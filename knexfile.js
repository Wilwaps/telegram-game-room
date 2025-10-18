const path = require('path');
// Evitar fallo de certificados auto-firmados en entorno de desarrollo/CLI
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();

const baseConnection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
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
