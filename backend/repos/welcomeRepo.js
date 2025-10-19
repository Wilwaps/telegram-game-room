const db = require('../db');

async function ensureKv(){
  await db.query(`CREATE TABLE IF NOT EXISTS app_kv(
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}
async function ensureClaims(){
  await db.query(`CREATE TABLE IF NOT EXISTS welcome_claims(
    user_ext TEXT PRIMARY KEY,
    claimed_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}
async function getEvent(){
  await ensureKv();
  const rs = await db.query('SELECT value FROM app_kv WHERE key=$1', ['welcome_event']);
  const v = (rs.rows && rs.rows[0] && rs.rows[0].value) || null;
  if (!v) return { active:false, startsAt:0, endsAt:0, coins:0, fires:0, message:'' };
  return v;
}
async function setEvent(ev){
  await ensureKv();
  const now = Date.now();
  const startsAt = Number(ev.startsAt||now);
  const endsAt = ev.durationHours ? (startsAt + Math.max(1, Math.floor(Number(ev.durationHours)||72))*3600*1000) : Number(ev.endsAt||0);
  const value = {
    active: !!ev.active,
    startsAt,
    endsAt,
    coins: Math.max(0, parseInt(ev.coins||0,10)),
    fires: Math.max(0, parseInt(ev.fires||0,10)),
    message: String(ev.message||'')
  };
  await db.query('INSERT INTO app_kv(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()', ['welcome_event', value]);
  return value;
}
async function disableEvent(){ return setEvent({ active:false, startsAt:0, endsAt:0, coins:0, fires:0, message:'' }); }

async function hasClaim(userExt){
  await ensureClaims();
  const rs = await db.query('SELECT 1 FROM welcome_claims WHERE user_ext=$1', [String(userExt||'')]);
  return !!(rs.rows && rs.rows[0]);
}
async function setClaim(userExt){
  await ensureClaims();
  await db.query('INSERT INTO welcome_claims(user_ext,claimed_at) VALUES ($1,NOW()) ON CONFLICT DO NOTHING', [String(userExt||'')]);
}

async function mapExtToDbUserId(userExt){
  const v = String(userExt||'').trim(); if (!v) return null;
  if (v.startsWith('db:')) return v.slice(3);
  if (v.startsWith('tg:')){ const tg=v.slice(3); const r = await db.query('SELECT id FROM users WHERE tg_id=$1 LIMIT 1',[tg]); return (r.rows&&r.rows[0]&&r.rows[0].id)||null; }
  if (v.startsWith('em:')){ const em=v.slice(3).toLowerCase(); const r = await db.query('SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1',[em]); return (r.rows&&r.rows[0]&&r.rows[0].id)||null; }
  return null;
}

async function ensureWallet(dbUserId){
  await db.query('INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ($1,0,0,NOW()) ON CONFLICT (user_id) DO NOTHING', [dbUserId]);
}

async function getWalletExtBalances(userExt){
  const id = await mapExtToDbUserId(userExt); if (!id) return null;
  const rs = await db.query('SELECT fires_balance, coins_balance FROM wallets WHERE user_id=$1', [id]);
  const row = rs.rows && rs.rows[0]; if (!row) return { fires:0, coins:0 };
  return { fires: Number(row.fires_balance||0), coins: Number(row.coins_balance||0) };
}

let supplyRepo = null; try { supplyRepo = require('./supplyRepo'); } catch(_) { supplyRepo = null; }

async function awardIfEligible(userExt){
  const ext = String(userExt||'');
  if (!ext.startsWith('tg:')) return { awarded:false };
  const ev = await getEvent();
  const now = Date.now();
  if (!ev.active || now < Number(ev.startsAt||0) || now > Number(ev.endsAt||0)) return { awarded:false };
  if (await hasClaim(ext)) return { awarded:false };
  const dbUserId = await mapExtToDbUserId(ext);
  if (!dbUserId) return { awarded:false };
  await ensureWallet(dbUserId);
  const coins = Math.max(0, Number(ev.coins||0));
  const fires = Math.max(0, Number(ev.fires||0));
  // Control de supply: si hay fuegos a otorgar, verificar y emitir
  if (fires>0 && supplyRepo){
    const ok = await supplyRepo.canEmit(fires);
    if (!ok) return { awarded:false };
    const em = await supplyRepo.emit(fires);
    if (!em || !em.ok) return { awarded:false };
  }
  const client = await db.pool.connect();
  try{
    await client.query('BEGIN');
    if (coins>0){
      const w = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
      const wid = w.rows?.[0]?.id; if (wid){
        await client.query('UPDATE wallets SET coins_balance = coins_balance + $2, updated_at=NOW() WHERE id=$1',[wid, coins]);
        await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_coins,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid,'welcome_bonus', coins, 'welcome', { userExt: ext }]);
      }
    }
    if (fires>0){
      const w2 = await client.query('SELECT id FROM wallets WHERE user_id=$1 FOR UPDATE',[dbUserId]);
      const wid2 = w2.rows?.[0]?.id; if (wid2){
        await client.query('UPDATE wallets SET fires_balance = fires_balance + $2, updated_at=NOW() WHERE id=$1',[wid2, fires]);
        await client.query('INSERT INTO wallet_transactions(wallet_id,type,amount_fire,reference,meta,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',[wid2,'welcome_bonus', fires, 'welcome', { userExt: ext }]);
      }
    }
    await client.query('COMMIT');
  }catch(e){ try{ await client.query('ROLLBACK'); }catch(_){} throw e; }
  finally{ client.release(); }
  await setClaim(ext);
  return { awarded:true, coinsAwarded: coins, firesAwarded: fires, until: ev.endsAt };
}

module.exports = { getEvent, setEvent, disableEvent, awardIfEligible, getWalletExtBalances };
