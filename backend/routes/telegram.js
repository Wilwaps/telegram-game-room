const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const https = require('https');
const { URL } = require('url');
const store = require('../services/memoryStore');
let datosBot = null;
try { datosBot = require('../../datosbot/startResponder'); } catch (_) { datosBot = null; }

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
     const msg = update.message;
     const cbq = update.callback_query;
     const chat = (msg && msg.chat) || (cbq && cbq.message && cbq.message.chat) || null;
     const from = (msg && msg.from) || (cbq && cbq.from) || null;

     let startHandled = false;
     try {
       if (datosBot && typeof datosBot.handleStart === 'function') {
         startHandled = await datosBot.handleStart({ token, message: msg, chat, from });
       }
     } catch (err) {
       logger.warn('telegram_start_responder_error', { error: String(err && err.message || err) });
     }

     // Award 1 coin when a user posts a message in the target group
     const targetChatId = String(process.env.TELEGRAM_TARGET_CHAT_ID || '-1002660157966');
     if (msg && chat && String(chat.id) === targetChatId) {
       try {
         if (from && !from.is_bot) {
           const uid = 'tg:' + String(from.id);
           const uname = from.username || [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
           const out = store.addCoins({ userId: uid, amount: 1, userName: uname, reason: 'coin_msg_group' });
           if (out) logger.info('coin_awarded', { userId: uid, coins: out.u.coins });
         }
       } catch (e) {
         logger.warn('coin_award_error', { error: String(e) });
       }
     }

     // Enviar botón WebApp solo si está habilitado por env y en comandos explícitos (/start o /app)
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const baseUrl = process.env.PUBLIC_WEBAPP_URL || `${hostUrl}/games`;
    const allowBtn = String(process.env.TELEGRAM_SEND_WEBAPP_BUTTON || 'false').toLowerCase() === 'true';
    const isStart = !!(msg && typeof msg.text === 'string' && /^\s*\/start(\s|$)/i.test(msg.text));
    const isAppCmd = !!(msg && typeof msg.text === 'string' && /^\s*\/(app|open)\b/i.test(msg.text));
    if (allowBtn && token && chat && chat.type === 'private' && (isStart || isAppCmd)) {
      const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      const payload = {
        chat_id: chat.id,
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
