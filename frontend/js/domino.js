/**
 * ============================================
 * DOMINÓ - FRONTEND (MVP)
 * ============================================
 */

const DominoGame = {
  roomCode: null,
  players: [],
  board: { tiles: [], leftOpen: null, rightOpen: null },
  hand: [],
  handCount: 0,
  turnUserId: null,
  chooserEl: null,

  init() {
    // Bind UI events
    document.getElementById('domino-exit-btn')?.addEventListener('click', () => {
      TelegramApp.showConfirm('¿Salir de la partida?', (ok) => {
        if (!ok) return;
        try { SocketClient.leaveDomino(this.roomCode); } catch(_) {}
        UI.showScreen('lobby-screen');
      });
    });
    document.getElementById('domino-draw-btn')?.addEventListener('click', () => {
      if (!this.isMyTurn()) return UI.showToast('No es tu turno', 'warning');
      SocketClient.drawDomino(this.roomCode);
    });
    document.getElementById('domino-pass-btn')?.addEventListener('click', () => {
      if (!this.isMyTurn()) return UI.showToast('No es tu turno', 'warning');
      SocketClient.passDomino(this.roomCode);
    });

    // Socket listeners
    SocketClient.on(CONFIG.EVENTS.DOMINO_STATE, (payload) => {
      try {
        if (!payload) return;
        if (typeof payload.turnUserId !== 'undefined') this.turnUserId = payload.turnUserId;
        if (payload.board) this.board = payload.board;
        if (Array.isArray(payload.hand)) this.hand = payload.hand; // sólo llega a tu socket
        if (typeof payload.handCount === 'number') this.handCount = payload.handCount;
        this.renderAll();
      } catch (e) { console.error('DOMINO_STATE handler error', e); }
    });

    SocketClient.on(CONFIG.EVENTS.DOMINO_ROOM_UPDATED, ({ room }) => {
      try {
        if (!room) return;
        if (room.code !== this.roomCode) return;
        this.updateFromRoom(room);
      } catch (e) { console.error('DOMINO_ROOM_UPDATED error', e); }
    });

    SocketClient.on(CONFIG.EVENTS.DOMINO_ROUND_END, (payload) => {
      try {
        if (!payload) return;
        UI.showToast(payload.winnerUserId ? 'Ronda terminada' : 'Ronda bloqueada', payload.winnerUserId ? 'success' : 'warning');
      } catch(_) {}
    });

    SocketClient.on(CONFIG.EVENTS.DOMINO_MATCH_END, (payload) => {
      try { UI.showToast('Partida finalizada', 'info'); } catch(_) {}
      // TODO: transicionar a pantalla de resultados cuando esté lista para Dominó
    });
  },

  start(room) {
    this.roomCode = room.code;
    this.updateFromRoom(room);
    UI.showScreen('domino-game-screen');
    this.renderAll();
  },

  updateFromRoom(room) {
    this.players = Array.isArray(room.players) ? room.players : [];
    this.turnUserId = room.turnUserId || this.turnUserId;
    if (room.board) this.board = room.board;
    // No recibimos mano completa aquí por privacidad
    try {
      const codeEl = document.getElementById('domino-room-code');
      if (codeEl) codeEl.textContent = room.code;
    } catch(_){}
    this.renderAll();
  },

  renderAll() {
    this.renderPlayers();
    this.renderBoard();
    this.renderOpenEnds();
    this.renderHand();
  },

  isMyTurn() {
    return String(this.turnUserId) === String(SocketClient.userId);
  },

  renderPlayers() {
    const wrap = document.getElementById('domino-players');
    if (!wrap) return;
    const hostId = this.players?.[0]?.userId; // fallback simple
    wrap.innerHTML = this.players.map(p => `
      <div class="domino-player ${String(p.userId)===String(this.turnUserId)?'turn':''}">
        <div class="dot"></div>
        <div class="name">${Utils.escapeHtml(p.userName || p.firstName || 'Jugador')}</div>
        ${String(p.userId)===String(hostId) ? '<span class="badge">Host</span>' : ''}
      </div>
    `).join('');
  },

  renderOpenEnds() {
    const el = document.getElementById('domino-open-ends');
    if (!el) return;
    const { leftOpen, rightOpen } = this.board || {};
    el.innerHTML = (leftOpen==null||rightOpen==null) ? '' : `
      <span class="chip">L: ${leftOpen}</span>
      <span class="chip">R: ${rightOpen}</span>
    `;
  },

  renderBoard() {
    const boardEl = document.getElementById('domino-board');
    if (!boardEl) return;
    const tiles = Array.isArray(this.board?.tiles) ? this.board.tiles : [];
    boardEl.innerHTML = tiles.map(t => this.renderTile(t)).join('');
  },

  renderHand() {
    const handEl = document.getElementById('domino-hand');
    if (!handEl) return;
    const { leftOpen, rightOpen } = this.board || {};
    const isTurn = this.isMyTurn();

    const html = (this.hand || []).map(t => {
      const canLeft = isTurn && (t.a === leftOpen || t.b === leftOpen);
      const canRight = isTurn && (t.a === rightOpen || t.b === rightOpen);
      const playable = canLeft || canRight;
      return `
        <div class="tile ${playable?'playable':'disabled'}" data-id="${t.id}" data-can-left="${canLeft}" data-can-right="${canRight}">
          <div class="half">${this.renderHalfPips(t.a)}</div>
          <div class="sep"></div>
          <div class="half">${this.renderHalfPips(t.b)}</div>
        </div>
      `;
    }).join('');

    handEl.innerHTML = html;

    // Bind clicks
    handEl.querySelectorAll('.tile').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = el.getAttribute('data-id');
        const canLeft = el.getAttribute('data-can-left') === 'true';
        const canRight = el.getAttribute('data-can-right') === 'true';
        if (!(canLeft || canRight)) return UI.showToast('Esa ficha no encaja', 'warning');
        if (!this.isMyTurn()) return UI.showToast('No es tu turno', 'warning');
        if (canLeft && canRight) {
          this.showEndChooser(id);
        } else {
          const end = canLeft ? 'left' : 'right';
          this.play(id, end);
        }
      });
    });
  },

  showEndChooser(tileId) {
    // Crear chooser simple fijo inferior
    this.hideChooser();
    const chooser = document.createElement('div');
    chooser.id = 'domino-end-chooser';
    chooser.style.position = 'fixed';
    chooser.style.left = '50%';
    chooser.style.bottom = '86px';
    chooser.style.transform = 'translateX(-50%)';
    chooser.style.background = 'var(--tg-theme-secondary-bg-color, #f2f2f2)';
    chooser.style.border = '1px solid rgba(0,0,0,.08)';
    chooser.style.boxShadow = '0 6px 20px rgba(0,0,0,.15)';
    chooser.style.borderRadius = '12px';
    chooser.style.padding = '8px';
    chooser.style.display = 'flex';
    chooser.style.gap = '8px';
    chooser.style.zIndex = '9998';

    const btnLeft = document.createElement('button');
    btnLeft.className = 'btn btn-secondary';
    btnLeft.textContent = 'Jugar Izquierda';
    btnLeft.onclick = () => { this.play(tileId, 'left'); this.hideChooser(); };

    const btnRight = document.createElement('button');
    btnRight.className = 'btn btn-primary';
    btnRight.textContent = 'Jugar Derecha';
    btnRight.onclick = () => { this.play(tileId, 'right'); this.hideChooser(); };

    chooser.appendChild(btnLeft);
    chooser.appendChild(btnRight);
    document.body.appendChild(chooser);
    this.chooserEl = chooser;
  },

  hideChooser() {
    try { this.chooserEl && this.chooserEl.remove(); this.chooserEl = null; } catch(_) {}
  },

  play(tileId, end) {
    if (!this.isMyTurn()) return UI.showToast('No es tu turno', 'warning');
    SocketClient.playDomino(tileId, end, this.roomCode);
    TelegramApp.hapticFeedback('light');
  },

  renderTile(t) {
    return `
      <div class="tile rot-0" title="${t.a}|${t.b}">
        <div class="half">${this.renderHalfPips(t.a)}</div>
        <div class="sep"></div>
        <div class="half">${this.renderHalfPips(t.b)}</div>
      </div>
    `;
  },

  renderHalfPips(n) {
    const map = {
      0: [],
      1: [5],
      2: [1,9],
      3: [1,5,9],
      4: [1,3,7,9],
      5: [1,3,5,7,9],
      6: [1,3,4,6,7,9]
    };
    const pts = map[n] || [];
    let html = '';
    for (let i=1; i<=9; i++) {
      html += pts.includes(i) ? '<div class="pip"></div>' : '<div></div>';
    }
    return html;
  }
};

// Hacer global
window.DominoGame = DominoGame;
