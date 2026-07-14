'use strict';

function registerPatientShelfRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    ensureRoutineTables,
    ensureBillingTables,
    ensurePatientShelfInventoryColumns,
    loadPatientShelfProductRows,
    formatShelfProductApiRow,
    parseBillingDocumentUpload,
    safeParseJsonArray,
    isIsoDateOnly,
    localDateFromIso,
    isoFromLocalDate,
    weekdayKeyForIsoLocal,
    enumerateIsoDates,
    issuePatientDocumentDownloadUrl,
    fetchBillingAggregatesByDay,
    fieldsFromSqlAggRow,
    PatientPortalService,
    billingOk,
    billingErr,
    resolveBillingSubscription,
    requirePlusForBillingFeature,
    getPatientStep3Status,
    ensureProductsPhase2Tables,
    blockWalletWhenDisabled,
    blockChatWhenDisabled,
    isPatientWalletEnabled,
    isPatientChatEnabled,
    parseBooleanFlag,
    withIdempotency,
    assertPatientOwnsAppointmentOrThrow,
    validatePatientAvailableSlotsQuery,
    validatePatientBookingScheduleBody,
    validatePatientTriageBody,
    requireCsrfForCookieAuth,
    auditBookingEvent,
    botGuard,
    authLimiter,
    otpSendLimiter,
    otpConfirmLimiter,
  } = deps;
  

app.get('/api/patient/shelf/products', (req, res, next) => apiLimiter(req, res, next), requirePatientSession, async (req, res) => {
  try {
    ensurePatientShelfInventoryColumns();
    const sessionId = req.patientSessionId;
    const rows = loadPatientShelfProductRows(sessionId);
    const products = rows.map((r) => formatShelfProductApiRow(r));
    return res.json({ success: true, products });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.patch('/api/patient/shelf/products/:productId', (req, res, next) => apiLimiter(req, res, next), express.json(), requirePatientSession, async (req, res) => {
  try {
    ensurePatientShelfInventoryColumns();
    const sessionId = req.patientSessionId;
    const productId = String(req.params.productId || '').trim();
    if (!productId) return res.status(400).json({ success: false, error: 'product id required' });
    const row = db.db.prepare(`SELECT id FROM patient_onboarding_step3_products WHERE id = ? AND session_id = ?`).get(productId, sessionId);
    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(body, 'opened_date')) {
      const v = body.opened_date == null || body.opened_date === '' ? null : String(body.opened_date).trim();
      if (v && !isIsoDateOnly(v)) return res.status(400).json({ success: false, error: 'opened_date must be YYYY-MM-DD' });
      updates.push('opened_date = ?');
      params.push(v);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'expiry_date')) {
      const v = body.expiry_date == null || body.expiry_date === '' ? null : String(body.expiry_date).trim();
      if (v && !isIsoDateOnly(v)) return res.status(400).json({ success: false, error: 'expiry_date must be YYYY-MM-DD' });
      updates.push('expiry_date = ?');
      params.push(v);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'pao_months')) {
      const n = body.pao_months == null || body.pao_months === '' ? null : Number(body.pao_months);
      if (n != null && (!Number.isFinite(n) || n < 0 || n > 120)) {
        return res.status(400).json({ success: false, error: 'pao_months must be between 0 and 120' });
      }
      updates.push('pao_months = ?');
      params.push(n);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'inventory_status')) {
      const st = String(body.inventory_status || '').trim().toLowerCase();
      if (!['stock', 'opened', 'finished'].includes(st)) {
        return res.status(400).json({ success: false, error: 'inventory_status must be stock, opened, or finished' });
      }
      updates.push('inventory_status = ?');
      params.push(st);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'price_usd')) {
      const p = body.price_usd == null || body.price_usd === '' ? null : Number(body.price_usd);
      if (p != null && (!Number.isFinite(p) || p < 0)) {
        return res.status(400).json({ success: false, error: 'price_usd must be a non-negative number' });
      }
      updates.push('price_usd = ?');
      params.push(p);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'cost_per_use')) {
      const p = body.cost_per_use == null || body.cost_per_use === '' ? null : Number(body.cost_per_use);
      if (p != null && (!Number.isFinite(p) || p < 0)) {
        return res.status(400).json({ success: false, error: 'cost_per_use must be a non-negative number' });
      }
      updates.push('cost_per_use = ?');
      params.push(p);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'key_ingredients')) {
      const k = body.key_ingredients == null ? null : String(body.key_ingredients).trim().slice(0, 2000);
      updates.push('key_ingredients = ?');
      params.push(k);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'display_color')) {
      const dc = body.display_color == null || body.display_color === '' ? null : String(body.display_color).trim();
      if (dc && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(dc) && !/^hsl\(/i.test(dc)) {
        return res.status(400).json({ success: false, error: 'display_color must be #hex or hsl(...)' });
      }
      updates.push('display_color = ?');
      params.push(dc);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    updates.push('updated_at = datetime(\'now\')');
    params.push(productId, sessionId);
    db.db.prepare(`UPDATE patient_onboarding_step3_products SET ${updates.join(', ')} WHERE id = ? AND session_id = ?`).run(...params);
    const fresh = db.db.prepare(`
      SELECT id, selection_mode, catalog_product_id, custom_product_name, custom_brand, category, usage_time,
        frequency_rule, days_of_week_json, goal, opened_date, expiry_date, pao_months, inventory_status,
        price_usd, cost_per_use, key_ingredients, display_color, verdict_status, kept_despite_conflict, updated_at
      FROM patient_onboarding_step3_products WHERE id = ? AND session_id = ?
    `).get(productId, sessionId);
    return res.json({ success: true, product: formatShelfProductApiRow(fresh) });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/patient/shelf/products/:productId/link-routine-item', (req, res, next) => apiLimiter(req, res, next), express.json(), requirePatientSession, async (req, res) => {
  try {
    ensureRoutineTables();
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    const productId = String(req.params.productId || '').trim();
    const templateItemId = String(req.body?.template_item_id || '').trim();
    if (!productId || !templateItemId) {
      return res.status(400).json({ success: false, error: 'productId and template_item_id required' });
    }
    const shelfRow = db.db.prepare(`SELECT id FROM patient_onboarding_step3_products WHERE id = ? AND session_id = ?`).get(productId, sessionId);
    if (!shelfRow) return res.status(404).json({ success: false, error: 'Product not found' });
    const whereSql = patientId
      ? `WHERE (patient_id = ? OR session_id = ?) AND is_active = 1`
      : `WHERE session_id = ? AND is_active = 1`;
    const tParams = patientId ? [patientId, sessionId] : [sessionId];
    const template = db.db.prepare(`SELECT id FROM patient_routine_templates ${whereSql} ORDER BY datetime(updated_at) DESC LIMIT 1`).get(...tParams);
    if (!template) return res.status(400).json({ success: false, error_code: 'NO_TEMPLATE', error: 'No active routine template.' });
    const item = db.db.prepare(`SELECT id FROM patient_routine_template_items WHERE id = ? AND template_id = ? AND is_active = 1`).get(templateItemId, template.id);
    if (!item) return res.status(404).json({ success: false, error: 'Template item not found' });
    db.db.prepare(`
      UPDATE patient_routine_template_items
      SET source_type = 'shelf', source_ref_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(productId, templateItemId);
    return res.json({ success: true, template_item_id: templateItemId, shelf_product_id: productId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/patient/shelf/products', (req, res, next) => apiLimiter(req, res, next), express.json(), requirePatientSession, async (req, res) => {
  try {
    ensurePatientShelfInventoryColumns();
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const name = String(body.product_name || body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'product_name required' });
    const usageTime = String(body.usage_time || 'pm').trim();
    const category = String(body.category || 'treatment').trim();
    const ingredientsText = body.ingredients_text ? String(body.ingredients_text) : null;
    const { extractActivesFromText, persistCanonicalIds } = require('../services/patient-lineup-resolver-service');
    const ids = extractActivesFromText(`${name} ${ingredientsText || ''} ${body.key_ingredients || ''}`);
    const id = `shelf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.db.prepare(`
      INSERT INTO patient_onboarding_step3_products (
        id, session_id, patient_id, selection_mode, custom_product_name, custom_brand,
        category, usage_time, goal, key_ingredients, ingredients_text, ingredient_canonical_ids_json
      ) VALUES (?, ?, ?, 'custom', ?, ?, ?, ?, 'conflict_track', ?, ?, ?)
    `).run(
      id,
      sessionId,
      patientId || null,
      name,
      body.brand ? String(body.brand) : null,
      category,
      usageTime,
      body.key_ingredients ? String(body.key_ingredients).slice(0, 2000) : null,
      ingredientsText,
      JSON.stringify(ids)
    );
    persistCanonicalIds(db.db, id, ids);
    const row = loadPatientShelfProductRows(sessionId).find((r) => r.id === id);
    return res.json({ success: true, product: formatShelfProductApiRow(row) });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/patient/shelf/products/scan', (req, res, next) => apiLimiter(req, res, next), express.json(), requirePatientSession, async (req, res) => {
  try {
    ensurePatientShelfInventoryColumns();
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    const barcode = String(req.body?.barcode || '').trim();
    if (!barcode) return res.status(400).json({ success: false, error: 'barcode required' });
    const { resolveProductIdentityFromBarcode } = require('../services/product-identity-resolver');
    const resolved = await resolveProductIdentityFromBarcode(barcode);
    if (!resolved.success) {
      return res.status(404).json({ success: false, error: 'product_not_found', barcode });
    }
    const n = resolved.normalized;
    const productName = n.product_name || `Product ${barcode}`;
    const { extractActivesFromText, persistCanonicalIds } = require('../services/patient-lineup-resolver-service');
    const ids = extractActivesFromText(n.ingredients_text || productName);
    const id = `shelf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.db.prepare(`
      INSERT INTO patient_onboarding_step3_products (
        id, session_id, patient_id, selection_mode, catalog_product_id, custom_product_name,
        category, usage_time, goal, ingredients_text, barcode, ingredient_canonical_ids_json, key_ingredients
      ) VALUES (?, ?, ?, 'catalog', ?, ?, 'treatment', ?, 'conflict_track', ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      patientId || null,
      `obf:${barcode}`,
      productName,
      String(req.body?.usage_time || 'pm'),
      n.ingredients_text || null,
      barcode,
      JSON.stringify(ids),
      (n.ingredients_text || '').slice(0, 200)
    );
    persistCanonicalIds(db.db, id, ids);
    const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
    const evaluate = await evaluateWithGraph(db.db, { sessionId, patientId, highlightProductId: id });
    if (typeof recordPatientPortalEvent === 'function') {
      recordPatientPortalEvent(req, 'shelf.scan', { barcode, product_id: id });
    }
    const row = loadPatientShelfProductRows(sessionId).find((r) => r.id === id);
    return res.json({
      success: true,
      product: formatShelfProductApiRow(row),
      evaluate,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/patient/shelf/evaluate-pair', (req, res, next) => apiLimiter(req, res, next), express.json(), requirePatientSession, async (req, res) => {
  try {
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    const ids = Array.isArray(req.body?.product_ids) ? req.body.product_ids.map(String).slice(0, 2) : [];
    if (ids.length < 1) return res.status(400).json({ success: false, error: 'product_ids required' });
    const highlightId = String(req.body?.highlight_product_id || ids[0] || '').trim();
    const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
    const result = await evaluateWithGraph(db.db, {
      sessionId,
      patientId,
      highlightProductId: highlightId || null,
    });
    if (typeof recordPatientPortalEvent === 'function' && result.success) {
      recordPatientPortalEvent(req, 'conflict.evaluate.request', {
        overall: result.overall,
        compatibility_score: result.compatibility_score,
        conflict_count: (result.conflicts || []).length,
        highlight_product_id: highlightId,
        source: 'evaluate_pair',
      });
      const bfi = Number(result.barrier_friction_index);
      if (Number.isFinite(bfi)) {
        if (bfi < 60) recordPatientPortalEvent(req, 'bfi.critical', { barrier_friction_index: bfi });
        else if (bfi < 80) recordPatientPortalEvent(req, 'bfi.elevated', { barrier_friction_index: bfi });
      }
    }
    return res.json({ success: true, ...result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/patient/shelf/products/:productId/insight', (req, res, next) => apiLimiter(req, res, next), requirePatientSession, async (req, res) => {
  try {
    const { isV3InsightsEnabled } = require('../services/consumer-insight-service');
    const { composeProductInsightWithGraph } = require('../services/consumer-insight-graph');
    if (!isV3InsightsEnabled()) {
      return res.json({ success: true, insight: null, feature_enabled: false });
    }
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    const productId = String(req.params.productId || '').trim();
    const rows = loadPatientShelfProductRows(sessionId);
    const product = rows.find((r) => String(r.id) === productId);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
    const evaluate = await evaluateWithGraph(db.db, { sessionId, patientId, highlightProductId: productId });

    const bio = require('../services/patient-bio-profile-service');
    const bioProfile = bio.getBioProfile(db.db, { sessionId, patientId });

    let phaseLabel = null;
    try {
      ensureRoutineTables();
      const template = db.db.prepare(`
        SELECT id, start_date, concern_id, metadata_json FROM patient_routine_templates
        WHERE session_id = ? AND is_active = 1 ORDER BY datetime(updated_at) DESC LIMIT 1
      `).get(sessionId);
      if (template) {
        const concernRoutineService = require('../services/concern-routine-service');
        let program = null;
        if (template.metadata_json) {
          try { program = JSON.parse(String(template.metadata_json)); } catch (_) { program = null; }
        }
        if (!program && template.concern_id) program = concernRoutineService.getConcernProgram(template.concern_id);
        if (program) {
          const todayIso = new Date().toISOString().slice(0, 10);
          const phase = concernRoutineService.resolveCurrentPhase(program, template.start_date, todayIso);
          phaseLabel = phase?.label || phase?.focus || null;
        }
      }
    } catch (_) {}

    const insight = await composeProductInsightWithGraph(db.db, {
      sessionId,
      patientId,
      productId,
      product,
      evaluate,
      bioProfile,
      phaseLabel,
      loadShelfRows: (sid) => loadPatientShelfProductRows(sid),
    });
    return res.json({ success: true, insight, feature_enabled: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/patient/shelf/products/:productId/verdict-action', (req, res, next) => apiLimiter(req, res, next), express.json(), requirePatientSession, async (req, res) => {
  try {
    ensurePatientShelfInventoryColumns();
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    const productId = String(req.params.productId || '').trim();
    const action = String(req.body?.action || '').trim().toLowerCase();
    const row = db.db.prepare(`SELECT id FROM patient_onboarding_step3_products WHERE id = ? AND session_id = ?`).get(productId, sessionId);
    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });
    if (action === 'remove') {
      db.db.prepare(`UPDATE patient_onboarding_step3_products SET inventory_status = 'finished', updated_at = datetime('now') WHERE id = ?`).run(productId);
    } else if (action === 'keep') {
      db.db.prepare(`UPDATE patient_onboarding_step3_products SET kept_despite_conflict = 1, verdict_status = 'kept', updated_at = datetime('now') WHERE id = ?`).run(productId);
    } else {
      return res.status(400).json({ success: false, error: 'action must be remove or keep' });
    }
    if (typeof recordPatientPortalEvent === 'function') {
      recordPatientPortalEvent(req, 'shelf.verdict_action', { product_id: productId, action });
    }
    const { evaluateWithGraph } = require('../services/consumer-analysis-graph');
    const evaluate = await evaluateWithGraph(db.db, { sessionId, patientId, highlightProductId: productId });
    return res.json({ success: true, action, evaluate });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});
}

module.exports = { registerPatientShelfRoutes };
