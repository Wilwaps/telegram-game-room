import { Registry } from '../../core/registry.js';
import { UI } from '../../core/ui.js';
import { Utils } from '../../core/utils.js';
import { Socket } from '../../core/socket.js';

const TTT = {
  id: 'tictactoe',
  name: 'Tic‑Tac‑Toe',
  icon: '❌⭘',
  desc: 'Juega 3 en raya con modos Amistoso/Fire',

  mount(root, ctx){
    const state = {
      room: null,
      insufficientUserIds: [],
      isHost: false,
      phase: 'menu', // menu | waiting | playing | finished
      userId: (ctx && ctx.user && ctx.user.userId) || null,
    };

    const disposers = [];

    // Styles (mínimos) para aura de insuficientes
    const style = document.createElement('style');
    style.textContent = `
    .ttt-wrap{display:flex;flex-direction:column;gap:12px}
    .ttt-card{background:var(--card);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);padding:var(--space-lg)}
    .ttt-row{display:flex;gap:10px;align-items:center}
    .ttt-col{display:flex;flex-direction:column;gap:8px}
    .ttt-grid{display:grid;grid-template-columns:repeat(3,82px);gap:8px;justify-content:center;margin-top:10px}
    .ttt-cell{width:82px;height:82px;display:grid;place-content:center;background:#0b1220;border:1px solid rgba(255,255,255,.12);border-radius:12px;font-size:36px;font-weight:700;cursor:pointer}
    .ttt-cell.disabled{opacity:.6;cursor:not-allowed}
    .ttt-cell.selectable{box-shadow:0 0 0 2px var(--accent) inset, 0 8px 18px rgba(0,0,0,.35)}
    .ttt-players{display:flex;gap:12px}
    .ttt-player{padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03)}
    .ttt-player.insufficient{box-shadow:0 0 0 2px var(--danger)}
    .ttt-player.active{box-shadow:0 0 0 2px var(--accent)}
    .ttt-badge{padding:4px 8px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
    .ttt-mode{display:flex;gap:10px;align-items:center}
    .ttt-timer{font-weight:700;color:#fff;background:rgba(153,0,255,.22);border:1px solid rgba(255,255,255,.12);padding:6px 10px;border-radius:10px}
    `;
    document.head.appendChild(style);
    disposers.push(()=>{ try{ document.head.removeChild(style); }catch(_){} });

    const wrap = document.createElement('div');
    wrap.className = 'ttt-wrap';

    // Views
    const viewMenu = document.createElement('div');
    viewMenu.className = 'ttt-card';
    viewMenu.innerHTML = `
      <h3 style="margin-top:0">Tic‑Tac‑Toe</h3>
      <div class="ttt-row">
        <button id="ttt-create" class="btn btn-primary">Crear sala privada</button>
        <div style="flex:1"></div>
      </div>
      <div class="ttt-row">
        <input id="ttt-code" class="input" placeholder="Código (000000)" maxlength="6" inputmode="numeric" pattern="[0-9]*" style="max-width:160px" />
        <button id="ttt-join" class="btn">Unirse</button>
      </div>
    `;

    const viewWaiting = document.createElement('div');
    viewWaiting.className = 'ttt-card';

    const viewGame = document.createElement('div');
    viewGame.className = 'ttt-card';

    wrap.appendChild(viewMenu);
    root.appendChild(wrap);

    const s = Socket.socket;

    function render(){
      viewMenu.style.display = state.phase==='menu' ? '' : 'none';
      viewWaiting.style.display = state.phase==='waiting' ? '' : 'none';
      viewGame.style.display = state.phase==='playing' || state.phase==='finished' ? '' : 'none';

      if (state.phase==='waiting') renderWaiting();
      if (state.phase==='playing' || state.phase==='finished') renderGame();
    }

    function renderWaiting(){
      const r = state.room || {};
      const players = r.players || [];
      const mode = r.mode || 'friendly';
      const entryCost = r.entryCost || 1;
      const isHost = state.isHost;

      const pHtml = players.map(p=>{
        const insuf = (state.insufficientUserIds||[]).includes(String(p.userId));
        const isTurn = r.currentTurn && p.symbol === r.currentTurn;
        return `<div class="ttt-player ${insuf?'insufficient':''} ${isTurn?'active':''}"><div><strong>${Utils.escapeHtml(p.userName||p.userId)}</strong> <span class="ttt-badge">${p.symbol||''}</span></div></div>`
      }).join('') || '<div class="muted">Esperando jugadores...</div>';

      viewWaiting.innerHTML = `
        <div class="ttt-row" style="justify-content:space-between">
          <div>
            <div class="muted">Código</div>
            <div class="ttt-badge">${String(r.code||'').replace(/\D/g,'').slice(0,6)}</div>
          </div>
          <div class="ttt-mode">
            <label><input type="radio" name="ttt-mode" value="friendly" ${mode!=='fire'?'checked':''} ${!isHost?'disabled':''}/> Amistoso</label>
            <label><input type="radio" name="ttt-mode" value="fire" ${mode==='fire'?'checked':''} ${!isHost?'disabled':''}/> Fire</label>
            <input id="ttt-entry" class="input" type="number" min="1" value="${entryCost}" style="width:86px; ${mode==='fire'?'':'display:none'}" ${!isHost?'disabled':''} />
            ${isHost?`<button id="ttt-apply-mode" class="btn">Aplicar</button>`:''}
            <span class="ttt-badge" title="Visibilidad">${r.isPublic?'Pública':'Privada'}</span>
            ${isHost && !r.isPublic ? `<button id="ttt-make-public" class="btn">Hacer pública</button>` : ''}
          </div>
        </div>
        <div class="ttt-players">${pHtml}</div>
        <div class="ttt-row" style="justify-content:flex-end">
          ${isHost?`<button id="ttt-start" class="btn btn-primary" ${players.length<2?'disabled':''}>Iniciar</button>`:''}
{{ ... }}
      `;

      // Bind mode apply
      const applyBtn = viewWaiting.querySelector('#ttt-apply-mode');
      if (applyBtn){
        applyBtn.onclick = ()=>{
          try{
            const val = viewWaiting.querySelector('input[name="ttt-mode"]:checked')?.value || 'friendly';
            const entryEl = viewWaiting.querySelector('#ttt-entry');
            const cost = parseInt(entryEl && entryEl.value, 10);
            const payload = { roomCode: r.code, mode: val };
            if (val==='fire' && !isNaN(cost)) payload.entryCost = cost;
            s.emit('set_room_mode', payload);
          }catch(e){ UI.showToast('Error aplicando modo','error'); }
        };
        // Toggle entry input visibility
        const radios = viewWaiting.querySelectorAll('input[name="ttt-mode"]');
        radios.forEach(rd=> rd.addEventListener('change', ()=>{
          const entryEl = viewWaiting.querySelector('#ttt-entry');
          if (!entryEl) return;
          entryEl.style.display = (rd.value==='fire' && rd.checked) ? '' : 'none';
        }));
      }

      // Bind start
      const startBtn = viewWaiting.querySelector('#ttt-start');
      if (startBtn){
        startBtn.onclick = ()=>{
          try{ s.emit('start_game_request', { roomCode: r.code }); }
          catch(e){ UI.showToast('No se pudo iniciar','error'); }
        };
      }

      // Bind make public (solo host)
      const makePublicBtn = viewWaiting.querySelector('#ttt-make-public');
      if (makePublicBtn){
        makePublicBtn.onclick = ()=>{
          try{ s.emit('make_public', r.code); UI.showToast('Sala marcada como pública','success'); }
          catch(e){ UI.showToast('No se pudo cambiar visibilidad','error'); }
        };
      }
    }

    let turnTimerId = null;
    function clearTurnTimer(){ if (turnTimerId) { try{ clearInterval(turnTimerId);}catch(_){} turnTimerId=null; } }
    function renderGame(){
      const r = state.room || {};
      const board = r.board || Array(9).fill(null);
      const turn = r.currentTurn || 'X';
      const me = state.userId;
      const players = r.players || [];
      const currentPlayer = players.find(p=> p.symbol === turn);
      viewGame.innerHTML = `
        <div class="ttt-row" style="justify-content:space-between">
          <div>
            <div class="muted">Turno</div>
            <div class="ttt-badge">${turn} ${currentPlayer?('· '+Utils.escapeHtml(currentPlayer.userName||currentPlayer.userId)) : ''}</div>
          </div>
          <div class="muted">Sala ${String(r.code||'').replace(/\D/g,'').slice(0,6)}</div>
        </div>
        <div class="ttt-row" style="justify-content:space-between">
          <div class="ttt-players">${players.map(p=>`<div class="ttt-player ${p.symbol===turn?'active':''}"><strong>${Utils.escapeHtml(p.userName||p.userId)}</strong> <span class="ttt-badge">${p.symbol||''}</span></div>`).join('')}</div>
          <div id="ttt-timer" class="ttt-timer">--</div>
        </div>
        <div class="ttt-grid" id="ttt-grid"></div>
      `;
      const grid = viewGame.querySelector('#ttt-grid');
      grid.innerHTML = '';
      // Turn timer (20s fallback si backend no envía tiempo)
      try {
        clearTurnTimer();
        const timerEl = viewGame.querySelector('#ttt-timer');
        const timeoutMs = (typeof r.turnTimeoutMs === 'number' && r.turnTimeoutMs>0) ? r.turnTimeoutMs : 20000;
        let endsAt = Date.now() + timeoutMs;
        const tick = ()=>{
          const rem = Math.max(0, endsAt - Date.now());
          const s = Math.ceil(rem/1000);
          if (timerEl) timerEl.textContent = `${s}s`;
          if (rem<=0) { clearTurnTimer(); }
        };
        tick();
        turnTimerId = setInterval(tick, 500);
      } catch(_){ }
      for (let i=0;i<9;i++){
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';
        cell.textContent = board[i] || '';
        const isEmpty = !board[i];
        const myPlayer = (r.players||[]).find(p=> String(p.userId)===String(me));
        const myTurn = myPlayer && myPlayer.symbol === turn;
        if (!isEmpty || !myTurn) cell.classList.add('disabled');
        if (isEmpty && myTurn) cell.classList.add('selectable');
        cell.addEventListener('click', ()=>{
          if (!isEmpty || !myTurn) return;
          // Optimista: marcar de inmediato
          try{ cell.textContent = myPlayer.symbol || ''; cell.classList.add('disabled'); cell.classList.remove('selectable'); }catch(_){ }
          try{ s.emit('make_move', { roomCode: r.code, cellIndex: i }); }catch(_){ }
        });
        grid.appendChild(cell);
      }
    }

    function setRoom(room){
      state.room = room || null;
      if (room){ state.isHost = String(room.host)===String(state.userId); }
    }

    // Socket listeners
    const onRoomCreated = (payload)=>{
      try{
        setRoom(payload?.room || payload); // backend a veces envía room o toJSON directo
        state.phase = 'waiting';
        if (!wrap.contains(viewWaiting)) wrap.appendChild(viewWaiting);
        render();
        UI.log(`ttt:room_created ${state.room?.code}`,'info','ttt-v2');
      }catch(e){ console.error(e); }
    };

    const onRoomUpdated = (room)=>{
      try{
        if (!room) return;
        if (!state.room || room.code!==state.room.code) return; // ignorar otras salas
        setRoom(room);
        if (state.phase==='menu') state.phase='waiting';
        render();
      }catch(e){ console.error(e); }
    };

    const onModeUpdated = ({ room, insufficientUserIds }={})=>{
      try{
        if (!room) return;
        if (!state.room || room.code!==state.room.code) return;
        setRoom(room);
        state.insufficientUserIds = (insufficientUserIds||[]).map(String);
        render();
      }catch(e){ console.error(e); }
    };

    const onGameStart = ({ room })=>{
      try{
        setRoom(room);
        state.phase='playing';
        if (!wrap.contains(viewGame)) wrap.appendChild(viewGame);
        render();
        UI.showToast('¡Que comience el juego!','success');
      }catch(e){ console.error(e); }
    };

    const onMoveMade = ({ room })=>{
      try{ setRoom(room); render(); }catch(e){ }
    };

    const onGameDraw = ({ room })=>{
      try{
        setRoom(room); state.phase='finished'; render();
        UI.showToast('Empate','warning');
      }catch(e){ }
    };

    const onGameOver = ({ winner, winnerName, room })=>{
      try{
        if (room) setRoom(room);
        state.phase='finished'; render();
        const msg = winner ? `Ganador: ${winnerName||winner}` : 'Partida finalizada';
        UI.showToast(msg,'success');
      }catch(e){ }
    };

    const onError = ({ message })=>{ UI.showToast(message||'Error','error'); };

    // Registrar
    s.on && s.on('room_created', onRoomCreated);
    s.on && s.on('room_updated', onRoomUpdated);
    s.on && s.on('room_mode_updated', onModeUpdated);
    s.on && s.on('game_start', onGameStart);
    s.on && s.on('move_made', onMoveMade);
    s.on && s.on('game_draw', onGameDraw);
    s.on && s.on('game_over', onGameOver);
    s.on && s.on('error', onError);
    disposers.push(()=>{ try{ s.off && s.off('room_created', onRoomCreated);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('room_updated', onRoomUpdated);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('room_mode_updated', onModeUpdated);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('game_start', onGameStart);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('move_made', onMoveMade);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('game_draw', onGameDraw);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('game_over', onGameOver);}catch(_){}});
    disposers.push(()=>{ try{ s.off && s.off('error', onError);}catch(_){}});

    // Bind menú
    viewMenu.querySelector('#ttt-create').addEventListener('click', ()=>{
      try{ s.emit('create_room', { isPublic:false, gameType:'tic-tac-toe' }); }catch(e){ UI.showToast('No se pudo crear','error'); }
    });
    const codeInput = viewMenu.querySelector('#ttt-code');
    codeInput.addEventListener('input', ()=>{ codeInput.value = (codeInput.value||'').replace(/\D/g,'').slice(0,6); });
    viewMenu.querySelector('#ttt-join').addEventListener('click', ()=>{
      const v = String(codeInput.value||'').trim();
      if (!/^\d{6}$/.test(v)) return UI.showToast('Código inválido: usa 6 dígitos','warning');
      try{ s.emit('join_room', v); }catch(e){ UI.showToast('No se pudo unir','error'); }
    });

    // inicial
    render();

    // retorno de plugin
    const plugin = {
      unmount(){ try{ disposers.forEach(fn=>fn()); }catch(_){} try{ clearTurnTimer(); }catch(_){} }
    };
    root.__plugin = plugin;
    return plugin;
  }
};

Registry.register(TTT);
