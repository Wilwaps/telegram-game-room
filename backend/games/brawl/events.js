const logger = require('../../config/logger');
const { BrawlManager } = require('./state');

function initialize(io) {
  const ns = io.of('/brawl');
  const manager = new BrawlManager(ns);

  function generateCode(length = 6) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  ns.on('connection', (socket) => {
    logger.info(`[BRAWL] Cliente conectado: ${socket.id}`);

    // Autenticación mínima (desde Telegram WebApp u otra fuente)
    socket.on('authenticate', (user = {}) => {
      socket.userId = user.userId || `guest:${socket.id}`;
      socket.userName = user.userName || 'Guest';
      logger.info(`[BRAWL] AUTH userId=${socket.userId} userName=${socket.userName}`);
      socket.emit('authenticated', { ok: true, userId: socket.userId, userName: socket.userName });
    });

    socket.on('brawl_join', (payload = {}) => {
      try {
        const roomId = payload.roomId || generateCode();
        const m = manager.getOrCreate(roomId);
        const p = m.addPlayer(socket, { userId: socket.userId, userName: socket.userName });
        socket.currentBrawlRoom = roomId;
        logger.info(`[BRAWL] JOIN room=${roomId} user=${p.userId}`);
        ns.to(roomId).emit('brawl_score', { roomId, players: Array.from(m.players.values()).length });
      } catch (err) {
        logger.error('[BRAWL] brawl_join error:', err);
        socket.emit('error', { code: 'BRAWL_JOIN_FAILED', message: 'No se pudo unir a la arena' });
      }
    });

    socket.on('brawl_input', ({ mask = 0, ts = Date.now(), seq = 0 } = {}) => {
      try {
        const roomId = socket.currentBrawlRoom;
        if (!roomId) return;
        const m = manager.getOrCreate(roomId);
        m.setInput(socket.id, mask >>> 0);
      } catch (err) {
        logger.error('[BRAWL] brawl_input error:', err);
      }
    });

    socket.on('brawl_leave', () => {
      try {
        const roomId = socket.currentBrawlRoom;
        if (!roomId) return;
        const m = manager.getOrCreate(roomId);
        m.removePlayer(socket.id);
        socket.leave(roomId);
        socket.currentBrawlRoom = null;
        manager.removeIfEmpty(roomId);
        logger.info(`[BRAWL] LEAVE room=${roomId} socket=${socket.id}`);
      } catch (err) {
        logger.error('[BRAWL] brawl_leave error:', err);
      }
    });

    socket.on('disconnect', () => {
      try {
        const roomId = socket.currentBrawlRoom;
        if (roomId) {
          const m = manager.getOrCreate(roomId);
          m.removePlayer(socket.id);
          manager.removeIfEmpty(roomId);
        }
        logger.info(`[BRAWL] Cliente desconectado: ${socket.id}`);
      } catch (err) {
        logger.error('[BRAWL] disconnect error:', err);
      }
    });
  });

  logger.info('✅ Namespace /brawl inicializado');
}

module.exports = { initialize };
