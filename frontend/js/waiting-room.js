const WaitingRoom = {
  currentRoom: null,

  /**
   * Inicializar sala de espera
   */
  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
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
      Game.start(data);
    });

    // Sala cerrada
    SocketClient.on('room_closed', () => {
      this.currentRoom = null;
      UI.showScreen('lobby-screen');
    });

    // Dominó: actualizar sala
    SocketClient.on('domino_room_updated', ({ room }) => {
      if (this.currentRoom && room && room.code === this.currentRoom.code) {
        this.updateRoom(room);
      }
    });
  },

  /**
   * Mostrar sala de espera
   */
  show(room) {
    this.currentRoom = room;

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

    // Código de sala
    const roomCodeEl = document.getElementById('room-code-display');
    if (roomCodeEl) roomCodeEl.textContent = this.currentRoom.code;

    // Actualizar jugadores según tipo de juego
    if (this.currentRoom.gameType === 'domino') {
      this.renderDominoPlayers();
    } else {
      this.updateHostInfo();
      this.updatePlayerSlots();
    }
    this.updatePublicButton();
  },

  /**
   * Renderizar jugadores para Dominó (4 jugadores)
   */
  renderDominoPlayers() {
    const container = document.querySelector('#waiting-room-screen .players-waiting');
    if (!container) return;

    // Construir 4 slots
    const players = Array.isArray(this.currentRoom.players) ? this.currentRoom.players.slice(0, 4) : [];
    const hostId = (typeof this.currentRoom.host === 'string')
      ? this.currentRoom.host
      : (this.currentRoom.host && this.currentRoom.host.userId) ? this.currentRoom.host.userId : (players[0]?.userId || null);

    const slotHtml = (index) => {
      const p = players[index];
      if (p) {
        const name = Utils.escapeHtml(p.userName || p.firstName || `Jugador ${index+1}`);
        const avatar = p.userAvatar || p.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2481cc&color=fff`;
        const isHost = p.userId === hostId;
        return `
          <div class="player-slot filled" id="domino-slot-${index}">
            <div class="player-avatar-wrapper">
              <img class="player-avatar" alt="P${index+1}" src="${avatar}">
            </div>
            <div class="player-info">
              <span class="player-name">${name}</span>
              ${isHost ? '<span class="player-badge host-badge">Host</span>' : ''}
            </div>
          </div>
        `;
      }
      return `
        <div class="player-slot empty" id="domino-slot-${index}">
          <div class="player-avatar-wrapper waiting-pulse">
            <div class="player-avatar-placeholder"><span>?</span></div>
          </div>
          <div class="player-info">
            <span class="player-name">Esperando jugador...</span>
          </div>
        </div>
      `;
    };

    container.innerHTML = `${slotHtml(0)}
      <div class="vs-divider"><span class="vs-text">VS</span></div>
      ${slotHtml(1)}
      <div class="vs-divider"><span class="vs-text">VS</span></div>
      ${slotHtml(2)}
      <div class="vs-divider"><span class="vs-text">VS</span></div>
      ${slotHtml(3)}`;
  },

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
        }
        const info = guestSlot.querySelector('.player-info .player-name');
        if (info) info.textContent = guestName;
      }
    } else {
      guestSlot.classList.add('empty');
      guestSlot.classList.remove('filled');
    }
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

    // En Dominó aún no soportamos "hacer pública"
    if (this.currentRoom.gameType === 'domino') {
      makePublicBtn.textContent = 'No disponible en Dominó';
      makePublicBtn.disabled = true;
      makePublicBtn.classList.add('disabled');
      return;
    }

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

    const isDomino = this.currentRoom.gameType === 'domino';
    const shareUrl = isDomino
      ? `${window.location.origin}?room=${this.currentRoom.code}&game=domino`
      : `${window.location.origin}?room=${this.currentRoom.code}`;
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
        if (this.currentRoom.gameType === 'domino') {
          SocketClient.leaveDomino(this.currentRoom.code);
        } else {
          SocketClient.leaveRoom(this.currentRoom.code);
        }
        this.currentRoom = null;
        UI.showScreen('lobby-screen');
        TelegramApp.hapticFeedback('medium');
      }
    });
  }
};

// Hacer global
window.WaitingRoom = WaitingRoom;
