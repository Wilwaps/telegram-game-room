const db = require('../db');

async function ensureTables(){
  await db.query(`CREATE TABLE IF NOT EXISTS market_redeems(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_ext TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    cedula TEXT,
    telefono TEXT,
    bank_code TEXT,
    bank_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_by TEXT,
    processed_at TIMESTAMPTZ,
    meta JSONB
  )`);
}

async function createRedeem({ userExt, amount, cedula, telefono, bankCode, bankName, meta }){
  await ensureTables();
  const a = Math.max(1, Number(amount||0));
  const rs = await db.query('INSERT INTO market_redeems(user_ext, amount, cedula, telefono, bank_code, bank_name, status, meta) VALUES ($1,$2,$3,$4,$5,$6,\'pending\',$7) RETURNING *', [String(userExt||''), a, String(cedula||''), String(telefono||''), String(bankCode||''), String(bankName||''), meta||{}]);
  return rs.rows && rs.rows[0];
}

async function listByUser(userExt, { limit=50, offset=0, status }={}){
  await ensureTables();
  const l = Math.max(1, Math.min(200, Number(limit)||50));
  const o = Math.max(0, Number(offset)||0);
  const params = [String(userExt||''), l, o];
  let where = 'WHERE user_ext=$1';
  if (status){ params.unshift(String(status)); where = 'WHERE status=$1 AND user_ext=$2'; }
  const rs = await db.query(`SELECT * FROM market_redeems ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  return { items: rs.rows||[], limit:l, offset:o };
}

async function listAll({ status, limit=50, offset=0 }={}){
  await ensureTables();
  const l = Math.max(1, Math.min(200, Number(limit)||50));
  const o = Math.max(0, Number(offset)||0);
  const params = [l, o];
  let where = '';
  if (status){ params.unshift(String(status)); where = 'WHERE status=$1'; }
  const rs = await db.query(`SELECT * FROM market_redeems ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  return { items: rs.rows||[], limit:l, offset:o };
}

async function accept({ id, adminUserName }){
  await ensureTables();
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    const rq = await client.query('SELECT * FROM market_redeems WHERE id=$1 FOR UPDATE', [id]);
    const rec = rq.rows && rq.rows[0]; if (!rec) throw new Error('redeem_not_found');
    if (rec.status !== 'pending') throw new Error('redeem_not_pending');
    const amt = Number(rec.amount||0);
    const ext = String(rec.user_ext||'');
    let dbUserId = null;
    if (ext.startsWith('db:')) dbUserId = ext.slice(3); else if (ext.startsWith('tg:')) { const tg = ext.slice(3); const r = await client.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1', [tg]); dbUserId = r.rows?.[0]?.id||null; }
    if (!dbUserId) throw new Error('user_not_mapped');
    // ensure wallet and debit
    await client.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING',[dbUserId]);
    const w = await client.query('SELECT id, fires_balance FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
    const row = w.rows && w.rows[0]; if (!row) throw new Error('wallet_missing');
    const bal = Number(row.fires_balance||0); if (bal < amt) throw new Error('insufficient_fires');
    await client.query('UPDATE wallets SET fires_balance = fires_balance - $2, updated_at=NOW() WHERE id=$1', [row.id, amt]);
    await client.query('INSERT INTO wallet_transactions(wallet_id, type, amount_fire, reference, meta, created_at) VALUES ($1,$2,$3,$4,$5,NOW())', [row.id, 'market_redeem', -amt, String(id), { marketRedeemId: String(id) }]);
    // Auditoría supply: registrar burn por canje de mercado
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS supply_txs(
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        type TEXT NOT NULL,
        amount NUMERIC(24,2) NOT NULL DEFAULT 0,
        user_ext TEXT,
        user_id UUID,
        event_id INTEGER,
        reference TEXT,
        meta JSONB,
        actor TEXT
      )`);
    } catch(_) {}
    try {
      await client.query('INSERT INTO supply_txs(ts,type,amount,user_ext,user_id,reference,meta,actor) VALUES (NOW(),$1,$2,$3,$4,$5,$6,$7)',
        ['burn_market_redeem', amt, String(rec.user_ext||''), dbUserId, String(id), { marketRedeemId: String(id) }, String(adminUserName||'admin')]);
    } catch(_) {}
    await client.query('UPDATE market_redeems SET status=\'accepted\', processed_by=$2, processed_at=NOW() WHERE id=$1', [id, String(adminUserName||'admin')]);
    await client.query('COMMIT');
    return { ok:true };
  }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} throw err; }
  finally{ client.release(); }
}

async function reject({ id, adminUserName }){
  await ensureTables();
  await db.query('UPDATE market_redeems SET status=\'rejected\', processed_by=$2, processed_at=NOW() WHERE id=$1', [id, String(adminUserName||'admin')]);
  return { ok:true };
}

module.exports = { createRedeem, listByUser, listAll, accept, reject };
