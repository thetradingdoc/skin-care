'use strict';

/**
 * P5.10 — Calendar month/list over patient_record_facts (multi-type days).
 * A day with skin AND bill reports both tags — never collapses to one type.
 * Includes media_url on facts (same presentFact path as marks) so prior-photo
 * overlays can use this SSOT instead of journal/calendar-range.
 */

const factsRepo = require('../../repositories/patient-record-facts-repo');
const { presentFact } = require('../patient-record-media-access');

function requireOwner({ patientId, sessionId }) {
  if (!patientId && !sessionId) {
    const err = new Error('OWNER_REQUIRED');
    err.code = 'OWNER_REQUIRED';
    throw err;
  }
}

function factDate(fact) {
  const d = fact?.structured_json?.date || fact?.entry_date;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * @returns {{ success, days: [{ date, tags: string[], facts: [...] }] }}
 */
function buildFactsCalendar(db, { patientId = null, sessionId = null, start, end, month } = {}) {
  requireOwner({ patientId, sessionId });
  factsRepo.ensurePatientRecordFactsTable(db);

  let startIso = start;
  let endIso = end;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    startIso = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    endIso = `${month}-${String(last).padStart(2, '0')}`;
  }
  if (!startIso || !endIso) {
    const err = new Error('RANGE_REQUIRED');
    err.code = 'RANGE_REQUIRED';
    throw err;
  }

  const facts = factsRepo
    .listFacts(db, {
      patientId: patientId || null,
      sessionId: patientId ? null : sessionId,
      startIso,
      endIso,
      limit: 500,
    })
    .filter((f) => f.confirmed_at);

  const byDay = new Map();
  for (const f of facts) {
    const d = factDate(f);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, { date: d, tags: new Set(), facts: [] });
    const bucket = byDay.get(d);
    bucket.tags.add(f.tag);
    const presented = presentFact(f, { db });
    bucket.facts.push({
      id: f.id,
      tag: f.tag,
      ai_or_manual: f.ai_or_manual,
      compare_group_id: f.compare_group_id || null,
      media_url: presented?.media_url || null,
      media_url_expires_at: presented?.media_url_expires_at || null,
    });
  }

  const days = [...byDay.values()]
    .map((b) => ({
      date: b.date,
      tags: [...b.tags].sort(),
      multi_type: b.tags.size > 1,
      facts: b.facts,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    success: true,
    start: startIso,
    end: endIso,
    days,
    source: 'patient_record_facts',
  };
}

module.exports = { buildFactsCalendar };
