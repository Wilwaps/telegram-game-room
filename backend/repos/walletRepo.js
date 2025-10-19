const db = require('../db');

async function mapExtToDbUserId(userExt){
  const v = String(userExt||'').trim(); if (!v) return null;
  if (v.startsWith('db:')) return v.slice(3);
  if (v.startsWith('tg:')){ const tg=v.slice(3); const r=await db.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1',[tg]); return (r.rows&&r.rows[0]&&r.rows[0].id)||null; }
  if (v.startsWith('em:')){ const em=v.slice(3).toLowerCase(); const r=await db.query('SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1',[em]); return (r.rows&&r.rows[0]&&r.rows[0].id)||null; }
  return null;
}

async function ensureWallet(userId){
  await db.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING', [userId]);
}

async function getBalancesByExt(userExt){
  const dbUserId = await mapExtToDbUserId(userExt); if (!dbUserId) return null;
  const rs = await db.query('SELECT id, fires_balance, coins_balance FROM wallets WHERE user_id=$1', [dbUserId]);
  const row = rs.rows && rs.rows[0];
  return { walletId: row? row.id : null, userId: dbUserId, fires: Number(row?.fires_balance||0), coins: Number(row?.coins_balance||0) };
}

async function creditFiresByExt(userExt, amount, { type='manual_credit', reference='', meta={} }={}){
  const amt = Math.max(0, Number(amount||0)); if (!amt) return { ok:false };
  const dbUserId = await mapExtToDbUserId(userExt); if (!dbUserId) return { ok:false };
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING',[dbUserId]);
    const w = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
    const wid = w.rows?.[0]?.id; if (!wid) throw new Error('wallet_missing');
    await client.query('UPDATE wallets SET fires_balance = fires_balance + $2, updated_at=NOW() WHERE id=$1',[wid, amt]);
    await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid, type, amt, String(reference||''), meta||{}]);
    await client.query('COMMIT');
    return { ok:true };
  }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} return { ok:false, error: err.message||'credit_error' }; }
  finally{ client.release(); }
}

async function debitFiresByExt(userExt, amount, { type='manual_debit', reference='', meta={} }={}){
  const amt = Math.max(0, Number(amount||0)); if (!amt) return { ok:false };
  const dbUserId = await mapExtToDbUserId(userExt); if (!dbUserId) return { ok:false };
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    const w = await client.query('SELECT id, fires_balance FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
    const row = w.rows?.[0]; if (!row) throw new Error('wallet_missing');
    const bal = Number(row.fires_balance||0); if (bal < amt) throw new Error('insufficient_fires');
    await client.query('UPDATE wallets SET fires_balance = fires_balance - $2, updated_at=NOW() WHERE id=$1',[row.id, amt]);
    await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[row.id, type, -amt, String(reference||''), meta||{}]);
    await client.query('COMMIT');
    return { ok:true };
  }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} return { ok:false, error: err.message||'debit_error' }; }
  finally{ client.release(); }
}

async function creditCoinsByExt(userExt, amount, { type='manual_credit', reference='', meta={} }={}){
  const amt = Math.max(0, Number(amount||0)); if (!amt) return { ok:false };
  const dbUserId = await mapExtToDbUserId(userExt); if (!dbUserId) return { ok:false };
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING',[dbUserId]);
    const w = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
    const wid = w.rows?.[0]?.id; if (!wid) throw new Error('wallet_missing');
    await client.query('UPDATE wallets SET coins_balance = coins_balance + $2, updated_at=NOW() WHERE id=$1',[wid, amt]);
    await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_coin,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid, type, amt, String(reference||''), meta||{}]);
    await client.query('COMMIT');
    return { ok:true };
  }catch(err){ try{ await client.query('ROLLBACK'); }catch(_){} return { ok:false, error: err.message||'credit_error' }; }
  finally{ client.release(); }
}

module.exports = { mapExtToDbUserId, ensureWallet, getBalancesByExt, creditFiresByExt, debitFiresByExt, creditCoinsByExt };
