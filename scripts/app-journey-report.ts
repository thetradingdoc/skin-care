/**
 * Incremental markdown writer for screenshots/ux-audit.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StepKind, UxCheckResult } from './app-journey-ux-checks.ts';
import { manualChecklistFor } from './app-journey-ux-checks.ts';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCREENSHOTS_DIR = path.join(rootDir, 'screenshots');
export const REPORT_PATH = path.join(SCREENSHOTS_DIR, 'ux-audit.md');

export type StepStatus = 'succeeded' | 'skipped' | 'failed';

export type StepRecord = {
  index: string;
  slug: string;
  project: 'desktop' | 'mobile';
  status: StepStatus;
  reason?: string;
  screenshotRel?: string;
  checks?: UxCheckResult;
  kind: StepKind;
};

const records: StepRecord[] = [];

export function appPath(route: string): string {
  const raw = process.env.APP_PATH_PREFIX;
  // Default /app for consumer hosting; set APP_PATH_PREFIX= (empty) for Expo web
  const prefix = raw === undefined ? '/app' : raw.replace(/\/$/, '');
  const r = route.startsWith('/') ? route : `/${route}`;
  if (!prefix) return r;
  return `${prefix}${r}`;
}

export function ensureScreenshotDirs(): void {
  fs.mkdirSync(path.join(SCREENSHOTS_DIR, 'desktop'), { recursive: true });
  fs.mkdirSync(path.join(SCREENSHOTS_DIR, 'mobile'), { recursive: true });
}

export function screenshotPath(project: 'desktop' | 'mobile', index: string, slug: string): string {
  return path.join(SCREENSHOTS_DIR, project, `${index}-${slug}.png`);
}

export function recordStep(rec: StepRecord): void {
  const i = records.findIndex((r) => r.project === rec.project && r.index === rec.index);
  if (i >= 0) records[i] = rec;
  else records.push(rec);
  writeReport();
}

function yesNo(v: boolean | 'skipped'): string {
  if (v === 'skipped') return 'skipped';
  return v ? 'YES' : 'NO';
}

function formatIcons(v: string[] | 'skipped'): string {
  if (v === 'skipped') return 'check skipped - page load failed';
  if (!v.length) return 'none found';
  return v.map((s) => `\`${s}\``).join(', ');
}

function formatAxe(c: UxCheckResult): string {
  if (c.axeViolationCount === 'skipped' || c.axeTop3 === 'skipped') {
    return 'check skipped - page load failed';
  }
  if (c.axeViolationCount === 0) return 'none';
  return `${c.axeViolationCount} — ${c.axeTop3.join('; ')}`;
}

function writeReport(): void {
  ensureScreenshotDirs();
  const desktop = records.filter((r) => r.project === 'desktop').sort((a, b) => a.index.localeCompare(b.index));
  const byKey = new Map(desktop.map((r) => [`${r.index}-${r.slug}`, r]));

  const summaryRows = desktop.map((r) => {
    const flags = r.checks?.flags?.length ? r.checks.flags.join('; ') : r.status === 'failed' ? r.reason || 'failed' : '—';
    const manual = 'Y';
    const link = r.screenshotRel ? `[png](${r.screenshotRel})` : '—';
    return `| ${r.index}-${r.slug} | ${flags} | ${manual} | ${link} |`;
  });

  const sections = desktop.map((r) => {
    const mobileTwin = `mobile/${r.index}-${r.slug}.png`;
    const img = r.screenshotRel ? `![screenshot](${r.screenshotRel})` : '_no screenshot_';
    const c = r.checks;
    const checklist = manualChecklistFor(r.kind)
      .map((item) => `     - [ ] ${item}`)
      .join('\n');

    const extra: string[] = [];
    if (c?.loadingStateNote) extra.push(`- Loading state: ${c.loadingStateNote}`);
    if (c?.uploadFallbackNote) extra.push(`- Upload fallback: ${c.uploadFallbackNote}`);
    if (c?.commerceConflict != null) {
      extra.push(`- Commerce conflict (Subscribe + trytouche): ${c.commerceConflict ? 'YES' : 'NO'}`);
    }
    if (c?.emptyStateNote) extra.push(`- Empty state: ${c.emptyStateNote}`);
    if (c?.streakCopy) extra.push(`- Streak copy: “${c.streakCopy}”`);
    if (r.status !== 'succeeded') {
      extra.push(`- Step status: **${r.status}**${r.reason ? ` — ${r.reason}` : ''}`);
    }

    return [
      `## ${r.index} - ${r.slug}`,
      '',
      img,
      '',
      `_Mobile twin: \`${mobileTwin}\`_`,
      '',
      `- Disclaimer present: ${c ? yesNo(c.disclaimerPresent) : 'skipped'}`,
      `- Progress indicator: ${c?.progressIndicator ?? 'N/A'} _(app onboarding has no FunnelShell Step X of Y)_`,
      `- Icon-only buttons missing labels: ${c ? formatIcons(c.iconOnlyMissingLabels) : 'skipped'}`,
      `- Axe violations: ${c ? formatAxe(c) : 'skipped'}`,
      ...extra,
      `- Manual review flags:`,
      checklist,
      '',
    ].join('\n');
  });

  const flagged = desktop
    .filter((r) => (r.checks?.flags?.length ?? 0) >= 2 || r.status === 'failed')
    .map((r) => ({
      name: `${r.index}-${r.slug}`,
      count: r.checks?.flags?.length ?? (r.status === 'failed' ? 2 : 0),
      flags: r.checks?.flags ?? [r.reason || 'failed'],
    }))
    .sort((a, b) => b.count - a.count);

  const topIssues =
    flagged.length === 0
      ? '_No steps with 2+ automated flags yet._'
      : flagged
          .map((f) => `- **${f.name}** (${f.count}): ${f.flags.join('; ')}`)
          .join('\n');

  const succeeded = records.filter((r) => r.status === 'succeeded').length;
  const skipped = records.filter((r) => r.status === 'skipped').length;
  const failed = records.filter((r) => r.status === 'failed').length;

  const md = [
    '# App journey UX audit (patient-app only)',
    '',
    `_Generated incrementally by \`scripts/app-journey-screenshots.spec.ts\`._`,
    '',
    '**Not in scope:** marketing landing, web `/scan` funnel, `.sc-hero-cta`.',
    '',
    `**Run totals (all projects):** succeeded ${succeeded} · skipped ${skipped} · failed ${failed}`,
    '',
    '## Summary',
    '',
    '| Step | Automated flags | Manual review | Screenshot |',
    '|------|-----------------|---------------|------------|',
    ...summaryRows,
    '',
    ...sections,
    '## Top issues',
    '',
    topIssues,
    '',
    '## Notes',
    '',
    '- Progress indicator is **N/A** for in-app onboarding (no FunnelShell).',
    '- Upload fallback is **expected absent** on `/onboarding/scan`; flagged as product gap vs web funnel.',
    '- Face-oval reliability cannot be automated — left in manual checklist.',
    `- Desktop steps recorded: ${byKey.size}`,
    '',
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, md, 'utf8');
}

export function printFinalSummary(): void {
  const lines = records.map(
    (r) => `  [${r.project}] ${r.index}-${r.slug}: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`,
  );
  console.log('\n=== App journey screenshot summary ===');
  console.log(lines.join('\n'));
  const s = records.filter((r) => r.status === 'succeeded').length;
  const k = records.filter((r) => r.status === 'skipped').length;
  const f = records.filter((r) => r.status === 'failed').length;
  console.log(`Totals: succeeded=${s} skipped=${k} failed=${f}`);
  console.log(`Report: ${REPORT_PATH}\n`);
}
