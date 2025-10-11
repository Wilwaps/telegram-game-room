import { Registry } from '../../core/registry.js';
import { UI } from '../../core/ui.js';
import { Utils } from '../../core/utils.js';
import { Socket } from '../../core/socket.js';

function genUnique(min, max, count){
  const set = new Set();
  while (set.size < count){ set.add(Utils.randInt(min, max)); }
  return Array.from(set).sort((a,b)=>a-b);
}

function generateCard(){
  const cols = [
    genUnique(1, 15, 5),
    genUnique(16, 30, 5),
    genUnique(31, 45, 5),
    genUnique(46, 60, 5),
    genUnique(61, 75, 5)
  ];
  // Centro libre
  cols[2][2] = 0; // 0 representará FREE
  return { id: 'c_'+Math.random().toString(36).slice(2,8), numbers: cols, marked: new Set([0]) };
}

function validateLine(card){
  const n = card.numbers; const has = (x)=> card.marked.has(x) || x===0;
  // Horizontales
  for (let r=0;r<5;r++){ let ok=true; for (let c=0;c<5;c++){ if (!has(n[c][r])){ ok=false; break; } } if (ok) return true; }
  // Verticales
  for (let c=0;c<5;c++){ let ok=true; for (let r=0;r<5;r++){ if (!has(n[c][r])){ ok=false; break; } } if (ok) return true; }
  // Diagonales
  let ok1=true; for (let i=0;i<5;i++){ if (!has(n[i][i])) { ok1=false; break; } }
  if (ok1) return true;
  let ok2=true; for (let i=0;i<5;i++){ if (!has(n[i][4-i])) { ok2=false; break; } }
  return ok2;
}

const BingoV2 = {
  id: 'bingo',
  name: 'Bingo',
  icon: '🎱',
  desc: 'Marca tus números y canta ¡Bingo! (v2 demo)',

  mount(root, ctx){
    const { UI:ui = UI } = ctx || {};
    const state = { drawn: new Set(), recent: [], card: generateCard(), cards: [], activeCardId: null, last: null, room: null, isHost: false, userId: (ctx && ctx.user && ctx.user.userId) || null, missingUserIds: [], ecoMode: 'friendly', finishing: false, claimAction: 'claim', pendingStart: false };
    const disposers = [];

    const wrap = document.createElement('div');
    wrap.className = 'bn-wrap';

    // Controles superiores: crear/unirse
    const menuPanel = document.createElement('div');
    menuPanel.className = 'bn-panel';
    menuPanel.innerHTML = `
      <div class="bn-row" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <button id="bn-create" class="btn btn-primary">Crear sala</button>
        <label style="display:flex; gap:6px; align-items:center"><input id="bn-public" type="checkbox" /> Pública</label>
        <button id="bn-make-public" class="btn" style="display:none">Hacer pública</button>
        <div id="bn-mode" class="bn-mode" style="display:flex; gap:6px; align-items:center; margin-left:10px;">
          <label><input type="radio" name="bnEcoMode" value="friendly" checked> Amistoso</label>
          <label><input type="radio" name="bnEcoMode" value="fire"> 🔥 Fuego</label>
        </div>
        <div id="bn-advanced" class="bn-adv" style="display:none; gap:8px; align-items:center; flex-wrap:wrap">
          <label>Modo
            <select id="bn-game-mode" class="input" style="min-width:120px">
              <option value="line">Línea</option>
              <option value="double">Doble línea</option>
              <option value="full">Cartón lleno</option>
            </select>
          </label>
          <label>Max jugadores <input id="bn-max-players" class="input" type="number" min="2" max="100" value="30" style="width:70px" /></label>
          <label data-component-name="<label />">Max cartones/usuario <input id="bn-max-cards" class="input" type="number" min="1" max="50" value="1" style="width:70px"></label>
          <label style="display:block; min-width:100%"><input id="bn-autodraw" type="checkbox" /> Auto</label>
          <label id="bn-interval-wrap" style="display:none">Intervalo (s) <input id="bn-interval" class="input" type="number" min="1" max="60" value="5" style="width:100px" /></label>
        </div>
        <button id="bn-ready" class="btn btn-secondary" style="display:none" disabled>Estoy listo</button>
        <div style="flex:1"></div>
        <input id="bn-code" class="input" placeholder="Código (000000)" maxlength="6" inputmode="numeric" pattern="[0-9]*" style="max-width:140px" />
        <input id="bn-cards" class="input" type="number" min="1" value="1" style="width:80px" />
        <button id="bn-join" class="btn">Unirse/Comprar</button>
      </div>`;
    wrap.appendChild(menuPanel);

    // Listado de salas públicas (solo cuando no estás en una sala)
    const publicPanel = document.createElement('div');
    publicPanel.className = 'bn-panel';
    publicPanel.innerHTML = `<h3 class="bn-title">Salas públicas de Bingo</h3><div id="bn-public-list" class="bn-public"></div>`;
    const publicListEl = publicPanel.querySelector('#bn-public-list');
    wrap.appendChild(publicPanel);

    // Lobby de espera (dentro de una sala)
    const lobbyPanel = document.createElement('div');
    lobbyPanel.className = 'bn-panel';
    lobbyPanel.innerHTML = `<div id="bn-lobby" class="bn-lobby"></div>`;
    const lobbyRoot = lobbyPanel.querySelector('#bn-lobby');
    wrap.appendChild(lobbyPanel);

    // Panel draw (solo dentro de sala e iniciado)
    const drawPanel = document.createElement('div');
    drawPanel.className = 'bn-panel';
    drawPanel.innerHTML = `<h3 class="bn-title">Números cantados</h3><div class="bn-draw-grid" id="bn-draw-grid"></div><div class="bn-recent" id="bn-recent"></div>`;
    const drawGrid = drawPanel.querySelector('#bn-draw-grid');
    const recentEl = drawPanel.querySelector('#bn-recent');
    wrap.appendChild(drawPanel);

    // Panel cards
    const cardsPanel = document.createElement('div');
    cardsPanel.className = 'bn-panel';
    cardsPanel.innerHTML = `<h3 class="bn-title">Tus cartones</h3><div class="bn-cards" id="bn-cards"></div>`;
    const cardsRoot = cardsPanel.querySelector('#bn-cards');
    wrap.appendChild(cardsPanel);

    // Claim overlay
    const claimOverlay = document.createElement('div');
    claimOverlay.className = 'bn-claim-overlay';
    claimOverlay.innerHTML = `<button class="bn-claim-btn">¡Bingo!</button>`;
    const claimBtn = claimOverlay.querySelector('.bn-claim-btn');
    document.body.appendChild(claimOverlay);

    const fab = document.createElement('button');
    fab.className = 'bn-fab';
    fab.textContent = 'Cantar número';
    fab.style.display = 'none'; // oculto por defecto
    document.body.appendChild(fab);

    const statePublic = { rooms: new Map() };
    // Ocultar paneles de juego por defecto (fuera de sala)
    try { drawPanel.style.display = 'none'; cardsPanel.style.display = 'none'; claimOverlay.style.display = 'none'; fab.style.display = 'none'; } catch(_){ }

    const renderPublicRooms = ()=>{
      if (state.room) { publicPanel.style.display = 'none'; return; }
      publicPanel.style.display = '';
      // Asegurar ocultar paneles de juego fuera de sala
      try { drawPanel.style.display = 'none'; cardsPanel.style.display = 'none'; claimOverlay.style.display = 'none'; fab.style.display = 'none'; } catch(_){ }
      // Mostrar de nuevo controles de creación fuera de sala
      try {
        const createBtn = menuPanel.querySelector('#bn-create'); if (createBtn) createBtn.style.display = '';
        const pubEl = menuPanel.querySelector('#bn-public'); if (pubEl && pubEl.closest('label')) pubEl.closest('label').style.display = '';
      } catch(_){ }
      if (!statePublic.rooms.size) { publicListEl.innerHTML = '<div class="muted">No hay salas públicas disponibles…</div>'; return; }
      const items = Array.from(statePublic.rooms.values());
      publicListEl.innerHTML = items.map(r=>{
        const ready = (r.players||[]).filter(p=>p.ready).length;
        return `<div class="bn-room-item">
          <div class="meta"><strong>#${r.code}</strong> · ${Utils.escapeHtml(r.hostName||'Host')} · ${r.mode||'line'} · ${ready}/${(r.players||[]).length}/${r.maxPlayers||30}</div>
          <div class="actions"><button class="btn btn-sm" data-join="${r.code}">Unirse</button></div>
        </div>`;
      }).join('');
      // bind join
      publicListEl.querySelectorAll('[data-join]').forEach(btn=>{
        btn.onclick = ()=>{
          const code = btn.getAttribute('data-join');
          const cnt = parseInt((menuPanel.querySelector('#bn-cards') && menuPanel.querySelector('#bn-cards').value) || '1', 10) || 1;
          try { Socket.socket.emit('join_bingo', { roomCode: code, cardsCount: cnt }); } catch(_){ ui.showToast('No se pudo unir', 'error'); }
        };
      });
    };

    const renderDraw = ()=>{
      drawGrid.innerHTML = '';
      for (let n=1;n<=75;n++){
        const d = document.createElement('div');
        d.className = 'bn-number';
        d.textContent = String(n);
        if (state.drawn.has(n)) d.classList.add('active');
        if (state.last === n) d.classList.add('last');
        drawGrid.appendChild(d);
      }
      recentEl.innerHTML = state.recent.map(n=>`<div class="bn-ball">${n}</div>`).join('');
      // Ajustar grid de números para adaptarse al contenedor
      drawGrid.style.display = 'grid';
      drawGrid.style.gridTemplateColumns = 'repeat(15, minmax(18px, 1fr))';
      drawGrid.style.gap = '4px';
    };

    const renderLobby = ()=>{
      const room = state.room;
      const el = lobbyRoot;
      if (!room) { el.innerHTML = '<div class="muted">Crea o únete a una sala para ver participantes…</div>'; return; }
      const players = room.players || [];
      const readyCount = players.filter(p=>p.ready).length;
      const total = players.length;
      const missingTickets = (state.missingUserIds||[]);
      const playersCount = total;
      const maxPlayers = room.maxPlayers || 30;
      const me = players.find(p=>String(p.userId)===String(state.userId));
      const myCardsCount = (me && typeof me.cardsCount==='number') ? me.cardsCount : Math.max(1, (state.cards && state.cards.length) || 1);
      el.innerHTML = `
        <div class="bn-lobby-top" style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
          <div style="display:flex; gap:8px; align-items:center"><strong>Sala #${room.code}</strong></div>
          <div style="display:flex; gap:8px; align-items:center">
            <button id="bn-share" class="btn btn-sm">Compartir</button>
            <button id="bn-leave" class="btn btn-secondary btn-sm">Salir</button>
          </div>
        </div>
        <div class="bn-lobby-head" style="display:flex; align-items:center; gap:10px; justify-content:space-between">
          <div><strong>Jugadores:</strong> ${playersCount}/${maxPlayers} · Listos ${readyCount}/${total}</div>
        </div>
        ${!room.started ? `<div class="bn-my-cards" style="display:flex; align-items:center; gap:8px; margin:8px 0;"><label>Mis cartones <input id="bn-my-cards" class="input" type="number" min="1" max="10" value="${myCardsCount}" style="width:80px" /></label></div>` : ''}
        ${room.ecoMode === 'fire' ? `<div class="warn">Modo 🔥 activo. Cada cartón cuesta 1 🔥. ${missingTickets.length? `Faltan tickets: ${missingTickets.length}`: ''}</div>`: '<div class="muted">Modo amistoso</div>'}
        <div class="bn-lobby-list">
          ${players.map(p=>`
            <div class="bn-player ${p.ready?'ready':''}">
              <span class="name">${Utils.escapeHtml(p.userName||p.userId)}</span>
              <span class="status">${p.ready?'Listo ✅':'Esperando…'}</span>
              ${String(p.userId)===String(state.userId)? `<button class="btn btn-sm ${p.ready?'':'btn-secondary'}" data-action="toggle-ready">${p.ready?'No listo':'Estoy listo'}</button>`:''}
            </div>
          `).join('')}
        </div>
        ${state.isHost ? `<div class="bn-lobby-actions" style="margin-top:10px"><button id="bn-start-bottom" class="btn" style="background:#22c55e; color:#fff">Iniciar</button></div>` : ''}
      `;
      // Bind toggle-ready if present
      el.querySelectorAll('button[data-action="toggle-ready"]').forEach(btn=>{
        btn.onclick = ()=>{
          const s = Socket.socket;
          const code = room.code;
          const me = (room.players||[]).find(p=>String(p.userId)===String(state.userId));
          const next = !(me&&me.ready);
          try {
            const myCardsEl2 = lobbyPanel.querySelector('#bn-my-cards');
            if (myCardsEl2) {
              const raw = parseInt(myCardsEl2.value,10);
              const v = Math.max(1, Math.min(10, isNaN(raw)?1:raw));
              if (s && s.emit) { s.emit('bingo_set_cards', { roomCode: code, count: v }); }
            }
          } catch(_){ }
          if (s && s.emit) { try{ s.emit('bingo_set_ready', { roomCode: code, ready: next }); }catch(_){}}
          else { // fallback offline
            if (me) me.ready = next;
            renderLobby();
          }
        };
      });
      const startBtn = lobbyPanel.querySelector('#bn-start');
      if (startBtn) {
        startBtn.style.display = state.isHost ? '' : 'none';
        const allReady = total>0 && readyCount===total;
        let allow = allReady;
        if (room.ecoMode==='fire') { allow = allow && (missingTickets.length===0); }
        startBtn.disabled = !state.isHost || !allow;
        startBtn.onclick = ()=>{
          if (!state.room) return;
          try {
            // Aplicar configuración seleccionada antes de iniciar
            const ecoMode = Array.from(menuPanel.querySelectorAll('input[name="bnEcoMode"]')).find(x=>x.checked)?.value || 'friendly';
            const ticketInput = menuPanel.querySelector('#bn-cards');
            const gmEl = menuPanel.querySelector('#bn-game-mode');
            const mpEl = menuPanel.querySelector('#bn-max-players');
            const mcEl = menuPanel.querySelector('#bn-max-cards');
            const adEl = menuPanel.querySelector('#bn-autodraw');
            const itEl = menuPanel.querySelector('#bn-interval');
            const payload = {
              roomCode: state.room.code,
              ecoMode,
              mode: gmEl ? gmEl.value : (room.mode||'line'),
              maxPlayers: mpEl ? parseInt(mpEl.value,10)||30 : (room.maxPlayers||30),
              maxCardsPerUser: mcEl ? (parseInt(mcEl.value,10)||1) : (room.maxCardsPerUser||1),
              autoDraw: adEl ? !!adEl.checked : !!room.autoDraw,
              drawIntervalMs: ((itEl ? parseInt(itEl.value,10)||5 : Math.round((room.drawIntervalMs||5000)/1000)) * 1000)
            };
            if (ecoMode === 'fire' && ticketInput && ticketInput.style.display !== 'none') {
              payload.ticketPrice = parseInt(ticketInput.value||'1',10)||1;
            }
            state.pendingStart = true;
            Socket.socket.emit('bingo_set_mode', payload);
          } catch(e){ ui.showToast('No se pudo iniciar','error'); }
        };
      }
      const startBottom = lobbyPanel.querySelector('#bn-start-bottom');
      if (startBottom) {
        const allReady = total>0 && readyCount===total;
        let allow = allReady;
        if (room.ecoMode==='fire') { allow = allow && (missingTickets.length===0); }
        startBottom.disabled = !state.isHost || !allow;
        startBottom.onclick = ()=>{
          if (!state.room) return;
          try {
            const ecoMode = Array.from(menuPanel.querySelectorAll('input[name="bnEcoMode"]')).find(x=>x.checked)?.value || 'friendly';
            const ticketInput = menuPanel.querySelector('#bn-cards');
            const gmEl = menuPanel.querySelector('#bn-game-mode');
            const mpEl = menuPanel.querySelector('#bn-max-players');
            const mcEl = menuPanel.querySelector('#bn-max-cards');
            const adEl = menuPanel.querySelector('#bn-autodraw');
            const itEl = menuPanel.querySelector('#bn-interval');
            const payload = {
              roomCode: state.room.code,
              ecoMode,
              mode: gmEl ? gmEl.value : (room.mode||'line'),
              maxPlayers: mpEl ? parseInt(mpEl.value,10)||30 : (room.maxPlayers||30),
              maxCardsPerUser: mcEl ? (parseInt(mcEl.value,10)||1) : (room.maxCardsPerUser||1),
              autoDraw: adEl ? !!adEl.checked : !!room.autoDraw,
              drawIntervalMs: ((itEl ? parseInt(itEl.value,10)||5 : Math.round((room.drawIntervalMs||5000)/1000)) * 1000)
            };
            if (ecoMode === 'fire' && ticketInput && ticketInput.style.display !== 'none') {
              payload.ticketPrice = parseInt(ticketInput.value||'1',10)||1;
            }
            state.pendingStart = true;
            Socket.socket.emit('bingo_set_mode', payload);
          } catch(e){ ui.showToast('No se pudo iniciar','error'); }
        };
      }
      const myCardsEl = lobbyPanel.querySelector('#bn-my-cards');
      if (myCardsEl) {
        const syncCards = ()=>{
          const raw = parseInt(myCardsEl.value,10);
          const v = Math.max(1, Math.min(10, isNaN(raw)?1:raw));
          myCardsEl.value = String(v);
          try { Socket.socket && Socket.socket.emit && Socket.socket.emit('bingo_set_cards', { roomCode: room.code, count: v }); } catch(_){ ui.showToast('No se pudo ajustar cartones','error'); }
        };
        myCardsEl.onchange = syncCards;
        myCardsEl.oninput = syncCards;
      }
      const leaveBtn = lobbyPanel.querySelector('#bn-leave');
      if (leaveBtn) {
        leaveBtn.onclick = ()=>{
          if (!state.room) return;
          try { Socket.socket.emit('leave_bingo', { roomCode: state.room.code }); } catch(_){ }
          try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){ }
        };
      }
      const shareBtn = lobbyPanel.querySelector('#bn-share');
      if (shareBtn) {
        shareBtn.onclick = async ()=>{
          try {
            const code = state?.room?.code || '';
            const text = `Únete a mi sala de Bingo: código ${code}`;
            const url = location.origin;
            try { await navigator.clipboard?.writeText?.(text); ui.showToast('Código copiado', 'success'); } catch(_){ }
            if (navigator.share) {
              try { await navigator.share({ title: 'Bingo', text, url }); return; } catch(_){ }
            }
            const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
            window.open(tg, '_blank');
          } catch(_){ ui.showToast('No se pudo compartir','error'); }
        };
      }
      if (cardsPanel) cardsPanel.style.display = room.started ? '' : 'none';
      if (drawPanel) drawPanel.style.display = room.started ? '' : 'none';
      if (claimOverlay) claimOverlay.style.display = room.started ? '' : 'none';
      if (fab) fab.style.display = (state.isHost && room.started) ? '' : 'none';
      // Ocultar paneles de menú y lobby cuando inicia el juego
      if (menuPanel) menuPanel.style.display = room.started ? 'none' : '';
      if (lobbyPanel) lobbyPanel.style.display = room.started ? 'none' : '';
    };

    const renderCard = ()=>{
      cardsRoot.innerHTML = '';
      cardsRoot.style.display = 'grid';
      cardsRoot.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
      cardsRoot.style.gap = '12px';
      const arr = (state.cards && state.cards.length) ? state.cards : [state.card];
      const show = arr;
      show.forEach((c)=>{
        const cardEl = document.createElement('div');
        cardEl.className = 'bn-card';
        cardEl.setAttribute('data-id', c.id || '');
        cardEl.style.width = '100%';
        cardEl.innerHTML = `<div class="hdr"><span>Cartón</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'bn-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        grid.style.gap = '4px';
        for (let r=0;r<5;r++){
          for (let col=0; col<5; col++){
            const num = c.numbers[col][r];
            const cell = document.createElement('div');
            cell.className = 'bn-cell';
            cell.style.display = 'flex';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
            cell.style.aspectRatio = '1';
            cell.style.overflow = 'hidden';
            cell.style.textOverflow = 'ellipsis';
            cell.style.whiteSpace = 'nowrap';
            cell.style.fontSize = 'var(--bn-cell-font, 14px)';
            if (num === 0) cell.classList.add('free');
            cell.textContent = num === 0 ? 'FREE' : String(num);
            if (c.marked instanceof Set && c.marked.has(num)) cell.classList.add('marked');
            if (state.last && num === state.last) cell.classList.add('last-drawn');
            if (num !== 0 && state.drawn.has(num) && !(c.marked instanceof Set && c.marked.has(num))) {
              cell.classList.add('pending');
            }
            cell.addEventListener('click', (e)=>{
              e.stopPropagation();
              state.activeCardId = c.id || state.activeCardId;
              if (num === 0) return;
              if (!state.drawn.has(num)) { ui.showToast('Ese número aún no ha sido cantado', 'warning'); return; }
              if (cell.classList.contains('marked')){
                c.marked.delete(num);
                cell.classList.remove('marked');
                if (state.drawn.has(num)) cell.classList.add('pending');
              } else {
                c.marked.add(num);
                cell.classList.add('marked');
                cell.classList.remove('pending');
              }
              updateClaim(c);
            });
            grid.appendChild(cell);
          }
        }
        cardEl.appendChild(grid);
        cardsRoot.appendChild(cardEl);
        try {
          const rect = cardEl.getBoundingClientRect();
          const cw = rect && rect.width ? rect.width : 220;
          const cellSize = cw / 5;
          const fontPx = Math.max(10, Math.min(18, Math.floor(cellSize * 0.45)));
          grid.style.setProperty('--bn-cell-font', fontPx + 'px');
        } catch(_){ }
      });
    };

    const updateClaim = (c=null)=>{
      // Usar sólo cartones del servidor para evitar errores de 'Cartón inválido'
      const cardX = c || (state.cards && state.cards[0]);
      if (!cardX) { try{ claimOverlay.classList.remove('active'); }catch(_){} return; }
      const valid = validateLine(cardX);
      if (valid) {
        const eco = (state.room && state.room.ecoMode) || 'friendly';
        if (claimBtn) {
          if (eco === 'fire') {
            const pot = (state.room && state.room.pot) || 0;
            const reward = Math.floor(pot * 0.7);
            claimBtn.textContent = `Reclamar ${reward} 🔥`;
          } else {
            claimBtn.textContent = '¡Bingo! 🎉';
          }
        }
        claimOverlay.classList.add('active');
      } else {
        claimOverlay.classList.remove('active');
      }
    };

    const handleNumberDrawn = (n)=>{
      state.drawn.add(n);
      state.last = n;
      state.recent.unshift(n); state.recent = state.recent.slice(0,5);
      renderDraw();
      renderCard();
      ui.log(`bingo:number_drawn ${n}`, 'info', 'bingo-v2');
    };

    disposers.push(()=>{ document.body.removeChild(fab); });
    disposers.push(()=>{ document.body.removeChild(claimOverlay); });

    fab.addEventListener('click', ()=>{
      const s = Socket.socket;
      if (s && state.room && state.isHost && state.room.started){
        try { s.emit('draw_next', { roomCode: state.room.code }); } catch(_){}
        return;
      }
      // Fallback offline: simular número
      const pool = []; for (let n=1;n<=75;n++){ if (!state.drawn.has(n)) pool.push(n); }
      if (!pool.length) { ui.showToast('No quedan números', 'info'); return; }
      const next = pool[Math.floor(Math.random()*pool.length)];
      handleNumberDrawn(next);
    });

    claimBtn.addEventListener('click', ()=>{
      if (state.claimAction === 'exit') {
        try { Socket.socket && Socket.socket.emit && Socket.socket.emit('leave_bingo', { roomCode: state.room && state.room.code }); } catch(_){ }
        try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){ }
        return;
      }
      const s = Socket.socket;
      const cid = state.activeCardId || (state.cards && state.cards[0] && state.cards[0].id) || null;
      if (s && state.room && cid){
        try { s.emit('claim_bingo', { roomCode: state.room.code, cardId: cid }); } catch(_){ }
      } else {
        // Sin cartón del servidor disponible: usar botón como 'Salir'
        try { Socket.socket && Socket.socket.emit && Socket.socket.emit('leave_bingo', { roomCode: state.room && state.room.code }); } catch(_){ }
        try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){ }
      }
    });

    // Socket.io listeners (integración backend)
    try {
      const s = Socket.socket;
      if (s && s.on){
        const onRoomCreated = ({ room })=>{
          try {
            state.room = room; state.isHost = String(room.hostId||'') === String(state.userId||'');
            state.ecoMode = room.ecoMode || 'friendly';
            const makePublicBtn = menuPanel.querySelector('#bn-make-public');
            const startBtn = lobbyPanel.querySelector('#bn-start');
            const readyBtn = menuPanel.querySelector('#bn-ready');
            const codeEl = menuPanel.querySelector('#bn-code');
            const joinBtn = menuPanel.querySelector('#bn-join');
            const cardsElTop = menuPanel.querySelector('#bn-cards');
            const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
            makePublicBtn.style.display = (state.isHost && !room.isPublic) ? '' : 'none';
            if (startBtn) startBtn.style.display = 'none';
            readyBtn.style.display = '';
            readyBtn.disabled = false;
            // Sync eco UI
            ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
            // Top menu context while inside room (host cannot join another room)
            if (codeEl) codeEl.style.display = state.isHost ? 'none' : '';
            if (joinBtn) joinBtn.style.display = state.isHost ? 'none' : '';
            if (cardsElTop){
              if (state.isHost && room.ecoMode==='fire'){
                cardsElTop.style.display = '';
                cardsElTop.placeholder = 'Ticket \uD83D\uDD25';
                cardsElTop.title = 'Ticket (fuegos)';
                if (typeof room.ticketPrice==='number') cardsElTop.value = String(room.ticketPrice);
              } else {
                cardsElTop.style.display = state.isHost ? 'none' : '';
                cardsElTop.placeholder = '';
                cardsElTop.title = '';
              }
            }
            ui.log(`bingo:room_created ${room.code}`, 'info', 'bingo-v2');
            // Sync avanzadas
            const gameModeEl = menuPanel.querySelector('#bn-game-mode');
            const maxPlayersEl = menuPanel.querySelector('#bn-max-players');
            const maxCardsEl = menuPanel.querySelector('#bn-max-cards');
            const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
            const intervalEl = menuPanel.querySelector('#bn-interval');
            const intervalWrap = menuPanel.querySelector('#bn-interval-wrap');
            if (gameModeEl) gameModeEl.value = room.mode || 'line';
            if (maxPlayersEl) maxPlayersEl.value = String(room.maxPlayers||30);
            if (maxCardsEl) maxCardsEl.value = String(room.maxCardsPerUser||10);
            if (autoDrawEl) autoDrawEl.checked = !!room.autoDraw;
            if (intervalEl) intervalEl.value = String(Math.max(1, Math.round((room.drawIntervalMs||5000)/1000)));
            if (intervalWrap) intervalWrap.style.display = (autoDrawEl && autoDrawEl.checked) ? '' : 'none';
            // Deshabilitar si no host
            [gameModeEl,maxPlayersEl,maxCardsEl,autoDrawEl,intervalEl].forEach(el=>{ if (el) el.disabled = !state.isHost; });
            // Mostrar avanzado dentro de sala (host)
            const adv = menuPanel.querySelector('#bn-advanced'); if (adv) adv.style.display = state.isHost ? '' : 'none';
            // Ocultar creación dentro de sala
            const createBtn = menuPanel.querySelector('#bn-create'); if (createBtn) createBtn.style.display = 'none';
            const pubEl = menuPanel.querySelector('#bn-public'); if (pubEl && pubEl.closest('label')) pubEl.closest('label').style.display = 'none';
            // Alternar paneles
            renderPublicRooms();
            renderLobby();
            try {
              const code = String(room.code||'');
              const text = `Únete a mi sala de Bingo: código ${code}`;
              try { navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(text).catch(()=>{}); } catch(_){ }
              const shareBtn = lobbyPanel.querySelector('#bn-share');
              if (shareBtn) {
                const prev = shareBtn.getAttribute('style')||'';
                shareBtn.setAttribute('style', `${prev}; box-shadow: 0 0 0 4px rgba(34,197,94,.45); transform: scale(1.02); transition: box-shadow .2s, transform .2s;`);
                setTimeout(()=>{ try { shareBtn.setAttribute('style', prev); } catch(_){ } }, 1800);
              }
            } catch(_){ }
          } catch(e) { try { ui.log('bingo:onRoomCreated error','error','bingo-v2'); } catch(_){} }
        };
        const onRoomUpdated = ({ room })=>{
          try {
            state.room = room; state.isHost = String(room.hostId||'') === String(state.userId||'');
            state.ecoMode = room.ecoMode || 'friendly';
            const makePublicBtn = menuPanel.querySelector('#bn-make-public');
            const ecoRadios = menuPanel.querySelectorAll('input[name=\"bnEcoMode\"]');
            const codeEl = menuPanel.querySelector('#bn-code');
            const joinBtn = menuPanel.querySelector('#bn-join');
            const cardsElTop = menuPanel.querySelector('#bn-cards');
            makePublicBtn.style.display = (state.isHost && !room.isPublic) ? '' : 'none';
            ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
            if (codeEl) codeEl.style.display = state.isHost ? 'none' : '';
            if (joinBtn) joinBtn.style.display = state.isHost ? 'none' : '';
            if (cardsElTop){
              if (state.isHost && room.ecoMode==='fire'){
                cardsElTop.style.display = '';
                cardsElTop.placeholder = 'Ticket \uD83D\uDD25';
                cardsElTop.title = 'Ticket (fuegos)';
                if (typeof room.ticketPrice==='number') cardsElTop.value = String(room.ticketPrice);
              } else {
                cardsElTop.style.display = state.isHost ? 'none' : '';
                cardsElTop.placeholder = '';
                cardsElTop.title = '';
              }
            }
            ui.log(`bingo:room_updated status=${room.status} players=${(room.players||[]).length}`, 'info', 'bingo-v2');
            // Sync avanzadas
            const gameModeEl = menuPanel.querySelector('#bn-game-mode');
            const maxPlayersEl = menuPanel.querySelector('#bn-max-players');
            const maxCardsEl = menuPanel.querySelector('#bn-max-cards');
            const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
            const intervalEl = menuPanel.querySelector('#bn-interval');
            const intervalWrap = menuPanel.querySelector('#bn-interval-wrap');
            if (gameModeEl) gameModeEl.value = room.mode || 'line';
            if (maxPlayersEl) maxPlayersEl.value = String(room.maxPlayers||30);
            if (maxCardsEl) maxCardsEl.value = String(room.maxCardsPerUser||10);
            if (autoDrawEl) autoDrawEl.checked = !!room.autoDraw;
            if (intervalEl) intervalEl.value = String(Math.max(1, Math.round((room.drawIntervalMs||5000)/1000)));
            if (intervalWrap) intervalWrap.style.display = (autoDrawEl && autoDrawEl.checked) ? '' : 'none';
            const adv = menuPanel.querySelector('#bn-advanced'); if (adv) adv.style.display = state.isHost ? '' : 'none';
            const createBtn = menuPanel.querySelector('#bn-create'); if (createBtn) createBtn.style.display = state.room ? 'none' : '';
            const pubEl = menuPanel.querySelector('#bn-public'); if (pubEl && pubEl.closest('label')) pubEl.closest('label').style.display = state.room ? 'none' : '';
            renderPublicRooms();
            [gameModeEl,maxPlayersEl,maxCardsEl,autoDrawEl,intervalEl].forEach(el=>{ if (el) el.disabled = !state.isHost; });
            renderLobby();
          } catch(e){}
        };
        const onJoined = ({ room, cards })=>{
          try {
            state.room = room; state.isHost = String(room.hostId||'') === String(state.userId||'');
            state.ecoMode = room.ecoMode || 'friendly';
            // tomar primer cartón para UI simple
            state.cards = Array.isArray(cards) ? cards.map(k=>({ id:k.id, numbers:k.numbers, marked: new Set(k.marked||[]) })) : [];
            if (state.cards && state.cards.length){ state.card = state.cards[0]; state.activeCardId = state.card.id; }
            state.drawn = new Set((room && room.drawnSet) || []);
            renderDraw(); renderCard();
            // reset claim state
            state.claimAction = 'claim';
            try { claimOverlay.classList.remove('active'); } catch(_){ }
            try { claimBtn.textContent = '¡Bingo!'; } catch(_){ }
            // enable ready UI
            const readyBtn = menuPanel.querySelector('#bn-ready');
            readyBtn.style.display = '';
            readyBtn.disabled = false;
            // sync eco UI
            const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
            ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
            const codeEl = menuPanel.querySelector('#bn-code');
            const joinBtn = menuPanel.querySelector('#bn-join');
            const cardsElTop = menuPanel.querySelector('#bn-cards');
            if (codeEl) codeEl.style.display = state.isHost ? 'none' : '';
            if (joinBtn) joinBtn.style.display = state.isHost ? 'none' : '';
            if (cardsElTop){
              if (state.isHost && room.ecoMode==='fire'){
                cardsElTop.style.display = '';
                cardsElTop.placeholder = 'Ticket ';
                cardsElTop.title = 'Ticket (fuegos)';
                if (typeof room.ticketPrice==='number') cardsElTop.value = String(room.ticketPrice);
              } else {
                cardsElTop.style.display = state.isHost ? 'none' : '';
                cardsElTop.placeholder = '';
                cardsElTop.title = '';
              }
            }
            const adv = menuPanel.querySelector('#bn-advanced'); if (adv) adv.style.display = state.isHost ? '' : 'none';
            const createBtn = menuPanel.querySelector('#bn-create'); if (createBtn) createBtn.style.display = 'none';
            const pubEl = menuPanel.querySelector('#bn-public'); if (pubEl && pubEl.closest('label')) pubEl.closest('label').style.display = 'none';
            renderPublicRooms();
            renderLobby();
            ui.showToast(`Unido a sala ${room.code}`, 'success');
          } catch(e){}
        };
        const onStarted = ({ room })=>{ try {
          state.room = room;
          // Aplicar toggles de paneles mediante lobby render
          renderLobby();
          renderDraw();
          renderCard();
          try { Socket.socket && Socket.socket.emit && Socket.socket.emit('get_bingo_cards', { roomCode: state.room && state.room.code }); } catch(_){ }
          ui.showToast('Bingo iniciado','success');
          ui.log('bingo:started', 'info', 'bingo-v2');
        }catch(_){ } };
        const onNumber = ({ number })=> handleNumberDrawn(parseInt(number,10));
        const onInvalidClaim = ({ reason })=>{ try {
          ui.showToast(reason || 'Cartón inválido', 'warning');
          // Convertir botón en 'Salir' usando bandera de estado
          try {
            state.claimAction = 'exit';
            claimOverlay.classList.add('active');
            claimBtn.textContent = 'Salir';
          } catch(_){ }
        } catch(_){ } };
        const onCardsSync = ({ roomCode, cards })=>{ try {
          if (!state.room || String(state.room.code) !== String(roomCode)) return;
          state.cards = Array.isArray(cards) ? cards.map(k=>({ id:k.id, numbers:k.numbers, marked: new Set(k.marked||[]) })) : [];
          if (state.cards.length){ state.card = state.cards[0]; state.activeCardId = state.card.id; }
          renderCard();
        } catch(_){ } };
        const onWinner = ({ userId, userName, distribution })=>{ try {
          const isMe = String(userId||'') === String(state.userId||'');
          const eco = (state.room && state.room.ecoMode) || 'friendly';
          const winnerName = userName || 'Jugador';
          const cons = [
            '¡Casi! La próxima será.',
            'Buen intento, sigue la racha.',
            'Estuvo reñido, no te rindas.',
            '¡Qué cerca! A por la siguiente.',
            'Gran partida, vamos por más.'
          ];
          const msg = cons[Math.floor(Math.random()*cons.length)];
          if (isMe && eco === 'fire') {
            const amount = (distribution && distribution.winner) || 0;
            // Mostrar CTA de reclamo y luego salir
            try {
              state.claimAction = 'exit';
              claimOverlay.classList.add('active');
              claimBtn.textContent = `Reclamar ${amount} 🔥`;
            } catch(_){ }
            ui.showToast('¡Ganaste! Reclamando premio…', 'success');
            setTimeout(()=>{
              if (state.finishing) return;
              state.finishing = true;
              try { Socket.socket && Socket.socket.emit && Socket.socket.emit('leave_bingo', { roomCode: state.room && state.room.code }); } catch(_){ }
              try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){ }
            }, 2500);
          } else {
            if (isMe) {
              ui.showToast('¡Ganaste! 🎉', 'success');
            } else {
              ui.showToast(`${msg} Ganó ${winnerName}.`, 'info');
            }
            // Auto salida para todos tras notificación
            setTimeout(()=>{
              if (state.finishing) return;
              state.finishing = true;
              try { Socket.socket && Socket.socket.emit && Socket.socket.emit('leave_bingo', { roomCode: state.room && state.room.code }); } catch(_){ }
              try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){ }
            }, 1200);
          }
        }catch(_){} };
        const onFinished = ({ room })=>{ try {
          state.room = room; renderLobby(); ui.log('bingo:finished','info','bingo-v2');
          // Auto salida inmediata para asegurar cierre de sala en todos
          if (!state.finishing) {
            state.finishing = true;
            try { Socket.socket && Socket.socket.emit && Socket.socket.emit('leave_bingo', { roomCode: state.room && state.room.code }); } catch(_){ }
            try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){ }
          }
          // Restaurar paneles por si permanecieran visibles
          try { if (menuPanel) menuPanel.style.display = ''; } catch(_){ }
          try { if (lobbyPanel) lobbyPanel.style.display = ''; } catch(_){ }
          try { claimOverlay.classList.remove('active'); } catch(_){ }
        }catch(_){} };
        const onPlayerJoined = ({ room, userId, userName, cardsCount })=>{ try { state.room = room; renderLobby(); ui.log(`bingo:player_joined ${userName||userId||''} +${cardsCount||1}`, 'info', 'bingo-v2'); }catch(_){} };
        const onReadyUpdated = ({ room, allReady })=>{ try { state.room = room; renderLobby(); ui.log(`bingo:ready_updated allReady=${!!allReady}`, 'info', 'bingo-v2'); }catch(_){} };
        const onModeUpdated = ({ room, missingUserIds })=>{ try {
          state.room = room; state.missingUserIds = missingUserIds||[];
          const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
          ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
          // Ajustar top inputs según modo/rol
          const codeEl = menuPanel.querySelector('#bn-code');
          const joinBtn = menuPanel.querySelector('#bn-join');
          const cardsElTop = menuPanel.querySelector('#bn-cards');
          if (codeEl) codeEl.style.display = state.isHost ? 'none' : '';
          if (joinBtn) joinBtn.style.display = state.isHost ? 'none' : '';
          if (cardsElTop){
            if (state.isHost && room.ecoMode==='fire'){
              cardsElTop.style.display = '';
              cardsElTop.placeholder = 'Ticket \uD83D\uDD25';
              cardsElTop.title = 'Ticket (fuegos)';
              if (typeof room.ticketPrice==='number') cardsElTop.value = String(room.ticketPrice);
            } else {
              cardsElTop.style.display = state.isHost ? 'none' : '';
              cardsElTop.placeholder = '';
              cardsElTop.title = '';
            }
          }
          // Toggle intervalo visible por autodraw
          const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
          const intervalWrap = menuPanel.querySelector('#bn-interval-wrap');
          if (intervalWrap) intervalWrap.style.display = (autoDrawEl && autoDrawEl.checked) ? '' : 'none';
          renderLobby();
          // Si estamos en flujo de inicio, arrancar cuando el modo haya sido aplicado
          if (state.isHost && state.pendingStart) {
            state.pendingStart = false;
            try { Socket.socket.emit('start_bingo', { roomCode: state.room.code }); } catch(e){ ui.showToast('No se pudo iniciar','error'); }
          }
        }catch(_){}};

        s.on('bingo_room_created', onRoomCreated);
        s.on('bingo_room_updated', onRoomUpdated);
        s.on('bingo_joined', onJoined);
        s.on('bingo_started', onStarted);
        s.on('number_drawn', onNumber);
        s.on('bingo_invalid', onInvalidClaim);
        s.on('bingo_cards', onCardsSync);
        s.on('bingo_winner', onWinner);
        s.on('bingo_finished', onFinished);
        s.on('player_joined_bingo', onPlayerJoined);
        s.on('bingo_ready_updated', onReadyUpdated);
        s.on('bingo_mode_updated', onModeUpdated);
        // Suscripción al bus local para lista inicial de salas
        try { Socket.on && Socket.on('rooms_list', (list)=>{ try {
          statePublic.rooms.clear();
          (Array.isArray(list)?list:[]).filter(r=>r && r.gameType==='bingo').forEach(r=> statePublic.rooms.set(String(r.code), r));
          renderPublicRooms();
        } catch(_){ } }); } catch(_){ }
        // Lobby unificado: salas públicas
        s.on('room_added', (room)=>{ try { if (room && room.gameType==='bingo') { statePublic.rooms.set(String(room.code), room); renderPublicRooms(); } } catch(_){ } });
        s.on('room_updated', (room)=>{ try { if (room && room.gameType==='bingo') { statePublic.rooms.set(String(room.code), room); renderPublicRooms(); } } catch(_){ } });
        s.on('room_removed', (code)=>{ try { statePublic.rooms.delete(String(code)); renderPublicRooms(); } catch(_){ } });

        disposers.push(()=>{ try{ s.off && s.off('bingo_room_created', onRoomCreated);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_room_updated', onRoomUpdated);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_joined', onJoined);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_started', onStarted);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('number_drawn', onNumber);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_winner', onWinner);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_finished', onFinished);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('player_joined_bingo', onPlayerJoined);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_ready_updated', onReadyUpdated);}catch(_){} });
        disposers.push(()=>{ try{ s.off && s.off('bingo_mode_updated', onModeUpdated);}catch(_){} });

        // Acciones de menú
        const createBtn = menuPanel.querySelector('#bn-create');
        const joinBtn = menuPanel.querySelector('#bn-join');
        const startBtn = menuPanel.querySelector('#bn-start');
        const makePublicBtn = menuPanel.querySelector('#bn-make-public');
        const codeEl = menuPanel.querySelector('#bn-code');
        const cardsEl = menuPanel.querySelector('#bn-cards');
        const readyBtn = menuPanel.querySelector('#bn-ready');
        const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
        const gameModeEl = menuPanel.querySelector('#bn-game-mode');
        const maxPlayersEl = menuPanel.querySelector('#bn-max-players');
        const maxCardsEl = menuPanel.querySelector('#bn-max-cards');
        const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
        const intervalEl = menuPanel.querySelector('#bn-interval');
        const intervalWrap = menuPanel.querySelector('#bn-interval-wrap');
        const publicEl = menuPanel.querySelector('#bn-public');

        createBtn && (createBtn.onclick = ()=>{
          if (!Socket.socket) return ui.showToast('Socket no disponible','error');
          const ecoMode = Array.from(ecoRadios).find(x=>x.checked)?.value || 'friendly';
          const payload = {
            isPublic: !!(publicEl && publicEl.checked),
            mode: (gameModeEl && gameModeEl.value) || 'line',
            autoDraw: !!(autoDrawEl && autoDrawEl.checked),
            drawIntervalMs: ((parseInt(intervalEl && intervalEl.value,10) || 5) * 1000),
            ecoMode,
            maxPlayers: parseInt(maxPlayersEl && maxPlayersEl.value,10) || 30,
            maxCardsPerUser: parseInt(maxCardsEl && maxCardsEl.value,10) || 10
          };
          if (ecoMode==='fire') {
            payload.ticketPrice = parseInt((cardsEl && cardsEl.value) || '1', 10) || 1;
          }
          try { Socket.socket.emit('create_bingo_room', payload); }
          catch(e){ ui.showToast('No se pudo crear','error'); }
        });
        if (codeEl) { codeEl.addEventListener('input', ()=>{ codeEl.value = (codeEl.value||'').replace(/\D/g,'').slice(0,6); }); }
        joinBtn && (joinBtn.onclick = ()=>{
          const code = (codeEl && codeEl.value.trim()) || (state.room && String(state.room.code||'').replace(/\D/g,'').slice(0,6)) || '';
          const cnt = parseInt((cardsEl && cardsEl.value) || '1', 10) || 1;
          if (!/^\d{6}$/.test(code)) return ui.showToast('Código inválido: usa 6 dígitos', 'warning');
          try { Socket.socket.emit('join_bingo', { roomCode: code, cardsCount: cnt }); }
          catch(e){ ui.showToast('No se pudo unir/comprar', 'error'); }
        });
        startBtn && (startBtn.onclick = ()=>{
          if (!state.room) return;
          try { Socket.socket.emit('start_bingo', { roomCode: state.room.code }); }
          catch(e){ ui.showToast('No se pudo iniciar','error'); }
        });
        makePublicBtn && (makePublicBtn.onclick = ()=>{
          if (!state.room) return;
          try { Socket.socket.emit('bingo_make_public', { roomCode: state.room.code }); }
          catch(e){ ui.showToast('No se pudo hacer pública','error'); }
        });
        readyBtn && (readyBtn.onclick = ()=>{
          if (!state.room) return;
          const me = (state.room.players||[]).find(p=>String(p.userId)===String(state.userId));
          const next = !(me&&me.ready);
          try { Socket.socket.emit('bingo_set_ready', { roomCode: state.room.code, ready: next }); }
          catch(e){ ui.showToast('No se pudo marcar listo','error'); }
        });
        ecoRadios && ecoRadios.forEach(r=>{
          r.onchange = ()=>{
            if (!state.room) return;
            if (!state.isHost) { renderLobby(); return; }
            const ecoMode = Array.from(ecoRadios).find(x=>x.checked)?.value || 'friendly';
            // toggle top controls
            if (state.isHost) {
              if (ecoMode==='fire'){
                if (codeEl) codeEl.style.display = 'none';
                if (joinBtn) joinBtn.style.display = 'none';
                if (cardsEl) { cardsEl.style.display=''; cardsEl.placeholder='Ticket \uD83D\uDD25'; cardsEl.title='Ticket (fuegos)'; }
              } else {
                if (cardsEl) { cardsEl.style.display='none'; cardsEl.placeholder=''; cardsEl.title=''; }
              }
            }
            const payload = { roomCode: state.room.code, ecoMode };
            if (ecoMode==='fire') { payload.ticketPrice = parseInt((cardsEl && cardsEl.value) || '1',10)||1; }
            try { Socket.socket.emit('bingo_set_mode', payload); } catch(e){ ui.showToast('No se pudo cambiar modo','error'); }
          };
        });

        // Toggle intervalo al cambiar Auto
        if (autoDrawEl) {
          autoDrawEl.onchange = ()=>{
            if (intervalWrap) intervalWrap.style.display = autoDrawEl.checked ? '' : 'none';
          };
        }
        // Sin botón Aplicar ni ticket dedicado; se usa #bn-cards como ticket si 🔥
      }
    } catch(e){ console.warn('bingo socket setup failed', e); }

    // Primer render
    renderDraw();
    renderCard();

    // Montaje en root
    root.innerHTML = '';
    root.appendChild(wrap);

    const plugin = {
      unmount(){ try { disposers.forEach(fn=>fn()); } catch(_){} }
    };
    root.__plugin = plugin;
    return plugin;
  }
};

Registry.register(BingoV2);
