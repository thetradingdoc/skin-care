#!/usr/bin/env node
'use strict';

/**
 * Sync Cursor plan frontmatter FROM repo SSOT.
 *
 * SSOT: docs/product/agentic-tracker-plan-todos.yaml
 * Mirror: ~/.cursor/plans/agentic_medical_tracker_engine_852327e9.plan.md (frontmatter only)
 *
 * Never edit plan todos by hand — this script overwrites them.
 *
 * Usage:
 *   node middleware-platform/scripts/sync-agentic-plan-todos.cjs
 *   node middleware-platform/scripts/sync-agentic-plan-todos.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REPO_TODOS = path.join(ROOT, 'docs', 'product', 'agentic-tracker-plan-todos.yaml');
const PLAN =
  process.env.TOUCHE_PLAN_PATH ||
  path.join(
    process.env.HOME || '',
    '.cursor/plans/agentic_medical_tracker_engine_852327e9.plan.md',
  );
const DRY = process.argv.includes('--dry-run');

function parseTodos(text) {
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

function buildFrontmatter(todos) {
  const lines = [
    '---',
    'name: Agentic Medical Tracker Engine',
    'overview: "Medical-tracker agentic engine (v10). Todo status SSOT is docs/product/agentic-tracker-plan-todos.yaml — synced here by sync-agentic-plan-todos.cjs."',
    'todos:',
  ];
  for (const t of todos) {
    const content =
      t.content.includes(':') || t.content.includes('"')
        ? JSON.stringify(t.content)
        : t.content;
    lines.push(`  - id: ${t.id}`);
    lines.push(`    content: ${content}`);
    lines.push(`    status: ${t.status}`);
  }
  lines.push('isProject: false');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(REPO_TODOS)) {
    console.error('SSOT missing:', REPO_TODOS);
    process.exit(1);
  }
  const todos = parseTodos(fs.readFileSync(REPO_TODOS, 'utf8'));
  if (!todos.length) {
    console.error('SSOT has zero todos — refusing to wipe plan');
    process.exit(1);
  }
  const fm = buildFrontmatter(todos);
  if (!fs.existsSync(PLAN)) {
    console.error('Plan file missing:', PLAN);
    process.exit(1);
  }
  const existing = fs.readFileSync(PLAN, 'utf8');
  let body = existing;
  if (existing.startsWith('---')) {
    const parts = existing.split(/^---\n/m);
    // parts[0]='' parts[1]=fm parts[2]=body (or more if --- in body)
    if (parts.length >= 3) {
      body = parts.slice(2).join('---\n');
    }
  }
  const next = fm + body.replace(/^\n/, '');
  console.log(`SSOT todos: ${todos.length} → ${PLAN}`);
  if (DRY) {
    console.log(fm.slice(0, 400) + '...');
    return;
  }
  fs.writeFileSync(PLAN, next);
  console.log('Synced plan frontmatter from repo SSOT.');
}

main();
