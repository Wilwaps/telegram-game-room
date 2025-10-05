/**
 * ============================================
 * BINGO - FRONTEND
 * ============================================
 */

const Bingo = {
  // Estado
  room: null,
  myCards: [],
  drawnSet: new Set(),
  recentDraws: [],
  selectedCardId: null,
  hostDesiredCards: 1,
  potentialNotified: {}, // { cardId: timestamp }
  claiming: false,
  claimTimer: null,

  init() {
    this.cacheDom();
    this.bindUI();
    this.bindSocket();
  },

  cacheDom() {
    // Lobby (pueden no existir al inicio)
    this.btnCreateBingo = document.getElementById('create-bingo-btn');
    this.btnJoinBingo = document.getElementById('join-bingo-btn');

    // Modales
    this.modalCreate = 'bingo-config-modal';
    this.modalJoin = 'bingo-join-modal';
    this.modeSelect = document.getElementById('bingo-mode-select');
    this.chkAutoDraw = document.getElementById('bingo-auto-draw');
    this.hostCardsValue = document.getElementById('bingo-host-cards');
    this.hostCardsDec = document.getElementById('bingo-host-cards-decrease');
    this.hostCardsInc = document.getElementById('bingo-host-cards-increase');
    this.hostCost = document.getElementById('bingo-host-cost');
    this.btnConfirmCreate = document.getElementById('confirm-create-bingo');

    this.joinRoomCode = document.getElementById('bingo-room-code');
    this.joinCardsValue = document.getElementById('bingo-cards-count');
    this.joinCardsDec = document.getElementById('bingo-cards-decrease');
    this.joinCardsInc = document.getElementById('bingo-cards-increase');
    this.joinCost = document.getElementById('bingo-total-cost');
    this.btnConfirmJoin = document.getElementById('confirm-join-bingo');

    // Waiting
    this.screenWaiting = 'bingo-waiting-screen';
    this.screenGame = 'bingo-game-screen';
    this.lblShareCode = document.getElementById('bingo-share-code');
    this.lblPot = document.getElementById('bingo-pot');
    this.listPlayers = document.getElementById('bingo-players-list');
    this.btnWaitingBack = document.getElementById('bingo-back-btn');
    this.btnWaitingInvite = document.getElementById('bingo-invite-btn');
    this.btnWaitingLeave = document.getElementById('bingo-leave-btn');
    this.btnWaitingStart = document.getElementById('bingo-start-btn');

    this.gridDraw = document.getElementById('bingo-draw-grid');
    this.listRecentDraws = document.getElementById('bingo-recent-draws');
    this.gridCards = document.getElementById('bingo-cards-grid');
    this.btnDrawNext = document.getElementById('bingo-draw-btn');
    this.btnClaim = document.getElementById('bingo-claim-btn');
    this.btnGameExit = document.getElementById('bingo-leave-game-btn');
    this.btnGameBack = document.getElementById('bingo-exit-btn');
    this.lblGamePot = document.getElementById('bingo-game-pot');
    this.lblPlayersCount = document.getElementById('bingo-players-count');
    this.lblMode = document.getElementById('bingo-mode-label');
  },

  bindUI() {
    // Abrir modales
    if (this.btnCreateBingo) {
      this.btnCreateBingo.addEventListener('click', () => {
        UI.showModal(this.modalCreate);
      });

    // (listener movido a bindSocket)
    }
    if (this.btnJoinBingo) {
      this.btnJoinBingo.addEventListener('click', () => {
        UI.showModal(this.modalJoin);
      });
    }

    // Controles de contadores
    const updateHostCost = () => {
      if (!this.hostCardsValue) return;
      const count = Math.max(1, parseInt(this.hostCardsValue.value || '1', 10));
      this.hostDesiredCards = count;
      if (this.hostCost) this.hostCost.textContent = `${count} 🔥`;
    };
    if (this.hostCardsDec) this.hostCardsDec.addEventListener('click', () => {
      const val = Math.max(1, parseInt(this.hostCardsValue.value || '1', 10) - 1);
      this.hostCardsValue.value = String(val);
      updateHostCost();
    });
    if (this.hostCardsInc) this.hostCardsInc.addEventListener('click', () => {
      const val = Math.min(10, parseInt(this.hostCardsValue.value || '1', 10) + 1);
      this.hostCardsValue.value = String(val);
      updateHostCost();
    });
    updateHostCost();

    const updateJoinCost = () => {
      if (!this.joinCardsValue) return;
      const count = Math.max(1, parseInt(this.joinCardsValue.value || '1', 10));
      if (this.joinCost) this.joinCost.textContent = `${count} 🔥`;
    };
    if (this.joinCardsDec) this.joinCardsDec.addEventListener('click', () => {
      const val = Math.max(1, parseInt(this.joinCardsValue.value || '1', 10) - 1);
      this.joinCardsValue.value = String(val);
      updateJoinCost();
    });
    if (this.joinCardsInc) this.joinCardsInc.addEventListener('click', () => {
      const val = Math.min(10, parseInt(this.joinCardsValue.value || '1', 10) + 1);
      this.joinCardsValue.value = String(val);
      updateJoinCost();
    });
    updateJoinCost();

    // Confirmaciones
    if (this.btnConfirmCreate) this.btnConfirmCreate.addEventListener('click', () => this.handleCreateConfirm());
    if (this.btnConfirmJoin) this.btnConfirmJoin.addEventListener('click', () => this.handleJoinConfirm());

    // Waiting actions
    if (this.btnWaitingBack) this.btnWaitingBack.addEventListener('click', () => this.leaveToLobby());
    if (this.btnWaitingLeave) this.btnWaitingLeave.addEventListener('click', () => this.leaveToLobby());
    if (this.btnWaitingInvite) this.btnWaitingInvite.addEventListener('click', () => this.handleInvite());
    if (this.btnWaitingStart) this.btnWaitingStart.addEventListener('click', () => this.handleStart());

    // Crear botón "Hacer pública" dinámicamente si no existe en el HTML
    const actions = document.querySelector('#bingo-waiting-screen .bingo-waiting-actions');
    if (actions && !this.btnWaitingMakePublic) {
      const btn = document.createElement('button');
      btn.id = 'bingo-make-public-btn';
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Hacer pública';
      // Insertar junto al botón Invitar
      actions.insertBefore(btn, this.btnWaitingLeave || actions.firstChild);
      this.btnWaitingMakePublic = btn;
    }
    if (this.btnWaitingMakePublic) {
      this.btnWaitingMakePublic.addEventListener('click', () => {
        if (!this.room) return;
        SocketClient.makePublicBingo(this.room.code);
        UI.showToast('Sala ahora es pública', 'success');
        TelegramApp.hapticFeedback('medium');
        this.btnWaitingMakePublic.disabled = true;
      });
    }

    // Game actions
    if (this.btnDrawNext) this.btnDrawNext.addEventListener('click', () => this.handleDrawNext());
    if (this.btnClaim) this.btnClaim.addEventListener('click', () => this.handleClaim());
    if (this.btnGameExit) this.btnGameExit.addEventListener('click', () => this.leaveToLobby());
    if (this.btnGameBack) this.btnGameBack.addEventListener('click', () => this.leaveToLobby());

    // Cierre modal genérico por data-close
    document.body.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close) {
        UI.hideModal(target.dataset.close);
      }
    });
  },

  bindSocket() {
    // Sala creada (host)
    SocketClient.on(CONFIG.EVENTS.BINGO_ROOM_CREATED, ({ room }) => {
      this.room = room;
      UI.hideModal(this.modalCreate);
      UI.showToast('Sala de Bingo creada', 'success');
      UI.showScreen(this.screenWaiting);
      this.renderWaiting(room);

      // Auto-unirse con cartones seleccionados
      const cards = Math.max(1, parseInt(this.hostDesiredCards || 1, 10));
      if (cards > 0) {
        setTimeout(() => {
          SocketClient.joinBingo(room.code, cards);
        }, 200);
      }
    });

    // Unión exitosa (me llegan mis cartones)
    SocketClient.on(CONFIG.EVENTS.BINGO_JOINED, ({ room, cards }) => {
      this.room = room;
      this.myCards = (cards || []).map(c => ({
        ...c,
        marked: new Set(c.marked || [])
      }));
      UI.hideModal(this.modalJoin);
      UI.showToast('Te uniste a la sala de Bingo', 'success');
      UI.showScreen(this.screenWaiting);
      this.renderWaiting(room);
    });

    // Jugador se une (actualiza sala y pot)
    SocketClient.on(CONFIG.EVENTS.PLAYER_JOINED_BINGO, ({ room }) => {
      if (room) {
        this.room = room;
        this.renderWaiting(room);
      }
    });

    // Jugador sale o host cierra
    SocketClient.on(CONFIG.EVENTS.PLAYER_LEFT_BINGO, ({ room }) => {
      if (room) {
        this.room = room;
        this.renderWaiting(room);
      }
    });
    SocketClient.on(CONFIG.EVENTS.HOST_LEFT_BINGO, () => {
      UI.showToast('El anfitrión cerró la sala. Se procesaron reembolsos.', 'info');
      this.resetState();
      Lobby.show();
    });

    // Inicio de juego
    SocketClient.on(CONFIG.EVENTS.BINGO_STARTED, ({ room, seedHash }) => {
      this.room = room;
      this.drawnSet = new Set(room.drawnSet || []);
      this.recentDraws = [];
      UI.showScreen(this.screenGame);
      this.renderGame(room);
      UI.showToast('¡Comienza el Bingo!', 'success');
    });

    // Número cantado
    SocketClient.on(CONFIG.EVENTS.NUMBER_DRAWN, ({ number }) => {
      this.handleNumberDrawn(number);
    });

    // Bingo inválido
    SocketClient.on(CONFIG.EVENTS.BINGO_INVALID, ({ reason }) => {
      UI.showToast(reason || 'Bingo inválido', 'error');
      TelegramApp.hapticFeedback('error');
      if (this.claiming) {
        this.claiming = false;
        if (this.claimTimer) { clearTimeout(this.claimTimer); this.claimTimer = null; }
        UI.showScreen(this.screenGame);
      }
    });

    // Notificación al host: jugador potencialmente tiene Bingo
    SocketClient.on(CONFIG.EVENTS.BINGO_POTENTIAL, ({ userName, cardId, pattern }) => {
      if (this.room && App.user && this.room.hostId === App.user.userId) {
        const pretty = pattern === 'full' ? 'cartón lleno' : (pattern === 'double' ? 'doble línea' : pattern);
        UI.showToast(`${userName} está cerca de cantar (${pretty})`, 'warning');
      }
    });

    // Cuando llega la transacción del premio, cerrar loading y abrir historial
    SocketClient.on(CONFIG.EVENTS.FIRES_TRANSACTION, (tx) => {
      if (!this.claiming || !tx) return;
      if (tx.reason === 'bingo_winner') {
        this.claiming = false;
        if (this.claimTimer) { clearTimeout(this.claimTimer); this.claimTimer = null; }
        UI.showScreen(this.screenGame);
        // Abrir historial para que vea su premio y movimientos recientes
        Economy.openHistory();
      }
    });

    // Hay ganador
    SocketClient.on(CONFIG.EVENTS.BINGO_WINNER, ({ userId, userName, cardId, distribution }) => {
      UI.showToast(`Ganador: ${userName} (+${distribution.winner} 🔥)`, 'success');
      UI.createConfetti();
      // Resaltar mi cartón ganador
      if (App.user && userId === App.user.userId) {
        const el = document.querySelector(`.bingo-card[data-card-id="${cardId}"]`);
        if (el) el.classList.add('bingo-card-win');
      }
      this.btnDrawNext && (this.btnDrawNext.disabled = true);
      this.btnClaim && (this.btnClaim.disabled = true);
    });

    SocketClient.on(CONFIG.EVENTS.BINGO_FINISHED, ({ room }) => {
      this.room = room;
      // Volver a lobby tras unos segundos
      setTimeout(() => {
        this.resetState();
        Lobby.show();
      }, 3000);
    });
  },
  // ======================
  // Flujos
  // ======================
  handleCreateConfirm() {
    const mode = this.modeSelect?.value || 'line';
    const autoDraw = !!this.chkAutoDraw?.checked;
    const drawIntervalMs = 5000;
    SocketClient.createBingoRoom({ isPublic: false, mode, autoDraw, drawIntervalMs });
  },

  handleJoinConfirm() {
    const code = (this.joinRoomCode?.value || '').trim().toUpperCase();
    const count = Math.max(1, parseInt(this.joinCardsValue?.value || '1', 10));
    if (!Utils.isValidRoomCode(code)) {
      UI.showToast('Código inválido (6 caracteres)', 'error');
      TelegramApp.hapticFeedback('error');
      return;
    }
    SocketClient.joinBingo(code, count);
  },

  leaveToLobby() {
    if (SocketClient.currentBingoRoom) {
      SocketClient.leaveBingo(SocketClient.currentBingoRoom);
    }
    this.resetState();
    Lobby.show();
  },

  handleInvite() {
    if (!this.room) return;
    const url = `${window.location.origin}?room=${this.room.code}`;
    const text = `¡Únete a mi sala de Bingo!\nCódigo: ${this.room.code}`;
    TelegramApp.shareLink(url, text);
    TelegramApp.hapticFeedback('medium');
  },

  handleStart() {
    if (!this.room) return;
    if (this.room.hostId !== App.user.userId) {
      UI.showToast('Solo el anfitrión puede iniciar', 'warning');
      return;
    }
    SocketClient.startBingo(this.room.code);
  },

  handleDrawNext() {
    if (!this.room) return;
    if (this.room.hostId !== App.user.userId) {
      UI.showToast('Solo el anfitrión puede cantar', 'warning');
      return;
    }
    SocketClient.drawNext(this.room.code);
  },

  handleClaim() {
    if (!this.room) return;
    const activeCard = this.selectedCardId || (this.myCards[0] && this.myCards[0].id);
    if (!activeCard) return;
    // Mostrar loading durante el reclamo
    this.claiming = true;
    UI.showLoading('Reclamando recompensa...');
    // Fallback: si no llega la transacción en 5s, abrir historial igual
    if (this.claimTimer) { clearTimeout(this.claimTimer); }
    this.claimTimer = setTimeout(() => {
      if (this.claiming) {
        this.claiming = false;
        UI.showScreen(this.screenGame);
        Economy.openHistory();
      }
    }, 5000);
    SocketClient.claimBingo(this.room.code, activeCard);
  },

  // ======================
  // Renderers
  // ======================
  renderWaiting(room) {
    this.room = room;
    if (this.lblShareCode) this.lblShareCode.textContent = `Código: ${room.code}`;
    if (this.lblPot) this.lblPot.textContent = String(room.pot || 0);

    // Render jugadores y cartones
    if (this.listPlayers) {
      const players = room.players || [];
      this.listPlayers.innerHTML = players.map(p => `
        <div class="bingo-player-item">
          <div class="bingo-player-info">
            <span>${Utils.escapeHtml(p.userName || 'Jugador')}</span>
          </div>
          <div class="bingo-player-cards">🃏 x${p.cardsCount || 0}</div>
        </div>
      `).join('');
    }

    // Botón iniciar solo para host
    const isHost = room.hostId === (App.user && App.user.userId);
    if (this.btnWaitingStart) this.btnWaitingStart.style.display = isHost ? 'inline-flex' : 'none';
    // Botón "Hacer pública" solo host; deshabilitado si ya es pública
    if (this.btnWaitingMakePublic) {
      this.btnWaitingMakePublic.style.display = isHost ? 'inline-flex' : 'none';
      this.btnWaitingMakePublic.disabled = !!room.isPublic;
      this.btnWaitingMakePublic.textContent = room.isPublic ? 'Pública' : 'Hacer pública';
    }

    // Panel para agregar cartones (solo antes de iniciar)
    if (!room.started) {
      const actions = document.querySelector('#bingo-waiting-screen .bingo-waiting-actions');
      if (actions) {
        let panel = document.getElementById('bingo-add-cards-panel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'bingo-add-cards-panel';
          panel.style.display = 'flex';
          panel.style.alignItems = 'center';
          panel.style.gap = '8px';
          panel.style.marginTop = '8px';
          panel.innerHTML = `
            <span style="font-weight:600">Tus cartones</span>
            <button id="bingo-add-dec" class="btn btn-secondary" style="min-width:36px">−</button>
            <input id="bingo-add-count" type="number" min="1" value="1" style="width:56px;text-align:center" />
            <button id="bingo-add-inc" class="btn btn-secondary" style="min-width:36px">＋</button>
            <span id="bingo-add-cost" style="opacity:0.9"></span>
            <button id="bingo-add-confirm" class="btn btn-primary">Agregar</button>
          `;
          actions.appendChild(panel);
        }

        const me = (room.players || []).find(p => p.userId === (App.user && App.user.userId));
        const myHave = me?.cardsCount || this.myCards.length || 0;
        const remaining = Math.max(0, (room.maxCardsPerUser || 10) - myHave);
        const price = room.ticketPrice || 1;

        const countInput = panel.querySelector('#bingo-add-count');
        const decBtn = panel.querySelector('#bingo-add-dec');
        const incBtn = panel.querySelector('#bingo-add-inc');
        const costLbl = panel.querySelector('#bingo-add-cost');
        const confirmBtn = panel.querySelector('#bingo-add-confirm');

        const sync = () => {
          let v = Math.max(1, parseInt(countInput.value || '1', 10));
          v = Math.min(v, Math.max(1, remaining));
          countInput.value = String(v);
          costLbl.textContent = `Costo: ${v * price} 🔥 (te quedan ${remaining} disponibles)`;
          confirmBtn.disabled = remaining <= 0;
        };
        decBtn.onclick = () => { countInput.value = String(Math.max(1, parseInt(countInput.value||'1',10) - 1)); sync(); };
        incBtn.onclick = () => { countInput.value = String(Math.min(remaining, parseInt(countInput.value||'1',10) + 1)); sync(); };
        countInput.oninput = sync;
        confirmBtn.onclick = () => {
          const add = Math.max(1, parseInt(countInput.value || '1', 10));
          if (add > 0) {
            SocketClient.joinBingo(room.code, add);
            UI.showToast(`Agregando ${add} cartón(es)...`, 'info');
          }
        };
        sync();
      }
    }
  },

  renderGame(room) {
    // Encabezado
    if (this.lblGamePot) this.lblGamePot.textContent = String(room.pot || 0);
    if (this.lblPlayersCount) this.lblPlayersCount.textContent = String((room.players || []).length);
    if (this.lblMode) {
      const modeMap = { line: 'línea', double: 'doble línea', full: 'cartón lleno' };
      this.lblMode.textContent = `Modo ${modeMap[room.mode] || room.mode}`;
    }

    // Render tablero de cantados (1..75)
    if (this.gridDraw) {
      this.gridDraw.innerHTML = '';
      for (let n = 1; n <= 75; n++) {
        const cell = document.createElement('div');
        cell.className = 'bingo-number';
        cell.dataset.number = String(n);
        cell.textContent = String(n);
        if (this.drawnSet.has(n)) cell.classList.add('active');
        this.gridDraw.appendChild(cell);
      }
    }

    // Render cartones del usuario
    this.renderCards();

    // Botones
    const isHost = room.hostId === (App.user && App.user.userId);
    if (this.btnDrawNext) {
      this.btnDrawNext.style.display = isHost ? 'inline-flex' : 'none';
      this.btnDrawNext.classList.toggle('bingo-fab', isHost);
    }
    if (this.btnClaim) this.btnClaim.disabled = true;
  },

  renderCards() {
    if (!this.gridCards) return;
    this.gridCards.innerHTML = '';

    this.myCards.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'bingo-card';
      cardEl.dataset.cardId = card.id;

      const header = document.createElement('div');
      header.className = 'bingo-card-header';
      header.innerHTML = `<span>Cartón ${idx + 1}</span>`;

      const grid = document.createElement('div');
      grid.className = 'bingo-card-grid';

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const num = card.numbers[col][row];
          const cell = document.createElement('div');
          cell.className = 'bingo-card-cell';
          cell.dataset.num = String(num);
          cell.dataset.col = String(col);
          cell.dataset.row = String(row);
          cell.textContent = String(num);
          if (col === 2 && row === 2) cell.classList.add('free');
          if (card.marked && card.marked.has(num)) cell.classList.add('marked');
          grid.appendChild(cell);
        }
      }

      cardEl.appendChild(header);
      cardEl.appendChild(grid);

      // Selección o zoom
      cardEl.addEventListener('click', () => {
        if (this.selectedCardId === card.id) {
          // Abrir zoom
          this.openCardOverlay(card);
        } else {
          this.selectedCardId = card.id;
          document.querySelectorAll('.bingo-card').forEach(el => el.classList.remove('selected'));
          cardEl.classList.add('selected');
          this.updateClaimAvailability();
        }
      });

      this.gridCards.appendChild(cardEl);
    });
  },

  // ======================
  // Juego
  // ======================
  handleNumberDrawn(number) {
    this.drawnSet.add(number);
    // Actualizar tablero principal
    const cell = this.gridDraw?.querySelector(`.bingo-number[data-number="${number}"]`);
    if (cell) {
      this.gridDraw.querySelectorAll('.bingo-number.last').forEach(c => c.classList.remove('last'));
      cell.classList.add('active');
      cell.classList.add('last');
    }

    // Actualizar últimos 5
    this.recentDraws.unshift(number);
    this.recentDraws = this.recentDraws.slice(0, 5);
    if (this.listRecentDraws) {
      this.listRecentDraws.innerHTML = this.recentDraws.map(n => `<div class="bingo-recent-ball">${n}</div>`).join('');
    }

    // Marcar en mis cartones
    this.myCards.forEach(card => {
      // Centro libre ya marcado
      if (!card.marked) card.marked = new Set();
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          const num = card.numbers[col][row];
          if (num === number) {
            card.marked.add(num);
            const el = document.querySelector(`.bingo-card[data-card-id="${card.id}"] .bingo-card-cell[data-num="${num}"]`);
            if (el) {
              // Quitar last-drawn previo
              document.querySelectorAll('.bingo-card-cell.last-drawn').forEach(e => e.classList.remove('last-drawn'));
              el.classList.add('marked', 'last-drawn');
            }
          }
        }
      }
     });
    this.updateClaimAvailability();
  },

  updateClaimAvailability() {
    if (!this.btnClaim) return;
    let canClaim = false;
    let winningCardId = null;

    for (const card of this.myCards) {
      const res = this.validateLocal(card, this.drawnSet, this.room?.mode || 'line');
      if (res.valid) {
        canClaim = true;
        winningCardId = card.id;
        // Brillo suave para UX
        const el = document.querySelector(`.bingo-card[data-card-id="${card.id}"]`);
        if (el) el.classList.add('bingo-card-win');
        // Avisar potencial al host (throttle 30s por card)
        const last = this.potentialNotified[card.id] || 0;
        const now = Date.now();
        if (now - last > 30000) {
          this.potentialNotified[card.id] = now;
          SocketClient.notifyBingoPotential(card.id, res.pattern || 'unknown', this.room?.code);
        }
      }
    }

    this.btnClaim.disabled = !canClaim;
    if (canClaim && !this.selectedCardId && winningCardId) {
      this.selectedCardId = winningCardId;
    }
  },

  // Mostrar overlay de zoom del cartón seleccionado
  openCardOverlay(card) {
    const overlay = document.createElement('div');
    overlay.className = 'bingo-card-overlay';
    const wrap = document.createElement('div');
    wrap.className = 'bingo-card-zoom';

    const header = document.createElement('div');
    header.className = 'bingo-card-header';
    header.innerHTML = `<span>Cartón</span>`;

    const grid = document.createElement('div');
    grid.className = 'bingo-card-grid';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const num = card.numbers[col][row];
        const cell = document.createElement('div');
        cell.className = 'bingo-card-cell';
        cell.dataset.num = String(num);
        if (col === 2 && row === 2) cell.classList.add('free');
        if (card.marked && card.marked.has(num)) cell.classList.add('marked');
        cell.textContent = String(num);
        grid.appendChild(cell);
      }
    }

    wrap.appendChild(header);
    wrap.appendChild(grid);
    overlay.appendChild(wrap);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onEsc = (ev) => { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
    document.addEventListener('keydown', onEsc);
  },

  // Validaciones locales (espejo del backend)
  validateLocal(card, drawnSet, mode) {
    const numbers = card.numbers;
    const marked = new Set(card.marked);
    // Asegurar centro libre
    marked.add(numbers[2][2]);

    const has = (n) => marked.has(n) || drawnSet.has(n) || n === numbers[2][2];

    const checkLine = () => {
      // Horizontales
      for (let row = 0; row < 5; row++) {
        let ok = true;
        for (let col = 0; col < 5; col++) if (!has(numbers[col][row])) { ok = false; break; }
        if (ok) return { valid: true, pattern: 'horizontal', row };
      }
      // Verticales
      for (let col = 0; col < 5; col++) {
        let ok = true;
        for (let row = 0; row < 5; row++) if (!has(numbers[col][row])) { ok = false; break; }
        if (ok) return { valid: true, pattern: 'vertical', col };
      }
      // Diagonales
      let ok1 = true; for (let i = 0; i < 5; i++) if (!has(numbers[i][i])) { ok1 = false; break; }
      if (ok1) return { valid: true, pattern: 'diagonal', type: 'main' };
      let ok2 = true; for (let i = 0; i < 5; i++) if (!has(numbers[i][4 - i])) { ok2 = false; break; }
      if (ok2) return { valid: true, pattern: 'diagonal', type: 'secondary' };
      return { valid: false };
    };

    const checkDouble = () => {
      let lines = 0;
      // Conteo sencillo horizontal/vertical
      for (let row = 0; row < 5; row++) {
        let ok = true;
        for (let col = 0; col < 5; col++) if (!has(numbers[col][row])) { ok = false; break; }
        if (ok) lines++;
      }
      for (let col = 0; col < 5; col++) {
        let ok = true;
        for (let row = 0; row < 5; row++) if (!has(numbers[col][row])) { ok = false; break; }
        if (ok) lines++;
      }
      return lines >= 2 ? { valid: true, pattern: 'double', lines } : { valid: false };
    };

    const checkFull = () => {
      for (let col = 0; col < 5; col++) for (let row = 0; row < 5; row++) if (!has(numbers[col][row])) return { valid: false };
      return { valid: true, pattern: 'full' };
    };

    switch (mode) {
      case 'line': return checkLine();
      case 'double': return checkDouble();
      case 'full': return checkFull();
      default: return { valid: false };
    }
  },

  resetState() {
    this.room = null;
    this.myCards = [];
    this.drawnSet = new Set();
    this.recentDraws = [];
    this.selectedCardId = null;
  }
};

window.Bingo = Bingo;
