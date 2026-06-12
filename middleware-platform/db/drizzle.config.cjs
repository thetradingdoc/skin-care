/** @type {import('drizzle-kit').Config} */
module.exports = {
  schema: './db/schema/index.js',
  out: './db/migrations-drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://postgres:testpass@localhost:5432/testdb',
  },
};
