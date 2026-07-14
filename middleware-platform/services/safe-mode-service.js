'use strict';

/**
 * TOUCH-100 — Post-procedure safe-mode engine.
 * When within recovery window: suppress actives, expose recovery protocol, flag for clients.
 */

const DEFAULT_RECOVERY_DAYS = {
  laser: 7,
  peel: 10,
  microneedling: 7,
  injectables: 3,
  default: 10,
};

const ACTIVE_ID_RE =
  /retinol|tretinoin|retinal|adapalene|tazarotene|glycolic|lactic|mandelic|salicylic|ascorbic|benzoyl|aha|bha|retinoid/i;

function recoveryDaysFor(type, override) {
  if (override != null && Number.isFinite(Number(override)) && Number(override) > 0) {
    return Math.min(90, Math.round(Number(override)));
  }
  const key = String(type || 'default').toLowerCase().trim();
  return DEFAULT_RECOVERY_DAYS[key] || DEFAULT_RECOVERY_DAYS.default;
}

function parseIsoDateOnly(s) {
  const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysSince(procedureDate, now = new Date()) {
  const start = parseIsoDateOnly(procedureDate);
  if (!start) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - start.getTime()) / 86400000);
}

/**
 * @returns {{
 *   active: boolean,
 *   procedure_date: string|null,
 *   procedure_type: string|null,
 *   recovery_day: number|null,
 *   recovery_days_total: number,
 *   days_remaining: number|null,
 *   ambient_copy: string|null,
 *   recovery_protocol: string[],
 * }}
 */
function computeSafeMode(profile, now = new Date()) {
  const procedure_date = profile?.procedure_date || null;
  const procedure_type = profile?.procedure_type || null;
  const total = recoveryDaysFor(procedure_type, profile?.procedure_recovery_days);
  const day = daysSince(procedure_date, now);

  if (day == null || day < 0 || day >= total) {
    return {
      active: false,
      procedure_date,
      procedure_type,
      recovery_day: day,
      recovery_days_total: total,
      days_remaining: null,
      ambient_copy: null,
      recovery_protocol: [],
    };
  }

  const typeLabel = procedure_type ? String(procedure_type).replace(/_/g, ' ') : 'procedure';
  const recovery_day = day + 1; // day 1 = procedure day
  return {
    active: true,
    procedure_date,
    procedure_type,
    recovery_day,
    recovery_days_total: total,
    days_remaining: total - day,
    ambient_copy: `safe mode · ${typeLabel} day ${recovery_day}`,
    recovery_protocol: [
      'Gentle cleanser only',
      'Barrier moisturizer',
      'Broad-spectrum SPF (daytime)',
      'Skip actives until recovery window ends',
    ],
  };
}

function isActiveStep(step) {
  const name = String(step?.product_name || '');
  const ids = (step?.ingredient_ids || []).map(String).join(' ');
  const role = String(step?.role || '').toLowerCase();
  if (ACTIVE_ID_RE.test(name) || ACTIVE_ID_RE.test(ids)) return true;
  if (role === 'treatment' || role === 'serum' || role === 'acid') {
    return ACTIVE_ID_RE.test(name + ' ' + ids) || /retin|aha|bha|peel|acid/i.test(name);
  }
  return false;
}

/**
 * Mute actives in lineup slots while safe-mode is on.
 * Returns { slots, suppressed_steps }
 */
function applySafeModeToSlots(slots, safeMode) {
  if (!safeMode?.active) {
    return { slots: slots || [], suppressed_steps: [] };
  }
  const suppressed_steps = [];
  const next = (slots || []).map((slot) => {
    const steps = (slot.steps || []).map((st) => {
      if (!isActiveStep(st)) return st;
      suppressed_steps.push({
        product_name: st.product_name,
        reason: 'post_procedure_safe_mode',
      });
      return {
        ...st,
        safe_mode_suppressed: true,
        leave_on: false,
        role: 'suppressed',
        notes: 'Paused during post-procedure recovery',
      };
    });
    return { ...slot, steps };
  });
  return { slots: next, suppressed_steps };
}

module.exports = {
  DEFAULT_RECOVERY_DAYS,
  recoveryDaysFor,
  daysSince,
  computeSafeMode,
  applySafeModeToSlots,
  isActiveStep,
};
