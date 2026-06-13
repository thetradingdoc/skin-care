'use strict';

module.exports = {
  id: '058_funnel_visitor_id',
  up(db) {
    const cols = db.prepare(`PRAGMA table_info(funnel_journeys)`).all();
    const hasVisitor = cols.some((c) => c.name === 'anonymous_visitor_id');
    if (!hasVisitor) {
      db.exec(`ALTER TABLE funnel_journeys ADD COLUMN anonymous_visitor_id TEXT`);
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_funnel_journeys_visitor
        ON funnel_journeys(anonymous_visitor_id, created_at);
    `);
  },
};
