#!/usr/bin/env node
'use strict';

/**
 * Audit every plan todo marked `completed` for a corresponding test that would
 * fail if the work were reverted.
 *
 * Usage:
 *   node scripts/audit-phase02-completed-tests.cjs
 *     → all phases (whole-project; default since Phase 7 close)
 *   node scripts/audit-phase02-completed-tests.cjs --phases=0,1,2,4
 *   node scripts/audit-phase02-completed-tests.cjs --apply
 *   node scripts/audit-phase02-completed-tests.cjs --json
 */

const fs = require('fs');
const path = require('path');
const {
  resolveAuditPhases,
  phaseLabel,
} = require('./lib/audit-completed-tests-scope.cjs');

const ROOT = path.join(__dirname, '..', '..');
const REPO_TODOS = path.join(ROOT, 'docs', 'product', 'agentic-tracker-plan-todos.yaml');
/** Cursor plan is a generated mirror only — audit does NOT read it (avoids dual-SSOT drift). */
const PLAN_MIRROR =
  process.env.TOUCHE_PLAN_PATH ||
  path.join(
    process.env.HOME || '',
    '.cursor/plans/agentic_medical_tracker_engine_852327e9.plan.md',
  );

const APPLY = process.argv.includes('--apply');
const AS_JSON = process.argv.includes('--json');
/** null = every phase present in the YAML SSOT (full-project audit). */
const PHASES = resolveAuditPhases(process.argv);

/**
 * Task-specific needles. Prefer unique phrases from the guarding test.
 * If you add a regression test, add its distinctive string here.
 */
const EVIDENCE = {
  'p0-01': ['mobile-ux-audit-2026-07-14'],
  'p0-02': ['app-trytouche-live-audit-2026-07-14'],
  'p0-03': ['app-trytouche-domain-cutover-2026-07-14'],
  'p0-04': ['calendar-routines-shots-2026-07-15'],
  'p0-05': ['ux-audit-fixes'],
  'p0-06': ['capture-scan.tsx'],
  'p0-07': ['capture-upload.tsx'],
  'p0-08': ['capture-review.tsx'],
  'p0-09': ['capture-manual-bill.tsx'],
  'p0-10': ['capture-manual-payment.tsx'],
  'p0-11': ['capture-complete.tsx'],
  'p0-13': ['(tabs)/today.tsx'],
  'p0-14': ['(tabs)/timeline.tsx'],
  'p0-15': ['(tabs)/money.tsx'],
  'p0-16': ['P0.16 dead Stack registrations'],
  'p0-17': ['P0.17 no inventable Progress %'],
  'p0-18': ['P0.18 no hardcoded sparkline'],
  'p0-19': ['fabricated_pct_retired', 'never invents clarity/redness'],
  'p0-20': ['P0.20 TOUCHE_AGENTIC_ARCHITECTURE.md'],
  'p1-01': ['065_ai_capture_usage', 'ai_capture_usage'],
  'p1-02': ['066_ai_welcome_bonus', 'ai_welcome_bonus'],
  'p1-03': ['refundFailedIfNeeded restores monthly quota', 'tryConsume'],
  'p1-04': ['AI_FREE_CAPTURE_LIMIT', 'freeCaptureLimit'],
  'p1-05': ['AI_WELCOME_BONUS_LIMIT', 'welcomeBonusLimit'],
  'p1-06': ['AI_BURST_LIMIT_24H', 'burstLimit24h'],
  'p1-07': ['P1.07 face-read meter wiring', 'face_read_vision'],
  'p1-08': ['P1.08 weekly rescore meter wiring', 'weekly_photo_rescore'],
  'p1-09': ['P1.09 billing OCR meter wiring', 'billing_ocr'],
  'p1-10': ['AI_CAPTURE_LIMIT', "status).toBe(402)"],
  'p1-11': ['AI_BURST_LIMIT', "status).toBe(429)"],
  'p1-12': ['recordUsageTokens writes cost fields', 'estimated_usd'],
  'p1-13': ['Plus bypasses monthly', "source).toBe('plus')"],
  'p1-14': ['ai-capture-meter'],
  'p1-15': ['AI_FREE_CAPTURE_LIMIT', 'AI_WELCOME_BONUS_LIMIT', 'AI_BURST_LIMIT_24H'],
  'p2-01': ['067_patient_record_facts', 'patient_record_facts'],
  'p2-02': ['validateSkinStructured', 'skin requires date'],
  'p2-03': ['validateBillStructured'],
  'p2-04': ['validatePrescriptionStructured'],
  'p2-05': ['validateMarkStructured'],
  'p2-06': ['validateLabStructured', 'lab stores source_language'],
  'p2-07': ['validateOtherStructured'],
  'p2-08': ['P2.08 requireRecordTag', 'tag_invalid'],
  'p2-09': ['P2.09 requireRecordMediaType'],
  'p2-10': ['P2.10', '/api/patient/records/upload'],
  'p2-11': ['persistRecordMedia local fallback'],
  'p2-12': ['dualWriteJournalSkin', 'journal→skin'],
  'p2-13': ['dualWriteSpotMark', 'compare_group_id'],
  'p2-14': ['dualWriteBillingBill', 'billing→bill'],
  'p2-15': ['updateFactConfirm', 'P2.15/P2.16'],
  'p2-16': ['list by tag/range (P2.15/P2.16)', 'listFacts'],
  'p2-17': ['lab stores source_language and display_language (P2.17)'],
  'p2-18': ['detectLanguageStub returns stub:true'],
  'p2-19': ['patient-record-facts-repo (P2.19'],
  'p2-20': ['pending capture binding', 'createOrGetPending'],
  'p2-21': ['anonymous fact + pending', 'capture_token'],
  'p2-22': ['claim rebinds facts', 'claimPendingCaptures'],
  'p2-23': ['setPendingCaptureToken', 'patient-record-capture'],
  'p2-24': ['mergeOwnerUsage'],
  'p2-25': ['P2.25 pending TTL', 'expires_at'],
  'p2-26': ['purgeExpiredPendingCaptures'],
  'p2-27': ['P2.27 pre-auth binding', 'TOUCH-026 is NOT the binding pattern'],
  'p2-28': ['same request_id allowed for different owners (P2.28)', 'idempotent per owner'],
  'p2-29': ['presentFact redacts', 'redactStorageRef'],
  // Phase 3 — capture orchestration
  'p3-01': ['P3.01 Capture orchestration service entrypoint', 'orchestrateCapture'],
  'p3-02': ['P3.02 Pre-flight meter_guard', 'fails quality without consuming'],
  'p3-03': ['P3.03 quality gate', 'rejects empty buffer'],
  'p3-04': ['P3.04 Skin vision suggest', 'perceiveSkinVision'],
  'p3-05': ['P3.05 Doc OCR via patient-document-extraction', 'perceiveDocOcr'],
  'p3-06': ['gcs-billing-storage P3.06', 'downloadBuffer'],
  'p3-07': ['P3.07 billing-ocr-parser', 'parses amount and date'],
  'p3-08': ['P3.08 Structurer skin', 'skin keeps ai_suggestion separate'],
  'p3-09': ['P3.09 Structurer bill', 'bill from OCR text'],
  'p3-10': ['P3.10 Structurer prescription', 'prescription extracts drug'],
  'p3-11': ['P3.11 Structurer mark', 'mark mints compare_group_id'],
  'p3-12': ['P3.12 Structurer lab', 'lab includes language'],
  'p3-13': ['P3.13 Structurer other', 'other free_text confirm'],
  'p3-14': ['P3.14 Manual path creates fact', 'without metering'],
  'p3-15': ['P3.15 API POST /api/patient/records/capture', 'returning confirm draft'],
  'p3-16': ['P3.16 API POST /api/patient/records/:id/confirm', 'persisting user edits'],
  'p3-17': ['manual capture→confirm for tag %s (P3.17)', 'P3.17'],
  // Phase 4 — medical-tracker rails
  'p4-01': ['get_extract', 'normalize_facts', 'detect_language', 'P4.01 medical tool definitions'],
  'p4-02': ['medical allowlists are disjoint from shelf', 'CAPTURE_COMPOSE_TOOLS'],
  'p4-03': ['executor rejects shelf tools', 'TOOL_NOT_IN_MEDICAL_ALLOWLIST'],
  'p4-04': ['P4.04 manual capture_compose', 'runCaptureComposeSync'],
  'p4-05': ['P4.05 delta_compose writes AI SUGGESTS', 'ai_suggestion.delta', 'delta: \'baseline\'', 'first-ever skin log'],
  'p4-06': ['P4.06 meter_guard pre-node', 'meterGuardNode'],
  'p4-07': ['P4.07 export_pack is retrieval-only', 'ai_generated', 'narrative).toBeNull'],
  'p4-08': ['getMedicalCheckpointer', 'P4.08 checkpointer'],
  'p4-09': ['contentHash is stable', 'medical:capture_compose:', 'cacheScope', 'patient:'],
  'p4-10': ['P4.10 rejects diagnosis vocabulary', 'DIAGNOSIS_VOCABULARY'],
  'p4-11': ['P4.11 ai_suggestion must be object field', 'AI_SUGGESTION_MUST_BE_OBJECT'],
  'p4-12': [
    'P4.12 prescription compose rejects commerce_variant_id',
    'PRESCRIPTION_COMMERCE_FORBIDDEN',
    'prescription_commerce_forbidden',
  ],
  'p4-13': ['P4.13 consumer-analysis-graph does not import', 'runCaptureCompose'],
  'p4-14': [
    'FORBIDDEN_CONSUMER_CAPTURE_MODULES',
    'verify-medical-tracker-isolation',
    'kelly-conversation-graph',
  ],
  // Phase 5
  'p5-01': ['P5.01 evaluate-pair', 'detectAllergenHardNos'],
  'p5-02': ['P5.02 N-day-worse', 'queried_table', 'patient_record_facts'],
  'p5-03': ['P5.03 Rx expiry only when reminder_opt_in', 'skipped_opt_out'],
  'p5-04': ['P5.04 routine cadence negative', 'no opt-in'],
  'p5-05': ['P5.05 routine mode no longer gates', 'never block'],
  'p5-06': ['P5.06 PDF inherits export_pack narrative=null', '%PDF-'],
  'p5-07': ['P5.07 share link expires', 'SHARE_EXPIRED'],
  'p5-08': ['P5.08 honest aggregates', 'calmer_day_count'],
  'p5-09': ['P5.09 bill-only user has no skin key', "not.toHaveProperty('skin')"],
  'p5-10': ['P5.10 multi-type day', 'multi_type'],
  'p5-11': ['P5.11 marks list is ownership-scoped', 'cross-user leak'],
  'p5-12': ['P5.12 compare_group timeline', 'narrative).toBeNull'],
  'p5-13': ['P5.13 alerts home decision', 'empty_redirect_to_check_retired'],
  'p5-14': ['P5.14 alerts feed cannot leak', 'THEIRS'],
  'cf-1': [
    'CF-1 free-text note rejects clinical rephrase',
    'FREE_TEXT_CLINICAL_CONTENT',
    'AI_TEXT_NOT_ALLOWLISTED',
  ],
  'cf-2': ['CF-2 sync script only writes plan FROM yaml', 'writeFileSync(PLAN'],
  // Phase 6
  'p6-01': ['P6.01 ledger balance reconstructs', 'CREDITS_BALANCE_DRIFT'],
  'p6-02': ['P6.02 credit pack pricing_policy', 'STRIPE_PRICE_AI_CREDIT_PACK'],
  'p6-03': ['P6.03 Plus subscription wire', 'STRIPE_PRICE_PLUS'],
  'p6-04': [
    'P6.04 idempotent on Stripe event ID',
    'recordPaidMoneyFailure',
    'Signature verification failed',
  ],
  'p6-05': ['P6.05 activate Plus then deactivate', 're-enables metering'],
  'p6-06': ['P6.06 welcome bonus still issues', 'welcome_bonus'],
  'p6-07': ['P6.07 getUsage is SSOT', 'meter_source_of_truth'],
  'p6-08': ['P6.08 AI credits architecturally separate', 'SHOPIFY_SEPARATION'],
  'p6-09': ['P6.09 care_program not promoted', 'care_program_promoted: false'],
  // Phase 7
  'p7-01': ['P7.01 Restore visible 5-tab shell', 'auth-shell-five-tabs'],
  'p7-02': ['P7.02 Hide tab bar during active capture', 'shouldHideTabBar'],
  'p7-03': [
    'P7.03 Authenticated cold lander',
    'spot-only with zero spots no longer diverts',
  ],
  'p7-04': ['P7.04 Capture state machine', '2a→3→4→5→5b→6'],
  'p7-05': ['P7.05 Confirm UI field sets', 'confirm-bill-amount'],
  'p7-06': ['P7.06 Thesis variants', 'not one templated paragraph'],
  'p7-07': ['P7.07 Daily T5b AI SUGGESTS', 'screen-t5b-daily-ai-suggests'],
  'p7-08': ['P7.08 Shelf Buy vs Rx', 'shelf-rx-never-buy'],
  'p7-09': ['P7.09 Profile Language stub', 'screen-profile-language'],
  'p7-10': ['P7.10 Share with doctor wired', 'physician.pdf'],
  'p7-11': ['P7.11 Welcome copy states 20 AI reads', 'welcome-20-ai-reads'],
  'p7-12': ['P7.12 Capture copy photo or PDF', 'video not in this version'],
  'p7-13': [
    'P7.13 try-* Shopify funnel end-to-end',
    'try-verdict → allergens → reveal → handoff',
  ],
  'p7-14': ['P7.14 OTP + name collection', 'auth-name-input'],
  'p7-15': ['P7.15 Empty states Calendar Shelf Progress', 'progress-empty-t9b'],
  'p7-16': ['P7.16 AI cap T6 and unlock T8', 'screen-t6-ai-cap'],
  'p7-17': ['P7.17 Welcome bonus T7', 'screen-t7-welcome-bonus'],
  'p7-18': ['P7.18 skin uses pending-confirm', 'does that match what you see?'],
  'p7-19': ['P7.19 bill reveal owns', 'Saved —'],
  'p7-20': ['P7.20 rx reveal owns', 'Yes, remind me'],
  'p7-21': ['P7.21 mark reveal is its own file', 'Logged as "mark"'],
  'p7-22': ['P7.22 lab reveal is its own file', 'translation is coming'],
  'p7-23': ['P7.23 other reveal is its own file', 'Logged as "other"'],
  'p7-24': ['P7.24 Mark new-vs-existing picker', 'mark-picker-zero-existing'],
  'p7-25': ['P7.25 Compare-over-time mark UI', 'screen-mark-compare-over-time'],
  'p7-26': ['P7.26 multi-type day shows all tags', 'never collapses to one'],
  'p7-27': ['P7.27 list view component exists', 'calendar-list'],
  'p7-28': ['P7.28 legend is icon+color', 'icon and a color'],
  'p7-29': ['P7.29 empty T2b copy is locked', 'Nothing logged yet'],
  'p7-30': ['P7.30 day detail lists mixed', 'calendar-day-detail'],
  'p7-31': ['P7.31 Progress Alerts module', 'empty_redirect_to_check_retired'],
  'p7-32': ['P7.32 Shelf conflict/hard_no', 'shelf-conflict-hard-no-surface'],
  'p7-33': ['P7.33 Screen 2b camera denied', 'screen-2b-camera-denied'],
  'p7-34': ['P7.34 Screen 2c vision fail', 'screen-2c-vision-fail'],
  'p7-35': ['P7.35 Screen 2m manual entry', 'screen-2m-manual-entry'],
  'p7-36': ['P7.36 Screen 9 OPQRST-lite', 'screen-9-opqrst-lite'],
  'p7-37': ['P7.37 Screen 10 routine nudge', 'screen-10-routine-nudge'],
  'p7-38': ['P7.38 Screen 7b OTP entry', 'screen-7b-otp-entry'],
  'p7-39': ['P7.39 Screen 7c OTP error', 'screen-7c-otp-error'],
  'p7-40': ['P7.40 Profile allergens management', 'screen-profile-allergens'],
  'p7-41': ['P7.41 Profile notifications permission', 'screen-profile-notifications'],
  'p7-42': ['P7.42 Profile consent/privacy', 'screen-profile-consent-privacy'],
  'p7-43': ['P7.43 Rx refill info destination', 'screen-rx-refill-info'],
  'p7-44': ['P7.44 Track AI-reads-left chip', 'track-ai-reads-left-chip'],
  'p7-45': ['P7.45 Alerts history from Progress/Profile', 'progress-alerts-history'],
  'p7-46': ['P8.07 / P7.46 Shelf Ask/Learn live', 'shelf-ask-action'],
  'p7-47': ['P7.47 Alerts empty must not auto-redirect', 'empty_redirect_to_check_retired'],
  // Phase 8 — hardening
  'p8-01': ['P8.01 Burst guard UX', 'screen-t6b-ai-burst'],
  'p8-02': ['P8.02 AV scan on all capture uploads', 'AV_SCAN_BLOCKED'],
  'p8-03': ['P8.03 Retention policy enforced job', 'purgeExpiredPatientRecordMedia'],
  'p8-04': ['P8.04 HIPAA consumer doc reflects', 'patient_record_facts'],
  'p8-05': ['P8.05 OCR cost measurement', 'blended_p50_usd'],
  'p8-06': ['P8.06 Lab translate after English extract', 'deferred_mt_keeps_english_extract'],
  'p8-07': ['P8.07 Ask/Learn shelf LLM policy', 'DIAGNOSIS_VOCABULARY'],
  'p8-08': ['P8.08 Barcode depth — Rx never Buy', 'barcode-rx-never-buy'],
  'p8-09': ['P8.09 Accessibility VoiceOver', 'A11Y_MIN_TAP_PT'],
  'p8-10': ['P8.10 E2E Playwright rebuilt IA', 'medical-tracker-ia.spec'],
  'p8-11': ['P8.11 Bill multi-currency locale format', 'formatBillMoney'],
};

const EXTRA_ALLOWLIST_FILES = {
  'p1-15': [
    path.join(ROOT, 'middleware-platform', 'scripts', 'verify-prod-consumer-env.cjs'),
  ],
  'p8-04': [path.join(ROOT, 'docs', 'security', 'HIPAA_CONSUMER.md')],
  'p8-05': [
    path.join(ROOT, 'middleware-platform', 'scripts', 'measure-ai-capture-cost.cjs'),
  ],
  'p8-10': [
    path.join(ROOT, 'middleware-platform', 'e2e', 'medical-tracker-ia.spec.cjs'),
  ],
};

function parsePlanTodos(text) {
  const todos = [];
  const re = /- id: ([\w-]+)\n\s+content: (.+)\n\s+status: (\w+)/g;
  let m;
  while ((m = re.exec(text))) {
    todos.push({
      id: m[1],
      content: m[2].replace(/^"|"$/g, ''),
      status: m[3],
    });
  }
  return todos;
}

function loadTodos() {
  if (!fs.existsSync(REPO_TODOS)) {
    throw new Error(
      `Todo SSOT missing: ${REPO_TODOS}. Restore from git; sync Cursor plan with sync-agentic-plan-todos.cjs`,
    );
  }
  const text = fs.readFileSync(REPO_TODOS, 'utf8');
  const todos = parsePlanTodos(text);
  return { todos, sources: [REPO_TODOS] };
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'screenshots') continue;
      walkFiles(p, out);
    } else if (/\.(js|ts|tsx|cjs|mjs)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function loadCorpus() {
  const files = [
    ...walkFiles(path.join(ROOT, 'middleware-platform', '__tests__')),
    ...walkFiles(path.join(ROOT, 'patient-app', 'lib', '__tests__')),
  ];
  return files.map((f) => ({
    path: f,
    rel: path.relative(ROOT, f),
    text: fs.readFileSync(f, 'utf8'),
  }));
}

function phaseOf(id) {
  // Carried-forward Phase 4 review items closed in Phase 5
  if (id === 'cf-1' || id === 'cf-2') return 5;
  const m = String(id).match(/^p(\d+)-/);
  return m ? Number(m[1]) : null;
}

function findEvidence(todo, corpus) {
  const needles = EVIDENCE[todo.id];
  if (!needles || !needles.length) {
    return { verified: false, reason: 'no_evidence_map_entry', hits: [] };
  }

  const hits = [];
  for (const file of corpus) {
    for (const n of needles) {
      if (file.text.includes(n)) {
        hits.push({ file: file.rel, needle: n });
        break;
      }
    }
  }

  const extras = EXTRA_ALLOWLIST_FILES[todo.id] || [];
  for (const abs of extras) {
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const rel = path.relative(ROOT, abs);
    for (const n of needles) {
      if (text.includes(n)) {
        hits.push({ file: rel, needle: n });
        break;
      }
    }
  }

  if (!hits.length) {
    return { verified: false, reason: 'no_test_match', hits: [], needles };
  }
  return { verified: true, reason: 'evidence_match', hits: hits.slice(0, 5) };
}

function applyUnverified(planText, unverifiedIds) {
  let out = planText;
  for (const id of unverifiedIds) {
    const re = new RegExp(`(- id: ${id}\\n\\s+content: .+\\n\\s+status: )completed`);
    if (re.test(out)) out = out.replace(re, '$1unverified');
  }
  return out;
}

function main() {
  const { todos: allTodos, sources } = loadTodos();
  if (!sources.length) {
    console.error(`No todos SSOT found at ${REPO_TODOS}`);
    process.exit(2);
  }
  const todos = allTodos.filter((t) => {
    const ph = phaseOf(t.id);
    if (ph == null || t.status !== 'completed') return false;
    if (PHASES == null) return true;
    return PHASES.has(ph);
  });

  const corpus = loadCorpus();
  const results = todos.map((t) => {
    const ev = findEvidence(t, corpus);
    return {
      id: t.id,
      content: t.content,
      verified: ev.verified,
      reason: ev.reason,
      evidence: ev.hits,
      needles: ev.needles,
    };
  });

  const unverified = results.filter((r) => !r.verified);
  const verified = results.filter((r) => r.verified);

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          sources,
          phases: phaseLabel(PHASES) === 'all' ? 'all' : [...PHASES],
          totals: {
            completed: results.length,
            verified: verified.length,
            unverified: unverified.length,
          },
          unverified,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Completed audit (phases ${phaseLabel(PHASES)}) — ${results.length} items`);
    console.log(`  sources: ${sources.join(' | ')}`);
    console.log(`  verified: ${verified.length}`);
    console.log(`  unverified: ${unverified.length}`);
    if (unverified.length) {
      console.log('\nUNVERIFIED (completed with no matching test):');
      for (const r of unverified) {
        console.log(`  - ${r.id}: ${r.content.slice(0, 110)}`);
        console.log(`      reason: ${r.reason}`);
        if (r.needles) console.log(`      expected needles: ${r.needles.join(' | ')}`);
      }
    }
  }

  if (APPLY && unverified.length && fs.existsSync(REPO_TODOS)) {
    let next = fs.readFileSync(REPO_TODOS, 'utf8');
    next = applyUnverified(next, unverified.map((r) => r.id));
    fs.writeFileSync(REPO_TODOS, next);
    console.log(`\n--apply: marked ${unverified.length} item(s) status: unverified in ${REPO_TODOS}`);
  }

  process.exit(unverified.length ? 1 : 0);
}

main();
