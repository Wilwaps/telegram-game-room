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
    this.lblShareCode = document.getElementById('bingo-share-code');
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
  },

  bindUI() {
    // Abrir modales
    if (this.btnCreateBingo) {
      this.btnCreateBingo.addEventListener('click', () => {
        UI.showModal(this.modalCreate);
      });

    // Actualización de sala (p.ej. hacerse pública)
    SocketClient.on(CONFIG.EVENTS.BINGO_ROOM_UPDATED, ({ room }) => {
      if (room) {
        this.room = room;
        this.renderWaiting(room);
        if (this.btnWaitingMakePublic) {
          const isHost = room.hostId === (App.user && App.user.userId);
          this.btnWaitingMakePublic.style.display = isHost ? 'inline-flex' : 'none';
          this.btnWaitingMakePublic.disabled = !!room.isPublic;
          this.btnWaitingMakePublic.textContent = room.isPublic ? 'Pública' : 'Hacer pública';
        }
      }
    });
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
    if (this.btnDrawNext) this.btnDrawNext.style.display = isHost ? 'inline-flex' : 'none';
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

      // Selección de cartón
      cardEl.addEventListener('click', () => {
        this.selectedCardId = card.id;
        document.querySelectorAll('.bingo-card').forEach(el => el.classList.remove('selected'));
        cardEl.classList.add('selected');
        this.updateClaimAvailability();
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
      }
    }

    this.btnClaim.disabled = !canClaim;
    if (canClaim && !this.selectedCardId && winningCardId) {
      this.selectedCardId = winningCardId;
    }
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
