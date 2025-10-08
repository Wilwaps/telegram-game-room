const redisService = require('./redisService');
const { redis, constants } = require('../config/config');
const User = require('../models/User');

function normalizeStr(s, max = 128) {
  return String(s || '').trim().slice(0, max);
}

module.exports = {
  async getProfile(userId) {
    const uid = String(userId || '').trim();
    if (!uid) throw new Error('userId requerido');

    // Cargar hash de perfil específico
    const key = `user:${uid}:profile`;
    const h = await redisService.client.hgetall(key);

    // Complementar con el modelo User si existe
    const u = await redisService.getUser(uid);
    const base = {
      userId: uid,
      userName: u?.userName || '',
      firstName: h.firstName || u?.firstName || '',
      lastName: h.lastName || u?.lastName || '',
      phone: h.phone || '',
      email: h.email || ''
    };
    return base;
  },

  async updateProfile(userId, { firstName, lastName, phone, email }) {
    const uid = String(userId || '').trim();
    if (!uid) throw new Error('userId requerido');

    const data = {
      firstName: normalizeStr(firstName, 80),
      lastName: normalizeStr(lastName, 80),
      phone: normalizeStr(phone, 32),
      email: normalizeStr(email, 120)
    };

    const key = `user:${uid}:profile`;
    // Guardar hash y TTL de sesión
    await redisService.client.hset(key, data);
    await redisService.client.expire(key, redis.ttl.session);

    // Actualizar también el modelo User si existe (para consistencia)
    const u = await redisService.getUser(uid);
    if (u) {
      u.firstName = data.firstName || u.firstName;
      u.lastName = data.lastName || u.lastName;
      try { await redisService.setUser(uid, u); } catch(_){}
    }

    return { userId: uid, ...data };
  },

  async requestKeyChange(userId, newKey, note = '') {
    const uid = String(userId || '').trim();
    const key = String(newKey || '').trim();
    if (!uid || !key) throw new Error('userId y newKey requeridos');

    const reqKey = `profile:keyreq:${uid}`;
    const payload = {
      newKey: normalizeStr(key, 128),
      note: normalizeStr(note, 256),
      ts: String(Date.now())
    };
    await redisService.client.hset(reqKey, payload);
    // expira en 7 días
    await redisService.client.expire(reqKey, 7 * 24 * 3600);
    return { success: true };
  }
};
