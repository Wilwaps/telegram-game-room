const db = require('../db');

async function ensureTable(){
  await db.query(`CREATE TABLE IF NOT EXISTS app_kv(
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`);
}

async function getJson(key){
  await ensureTable();
  const rs = await db.query('SELECT value FROM app_kv WHERE key=$1 LIMIT 1', [String(key||'')]);
  return (rs.rows && rs.rows[0] && rs.rows[0].value) || null;
}

async function setJson(key, value){
  await ensureTable();
  await db.query('INSERT INTO app_kv(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()', [String(key||''), value||null]);
  return true;
}

module.exports = { getJson, setJson };
