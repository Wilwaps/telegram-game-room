const express = require('express');
const router = express.Router();
const store = require('../services/bingoStore');

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'bingo', status: 'ok' });
});

// Crear sala
router.post('/rooms', (req, res) => {
  try {
    const userId = String(req.body && req.body.userId || '').trim();
    const visibility = (req.body && req.body.visibility) || undefined;
    const costType = (req.body && req.body.costType) || undefined;
    const costValue = (req.body && req.body.costValue) || undefined;
    const mode = (req.body && req.body.mode) || undefined;
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const state = store.createRoom(userId, { visibility, costType, costValue, mode });
    res.json({ success: true, state });
  } catch (e) {
    res.status(500).json({ success: false, error: 'create_error' });
  }
});

// Salas del usuario
router.get('/my-rooms', (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const rooms = store.listRoomsByUser(userId);
    res.json({ success: true, rooms });
  } catch (e) {
    res.status(500).json({ success: false, error: 'list_error' });
  }
});

// Salas públicas
router.get('/public-rooms', (req, res) => {
  try {
    const rooms = store.listPublicRooms();
    res.json({ success: true, rooms });
  } catch (e) {
    res.status(500).json({ success: false, error: 'public_list_error' });
  }
});

// Buscar por código
router.get('/code/:code', (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    const state = store.findByCode(code);
    if (!state) return res.status(404).json({ success: false, error: 'room_not_found' });
    res.json({ success: true, state });
  } catch (e) {
    res.status(500).json({ success: false, error: 'code_lookup_error' });
  }
});

// Unirse por código
router.post('/join-code', (req, res) => {
  try {
    const code = String(req.body && req.body.code || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    if (!code || !userId) return res.status(400).json({ success: false, error: 'invalid_params' });
    const meta = store.findByCode(code);
    if (!meta) return res.status(404).json({ success: false, error: 'room_not_found' });
    const state = store.joinRoom(meta.id, userId);
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'join_code_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Unirse a sala
router.post('/rooms/:id/join', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    if (!roomId || !userId) return res.status(400).json({ success: false, error: 'invalid_params' });
    const state = store.joinRoom(roomId, userId);
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'join_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Opciones de sala (solo host)
router.patch('/rooms/:id/options', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    const visibility = (req.body && req.body.visibility);
    const costType = (req.body && req.body.costType);
    const costValue = (req.body && req.body.costValue);
    const mode = (req.body && req.body.mode);
    const state = store.setOptions(roomId, userId, { visibility, costType, costValue, mode });
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'options_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Ready/unready + cantidad de cartones
router.patch('/rooms/:id/ready', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    const ready = (req.body && req.body.ready);
    const cardsCount = (req.body && req.body.cardsCount);
    const state = store.setReady(roomId, userId, { ready, cardsCount });
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'ready_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Iniciar partida (host)
router.post('/rooms/:id/start', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    const state = store.start(roomId, userId);
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'start_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Extraer siguiente número (host)
router.post('/rooms/:id/draw', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    const state = store.drawNext(roomId, userId);
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'draw_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Cantar Bingo
router.post('/rooms/:id/claim', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    const cardIndex = (req.body && req.body.cardIndex);
    const state = store.claim(roomId, userId, { cardIndex });
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'claim_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// Estado actual de la sala
router.get('/rooms/:id/state', (req, res) => {
  try {
    const state = store.getState(String(req.params.id || ''));
    if (!state) return res.status(404).json({ success: false, error: 'room_not_found' });
    res.json({ success: true, state });
  } catch (e) {
    res.status(500).json({ success: false, error: 'state_error' });
  }
});

// SSE de sala
router.get('/rooms/:id/stream', (req, res) => {
  const roomId = String(req.params.id || '');
  const state = store.getState(roomId);
  if (!state) return res.status(404).end();

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders && res.flushHeaders();

  const send = (name, payload) => {
    try { res.write(`event: ${name}\n`); res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (_) {}
  };
  send('state', state);
  const off = store.onRoom(roomId, (s) => send('state', s));
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 15000);

  req.on('close', () => { clearInterval(hb); off(); });
});

module.exports = router;
