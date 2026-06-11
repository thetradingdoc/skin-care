'use strict';

const express = require('express');
const { evaluatePatientLineup } = require('../services/patient-routine-evaluate-service');
const { buildBioProfileContext } = require('../services/patient-bio-profile-service');
const { resolveProductIdentityFromBarcode } = require('../services/product-identity-resolver');
const { extractActivesFromText, persistCanonicalIds } = require('../services/patient-lineup-resolver-service');

function registerPublicRoutineEvaluateRoutes(app, { apiLimiter, botGuard, db }) {
  const rateKey = new Map();

  function checkRate(ip) {
    const key = String(ip || 'anon').slice(0, 64);
    const now = Date.now();
    const row = rateKey.get(key) || { count: 0, reset: now + 3600000 };
    if (now > row.reset) {
      row.count = 0;
      row.reset = now + 3600000;
    }
    row.count += 1;
    rateKey.set(key, row);
    return row.count <= 20;
  }

  app.post(
    '/api/public/routine/evaluate',
    (req, res, next) => apiLimiter(req, res, next),
    botGuard,
    express.json({ limit: '32kb' }),
    async (req, res) => {
      try {
        const ip = req.ip || req.headers['x-forwarded-for'] || 'anon';
        if (!checkRate(ip)) {
          return res.status(429).json({ success: false, error: 'rate_limited' });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const products = Array.isArray(body.products) ? body.products.slice(0, 2) : [];
        if (products.length < 1) {
          return res.status(400).json({ success: false, error: 'products_required', max: 2 });
        }

        const bio = body.bio_profile && typeof body.bio_profile === 'object' ? body.bio_profile : null;
        const profileComplete = bio && Array.isArray(bio.conditions) && bio.conditions.length > 0;

        const steps = [];
        for (let i = 0; i < products.length; i += 1) {
          const p = products[i] || {};
          const text = [p.product_name, p.ingredients_text, p.barcode].filter(Boolean).join(' ');
          let ids = extractActivesFromText(text);
          if (p.barcode) {
            try {
              const resolved = await resolveProductIdentityFromBarcode(String(p.barcode).trim());
              if (resolved.success && resolved.normalized?.ingredients_text) {
                ids = extractActivesFromText(resolved.normalized.ingredients_text);
              }
            } catch (_) {}
          }
          steps.push({
            order: i,
            product_name: p.product_name || `Product ${i + 1}`,
            ingredient_ids: ids,
            wash_off: false,
            leave_on: true,
            role: 'treatment',
          });
        }

        const slots = [{ time: 'pm', step_order: 0, steps }];
        const graph = db.createIngredientConflictGraph?.();
        if (!graph) {
          return res.status(503).json({ success: false, error: 'graph_unavailable' });
        }

        const verdict = graph.evaluateRoutine(slots);
        const conflictCount = (verdict.conflicts || []).length;
        const teaser = {
          success: true,
          teaser: true,
          conflict_count: conflictCount,
          overall: verdict.overall,
          message:
            conflictCount > 0
              ? `${conflictCount} potential conflict${conflictCount === 1 ? '' : 's'} found`
              : 'No major conflicts detected',
          signup_required_for_detail: !profileComplete,
        };

        if (!profileComplete) {
          return res.json(teaser);
        }

        const { detectClassOverloads, computeBarrierMetrics } = require('../services/barrier-load-calculator');
        const classOverloads = detectClassOverloads(slots, products.map((p) => p.product_name || ''));
        const allConflicts = [...(verdict.conflicts || []), ...classOverloads];
        const barrier = computeBarrierMetrics(slots, allConflicts);

        return res.json({
          ...teaser,
          teaser: false,
          compatibility_score: verdict.overall === 'avoid' ? 24 : verdict.overall === 'caution' ? 55 : 85,
          barrier_friction_index: barrier.barrier_friction_index,
          conflicts: allConflicts,
          suggested_split: verdict.suggested_split,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
  );
}

module.exports = { registerPublicRoutineEvaluateRoutes };
