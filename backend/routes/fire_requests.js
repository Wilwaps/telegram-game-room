const express = require('express');
const https = require('https');
const { URL } = require('url');
const router = express.Router();
const store = require('../services/memoryStore');
const adminAuth = require('../middleware/adminAuth');
const { preferSessionUserId } = require('../middleware/sessionUser');

function postJSON(urlStr, data) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const body = Buffer.from(JSON.stringify(data));
      const opts = {
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
      };
      const reqH = https.request(opts, (resp) => { resp.on('data', ()=>{}); resp.on('end', resolve); });
      reqH.on('error', () => resolve());
      reqH.write(body);
      reqH.end();
    } catch (_) { resolve(); }
  });
}

async function notifyAdminNewRequest(req, { request }) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const adminTgId = String(process.env.FIRE_REQUEST_ADMIN_TG_ID || '1417856820');
    if (!token || !adminTgId) return;
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const adminUi = `${hostUrl}/fire-requests`;
    const text = `Nueva solicitud de fuegos\nUsuario: ${request.userId}\nCantidad: ${request.amount}\nRef: ${request.reference}\n\nRevisar: ${adminUi}`;
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await postJSON(apiUrl, { chat_id: adminTgId, text });
  } catch (_) {}
}

// POST /api/economy/fire-requests/create { userId, amount, reference }
router.post('/fire-requests/create', (req, res) => {
  try {
    const { userId, amount, reference } = req.body || {};
    const realUserId = preferSessionUserId(req, userId);
    const rec = store.createFireRequest({ userId: realUserId, amount, reference });
    // notificar admin por TG (no bloquear)
    notifyAdminNewRequest(req, { request: rec });
    res.json({ success: true, request: rec });
  } catch (err) {
    const msg = (err && err.message) || 'create_error';
    res.status(400).json({ success: false, error: msg });
  }
});

// GET /api/economy/fire-requests/my/:userId
router.get('/fire-requests/my/:userId', (req, res) => {
  try {
    const realUserId = preferSessionUserId(req, req.params && req.params.userId);
    const { limit, offset } = req.query || {};
    const out = store.listFireRequestsByUser(realUserId, { limit, offset });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'list_my_error' });
  }
});

// GET /api/economy/fire-requests/pending (admin)
router.get('/fire-requests/pending', adminAuth, (req, res) => {
  try {
    const { limit, offset } = req.query || {};
    const out = store.listFireRequests({ status: 'pending', limit, offset });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'list_pending_error' });
  }
});

// GET /api/economy/fire-requests/list?status=(accepted|rejected|pending) (admin)
router.get('/fire-requests/list', adminAuth, (req, res) => {
  try {
    const { status, limit, offset } = req.query || {};
    const out = store.listFireRequests({ status, limit, offset });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'list_error' });
  }
});

// POST /api/economy/fire-requests/:id/accept (admin)
router.post('/fire-requests/:id/accept', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const adminUserName = req.admin?.userName || 'admin';
    const out = store.acceptFireRequest({ id, adminUserName });
    res.json({ success: true, ...out });
  } catch (err) {
    const msg = (err && err.message) || 'accept_error';
    const code = (msg === 'request_not_found' || msg === 'request_not_pending') ? 400 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// POST /api/economy/fire-requests/:id/reject (admin)
router.post('/fire-requests/:id/reject', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const adminUserName = req.admin?.userName || 'admin';
    const out = store.rejectFireRequest({ id, adminUserName });
    res.json({ success: true, ...out });
  } catch (err) {
    const msg = (err && err.message) || 'reject_error';
    const code = (msg === 'request_not_found' || msg === 'request_not_pending') ? 400 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

module.exports = router;
