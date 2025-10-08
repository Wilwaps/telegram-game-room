const WaitingRoom = {
  currentRoom: null,
  insufficientUserIds: [],

  /**
   * Inicializar sala de espera
   */
  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  // ==============================
  // Controles TTT: modo e inicio
  // ==============================
  ensureTTTControls() {
    const actions = document.querySelector('#waiting-room-screen .waiting-actions');
    if (!actions) return;
    if (!document.getElementById('ttt-controls')) {
      const wrap = document.createElement('div');
      wrap.id = 'ttt-controls';
      wrap.innerHTML = `
        <div class="ttt-controls">
          <button id="ttt-mode-toggle" class="btn btn-secondary"><span class="btn-icon">🎮</span><span class="btn-text">Modo: Amistoso</span></button>
          <button id="ttt-start-btn" class="btn btn-success"><span class="btn-icon">▶️</span><span class="btn-text">Iniciar partida</span></button>
        </div>
      `;
      actions.prepend(wrap);
      const modeBtn = wrap.querySelector('#ttt-mode-toggle');
      const startBtn = wrap.querySelector('#ttt-start-btn');
      modeBtn && modeBtn.addEventListener('click', () => this.toggleTTTMode());
      startBtn && startBtn.addEventListener('click', () => this.handleTTTStart());
    }
  },

  updateTTTControls() {
    const modeBtn = document.getElementById('ttt-mode-toggle');
    const startBtn = document.getElementById('ttt-start-btn');
    if (!this.currentRoom) return;
    const isHost = String(this.currentRoom.host) === String(SocketClient.userId) || String(this.currentRoom.host?.userId) === String(SocketClient.userId);
    const status = this.currentRoom.status || 'waiting';
    const isFire = this.currentRoom.mode === 'fire';
    const playersOk = Array.isArray(this.currentRoom.players) && this.currentRoom.players.length === 2;
    const noInsuff = !isFire || (this.insufficientUserIds.length === 0);

    if (modeBtn) {
      UI.updateButtonText('ttt-mode-toggle', `Modo: ${isFire ? 'Fire' : 'Amistoso'}`);
      modeBtn.disabled = !isHost || status !== 'waiting';
      modeBtn.classList.toggle('disabled', modeBtn.disabled);
      modeBtn.title = modeBtn.disabled ? 'Solo el anfitrión puede cambiar el modo (y antes de iniciar)' : '';
    }
    if (startBtn) {
      const canStart = isHost && status === 'waiting' && playersOk && noInsuff;
      startBtn.disabled = !canStart;
      startBtn.classList.toggle('disabled', !canStart);
      startBtn.title = !playersOk ? 'Se requieren 2 jugadores' : (!noInsuff ? 'Hay jugadores sin fuegos suficientes' : (!isHost ? 'Solo el anfitrión puede iniciar' : ''));
    }
  },

  toggleTTTMode() {
    if (!this.currentRoom) return;
    const isHost = String(this.currentRoom.host) === String(SocketClient.userId) || String(this.currentRoom.host?.userId) === String(SocketClient.userId);
    if (!isHost) return UI.showToast('Solo el anfitrión puede cambiar el modo', 'warning');
    const next = this.currentRoom.mode === 'fire' ? 'friendly' : 'fire';
    SocketClient.setRoomMode(next, undefined, this.currentRoom.code);
  },

  handleTTTStart() {
    if (!this.currentRoom) return;
    const isHost = String(this.currentRoom.host) === String(SocketClient.userId) || String(this.currentRoom.host?.userId) === String(SocketClient.userId);
    if (!isHost) return UI.showToast('Solo el anfitrión puede iniciar', 'warning');
    const btn = document.getElementById('ttt-start-btn');
    try { if (btn) { btn.disabled = true; btn.classList.add('disabled'); UI.updateButtonText('ttt-start-btn', 'Iniciando…'); } } catch(_) {}
    SocketClient.startGameRequest(this.currentRoom.code);
  },

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Botón atrás
    const backBtn = document.getElementById('back-to-lobby-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.handleBack());

    // Botón copiar código
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) copyCodeBtn.addEventListener('click', () => this.handleCopyCode());

    // Botón invitar amigos
    const inviteBtn = document.getElementById('invite-friends-btn');
    if (inviteBtn) inviteBtn.addEventListener('click', () => this.handleInviteFriends());

    // Botón hacer pública
    const makePublicBtn = document.getElementById('make-public-btn');
    if (makePublicBtn) makePublicBtn.addEventListener('click', () => this.handleMakePublic());

    // Botón salir de sala
    const leaveRoomBtn = document.getElementById('leave-waiting-btn');
    if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', () => this.handleLeaveRoom());
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Inicio de juego (TTT)
    SocketClient.on('game_start', (data) => {
      try { UI.log('socket: game_start', 'info', 'waiting'); } catch(_) {}
      Game.start(data);
    });

    // Sala cerrada
    SocketClient.on('room_closed', () => {
      try { UI.log('socket: room_closed', 'warn', 'waiting'); } catch(_) {}
      this.currentRoom = null;
      UI.showScreen('lobby-screen');
    });

    // Actualización de sala (TTT)
    SocketClient.on('room_updated', (room) => {
      try { UI.log(`socket: room_updated ${room?.code || ''}`, 'debug', 'waiting'); } catch(_) {}
      if (this.currentRoom && room && room.code === this.currentRoom.code) {
        this.updateRoom(room);
      }
    });

    // Modo actualizado (TTT)
    SocketClient.on(CONFIG.EVENTS.ROOM_MODE_UPDATED, ({ room, insufficientUserIds = [] } = {}) => {
      try { UI.log(`socket: room_mode_updated ${room?.code || ''} mode=${room?.mode}`, 'info', 'waiting'); } catch(_) {}
      if (!room) return;
      if (!this.currentRoom || room.code !== this.currentRoom.code) return;
      this.currentRoom = room;
      this.insufficientUserIds = Array.isArray(insufficientUserIds) ? insufficientUserIds.map(String) : [];
      this.render();
      if (this.insufficientUserIds.length > 0 && room.mode === 'fire') {
        UI.showToast('Hay jugadores sin fuegos suficientes', 'warning');
      }
    });

    // Manejar errores del servidor
    SocketClient.on('error', (err) => {
      try { UI.log(`socket: error ${err?.message || err}`, 'error', 'waiting'); } catch(_) {}
    });
  },

  /**
   * Mostrar sala de espera
   */
  show(room) {
    this.currentRoom = room;
    try { UI.log(`WaitingRoom.show ${room?.code || ''} (${room?.gameType || 'unknown'})`, 'info', 'waiting'); } catch(_) {}

    // Ocultar loading primero
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.remove('active');

    // Renderizar y mostrar
    this.render();
    UI.showScreen('waiting-room-screen');
    TelegramApp.hapticFeedback('success');
    try { TelegramApp.showBackButton(() => this.handleBack()); } catch(_) {}
  },

  /**
   * Renderizar sala de espera
   */
  render() {
    if (!this.currentRoom) return;

    // Actualizar texto de estado (Esperando... / En juego)
    try {
      const statusWrap = document.querySelector('#waiting-room-screen .waiting-status');
      const statusText = statusWrap ? statusWrap.querySelector('span:nth-child(2)') : null;
      if (statusText) {
        const status = this.currentRoom.status || 'waiting';
        statusText.textContent = status === 'waiting' ? 'Esperando...' : 'En juego';
      }
    } catch(_) {}

    // Código de sala
    const roomCodeEl = document.getElementById('room-code-display');
    if (roomCodeEl) roomCodeEl.textContent = this.currentRoom.code;

    // Insertar controles TTT si no existen y actualizar estado
    this.ensureTTTControls();
    // Actualizar jugadores (TTT)
    this.updateHostInfo();
    this.updatePlayerSlots();
    this.updatePublicButton();
    this.updateTTTControls();
  },

  // Dominó eliminado

  /**
   * Actualizar información del host (TTT/Domino)
   */
  updateHostInfo() {
    const hostNameEl = document.getElementById('host-name');
    const hostAvatarEl = document.getElementById('host-avatar');

    let hostDisplayName = '';
    let hostAvatar = '';

    if (this.currentRoom?.host && typeof this.currentRoom.host === 'object') {
      hostDisplayName = this.currentRoom.host.firstName || this.currentRoom.host.userName || 'Host';
      hostAvatar = this.currentRoom.host.photoUrl || this.currentRoom.host.userAvatar || '';
    } else if (Array.isArray(this.currentRoom?.players) && this.currentRoom.players.length) {
      const host = this.currentRoom.players[0];
      hostDisplayName = host.userName || host.firstName || 'Host';
      hostAvatar = host.userAvatar || host.photoUrl || '';
    }

    if (hostNameEl) hostNameEl.textContent = hostDisplayName || 'Host';
    if (hostAvatarEl) {
      hostAvatarEl.src = hostAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(hostDisplayName || 'Host')}&background=2481cc&color=fff`;
    }
  },

  /**
   * Actualizar slots de jugadores
   */
  updatePlayerSlots() {
    const hostSlot = document.getElementById('host-slot');
    const guestSlot = document.getElementById('guest-slot');
    if (!hostSlot || !guestSlot) return;

    // Host ya se renderiza con host-name/host-avatar; mantener placeholder de invitado
    if (this.currentRoom.players && this.currentRoom.players.length > 1) {
      let hostId = null;
      if (this.currentRoom.host && typeof this.currentRoom.host === 'object') {
        hostId = this.currentRoom.host.userId;
      } else if (typeof this.currentRoom.host === 'string') {
        hostId = this.currentRoom.host;
      } else if (Array.isArray(this.currentRoom.players) && this.currentRoom.players.length) {
        hostId = this.currentRoom.players[0].userId;
      }
      const guest = this.currentRoom.players.find(p => p.userId !== hostId);
      if (guest) {
        const guestName = Utils.escapeHtml(guest.userName || guest.firstName || 'Invitado');
        const guestAvatar = guest.userAvatar || guest.photoUrl || '';
        guestSlot.classList.remove('empty');
        guestSlot.classList.add('filled');
        guestSlot.querySelector('.player-avatar-placeholder')?.remove();
        const wrapper = guestSlot.querySelector('.player-avatar-wrapper');
        if (wrapper) {
          wrapper.classList.remove('waiting-pulse');
          const img = document.createElement('img');
          img.className = 'player-avatar';
          img.alt = 'Guest';
          img.src = guestAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(guestName)}&background=2481cc&color=fff`;
          wrapper.querySelector('img')?.remove();
          wrapper.prepend(img);
          // Aura roja si invitado está insuficiente (modo fire)
          const insuff = this.insufficientUserIds.includes(String(guest.userId));
          wrapper.classList.toggle('insufficient', insuff && this.currentRoom.mode === 'fire');
        }
        const info = guestSlot.querySelector('.player-info .player-name');
        if (info) info.textContent = guestName;
      }
    } else {
      guestSlot.classList.add('empty');
      guestSlot.classList.remove('filled');
    }
    // Aura para host si aplica
    try {
      let hostId = null;
      if (this.currentRoom.host && typeof this.currentRoom.host === 'object') hostId = this.currentRoom.host.userId;
      else if (typeof this.currentRoom.host === 'string' || typeof this.currentRoom.host === 'number') hostId = this.currentRoom.host;
      const hostWrap = document.querySelector('#host-slot .player-avatar-wrapper');
      if (hostWrap) {
        const insuffHost = this.insufficientUserIds.includes(String(hostId));
        hostWrap.classList.toggle('insufficient', insuffHost && this.currentRoom.mode === 'fire');
      }
    } catch(_) {}
  },

  // Botón atrás → confirmación y salida
  handleBack() {
    TelegramApp.showConfirm('¿Salir de la sala?', (confirmed) => {
      if (confirmed) this.handleLeaveRoom();
    });
  },

  /**
   * Actualizar botón de hacer pública
   */
  updatePublicButton() {
    const makePublicBtn = document.getElementById('make-public-btn');
    if (!makePublicBtn) return;

    // Dominó eliminado

    if (this.currentRoom.isPublic) {
      makePublicBtn.textContent = '🔓 Sala Pública';
      makePublicBtn.disabled = true;
      makePublicBtn.classList.add('disabled');
    } else {
      makePublicBtn.textContent = '🔒 Hacer Pública';
      makePublicBtn.disabled = false;
      makePublicBtn.classList.remove('disabled');
    }
  },

  /**
   * Actualizar sala
   */
  updateRoom(room) {
    this.currentRoom = room;
    this.render();
  },

  /**
   * Manejar copiar código
   */
  async handleCopyCode() {
    if (!this.currentRoom) return;

    try {
      await Utils.copyToClipboard(this.currentRoom.code);
      UI.showToast('Código copiado al portapapeles', 'success');
      TelegramApp.hapticFeedback('success');
    } catch (error) {
      console.error('Error al copiar código:', error);
      UI.showToast('No se pudo copiar el código', 'error');
    }
  },

  /**
   * Manejar invitar amigos
   */
  handleInviteFriends() {
    if (!this.currentRoom) return;

    const shareUrl = `${window.location.origin}?room=${this.currentRoom.code}`;
    const shareText = `¡Únete a mi sala de juegos! Código: ${this.currentRoom.code}`;

    // Usar API correcta de TelegramApp
    TelegramApp.shareLink(shareUrl, shareText);
    TelegramApp.hapticFeedback('medium');
  },

  /**
   * Manejar hacer pública
   */
  handleMakePublic() {
    if (!this.currentRoom || this.currentRoom.isPublic) return;

    TelegramApp.hapticFeedback('medium');
    SocketClient.makePublic(this.currentRoom.code);
    UI.showToast('Sala ahora es pública', 'success');
  },

  /**
   * Manejar salir de sala
   */
  handleLeaveRoom() {
    if (!this.currentRoom) return;

    // Confirmación usando API unificada
    TelegramApp.showConfirm('¿Salir de la sala?', (confirmed) => {
      if (confirmed) {
        SocketClient.leaveRoom(this.currentRoom.code);
        this.currentRoom = null;
        UI.showScreen('lobby-screen');
        TelegramApp.hapticFeedback('medium');
      }
    });
  }
};

// Hacer global
window.WaitingRoom = WaitingRoom;
