const express = require('express');
const router = express.Router();
const store = require('../services/tictactoeStore');

router.post('/rooms', (req, res) => {
  try {
    const userId = String(req.body && req.body.userId || '').trim();
    const visibility = (req.body && req.body.visibility) || undefined;
    const costType = (req.body && req.body.costType) || undefined;
    const costValue = (req.body && req.body.costValue) || undefined;
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const state = store.createRoom(userId, { visibility, costType, costValue });
    res.json({ success: true, state });
  } catch (e) {
    res.status(500).json({ success: false, error: 'create_error' });
  }
});

// GET /api/games/tictactoe/my-rooms?userId=
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

// POST /api/games/tictactoe/join-code { code, userId }
router.post('/join-code', (req, res) => {
  try {
    const code = String(req.body && req.body.code || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    if (!code || !userId) return res.status(400).json({ success: false, error: 'invalid_params' });
    const state = store.findByCode(code);
    if (!state) return res.status(404).json({ success: false, error: 'room_not_found' });
    const joined = store.joinRoom(state.id, userId);
    res.json({ success: true, state: joined });
  } catch (e) {
    const msg = e && e.message || 'join_code_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// GET /api/games/tictactoe/code/:code
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

router.post('/rooms/:id/move', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    const index = Number(req.body && req.body.index);
    if (!roomId || !userId || !Number.isFinite(index)) return res.status(400).json({ success: false, error: 'invalid_params' });
    const state = store.move({ roomId, userId, index });
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'move_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

router.get('/rooms/:id/state', (req, res) => {
  try {
    const state = store.getState(String(req.params.id || ''));
    if (!state) return res.status(404).json({ success: false, error: 'room_not_found' });
    res.json({ success: true, state });
  } catch (e) {
    res.status(500).json({ success: false, error: 'state_error' });
  }
});

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

// PATCH /api/games/tictactoe/rooms/:id/options
router.patch('/rooms/:id/options', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const visibility = (req.body && req.body.visibility);
    const costType = (req.body && req.body.costType);
    const costValue = (req.body && req.body.costValue);
    const state = store.setOptions(roomId, { visibility, costType, costValue });
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'options_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// GET /api/games/tictactoe/public-rooms
router.get('/public-rooms', (req, res) => {
  try {
    const rooms = store.listPublicRooms();
    res.json({ success: true, rooms });
  } catch (e) {
    res.status(500).json({ success: false, error: 'public_list_error' });
  }
});

// POST /api/games/tictactoe/rooms/:id/rematch
router.post('/rooms/:id/rematch', (req, res) => {
  try {
    const roomId = String(req.params.id || '').trim();
    const userId = String(req.body && req.body.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const state = store.rematch(roomId, userId);
    res.json({ success: true, state });
  } catch (e) {
    const msg = e && e.message || 'rematch_error';
    const code = (msg === 'room_not_found') ? 404 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

module.exports = router;
