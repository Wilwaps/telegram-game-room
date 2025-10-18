const { Pool } = require('pg');

function buildConfig() {
  const cs = process.env.DATABASE_URL;
  if (cs) {
    return {
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.PGPOOL_MAX || '10', 10) || 10,
      idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_MS || '30000', 10) || 30000,
    };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10) || 5432,
    user: process.env.PGUSER || undefined,
    password: process.env.PGPASSWORD || undefined,
    database: process.env.PGDATABASE || undefined,
    ssl: (process.env.PGSSLMODE || 'require') !== 'disable' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.PGPOOL_MAX || '10', 10) || 10,
    idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_MS || '30000', 10) || 30000,
  };
}

const pool = new Pool(buildConfig());

async function query(text, params) {
  return pool.query(text, params);
}

process.on('SIGINT', async () => {
  try { await pool.end(); } catch (_) {}
  process.exit(0);
});

module.exports = { pool, query };
