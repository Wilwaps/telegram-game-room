// Simple reverse proxy to production for TestSprite tunnel
// Listens on 5173 and forwards HTTP and WebSocket to production

const http = require('http');
const httpProxy = require('http-proxy');

const PORT = process.env.PORT ? parseInt(process.env.PORT,10) : 5173;
const TARGET = process.env.TARGET || 'https://telegram-game-room-production.up.railway.app';

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  ws: true,
  secure: true
});

proxy.on('error', (err, req, res) => {
  try {
    console.error('[proxy] error:', err && err.message ? err.message : String(err));
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error');
  } catch (_) {}
});

// Inject test headers to bypass rate-limit in QA
proxy.on('proxyReq', (proxyReq, req) => {
  try {
    proxyReq.setHeader('X-Test-Runner', 'testsprite');
    const ua = String(req.headers['user-agent']||'').trim();
    proxyReq.setHeader('User-Agent', ua ? `${ua} TestSprite` : 'TestSprite');
  } catch(_){}
});

proxy.on('proxyReqWs', (proxyReq, req) => {
  try {
    proxyReq.setHeader('X-Test-Runner', 'testsprite');
    const ua = String(req.headers['user-agent']||'').trim();
    proxyReq.setHeader('User-Agent', ua ? `${ua} TestSprite` : 'TestSprite');
  } catch(_){}
});

const server = http.createServer((req, res) => {
  proxy.web(req, res);
});

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[proxy] listening on http://0.0.0.0:${PORT} -> ${TARGET}`);
});
