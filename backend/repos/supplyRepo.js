const db = require('../db');

async function ensureTable(){
  await db.query(`CREATE TABLE IF NOT EXISTS fire_supply(
    id SMALLINT PRIMARY KEY DEFAULT 1,
    total_max NUMERIC(24,2) NOT NULL DEFAULT 1000000000,
    emitted NUMERIC(24,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  const rs = await db.query('SELECT 1 FROM fire_supply WHERE id=1');
  if (!rs.rows || !rs.rows[0]){
    await db.query('INSERT INTO fire_supply(id,total_max,emitted,updated_at) VALUES (1,1000000000,0,NOW())');
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

async function getDashboardSnapshot(){
  const st = await getStatus();
  let sum = 0;
  try {
    const r = await db.query('SELECT COALESCE(SUM(fires_balance),0) AS s FROM wallets');
    sum = Number(r.rows && r.rows[0] && r.rows[0].s || 0);
  } catch (_) { sum = 0; }
  const total = Number(st.totalMax||0);
  const emitted = Number(st.emitted||0);
  const circulating = Math.max(0, sum);
  const burned = Math.max(0, emitted - circulating);
  const reserve = Math.max(0, total - emitted);
  return { total, circulating, burned, reserve };
}

function parseDate(d){ if(!d) return null; const n=Number(d); if(!Number.isNaN(n) && n>0) return new Date(n); try{ const dt=new Date(String(d)); return isNaN(dt.getTime())? null : dt; }catch(_){ return null; } }

async function ensureSupplyTxsTable(){
  try{
    await db.query(`CREATE TABLE IF NOT EXISTS supply_txs(
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      type TEXT NOT NULL,
      amount NUMERIC(24,2) NOT NULL DEFAULT 0,
      user_ext TEXT,
      user_id INTEGER,
      event_id INTEGER REFERENCES welcome_events(id) ON DELETE SET NULL,
      reference TEXT,
      meta JSONB,
      actor TEXT
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS supply_txs_ts_idx ON supply_txs(ts)`);
    await db.query(`CREATE INDEX IF NOT EXISTS supply_txs_type_idx ON supply_txs(type)`);
    await db.query(`CREATE INDEX IF NOT EXISTS supply_txs_event_idx ON supply_txs(event_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS supply_txs_userext_idx ON supply_txs(user_ext)`);
  }catch(_){ }
}

async function listSupplyTxs({ type, user_ext, event_id, from, to, limit=50, offset=0, order='desc' }={}){
  await ensureSupplyTxsTable();
  const cond=[]; const args=[]; let i=1;
  if (type){ cond.push(`type=$${i++}`); args.push(String(type)); }
  if (user_ext){ cond.push(`user_ext=$${i++}`); args.push(String(user_ext)); }
  if (event_id){ cond.push(`event_id=$${i++}`); args.push(Number(event_id)); }
  const dtFrom = parseDate(from); if (dtFrom){ cond.push(`ts >= $${i++}`); args.push(dtFrom); }
  const dtTo = parseDate(to); if (dtTo){ cond.push(`ts <= $${i++}`); args.push(dtTo); }
  const where = cond.length? `WHERE ${cond.join(' AND ')}` : '';
  const lim = Math.max(1, Math.min(1000, Number(limit)||50));
  const off = Math.max(0, Number(offset)||0);
  const ord = String(order||'desc').toLowerCase()==='asc' ? 'ASC' : 'DESC';
  const q = `SELECT id, ts, type, amount, user_ext, user_id, event_id, reference, meta, actor FROM supply_txs ${where} ORDER BY ts ${ord}, id ${ord} LIMIT ${lim} OFFSET ${off}`;
  const rs = await db.query(q, args);
  return { items: rs.rows||[], limit: lim, offset: off };
}

async function getSupplyTx(id){
  await ensureSupplyTxsTable();
  const rs = await db.query('SELECT id, ts, type, amount, user_ext, user_id, event_id, reference, meta, actor FROM supply_txs WHERE id=$1',[Number(id)]);
  return rs.rows && rs.rows[0] || null;
}

function toCsvValue(v){ if (v===null||v===undefined) return ''; const s = typeof v==='object'? JSON.stringify(v) : String(v); return '"'+ s.replace(/"/g,'""') +'"'; }

async function exportSupplyTxsCsv(filters={}){
  await ensureSupplyTxsTable();
  const { items } = await listSupplyTxs({ ...filters, limit: Math.min(5000, Number(filters.limit)||5000), offset: Number(filters.offset)||0 });
  const header = ['id','ts','type','amount','user_ext','user_id','event_id','reference','actor','meta'];
  const lines = [header.join(',')];
  for (const r of items){
    const row = [r.id, r.ts instanceof Date? r.ts.toISOString() : (r.ts || ''), r.type, Number(r.amount||0), r.user_ext||'', r.user_id||'', r.event_id||'', r.reference||'', r.actor||'', r.meta||null];
    lines.push(row.map(toCsvValue).join(','));
  }
  return lines.join('\n');
}

module.exports = { getStatus, setMax, canEmit, emit, getDashboardSnapshot, listSupplyTxs, getSupplyTx, exportSupplyTxsCsv };
