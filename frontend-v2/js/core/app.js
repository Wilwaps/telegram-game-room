import { CONFIG } from './config.js';
import { UI } from './ui.js';
import { Utils } from './utils.js';
import { Registry } from './registry.js';
import { Socket } from './socket.js';

// Importar juegos (plugins)
import '../plugins/bingo/index.js';

const App = {
  user: null,
  selectedGameId: null,

  async init(){
    UI.init();
    this.user = this.getUser();
    await this.setupSocket();
    this.bindNav();
    this.renderLobby();
    this.bindProfileUI();
    this.renderAvatars();
    // Splash breve
    await Utils.sleep(700);
    UI.showScreen('lobby-screen');
  },

  getUser(){
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      return { userId: String(u.id), userName: u.username || u.first_name || 'Usuario' };
    }
    return { userId: 'dev_'+Math.random().toString(36).slice(2,10), userName: 'Dev User' };
  },

  renderLobby(){
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    const games = Registry.list();
    if (!games.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No hay juegos registrados (v2).';
      grid.appendChild(empty);
      return;
    }
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = `game-card gc-${game.id}`;
      card.innerHTML = `
        <div class="icon">${game.icon || '🎮'}</div>
        <div class="meta">
          <div class="name">${Utils.escapeHtml(game.name)}</div>
          <div class="desc">${Utils.escapeHtml(game.desc || '')}</div>
          <div>
            <button class="btn">Jugar</button>
          </div>
        </div>
      `;
      card.addEventListener('click', ()=> {
        this.markCardActive(game.id);
        this.startGame(game.id);
      });
      grid.appendChild(card);
    });
    if (this.selectedGameId){ this.markCardActive(this.selectedGameId); }
  },

  markCardActive(id){
    this.selectedGameId = id;
    document.querySelectorAll('#games-grid .game-card').forEach(el=> el.classList.remove('active'));
    const el = document.querySelector(`#games-grid .gc-${CSS.escape(id)}`);
    if (el) el.classList.add('active');
  },

  startGame(id){
    const game = Registry.get(id);
    if (!game){ UI.showToast('Juego no encontrado', 'error'); return; }
    this.selectedGameId = id;
    UI.showScreen('game-screen');
    document.getElementById('game-title').textContent = game.name;
    // aplicar tema por juego en el screen
    const screen = document.getElementById('game-screen');
    screen.classList.remove('theme-bingo');
    screen.classList.add(`theme-${id}`);
    this.renderAvatars();
    const root = document.getElementById('game-root');
    root.innerHTML = '';
    try {
      game.mount(root, { CONFIG, UI, Utils, user: this.user, onExit: ()=>this.exitGame() });
    } catch (e){
      console.error('Error al montar juego', e);
      UI.showToast('Error al iniciar el juego', 'error');
      this.exitGame();
    }
  },

  exitGame(){
    const root = document.getElementById('game-root');
    const current = root.__plugin;
    try { current && current.unmount && current.unmount(); } catch(_){}
    root.__plugin = null;
    UI.showScreen('lobby-screen');
  }
};

App.setupSocket = async function(){
  try{
    await Socket.connect();
    const s = Socket.socket;
    if (!s || !s.on) return;
    // Estado inicial del bono diario
    s.on('connect', ()=>{ try{ s.emit('daily_bonus_status'); }catch(_){ } });
    try{ s.emit('daily_bonus_status'); }catch(_){ }
    // Actualizaciones de bono diario
    s.on('daily_bonus_info', (info)=>{
      try{
        const amtEl = document.getElementById('daily-amount');
        const stEl = document.getElementById('daily-status');
        const remEl = document.getElementById('daily-remaining');
        const btn = document.getElementById('daily-claim');
        if (amtEl) amtEl.textContent = String(info?.amount ?? 0);
        if (stEl) stEl.textContent = info?.available ? 'Disponible' : 'No disponible';
        if (remEl){
          const ms = Math.max(0, parseInt(info?.remainingMs||0,10));
          if (ms > 0){
            const h = Math.floor(ms/3600000); const m = Math.floor((ms%3600000)/60000);
            remEl.textContent = `${h}h ${m}m`;
          } else remEl.textContent = '0h 0m';
        }
        if (btn){ btn.disabled = !info?.available; btn.classList.remove('is-loading'); }
      }catch(e){ console.error(e); }
    });
  }catch(e){ console.warn('socket setup failed', e); }
};

App.bindNav = function(){
  document.addEventListener('click', (e)=>{
    const a = e.target.closest && e.target.closest('a.nav-item[data-action]');
    if (!a) return;
    e.preventDefault();
    const action = a.getAttribute('data-action');
    // actualizar estados activos en todas las navs
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n=> n.classList.remove('active'));
    document.querySelectorAll(`.bottom-nav .nav-item[data-action="${action}"]`).forEach(n=> n.classList.add('active'));
    switch(action){
      case 'lobby': UI.showScreen('lobby-screen'); break;
      case 'profile': UI.showScreen('profile-screen'); break;
      case 'raffles': UI.showScreen('raffles-screen'); break;
      case 'bingo': App.startGame('bingo'); break;
      case 'game': UI.showScreen('game-screen'); break;
      default: UI.showScreen('lobby-screen'); break;
    }
  }, { passive:false });
};

// -------- Perfil y Avatar --------
App.renderAvatars = function(){
  const u = this.user || {};
  const url = (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) || '';
  const name = u.userName || 'U';
  const dataUrl = App._avatarDataUrl((name && name[0] ? name[0] : 'U').toUpperCase());
  const set = (id)=>{
    const img = document.getElementById(id);
    if (!img) return;
    img.src = url || dataUrl;
    img.onclick = ()=> {
      UI.showScreen('profile-screen');
      // activar nav 'profile' en todas las barras
      document.querySelectorAll('.bottom-nav .nav-item').forEach(n=> n.classList.remove('active'));
      document.querySelectorAll('.bottom-nav .nav-item[data-action="profile"]').forEach(n=> n.classList.add('active'));
    };
  };
  set('profile-avatar-lobby');
  set('profile-avatar-game');
};

App._avatarDataUrl = function(letter){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='100%' height='100%' rx='36' ry='36' fill='%231b1f3a'/><text x='50%' y='58%' font-size='36' font-family='Arial, Helvetica, sans-serif' fill='%23ffffff' text-anchor='middle'>${letter}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

App.bindProfileUI = function(){
  const sendBtn = document.getElementById('pf-send');
  const saveBtn = document.getElementById('pf-save');
  const reqKeyBtn = document.getElementById('pf-request-key');
  const dailyBtn = document.getElementById('daily-claim');
  try{
    // Cargar desde backend si existe
    const u = App.user;
    if (u?.userId){
      fetch(`/api/profile/${encodeURIComponent(u.userId)}`).then(r=>r.json()).then(j=>{
        if (j?.success && j.profile){
          const p=j.profile;
          if (p.firstName) document.getElementById('pf-first').value=p.firstName;
          if (p.lastName) document.getElementById('pf-last').value=p.lastName;
          if (p.phone) document.getElementById('pf-phone').value=p.phone;
          if (p.email) document.getElementById('pf-email').value=p.email;
        }
      }).catch(()=>{});
      // Determinar si es patrocinador para mostrar P2P
      fetch('/api/economy/sponsors').then(r=>r.json()).then(j=>{
        const items = j?.sponsors||[];
        const isSponsor = !!items.find(it=> String(it.userId) === String(u.userId));
        const sec = document.getElementById('pf-p2p-section');
        if (sec) sec.style.display = isSponsor ? '' : 'none';
      }).catch(()=>{});
      // Solicitar estado de bono diario
      try{ Socket.socket && Socket.socket.emit && Socket.socket.emit('daily_bonus_status'); }catch(_){ }
    } else {
      const d = JSON.parse(localStorage.getItem('v2.profile')||'{}');
      if (d.first) document.getElementById('pf-first').value = d.first;
      if (d.last) document.getElementById('pf-last').value = d.last;
      if (d.phone) document.getElementById('pf-phone').value = d.phone;
      if (d.email) document.getElementById('pf-email').value = d.email;
    }
  }catch(_){ }
  dailyBtn && dailyBtn.addEventListener('click', ()=>{
    try{
      dailyBtn.disabled = true; dailyBtn.classList.add('is-loading');
      Socket.socket && Socket.socket.emit && Socket.socket.emit('daily_bonus_claim');
      setTimeout(()=>{ dailyBtn.classList.remove('is-loading'); }, 1200);
    }catch(e){ dailyBtn.classList.remove('is-loading'); }
  });
  sendBtn && sendBtn.addEventListener('click', async ()=>{
    const to = document.getElementById('pf-to-id').value.trim();
    const amount = parseInt(document.getElementById('pf-amount').value, 10);
    const reason = (document.getElementById('pf-reason').value||'transfer').trim();
    const key = document.getElementById('pf-key').value.trim();
    const from = App.user?.userId;
    if (!from || !to || !amount){ return UI.showToast('Datos inválidos', 'warning'); }
    try{
      sendBtn.disabled = true; sendBtn.classList.add('is-loading');
      const r = await fetch('/api/economy/transfer', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ fromUserId: from, toUserId: to, amount, reason, sponsorKey: key }) });
      const j = await r.json().catch(()=>({success:false}));
      if (!r.ok || !j.success){ throw new Error(j?.error||('HTTP '+r.status)); }
      UI.showToast('Transferencia enviada', 'success');
      UI.log(`p2p: ${from} -> ${to} amount=${amount} reason=${reason}`, 'info', 'profile');
    }catch(e){
      console.error(e);
      UI.showToast('Error en transferencia', 'error');
      UI.log(`p2p:error ${String(e)}`, 'error', 'profile');
    }finally{
      sendBtn.disabled = false; sendBtn.classList.remove('is-loading');
    }
  });
  saveBtn && saveBtn.addEventListener('click', ()=>{
    const first = document.getElementById('pf-first').value.trim();
    const last = document.getElementById('pf-last').value.trim();
    const phone = document.getElementById('pf-phone').value.trim();
    const email = document.getElementById('pf-email').value.trim();
    const data = { firstName:first, lastName:last, phone, email };
    const u = App.user;
    if (u?.userId){
      fetch(`/api/profile/${encodeURIComponent(u.userId)}`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
        .then(r=>r.json()).then(j=>{
          if(j?.success){ UI.showToast('Perfil actualizado', 'success'); UI.log('profile:saved remote','info','profile'); }
          else { throw new Error(j?.error||'fail'); }
        }).catch(()=>{ UI.showToast('Error guardando perfil', 'error'); });
    } else {
      try{ localStorage.setItem('v2.profile', JSON.stringify({ first, last, phone, email })); }catch(_){ }
      UI.showToast('Datos guardados localmente', 'success');
      UI.log('profile:saved local', 'info', 'profile');
    }
  });
  reqKeyBtn && reqKeyBtn.addEventListener('click', ()=>{
    const newKey = document.getElementById('pf-new-key').value.trim();
    if (!newKey) { UI.showToast('Ingresa nueva clave', 'warning'); return; }
    const u = App.user;
    if (!u?.userId){ UI.showToast('Usuario no identificado', 'error'); return; }
    fetch(`/api/profile/${encodeURIComponent(u.userId)}/request-key-change`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ newKey }) })
      .then(r=>r.json()).then(j=>{
        if(j?.success){ UI.showToast('Solicitud de cambio enviada', 'success'); UI.log('profile:key_change_request','info','profile'); }
        else { throw new Error(j?.error||'fail'); }
      }).catch(()=>{ UI.showToast('Error al solicitar cambio', 'error'); });
  });
};

window.AppV2 = App;

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ()=> App.init());
} else {
  App.init();
}
