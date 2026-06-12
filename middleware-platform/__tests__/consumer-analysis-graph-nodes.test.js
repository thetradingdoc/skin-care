'use strict';

const Database = require('better-sqlite3');
const {
  loadConsumerContextSync,
  resolveLineupSlots,
  ingredientConflictNode,
} = require('../services/consumer-evaluate-nodes');

describe('consumer-evaluate-nodes', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    const migration = require('../migrations/055_conflict_engine');
    migration.up(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('loadConsumerContextSync returns bioContext', () => {
    const state = {
      sqlite_db: db,
      sessionId: 'sess_nodes_1',
      patientId: null,
    };
    const out = loadConsumerContextSync(state);
    expect(out.bioContext).toBeDefined();
  });

  test('ingredientConflictNode returns graph_unavailable when conflict graph missing', () => {
    const database = require('../database');
    const orig = database.createIngredientConflictGraph;
    database.createIngredientConflictGraph = () => null;
    try {
      const state = {
        sqlite_db: db,
        sessionId: 'sess_nodes_2',
        patientId: null,
        slots: [{ time: 'am', steps: [] }],
      };
      Object.assign(state, loadConsumerContextSync(state));
      Object.assign(state, resolveLineupSlots(state));
      const out = ingredientConflictNode(state);
      expect(out.graph_unavailable).toBe(true);
      expect(out.error).toBe('conflict_graph_unavailable');
    } finally {
      database.createIngredientConflictGraph = orig;
    }
  });

  test('resolveLineupSlots returns lineup object', () => {
    const state = {
      sqlite_db: db,
      sessionId: 'sess_nodes_3',
      patientId: null,
      slots: [{ time: 'am', steps: [] }],
    };
    Object.assign(state, loadConsumerContextSync(state));
    const out = resolveLineupSlots(state);
    expect(out.lineup).toBeDefined();
    expect(out.lineup.source).toBe('manual');
  });
});
