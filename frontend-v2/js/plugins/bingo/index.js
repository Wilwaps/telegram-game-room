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
    const state = { drawn: new Set(), recent: [], card: generateCard(), cards: [], activeCardId: null, last: null, room: null, isHost: false, userId: (ctx && ctx.user && ctx.user.userId) || null, missingUserIds: [], ecoMode: 'friendly' };
    const disposers = [];

    const wrap = document.createElement('div');
    wrap.className = 'bn-wrap';

    // Controles superiores: crear/unirse
    const menuPanel = document.createElement('div');
    menuPanel.className = 'bn-panel';
    menuPanel.innerHTML = `
      <div class="bn-row" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <button id="bn-create" class="btn btn-primary">Crear sala (privada)</button>
        <button id="bn-make-public" class="btn" style="display:none">Hacer pública</button>
        <div id="bn-mode" class="bn-mode" style="display:flex; gap:6px; align-items:center; margin-left:10px;">
          <label><input type="radio" name="bnEcoMode" value="friendly" checked> Amistoso</label>
          <label><input type="radio" name="bnEcoMode" value="fire"> 🔥 Fuego</label>
          <input id="bn-ticket" class="input" type="number" min="1" value="1" style="width:80px; display:none" title="Precio por cartón (fuego)" />
        </div>
        <div id="bn-advanced" class="bn-adv" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          <label>Modo
            <select id="bn-game-mode" class="input" style="min-width:120px">
              <option value="line">Línea</option>
              <option value="double">Doble línea</option>
              <option value="full">Cartón lleno</option>
            </select>
          </label>
          <label>Max jugadores <input id="bn-max-players" class="input" type="number" min="2" max="100" value="30" style="width:90px" /></label>
          <label>Max cartones/usuario <input id="bn-max-cards" class="input" type="number" min="1" max="50" value="10" style="width:90px" /></label>
          <label><input id="bn-autodraw" type="checkbox" /> Auto-cantar</label>
          <label>Intervalo (ms) <input id="bn-interval" class="input" type="number" min="1000" max="60000" value="5000" style="width:100px" /></label>
          <button id="bn-apply" class="btn">Aplicar</button>
        </div>
        <button id="bn-ready" class="btn btn-secondary" style="display:none" disabled>Estoy listo</button>
        <div style="flex:1"></div>
        <input id="bn-code" class="input" placeholder="Código (000000)" maxlength="6" inputmode="numeric" pattern="[0-9]*" style="max-width:140px" />
        <input id="bn-cards" class="input" type="number" min="1" value="1" style="width:80px" />
        <button id="bn-join" class="btn">Unirse/Comprar</button>
      </div>`;
    wrap.appendChild(menuPanel);

    // Lobby de espera
    const lobbyPanel = document.createElement('div');
    lobbyPanel.className = 'bn-panel';
    lobbyPanel.innerHTML = `<div class="bn-titlebar" style="display:flex; align-items:center; justify-content:space-between"><h3 class="bn-title">Sala de Espera</h3><button id="bn-start" class="btn" style="display:none; background:#16a34a; color:#fff">Iniciar</button></div><div id="bn-lobby" class="bn-lobby"></div>`;
    const lobbyRoot = lobbyPanel.querySelector('#bn-lobby');
    wrap.appendChild(lobbyPanel);

    // Panel draw
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
    document.body.appendChild(claimOverlay);

    const fab = document.createElement('button');
    fab.className = 'bn-fab';
    fab.textContent = 'Cantar número';
    document.body.appendChild(fab);

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
      el.innerHTML = `
        <div class="bn-lobby-head" style="display:flex; align-items:center; gap:10px; justify-content:space-between">
          <div><strong>Jugadores:</strong> ${playersCount}/${maxPlayers} · Listos ${readyCount}/${total}</div>
        </div>
        ${room.ecoMode === 'fire' ? `<div class="warn">Modo 🔥 activo. Tickets: ${room.ticketPrice||1}. ${missingTickets.length? `Faltan tickets: ${missingTickets.length}`: ''}</div>`: '<div class="muted">Modo amistoso</div>'}
        <div class="bn-lobby-list">
          ${players.map(p=>`
            <div class="bn-player ${p.ready?'ready':''}">
              <span class="name">${Utils.escapeHtml(p.userName||p.userId)}</span>
              <span class="status">${p.ready?'Listo ✅':'Esperando…'}</span>
              ${String(p.userId)===String(state.userId)? `<button class="btn btn-sm ${p.ready?'':'btn-secondary'}" data-action="toggle-ready">${p.ready?'No listo':'Estoy listo'}</button>`:''}
            </div>
          `).join('')}
        </div>
      `;
      // Bind toggle-ready if present
      el.querySelectorAll('button[data-action="toggle-ready"]').forEach(btn=>{
        btn.onclick = ()=>{
          const s = Socket.socket;
          const code = room.code;
          const me = (room.players||[]).find(p=>String(p.userId)===String(state.userId));
          const next = !(me&&me.ready);
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
        startBtn.onclick = ()=>{ if (!state.room) return; try { Socket.socket.emit('start_bingo', { roomCode: state.room.code }); } catch(e){ ui.showToast('No se pudo iniciar','error'); } };
      }
      if (cardsPanel) cardsPanel.style.display = room.started ? '' : 'none';
      if (claimOverlay) claimOverlay.style.display = room.started ? '' : 'none';
      if (fab) fab.style.display = (state.isHost && room.started) ? '' : 'none';
    };

    const renderCard = ()=>{
      cardsRoot.innerHTML = '';
      cardsRoot.style.display = 'grid';
      cardsRoot.style.gridTemplateColumns = 'repeat(2, minmax(220px, 1fr))';
      cardsRoot.style.gap = '12px';
      const arr = (state.cards && state.cards.length) ? state.cards : [state.card];
      const show = arr.slice(0,2);
      show.forEach((c)=>{
        const cardEl = document.createElement('div');
        cardEl.className = 'bn-card';
        cardEl.setAttribute('data-id', c.id || '');
        cardEl.innerHTML = `<div class="hdr"><span>Cartón</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'bn-grid';
        for (let r=0;r<5;r++){
          for (let col=0; col<5; col++){
            const num = c.numbers[col][r];
            const cell = document.createElement('div');
            cell.className = 'bn-cell';
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
      });
    };

    const updateClaim = (c=null)=>{
      const cardX = c || state.card;
      if (validateLine(cardX)) {
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

    claimOverlay.querySelector('.bn-claim-btn').addEventListener('click', ()=>{
      const s = Socket.socket;
      const cid = state.activeCardId || (state.cards && state.cards[0] && state.cards[0].id) || (state.card && state.card.id);
      if (s && state.room && cid){
        try { s.emit('claim_bingo', { roomCode: state.room.code, cardId: cid }); } catch(_){ }
      } else {
        claimOverlay.classList.remove('active');
        ui.showToast('¡Bingo (demo)!', 'success');
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
            const startBtn = menuPanel.querySelector('#bn-start');
            const readyBtn = menuPanel.querySelector('#bn-ready');
            const ticketEl = menuPanel.querySelector('#bn-ticket');
            const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
            makePublicBtn.style.display = (state.isHost && !room.isPublic) ? '' : 'none';
            startBtn.style.display = 'none';
            readyBtn.style.display = '';
            readyBtn.disabled = false;
            // Sync eco UI
            ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
            ticketEl.style.display = (state.isHost && (room.ecoMode==='fire'))? '' : 'none';
            if (typeof room.ticketPrice==='number') ticketEl.value = String(room.ticketPrice);
            ui.log(`bingo:room_created ${room.code}`, 'info', 'bingo-v2');
            // Sync avanzadas
            const gameModeEl = menuPanel.querySelector('#bn-game-mode');
            const maxPlayersEl = menuPanel.querySelector('#bn-max-players');
            const maxCardsEl = menuPanel.querySelector('#bn-max-cards');
            const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
            const intervalEl = menuPanel.querySelector('#bn-interval');
            if (gameModeEl) gameModeEl.value = room.mode || 'line';
            if (maxPlayersEl) maxPlayersEl.value = String(room.maxPlayers||30);
            if (maxCardsEl) maxCardsEl.value = String(room.maxCardsPerUser||10);
            if (autoDrawEl) autoDrawEl.checked = !!room.autoDraw;
            if (intervalEl) intervalEl.value = String(room.drawIntervalMs||5000);
            // Deshabilitar si no host
            [gameModeEl,maxPlayersEl,maxCardsEl,autoDrawEl,intervalEl].forEach(el=>{ if (el) el.disabled = !state.isHost; });
            renderLobby();
            ui.showToast(`Sala ${room.code} creada`, 'success');
          } catch(e) { console.error(e); }
        };
        const onRoomUpdated = ({ room })=>{
          try {
            state.room = room; state.isHost = String(room.hostId||'') === String(state.userId||'');
            state.ecoMode = room.ecoMode || 'friendly';
            const makePublicBtn = menuPanel.querySelector('#bn-make-public');
            const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
            const ticketEl = menuPanel.querySelector('#bn-ticket');
            makePublicBtn.style.display = (state.isHost && !room.isPublic) ? '' : 'none';
            ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
            ticketEl.style.display = (state.isHost && (room.ecoMode==='fire'))? '' : 'none';
            if (typeof room.ticketPrice==='number') ticketEl.value = String(room.ticketPrice);
            ui.log(`bingo:room_updated status=${room.status} players=${(room.players||[]).length}`, 'info', 'bingo-v2');
            // Sync avanzadas
            const gameModeEl = menuPanel.querySelector('#bn-game-mode');
            const maxPlayersEl = menuPanel.querySelector('#bn-max-players');
            const maxCardsEl = menuPanel.querySelector('#bn-max-cards');
            const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
            const intervalEl = menuPanel.querySelector('#bn-interval');
            if (gameModeEl) gameModeEl.value = room.mode || 'line';
            if (maxPlayersEl) maxPlayersEl.value = String(room.maxPlayers||30);
            if (maxCardsEl) maxCardsEl.value = String(room.maxCardsPerUser||10);
            if (autoDrawEl) autoDrawEl.checked = !!room.autoDraw;
            if (intervalEl) intervalEl.value = String(room.drawIntervalMs||5000);
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
            // enable ready UI
            const readyBtn = menuPanel.querySelector('#bn-ready');
            readyBtn.style.display = '';
            readyBtn.disabled = false;
            // sync eco UI
            const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]');
            ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); });
            const ticketEl = menuPanel.querySelector('#bn-ticket');
            ticketEl.style.display = (state.isHost && (room.ecoMode==='fire'))? '' : 'none';
            if (typeof room.ticketPrice==='number') ticketEl.value = String(room.ticketPrice);
            renderLobby();
            ui.showToast(`Unido a sala ${room.code}`, 'success');
          } catch(e){}
        };
        const onStarted = ({ room })=>{ try { state.room = room; renderDraw(); renderCard(); renderLobby(); ui.showToast('Bingo iniciado','success'); ui.log('bingo:started', 'info', 'bingo-v2'); }catch(_){ } };
        const onNumber = ({ number })=> handleNumberDrawn(parseInt(number,10));
        const onWinner = ({ userName })=>{ try { ui.showToast(`Ganador: ${userName||'Jugador'}`,'success'); setTimeout(()=>{ try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){} }, 1200); }catch(_){} };
        const onFinished = ({ room })=>{ try { ui.showToast('Fin de partida. Volviendo al lobby…','info'); setTimeout(()=>{ try { if (ctx && typeof ctx.onExit === 'function') { ctx.onExit(); } else { ui.showScreen && ui.showScreen('lobby-screen'); } } catch(_){} }, 800); }catch(_){} };
        const onPlayerJoined = ({ room, userId, userName, cardsCount })=>{ try { state.room = room; renderLobby(); ui.log(`bingo:player_joined ${userName||userId||''} +${cardsCount||1}`, 'info', 'bingo-v2'); }catch(_){} };
        const onReadyUpdated = ({ room, allReady })=>{ try { state.room = room; renderLobby(); ui.log(`bingo:ready_updated allReady=${!!allReady}`, 'info', 'bingo-v2'); }catch(_){} };
        const onModeUpdated = ({ room, missingUserIds })=>{ try { state.room = room; state.missingUserIds = missingUserIds||[]; const ecoRadios = menuPanel.querySelectorAll('input[name="bnEcoMode"]'); ecoRadios.forEach(r=>{ r.checked = r.value === (room.ecoMode||'friendly'); }); const ticketEl = menuPanel.querySelector('#bn-ticket'); ticketEl.style.display = (state.isHost && (room.ecoMode==='fire'))? '' : 'none'; if (typeof room.ticketPrice==='number') ticketEl.value = String(room.ticketPrice); renderLobby(); }catch(_){} };

        s.on('bingo_room_created', onRoomCreated);
        s.on('bingo_room_updated', onRoomUpdated);
        s.on('bingo_joined', onJoined);
        s.on('bingo_started', onStarted);
        s.on('number_drawn', onNumber);
        s.on('bingo_winner', onWinner);
        s.on('bingo_finished', onFinished);
        s.on('player_joined_bingo', onPlayerJoined);
        s.on('bingo_ready_updated', onReadyUpdated);
        s.on('bingo_mode_updated', onModeUpdated);

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
        const ticketEl = menuPanel.querySelector('#bn-ticket');
        const gameModeEl = menuPanel.querySelector('#bn-game-mode');
        const maxPlayersEl = menuPanel.querySelector('#bn-max-players');
        const maxCardsEl = menuPanel.querySelector('#bn-max-cards');
        const autoDrawEl = menuPanel.querySelector('#bn-autodraw');
        const intervalEl = menuPanel.querySelector('#bn-interval');
        const applyBtn = menuPanel.querySelector('#bn-apply');

        createBtn && (createBtn.onclick = ()=>{
          if (!Socket.socket) return ui.showToast('Socket no disponible','error');
          const ecoMode = Array.from(ecoRadios).find(x=>x.checked)?.value || 'friendly';
          const payload = {
            isPublic: false,
            mode: (gameModeEl && gameModeEl.value) || 'line',
            autoDraw: !!(autoDrawEl && autoDrawEl.checked),
            drawIntervalMs: parseInt(intervalEl && intervalEl.value,10) || 5000,
            ecoMode,
            maxPlayers: parseInt(maxPlayersEl && maxPlayersEl.value,10) || 30,
            ticketPrice: parseInt(ticketEl && ticketEl.value,10) || 1,
            maxCardsPerUser: parseInt(maxCardsEl && maxCardsEl.value,10) || 10
          };
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
            const payload = { roomCode: state.room.code, ecoMode };
            if (ecoMode==='fire') { payload.ticketPrice = parseInt(ticketEl.value||'1',10)||1; }
            try { Socket.socket.emit('bingo_set_mode', payload); } catch(e){ ui.showToast('No se pudo cambiar modo','error'); }
          };
        });
        applyBtn && (applyBtn.onclick = ()=>{
          if (!state.room) return;
          if (!state.isHost) return;
          const payload = {
            roomCode: state.room.code,
            ecoMode: Array.from(ecoRadios).find(x=>x.checked)?.value || 'friendly',
            ticketPrice: parseInt(ticketEl.value||'1',10)||1,
            mode: (gameModeEl && gameModeEl.value) || 'line',
            maxPlayers: parseInt(maxPlayersEl && maxPlayersEl.value,10) || 30,
            maxCardsPerUser: parseInt(maxCardsEl && maxCardsEl.value,10) || 10,
            autoDraw: !!(autoDrawEl && autoDrawEl.checked),
            drawIntervalMs: parseInt(intervalEl && intervalEl.value,10) || 5000
          };
          try { Socket.socket.emit('bingo_set_mode', payload); }
          catch(e){ ui.showToast('No se pudo aplicar configuración','error'); }
        });
        ticketEl && (ticketEl.onchange = ()=>{
          if (!state.room) return;
          if (!state.isHost) return;
          const ecoMode = 'fire';
          const payload = { roomCode: state.room.code, ecoMode, ticketPrice: parseInt(ticketEl.value||'1',10)||1 };
          try { Socket.socket.emit('bingo_set_mode', payload); } catch(e){ ui.showToast('No se pudo actualizar ticket','error'); }
        });
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
