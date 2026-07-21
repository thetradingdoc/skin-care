'use strict';

const { getConsumerProfile, toApiProfile } = require('../../repositories/consumer-profile-repo');
const { listSpots } = require('../../repositories/spot-repo');
const { findBarrierDip } = require('../barrier-insight-service');
const { getChunksForRoutineVerdict } = require('../ingredient-rag-chunks-service');
const { runEvaluatePipelineSync } = require('../consumer-evaluate-nodes');
const {
  getMarkFacts,
  getProtocolAdherence,
  getDayCounts,
} = require('../progress-kelly-tools');

async function executeTool(name, args, ctx) {
  const { db, sessionId, patientId, productId, loadShelfRows } = ctx;

  switch (name) {
    case 'get_consumer_profile': {
      const profile = await getConsumerProfile(db, { sessionId, patientId });
      return { success: true, profile: toApiProfile(profile) };
    }
    case 'get_bio_profile': {
      const bio = require('../patient-bio-profile-service');
      const profile = bio.getBioProfile(db, { sessionId, patientId });
      return { success: true, profile };
    }
    case 'get_shelf_products': {
      const rows = typeof loadShelfRows === 'function' ? loadShelfRows(sessionId) : [];
      return {
        success: true,
        products: (rows || []).map((r) => ({
          id: r.id,
          product_name: r.custom_product_name || r.catalog_product_id,
          usage_time: r.usage_time,
        })),
      };
    }
    case 'evaluate_lineup': {
      const result = runEvaluatePipelineSync(db, {
        sessionId,
        patientId,
        highlightProductId: productId || null,
      });
      return { success: true, evaluate: result };
    }
    case 'get_barrier_insight': {
      const insight = findBarrierDip(db, { sessionId, patientId });
      return { success: true, insight };
    }
    case 'get_active_spots': {
      const spots = await listSpots(db, { sessionId, patientId });
      return {
        success: true,
        spots: (spots || []).map((s) => ({
          id: s.id,
          label: s.label,
          photo_count: (s.photos || []).length,
        })),
      };
    }
    case 'retrieve_ingredient_monographs': {
      const chunks = getChunksForRoutineVerdict(
        {
          conflicts: [
            {
              ingredient_a: args?.ingredient_a || 'retinol',
              ingredient_b: args?.ingredient_b || 'salicylic acid',
            },
          ],
        },
        db,
      );
      return { success: true, snippets: (chunks || []).slice(0, 3) };
    }
    case 'get_routine_phase': {
      let phaseLabel = null;
      try {
        const template = db
          .prepare(
            `SELECT id, start_date, concern_id, metadata_json FROM patient_routine_templates
             WHERE session_id = ? AND is_active = 1 ORDER BY datetime(updated_at) DESC LIMIT 1`,
          )
          .get(sessionId);
        if (template) {
          const concernRoutineService = require('../concern-routine-service');
          let program = null;
          if (template.metadata_json) {
            try {
              program = JSON.parse(String(template.metadata_json));
            } catch (_) {
              program = null;
            }
          }
          if (!program && template.concern_id) {
            program = concernRoutineService.getConcernProgram(template.concern_id);
          }
          if (program) {
            const todayIso = new Date().toISOString().slice(0, 10);
            const phase = concernRoutineService.resolveCurrentPhase(
              program,
              template.start_date,
              todayIso,
            );
            phaseLabel = phase?.label || phase?.focus || null;
          }
        }
      } catch (_) {}
      return { success: true, phase_label: phaseLabel };
    }
    case 'get_product_details': {
      const pid = args?.product_id || productId;
      const rows = typeof loadShelfRows === 'function' ? loadShelfRows(sessionId) : [];
      const product = (rows || []).find((r) => String(r.id) === String(pid));
      if (!product) return { success: false, error: 'product_not_found' };
      return {
        success: true,
        product: {
          id: product.id,
          product_name: product.custom_product_name || product.catalog_product_id,
          ingredients_text: product.ingredients_text || null,
          usage_time: product.usage_time,
        },
      };
    }
    case 'get_mark_facts': {
      return getMarkFacts(db, {
        markId: args?.mark_id,
        patientId: patientId || args?.user_id || null,
      });
    }
    case 'get_protocol_adherence': {
      return getProtocolAdherence(db, {
        userId: args?.user_id,
        patientId,
        sessionId,
        windowDays: args?.window_days,
      });
    }
    case 'get_day_counts': {
      return getDayCounts(db, {
        userId: args?.user_id,
        patientId,
        markId: args?.mark_id,
      });
    }
    default:
      return { success: false, error: `unknown_tool:${name}` };
  }
}

module.exports = { executeTool };
