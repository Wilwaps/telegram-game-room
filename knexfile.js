const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();

const baseConnection = process.env.DATABASE_URL || {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: (process.env.PGSSLMODE || 'require') !== 'disable' ? { rejectUnauthorized: false } : false,
};

const common = {
  client: 'pg',
  connection: baseConnection,
  migrations: {
    directory: './backend/migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './backend/seeds'
  }
};

module.exports = {
  development: common,
  production: common,
};
