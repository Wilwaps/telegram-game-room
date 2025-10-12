const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const https = require('https');
const { URL } = require('url');

// Health simple del webhook
router.get('/webhook', (req, res) => {
  res.json({ success: true, status: 'telegram_webhook_ok', time: Date.now() });
});

// Webhook de Telegram
router.post('/webhook', async (req, res) => {
  try {
    // Verificación opcional de secret_token (si se configura)
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    if (expected) {
      const got = String(req.headers['x-telegram-bot-api-secret-token'] || '');
      if (got !== expected) {
        logger.warn('telegram_webhook_secret_mismatch');
        return res.status(401).json({ success: false, error: 'unauthorized' });
      }
    }

    const update = req.body || {};
    logger.info('telegram_update', { update });

     const postJSON = (urlStr, data) => new Promise((resolve) => {
       try {
         const u = new URL(urlStr);
         const body = Buffer.from(JSON.stringify(data));
         const opts = {
           method: 'POST',
           hostname: u.hostname,
           path: u.pathname + (u.search || ''),
           headers: {
             'Content-Type': 'application/json',
             'Content-Length': body.length
           }
         };
         const reqH = https.request(opts, (resp) => {
           resp.on('data', () => {});
           resp.on('end', resolve);
         });
         reqH.on('error', () => resolve());
         reqH.write(body);
         reqH.end();
       } catch (_) { resolve(); }
     });

     const token = process.env.TELEGRAM_BOT_TOKEN || '';
     const chatId = (update && update.message && update.message.chat && update.message.chat.id) ||
                    (update && update.callback_query && update.callback_query.message && update.callback_query.message.chat && update.callback_query.message.chat.id);
     const hostUrl = `${req.protocol}://${req.get('host')}`;
     const baseUrl = process.env.PUBLIC_WEBAPP_URL || `${hostUrl}/portal.html`;
     if (token && chatId) {
       const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
       const payload = {
         chat_id: chatId,
         text: 'Abre la WebApp',
         reply_markup: { inline_keyboard: [[ { text: 'Abrir WebApp', web_app: { url: baseUrl } } ]] }
       };
       await postJSON(apiUrl, payload);
     }

     return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('telegram_webhook_error', err);
    return res.status(500).json({ success: false, error: 'webhook_error' });
  }
});

module.exports = router;
