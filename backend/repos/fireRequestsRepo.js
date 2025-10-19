const db = require('../db');

async function ensureTables(){
  await db.query(`CREATE TABLE IF NOT EXISTS fire_requests(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_ext TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_by TEXT,
    processed_at TIMESTAMPTZ,
    meta JSONB
  )`);
}

async function createRequest({ userExt, amount, reference, meta }){
  await ensureTables();
  const a = Math.max(1, Number(amount||0));
  const rs = await db.query('INSERT INTO fire_requests(user_ext, amount, reference, status, meta) VALUES ($1,$2,$3,\'pending\',$4) RETURNING *', [String(userExt||''), a, String(reference||''), meta||{}]);
  return rs.rows && rs.rows[0];
}

async function listByUser(userExt, { limit=50, offset=0, status }={}){
  await ensureTables();
  const l = Math.max(1, Math.min(200, Number(limit)||50));
  const o = Math.max(0, Number(offset)||0);
  const params = [String(userExt||''), l, o];
  let where = 'WHERE user_ext=$1';
  if (status){ params.unshift(String(status)); where = 'WHERE status=$1 AND user_ext=$2'; }
  const rs = await db.query(`SELECT * FROM fire_requests ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  return { items: rs.rows||[], limit:l, offset:o };
}

async function listAll({ status, limit=50, offset=0 }={}){
  await ensureTables();
  const l = Math.max(1, Math.min(200, Number(limit)||50));
  const o = Math.max(0, Number(offset)||0);
  const params = [l, o];
  let where = '';
  if (status){ params.unshift(String(status)); where = 'WHERE status=$1'; }
  const rs = await db.query(`SELECT * FROM fire_requests ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  return { items: rs.rows||[], limit:l, offset:o };
}

async function accept({ id, adminUserName }){
  await ensureTables();
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    const rq = await client.query('SELECT * FROM fire_requests WHERE id=$1 FOR UPDATE', [id]);
    const rec = rq.rows && rq.rows[0]; if (!rec) throw new Error('request_not_found');
    if (rec.status !== 'pending') throw new Error('request_not_pending');
    // supply check/update
    const sup = await client.query('SELECT total_max, emitted FROM fire_supply WHERE id=1 FOR UPDATE');
    const srow = sup.rows && sup.rows[0];
    if (!srow){ await client.query('INSERT INTO fire_supply(id,total_max,emitted,updated_at) VALUES (1,1000000,0,NOW())'); }
    const sup2 = await client.query('SELECT total_max, emitted FROM fire_supply WHERE id=1 FOR UPDATE');
    const st = sup2.rows[0];
    const totalMax = Number(st.total_max||0); const emitted = Number(st.emitted||0);
    const amt = Number(rec.amount||0);
    if (emitted + amt > totalMax) throw new Error('supply_exceeded');
    // map user ext -> db user
    const ext = String(rec.user_ext||'');
    let dbUserId = null;
    if (ext.startsWith('db:')) dbUserId = ext.slice(3); else if (ext.startsWith('tg:')) { const tg = ext.slice(3); const r = await client.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1', [tg]); dbUserId = r.rows?.[0]?.id||null; }
    if (!dbUserId) throw new Error('user_not_mapped');
    // ensure wallet
    await client.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING',[dbUserId]);
    const w = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE', [dbUserId]);
    const wid = w.rows?.[0]?.id; if (!wid) throw new Error('wallet_missing');
    // credit
    await client.query('UPDATE wallets SET fires_balance = fires_balance + $2, updated_at=NOW() WHERE id=$1', [wid, amt]);
    await client.query('INSERT INTO wallet_transactions(wallet_id, type, amount_fire, reference, meta, created_at) VALUES ($1,$2,$3,$4,$5,NOW())', [wid, 'fire_request_accept', amt, String(rec.reference||''), { requestId: String(rec.id) }]);
    // update supply
    await client.query('UPDATE fire_supply SET emitted = emitted + $1, updated_at=NOW() WHERE id=1', [amt]);
    // update request
    await client.query('UPDATE fire_requests SET status=\'accepted\', processed_by=$2, processed_at=NOW() WHERE id=$1', [id, String(adminUserName||'admin')]);
    await client.query('COMMIT');
    return { ok:true };
  }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} throw err; }
  finally{ client.release(); }
}

async function reject({ id, adminUserName }){
  await ensureTables();
  await db.query('UPDATE fire_requests SET status=\'rejected\', processed_by=$2, processed_at=NOW() WHERE id=$1', [id, String(adminUserName||'admin')]);
  return { ok:true };
}

module.exports = { createRequest, listByUser, listAll, accept, reject };
