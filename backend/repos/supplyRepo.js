const db = require('../db');

async function ensureTable(){
  await db.query(`CREATE TABLE IF NOT EXISTS fire_supply(
    id SMALLINT PRIMARY KEY DEFAULT 1,
    total_max NUMERIC(24,2) NOT NULL DEFAULT 1000000,
    emitted NUMERIC(24,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  const rs = await db.query('SELECT 1 FROM fire_supply WHERE id=1');
  if (!rs.rows || !rs.rows[0]){
    await db.query('INSERT INTO fire_supply(id,total_max,emitted,updated_at) VALUES (1,1000000,0,NOW())');
  }
}

async function getStatus(){
  await ensureTable();
  const rs = await db.query('SELECT total_max, emitted FROM fire_supply WHERE id=1');
  const row = rs.rows && rs.rows[0];
  return { totalMax: Number(row?.total_max||0), emitted: Number(row?.emitted||0) };
}

async function setMax(total){
  await ensureTable();
  await db.query('UPDATE fire_supply SET total_max=$1, updated_at=NOW() WHERE id=1',[Number(total||0)]);
  return getStatus();
}

async function canEmit(amount){
  const a = Math.max(0, Number(amount||0));
  const st = await getStatus();
  return (st.emitted + a) <= st.totalMax;
}

async function emit(amount){
  const a = Math.max(0, Number(amount||0)); if (!a) return { ok:true };
  await ensureTable();
  // optimistic update
  const rs = await db.query('UPDATE fire_supply SET emitted = emitted + $1, updated_at=NOW() WHERE id=1 RETURNING total_max, emitted',[a]);
  const row = rs.rows && rs.rows[0];
  if (!row) return { ok:false };
  if (Number(row.emitted||0) > Number(row.total_max||0)){
    // rollback deduction
    await db.query('UPDATE fire_supply SET emitted = emitted - $1, updated_at=NOW() WHERE id=1',[a]);
    return { ok:false, error:'supply_exceeded' };
  }
  return { ok:true };
}

module.exports = { getStatus, setMax, canEmit, emit };
