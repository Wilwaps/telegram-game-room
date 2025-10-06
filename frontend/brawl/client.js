// Cliente Brawl - Arena MVP
// Conexión Socket.io, inputs táctiles/teclado, render Canvas, predicción/interpolación

const socket = io('/brawl');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');

// Estados locales
let localState = null; // {x,y,vx,vy,...}
let serverStates = []; // Buffer para interpolación
let inputMask = 0;
let seq = 0;
let roomId = null;
let connected = false;

// Config física (debe coincidir con servidor)
const PHYS = {
  gravity: 1800,
  baseSpeed: 240,
  maxSpeed: 300,
  accel: 2800,
  friction: 3200,
  jump: 680,
  doubleJump: 0.85,
  dashSpeed: 480,
  dodgeIframes: 0.30,
  fastFall: 1.3
};

// Bitmask de inputs (igual que servidor)
const INPUT = { LEFT: 1<<0, RIGHT: 1<<1, JUMP: 1<<2, DASH: 1<<3, DODGE: 1<<4, FAST_FALL: 1<<5 };

// Render: plataformas del mapa
const PLATFORMS = [
  {x:160,y:900,w:1600,h:60,c:'#555'}, // suelo
  {x:400,y:650,w:450,h:30,c:'#777'}, {x:1120,y:650,w:450,h:30,c:'#777'},
  {x:800,y:400,w:320,h:30,c:'#999'}
];

// Autenticación
socket.emit('authenticate', {
  userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'guest',
  userName: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Guest'
});

// Eventos Socket
socket.on('authenticated', (data) => {
  console.log('✅ Authenticated:', data);
  connected = true;
  document.getElementById('connectionStatus').textContent = 'Conectado';
  // Auto-join a una room (para MVP)
  roomId = 'arena-test-' + Date.now();
  socket.emit('brawl_join', { roomId });
});

socket.on('brawl_state', (state) => {
  // Buffer para interpolación
  serverStates.push(state);
  if (serverStates.length > 10) serverStates.shift();
});

socket.on('brawl_score', (score) => {
  document.getElementById('playerCount').textContent = score.players || 0;
});

socket.on('error', (err) => {
  console.error('❌ Error:', err);
  alert(`Error: ${err.message || 'Desconocido'}`);
});

socket.on('disconnect', () => {
  connected = false;
  document.getElementById('connectionStatus').textContent = 'Desconectado';
});

// Inputs: teclado
document.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'ArrowLeft': case 'a': case 'A': inputMask |= INPUT.LEFT; break;
    case 'ArrowRight': case 'd': case 'D': inputMask |= INPUT.RIGHT; break;
    case 'ArrowUp': case 'w': case 'W': inputMask |= INPUT.JUMP; break;
    case ' ': inputMask |= INPUT.DASH; e.preventDefault(); break;
    case 'Shift': inputMask |= INPUT.DODGE; break;
    case 's': case 'S': inputMask |= INPUT.FAST_FALL; break;
  }
  sendInput();
});

document.addEventListener('keyup', (e) => {
  switch(e.key) {
    case 'ArrowLeft': case 'a': case 'A': inputMask &= ~INPUT.LEFT; break;
    case 'ArrowRight': case 'd': case 'D': inputMask &= ~INPUT.RIGHT; break;
    case 'ArrowUp': case 'w': case 'W': inputMask &= ~INPUT.JUMP; break;
    case ' ': inputMask &= ~INPUT.DASH; break;
    case 'Shift': inputMask &= ~INPUT.DODGE; break;
    case 's': case 'S': inputMask &= ~INPUT.FAST_FALL; break;
  }
  sendInput();
});

// Inputs: táctiles
document.getElementById('leftBtn').addEventListener('touchstart', () => { inputMask |= INPUT.LEFT; sendInput(); });
document.getElementById('leftBtn').addEventListener('touchend', () => { inputMask &= ~INPUT.LEFT; sendInput(); });
document.getElementById('rightBtn').addEventListener('touchstart', () => { inputMask |= INPUT.RIGHT; sendInput(); });
document.getElementById('rightBtn').addEventListener('touchend', () => { inputMask &= ~INPUT.RIGHT; sendInput(); });
document.getElementById('jumpBtn').addEventListener('touchstart', () => { inputMask |= INPUT.JUMP; sendInput(); });
document.getElementById('jumpBtn').addEventListener('touchend', () => { inputMask &= ~INPUT.JUMP; sendInput(); });
document.getElementById('dashBtn').addEventListener('touchstart', () => { inputMask |= INPUT.DASH; sendInput(); });
document.getElementById('dashBtn').addEventListener('touchend', () => { inputMask &= ~INPUT.DASH; sendInput(); });
document.getElementById('dodgeBtn').addEventListener('touchstart', () => { inputMask |= INPUT.DODGE; sendInput(); });
document.getElementById('dodgeBtn').addEventListener('touchend', () => { inputMask &= ~INPUT.DODGE; sendInput(); });

function sendInput() {
  if (!connected || !roomId) return;
  socket.emit('brawl_input', { mask: inputMask, ts: Date.now(), seq: ++seq });
}

// Render loop (60 FPS)
function render() {
  // Limpiar canvas
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render plataformas
  PLATFORMS.forEach(p => {
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  });

  // Render jugadores (desde server state interpolado)
  if (serverStates.length > 0) {
    const latest = serverStates[serverStates.length - 1];
    latest.players.forEach(p => {
      ctx.fillStyle = p.userId === window.Telegram?.WebApp?.initDataUnsafe?.user?.id ? '#4a90e2' : '#e74c3c';
      ctx.fillRect(p.x - 10, p.y - 20, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText(p.userName || 'Player', p.x - 20, p.y - 25);
    });
  }

  // HUD update
  if (localState) {
    document.getElementById('pos').textContent = `${Math.round(localState.x || 0)},${Math.round(localState.y || 0)}`;
    document.getElementById('vel').textContent = `${Math.round(localState.vx || 0)},${Math.round(localState.vy || 0)}`;
  }
  document.getElementById('inputs').textContent = inputMask.toString(2).padStart(6, '0');

  requestAnimationFrame(render);
}

// Iniciar render y ocultar loading
setTimeout(() => {
  loading.classList.add('hide');
  render();
}, 1000);
