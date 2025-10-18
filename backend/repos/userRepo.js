const crypto = require('crypto');
const db = require('../db');

function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const h = crypto.createHash('sha256').update(salt + '::' + String(password || '')).digest('hex');
  return `${salt}:${h}`;
}
function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, h] = parts;
  const calc = crypto.createHash('sha256').update(salt + '::' + String(password || '')).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(h)); } catch (_) { return false; }
}

async function ensureWallet(client, userId) {
  await client.query(
    'INSERT INTO wallets (user_id, fires_balance, coins_balance) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );
}

async function ensureRole(client, roleName) {
  const name = String(roleName || 'client').toLowerCase();
  let rid = null;
  const ins = await client.query('INSERT INTO roles(name) VALUES($1) ON CONFLICT(name) DO NOTHING RETURNING id', [name]);
  if (ins.rows && ins.rows[0]) rid = ins.rows[0].id;
  if (!rid) {
    const r2 = await client.query('SELECT id FROM roles WHERE name=$1', [name]);
    rid = r2.rows[0]?.id || null;
  }
  return rid;
}

async function createUserWithPassword({ username, password, email, phone, displayName, roleName, tgId }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const tg = String(tgId);
    const uname = String(username || '').trim().toLowerCase() || null;
    if (!uname) throw new Error('invalid_username');
    if (!password) throw new Error('invalid_password');
    const disp = String(displayName || username || '').trim();
    const em = email ? String(email).trim().toLowerCase() : null;
    const ph = phone ? String(phone).trim() : null;

    const uIns = await client.query(
      'INSERT INTO users (username, display_name, email, phone) VALUES ($1,$2,$3,$4) RETURNING id',
      [uname, disp, em, ph]
    );
    const userId = uIns.rows[0].id;

    const passHash = hashPassword(password);
    await client.query(
      'INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash) VALUES ($1,$2,$3,$4)',
      [userId, 'password', uname, passHash]
    );

    await ensureWallet(client, userId);

    const roleId = await ensureRole(client, roleName || 'client');
    if (roleId) {
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, roleId]);
    }

    await client.query('COMMIT');
    return { userId };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function listUsersDb({ search, limit, offset }) {
  const q = String(search || '').trim().toLowerCase();
  const lim = Math.max(1, Math.min(200, Number(limit || 50)));
  const off = Math.max(0, Number(offset || 0));
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    where = 'WHERE LOWER(u.username) LIKE $1 OR LOWER(u.email) LIKE $2 OR COALESCE(u.phone,\'\') LIKE $3';
  }
  params.push(lim); params.push(off);
  const sql = `
    SELECT u.id, u.username, u.display_name, u.email, u.phone,
           COALESCE(w.fires_balance,0) AS fires,
           COALESCE(string_agg(r.name, ',') FILTER (WHERE r.name IS NOT NULL), '') AS roles,
           u.created_at, u.last_seen_at
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ${where}
    GROUP BY u.id, w.fires_balance
    ORDER BY u.created_at DESC
    LIMIT $${params.length-1} OFFSET $${params.length}
  `;
  const rs = await db.query(sql, params);
  return rs.rows || [];
}

async function listRoles() {
  const rs = await db.query('SELECT id, name FROM roles ORDER BY name ASC');
  return rs.rows || [];
}

async function updateUserContact({ userId, email, phone, username, displayName }) {
  const fields = [];
  const params = [];
  if (typeof email !== 'undefined') { params.push(String(email||'').trim() || null); fields.push(`email = $${params.length}`); }
  if (typeof phone !== 'undefined') { params.push(String(phone||'').trim() || null); fields.push(`phone = $${params.length}`); }
  if (typeof username !== 'undefined') { params.push(String(username||'').trim().toLowerCase() || null); fields.push(`username = $${params.length}`); }
  if (typeof displayName !== 'undefined') { params.push(String(displayName||'').trim() || null); fields.push(`display_name = $${params.length}`); }
  if (!fields.length) return { updated: false };
  params.push(userId);
  const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id`;
  const rs = await db.query(sql, params);
  return { updated: !!(rs.rows && rs.rows[0]) };
}

async function setUserRole({ userId, roleName }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const rid = await ensureRole(client, roleName || 'client');
    if (!rid) throw new Error('role_not_found');
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, rid]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally { client.release(); }
}

module.exports = { createUserWithPassword, listUsersDb, listRoles, updateUserContact, setUserRole };
