'use strict';

const fs = require('fs');
const path = require('path');
const concernRoutineService = require('./concern-routine-service');

const VALID_CONCERNS = concernRoutineService.VALID_CONCERNS || new Set();
const DATA_PATH = path.join(__dirname, '../data/routines/all_routines.json');
const FALLBACK_PATH = path.join(__dirname, '../routines/concern-routines.json');

let _catalog = null;

function loadRawCatalog() {
  if (_catalog) return _catalog;
  const filePath = fs.existsSync(DATA_PATH) ? DATA_PATH : FALLBACK_PATH;
  _catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return _catalog;
}

function resetCatalogCache() {
  _catalog = null;
}

function enrichSources(program) {
  const sources = program?.sources && typeof program.sources === 'object' ? program.sources : {};
  const community = Array.isArray(sources.community) ? sources.community : [];
  const clinical = Array.isArray(sources.clinical) ? sources.clinical : [];
  return {
    community,
    clinical,
    community_count: community.length,
    clinical_count: clinical.length,
    total_count: community.length + clinical.length,
  };
}

function normalizeProgram(concernId, program) {
  if (!program) return null;
  const weeklySchedule = program.weekly_schedule || {};
  const weeks = concernRoutineService.expandWeeklySchedule(weeklySchedule);
  const sources = enrichSources(program);
  return {
    concern_id: concernId,
    concern: program.concern || concernId,
    skin_type: program.skin_type || null,
    fitzpatrick: program.fitzpatrick || null,
    total_weeks: Number(program.total_weeks) || 12,
    am_routine: program.am_routine || [],
    pm_routine: program.pm_routine || [],
    key_rules: program.key_rules || [],
    red_flags: program.red_flags || [],
    weekly_schedule: weeklySchedule,
    weekly_schedule_weeks: weeks,
    sources,
    rag_version: program.rag_version || '1',
  };
}

function getRoutineForConcern(concernId) {
  const id = String(concernId || '').trim();
  if (!VALID_CONCERNS.has(id)) return null;
  const catalog = loadRawCatalog();
  return normalizeProgram(id, catalog[id]);
}

function listConcerns() {
  return concernRoutineService.listConcerns();
}

function isSkinragEnabled() {
  const v = String(process.env.FEATURE_SKINRAG_ROUTINES || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

module.exports = {
  getRoutineForConcern,
  listConcerns,
  normalizeProgram,
  loadRawCatalog,
  resetCatalogCache,
  isSkinragEnabled,
  DATA_PATH,
};
