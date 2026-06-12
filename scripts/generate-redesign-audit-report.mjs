#!/usr/bin/env node
/**
 * Merge mockup + live Playwright inventories into side-by-side audit report.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const MW = path.join(REPO_ROOT, 'middleware-platform');
const MOCKUP_JSON = path.join(MW, 'playwright-report', 'redesign-mockup-inventory.json');
const LIVE_JSON = path.join(MW, 'playwright-report', 'redesign-live-inventory.json');
const OUT_MD = path.join(REPO_ROOT, 'docs', 'patient-app/design', 'REDESIGN_V3_AUDIT_REPORT.md');

const GAP_ROWS = [
  ['Journey choose mode cards', 'Implemented', 'App has Continue CTA; mockup does not'],
  ['Track ATM 3 actions', 'Implemented', 'track.tsx'],
  ['Capture coin/body guide', 'Implemented', 'SpotCaptureFrame + BodyMapPicker'],
  ['Timeline photo thumbs', 'Implemented', 'SpotTimelineStrip renders SessionImage when URL present'],
  ['Growth size bars 55%→52%', 'Implemented', 'GrowthSummaryCard dynamic bars from size_signal'],
  ['Find a dermatologist', 'Implemented', 'Links to AAD URL'],
  ['Home BFI ring 62', 'API-driven', '/routine/evaluate'],
  ['Skip retinol step', 'API-driven', 'routine_step_states from evaluate'],
  ['Scan barcode animation', 'Implemented', 'Real camera vs mock CSS animation'],
  ['Verdict PHA fix', 'API-driven', 'suggested_fix from evaluate'],
  ['Progress Top 12%', 'API-driven', '/home/streak-percentile'],
  ['BFI 8-day grid', 'Implemented', 'Needs verdict-history API'],
  ['Dip insight 23pts', 'Implemented', 'pattern_count + drop_points in barrier-insight'],
  ['Improvement metric bars', 'API-driven', 'improvement_metrics from progress-summary'],
  ['Progress spot row', 'Implemented', 'spot-store + size stable label on SpotRowCard'],
  ['Profile tab screen', 'Missing from mockup', 'Account exists in app only'],
  ['HTML tab bars (40)', 'N/A', 'Decorative in static spec'],
  ['FEATURE_V3_INSIGHTS', 'Implemented', 'ProductInsightCard on Verdict when flag enabled'],
];

function loadJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const mockup = loadJson(MOCKUP_JSON);
  const live = loadJson(LIVE_JSON);
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });

  const lines = [];
  lines.push('# Redesign v3 Audit Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  if (mockup) {
    lines.push(`- **HTML mockup screens:** ${mockup.screenCount}`);
    lines.push(`- **Mockup tap targets:** ${mockup.summary?.totalButtons ?? 0} (all static / not configured)`);
    lines.push(`- **Mockup issues:** ${(mockup.summary?.issues || []).length} structural`);
  }
  if (live) {
    lines.push(`- **Live app screens tested:** ${live.screens?.length ?? 0}`);
    lines.push(`- **Live buttons:** pass ${live.summary?.passed ?? 0}, fail ${live.summary?.failed ?? 0}, skip ${live.summary?.skipped ?? 0}`);
  }
  lines.push('');

  lines.push('## HTML mockup — screens and functions');
  lines.push('');
  if (mockup?.screens) {
    for (const s of mockup.screens) {
      lines.push(`### ${s.index}. ${s.label}`);
      lines.push('');
      lines.push(`- **Intended route:** \`${s.intendedRoute}\``);
      lines.push(`- **Journey:** ${s.journey}`);
      lines.push('- **Functions:**');
      for (const f of s.functions || []) lines.push(`  - ${f}`);
      lines.push('- **Buttons / tap targets:**');
      for (const b of s.buttons || []) {
        lines.push(`  - \`${b.label.slice(0, 60)}\` — ${b.issue || 'static'}`);
      }
      lines.push('- **Mock data:**');
      lines.push('```json');
      lines.push(JSON.stringify(s.mockData, null, 2));
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('_Mockup inventory not found. Run `node scripts/playwright-redesign-mockup-audit.mjs`._');
    lines.push('');
  }

  lines.push('## Live patient-app — button results');
  lines.push('');
  if (live?.screens) {
    for (const s of live.screens) {
      lines.push(`### ${s.id}: ${s.label}`);
      lines.push('');
      lines.push(`- **Route:** \`${s.route}\``);
      if (s.mockupGap) lines.push(`- **Mockup gap:** ${s.mockupGap}`);
      if (s.mockDataVisible?.length) lines.push(`- **Mock-aligned data visible:** ${s.mockDataVisible.join(', ')}`);
      lines.push('| Button | Action | Result | Issue |');
      lines.push('|--------|--------|--------|-------|');
      for (const b of s.buttons || []) {
        lines.push(`| ${b.name} | ${b.action} | ${b.result} | ${b.issue || ''} |`);
      }
      lines.push('');
    }
  } else {
    lines.push('_Live inventory not found. Run playwright redesign-parity spec._');
    lines.push('');
  }

  lines.push('## Side-by-side gap analysis');
  lines.push('');
  lines.push('| Feature | Live status | Issue |');
  lines.push('|---------|-------------|-------|');
  for (const row of GAP_ROWS) {
    lines.push(`| ${row[0]} | ${row[1]} | ${row[2]} |`);
  }
  lines.push('');

  lines.push('## Mock data catalog (HTML hardcoded)');
  lines.push('');
  lines.push('| Domain | Values |');
  lines.push('|--------|--------|');
  lines.push('| Spot timeline | Neck spot, 18 days; Jun 1/8/13/Today; same/watch/alert tags |');
  lines.push('| Growth | Size appears stable; bars 55% → 52% |');
  lines.push('| Home | BFI 62, 2 conflicts, streak 14, skin age -5 |');
  lines.push('| Routine | Gentle cleanser safe; Retinol skip; Ceramide todo |');
  lines.push('| Scan shelf | CeraVe Retinol (Conflict), TO Niacinamide (Watch), LRP SPF (Safe) |');
  lines.push('| Verdict | CeraVe SA Cleanser 24/100; BHA+retinol; rosacea; PHA fix |');
  lines.push('| Progress | Streak 14, Top 12%; BFI grid 82,88,61,74,85,91,62,—; clarity +18%, redness -34%, age -5y |');
  lines.push('');

  lines.push('## Issues not configured');
  lines.push('');
  lines.push('### HTML mockup (expected)');
  lines.push('- All buttons are non-functional (no JS)');
  lines.push('- Tab bars do not navigate');
  lines.push('- Mode cards have no selection handler');
  lines.push('- CSS design tokens not loaded in standalone file');
  lines.push('');
  lines.push('### Live app gaps vs mockup');
  for (const row of GAP_ROWS.filter((r) => r[1] !== 'Implemented' && r[1] !== 'N/A')) {
    lines.push(`- **${row[0]}:** ${row[1]} — ${row[2]}`);
  }
  lines.push('');
  lines.push('## How to re-run');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/playwright-redesign-mockup-audit.mjs');
  lines.push('node scripts/build-consumer-hosting.cjs');
  lines.push('cd middleware-platform && npx playwright test --config playwright.redesign-parity.config.cjs');
  lines.push('node scripts/generate-redesign-audit-report.mjs');
  lines.push('```');

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log('Wrote', OUT_MD);
}

main();
