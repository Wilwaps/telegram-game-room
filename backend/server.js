const express = require('express');
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PORT, security } = require('./config/config');
const logger = require('./config/logger');
const economyRoutes = require('./routes/economy');
const authRoutes = require('./routes/auth');
const xpRoutes = require('./routes/xp');
const economyExtRoutes = require('./routes/economy_ext');
const telegramRoutes = require('./routes/telegram');
const profileRoutes = require('./routes/profile');
const tttRoutes = require('./routes/tictactoe');
const tttStore = require('./services/tictactoeStore');
const bingoRoutes = require('./routes/bingo');
const fireRequestsRoutes = require('./routes/fire_requests');
const rafflesRoutes = require('./routes/raffles');
const messagesRoutes = require('./routes/messages');
let gamesLobbyRoutes = null; try { gamesLobbyRoutes = require('./routes/games_lobby'); } catch(_) { gamesLobbyRoutes = null; }
const musicRoutes = require('./routes/music');
const store = require('./services/memoryStore');
const auth = require('./services/authStore');
let db = null; try { db = require('./db'); } catch(_) { db = null; }
const welcomeRoutes = require('./routes/welcome');
const adminWelcomeRoutes = require('./routes/admin_welcome');

const app = express();
// Sentry init (si DSN disponible)
try {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || '0.2') || 0.2,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app })
    ]
  });
} catch (_) {}
// Configurar trust proxy con hops numéricos (evita ValidationError de express-rate-limit)
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));
// Bloquear cualquier intento de establecer X-Frame-Options en respuestas
app.use((req, res, next) => {
  try {
    const original = res.setHeader;
    res.setHeader = function(name, value) {
      if (String(name || '').toLowerCase() === 'x-frame-options') { return; }
      return original.call(this, name, value);
    };
  } catch (_) {}
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://telegram.org", "https://cdn.jsdelivr.net", "https://browser.sentry-cdn.com", "'unsafe-inline'"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:", "blob:"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "connect-src": ["'self'", "https:", "wss:", "https://api.telegram.org", "https://*.telegram.org", "https://*.sentry.io", "https://*.ingest.sentry.io"],
      "media-src": ["'self'", "https://www.soundhelix.com", "https://api.telegram.org", "https://*.telegram.org"],
      "frame-ancestors": ["'self'", "https://*.telegram.org", "https://web.telegram.org", "https://t.me", "https://*.t.me"],
      "upgrade-insecure-requests": []
    }
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
// Sentry middleware (request/tracing)
try { app.use(Sentry.Handlers.requestHandler()); app.use(Sentry.Handlers.tracingHandler()); } catch (_) {}
app.use(express.json());
// Forzar eliminación del header X-Frame-Options para permitir embed en Telegram WebApp
app.use((req, res, next) => {
  try { res.removeHeader('X-Frame-Options'); res.removeHeader('x-frame-options'); } catch (_) {}
  next();
});
// Identidad para métricas: resuelve usuario de sesión o anonimiza con UID persistente
app.use((req, res, next) => {
  try {
    const raw = String(req.headers.cookie || '');
    let uid = '';
    let sid = '';
    let sessionObj = null;
    for (const part of raw.split(/;\s*/)) {
      const [k, v] = part.split('=');
      if (k === 'uid' || k === 'uidp') { uid = v; }
      else if (k === 'sid') { sid = v; }
    }
    // Fallback para WebViews que bloquean cookies: permitir cabecera x-session-id
    try {
      const sidHeader = String(req.headers['x-session-id'] || '');
      if (!sid && sidHeader) sid = sidHeader;
    } catch(_) {}
    if (sid) {
      try {
        const sess = auth.getSession(sid);
        if (sess && sess.userId) {
          req.sessionUserId = String(sess.userId);
          sessionObj = sess;
        }
      } catch (_) {}
    }
    req.sessionUser = sessionObj;
    if (!uid) {
      uid = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24);
      const maxAge = 365 * 24 * 3600;
      res.setHeader('Set-Cookie', [
        `uid=${uid}; Path=/; SameSite=None; Secure; Max-Age=${maxAge}`,
        `uidp=${uid}; Path=/; SameSite=None; Secure; Partitioned; Max-Age=${maxAge}`
      ]);
    }
    const ua = String(req.headers['user-agent'] || '');
    if (req.sessionUserId) {
      try { store.touchUser(req.sessionUserId, { ua }); } catch (_) {}
    } else {
      try { store.touchUser('anon:' + uid, { ua }); } catch (_) {}
    }
    // Log a Postgres (connection_logs) y actualizar last_seen_at cuando aplique
    try {
      if (db && db.query) {
        const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
        const platform = String(req.headers['sec-ch-ua-platform'] || '').replace(/\"/g,'') || (/(Android|iPhone|iPad|Windows|Mac|Linux)/i.exec(ua)?.[1] || 'unknown');
        const sess = String(req.sessionUserId || '');
        const run = async () => {
          let pgUserId = null;
          if (sess.startsWith('db:')) { pgUserId = sess.slice(3); }
          else if (sess.startsWith('tg:')) {
            const tg = sess.slice(3);
            const r = await db.query('SELECT id FROM users WHERE tg_id = $1 LIMIT 1', [tg]);
            if (r.rows && r.rows[0]) pgUserId = r.rows[0].id;
          }
          if (pgUserId) {
            try { await db.query('UPDATE users SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1', [pgUserId]); } catch(_){}
            try { await db.query('INSERT INTO connection_logs (user_id, ua, platform, ip) VALUES ($1,$2,$3,$4)', [pgUserId, ua, platform, ip]); } catch(_){}
          } else {
            try { await db.query('INSERT INTO connection_logs (ua, platform, ip) VALUES ($1,$2,$3)', [ua, platform, ip]); } catch(_){}
          }
        };
        // no bloquear request
        Promise.resolve(run()).catch(()=>{});
      }
    } catch (_) {}
  } catch (_) {}
  next();
});
app.use(express.static(path.resolve(__dirname, '../public')));

// Config JS para frontend (DSN y env)
app.get('/config.js', (req, res) => {
  try {
    res.set('Content-Type', 'application/javascript');
    res.send(`window.__SENTRY_DSN__=${JSON.stringify(process.env.SENTRY_DSN || '')};window.__APP_ENV__=${JSON.stringify(process.env.NODE_ENV || 'development')};`);
  } catch (e) { res.status(200).type('application/javascript').send(''); }
});

// Rate limit con bypass endurecido (requiere header + env)
const limiter = rateLimit({
  windowMs: security.rateLimit.windowMs,
  max: security.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    try {
      // Excluir webhook de Telegram del rate-limit
      if (req.path && req.path.startsWith('/telegram/webhook')) return true;
      const ua = String(req.headers['user-agent'] || '');
      const hx = String(req.headers['x-test-runner'] || '');
      // Omitir rate limit para clientes Telegram WebApp y rutas de login (QA)
      const isTelegramUA = /Telegram/i.test(ua);
      if (isTelegramUA) return true;
      if (req.path && (req.path === '/login' || req.path === '/games' || req.path.startsWith('/games'))) return true;
      const allowEnv = process.env.ALLOW_TEST_RUNNER === 'true' || (process.env.NODE_ENV !== 'production');
      const isTestUA = /testsprite|chrome-devtools|chrome devtools/i.test(ua);
      const isTestHX = /testsprite/i.test(hx);
      return allowEnv && (isTestUA || isTestHX);
    } catch (_) {
      return false;
    }
  }
});
app.use('/api', limiter);

// Rutas API
app.use('/api/economy', economyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/xp', xpRoutes);
app.use('/api/economy', economyExtRoutes);
app.use('/api/economy', fireRequestsRoutes);
app.use('/api/raffles', rafflesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/admin/welcome', adminWelcomeRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/games/tictactoe', tttRoutes);
app.use('/api/games/bingo', bingoRoutes);
try { if (gamesLobbyRoutes) app.use('/api/games/lobby', gamesLobbyRoutes); } catch(_) {}
app.use('/api/admin/users', require('./routes/admin_users'));
try { app.use('/api/roles', require('./routes/roles')); } catch(_) {}

// Rutas Frontend
app.get('/supply', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/supply.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/profile.html'));
});

app.get('/games', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/games.html'));
});
app.get('/games/tictactoe', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/tictactoe.html'));
});
app.get('/games/bingo', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/bingo.html'));
});
app.get('/raffles', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffles.html'));
});
app.get('/raffles/create', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffle-create.html'));
});
app.get('/raffles/room', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffle-room.html'));
});
app.get('/fire-requests', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/fire-requests.html'));
});

// Lobby
app.get('/lobby', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/lobby.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/admin/dashboard.html'));
});

app.get('/login', (req, res) => {
  return res.redirect(302, '/games');
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: Date.now() });
});

// DB healthcheck (PostgreSQL)
app.get('/api/db/health', async (req, res) => {
  try {
    if (!db || !db.query) return res.status(503).json({ success:false, error:'db_not_configured' });
    const r = await db.query('select 1 as ok');
    return res.json({ success:true, db: (r && r.rows && r.rows[0] && r.rows[0].ok) === 1 });
  } catch (e) {
    return res.status(500).json({ success:false, error:'db_unavailable' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'not_found' });
});

// Sentry error handler
try { app.use(Sentry.Handlers.errorHandler()); } catch (_) {}
// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, error: 'server_error' });
});

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  // Verificar conexión a DB (si está configurada)
  try {
    if (db && db.query) {
      db.query('select version()').then(()=>{
        logger.info('PostgreSQL conectado correctamente');
      }).catch((err)=>{
        logger.warn('PostgreSQL no disponible', { error: String(err && err.message || err) });
      });
    }
  } catch(_) {}
  try {
    const autoStart = String(process.env.WELCOME_AUTOSTART || 'false').toLowerCase() === 'true';
    if (autoStart) {
      const ev = store.getWelcomeEvent();
      if (!(ev && ev.active && Date.now() < Number(ev.endsAt || 0))) {
        store.setWelcomeEventActive({ coins: 100, fires: 10, durationHours: 72 });
        logger.info('Welcome event activated');
      } else {
        logger.info('Welcome event already active, skip activation');
      }
    } else {
      logger.info('Welcome auto-start disabled');
    }
  } catch (_) {}
  try {
    const interval = Math.max(500, parseInt(process.env.TTT_TICK_INTERVAL_MS || '1000', 10) || 1000);
    setInterval(() => {
      try { tttStore.tick(); } catch (err) { logger.error('TTT tick error', err); }
    }, interval);
    logger.info(`TTT tick loop started (interval ${interval} ms)`);
  } catch (err) {
    logger.error('Failed to start TTT tick loop', err);
  }
  try {
    if (authService && typeof authService.getUserByEmail === 'function' && typeof authService.createEmailUser === 'function') {
      const email = 'pruebatote@example.com';
      const exist = authService.getUserByEmail(email);
      if (!exist) {
        const rec = authService.createEmailUser({ name: 'pruebatote', email, password: 'pruebatote' });
        rec.verified = true;
        try { store.setUserContact({ userId: rec.internalId, email }); } catch (_) {}
        logger.info('Seed QA user created: pruebatote@example.com / pruebatote');
      } else if (!exist.verified) {
        exist.verified = true;
        try { store.setUserContact({ userId: exist.internalId, email }); } catch (_) {}
        logger.info('Seed QA user verified: pruebatote@example.com');
      }
    }
  } catch (e) { logger.warn('Seed QA user failed', e); }
  // Seed roles de Tote/Admin desde env si están presentes
  try {
    const roles = require('./services/roles');
    const parse = (s)=> String(s||'').split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean);
    const addAll = (ids, role)=>{ for(const id of ids){ try{ roles.grant(id, role);}catch(_){} } };
    addAll(parse(process.env.ROLE_TOTE_USER_IDS || process.env.TOTE_ID), 'tote');
    addAll(parse(process.env.ROLE_ADMIN_USER_IDS), 'admin');
  } catch(_) {}
});

// Ticker para TicTacToe: rota turno por timeout y emite SSE
setInterval(() => {
  try { tttStore.tick(); } catch (_) {}
}, Math.max(500, Math.min(2000, parseInt(process.env.TTT_TICK_MS || '1000', 10) || 1000)));
