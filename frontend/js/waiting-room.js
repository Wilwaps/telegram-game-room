/**
 * ============================================
 * GESTIÓN DE SALA DE ESPERA
 * ============================================
 */

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
    // Botón copiar código
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => this.handleCopyCode());
    }

    // Botón invitar amigos
    const inviteBtn = document.getElementById('invite-friends-btn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => this.handleInviteFriends());
    }

    // Botón hacer pública
    const makePublicBtn = document.getElementById('make-public-btn');
    if (makePublicBtn) {
      makePublicBtn.addEventListener('click', () => this.handleMakePublic());
    }

    // Botón salir de sala
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    if (leaveRoomBtn) {
      leaveRoomBtn.addEventListener('click', () => this.handleLeaveRoom());
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Jugador se unió
    SocketClient.on('player_joined', (data) => {
      console.log('Jugador se unió:', data);
      this.updateRoom(data.room);
      UI.showToast(`${data.userName} se unió a la sala`, 'success');
      TelegramApp.hapticFeedback('success');
    });

    // Sala actualizada
    SocketClient.on('room_updated', (room) => {
      if (this.currentRoom && room.code === this.currentRoom.code) {
        this.updateRoom(room);
      }
    });

    // Inicio de juego
    SocketClient.on('game_start', (data) => {
      console.log('Juego iniciado:', data);
      Game.start(data);
    });

    // Jugador abandonó
    SocketClient.on('player_left', (data) => {
      if (this.currentRoom && data.roomCode === this.currentRoom.code) {
        this.updateRoom(data.room);
      }
    });

    // Sala cerrada
    SocketClient.on('room_closed', () => {
      this.currentRoom = null;
      UI.showScreen('lobby-screen');
    });

    // Host transferido
    SocketClient.on('host_transferred', (data) => {
      console.log('Host transferido:', data);
      UI.showToast(data.message, 'info');
      if (this.currentRoom) {
        this.currentRoom.host = data.newHostId;
        this.render();
      }
    });
  },

  /**
   * Mostrar sala de espera
   */
  show(room) {
    console.log('Mostrando sala de espera:', room);
    this.currentRoom = room;
    
    // Ocultar loading primero
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.remove('active');
    }
    
    // Renderizar y mostrar
    this.render();
    UI.showScreen('waiting-room-screen');
    TelegramApp.hapticFeedback('success');
  },

  /**
   * Renderizar sala de espera
   */
  render() {
    if (!this.currentRoom) return;

    // Actualizar código de sala
    const roomCodeEl = document.getElementById('room-code');
    if (roomCodeEl) {
      roomCodeEl.textContent = this.currentRoom.code;
    }

    // Actualizar información del host
    this.updateHostInfo();

    // Actualizar slots de jugadores
    this.updatePlayerSlots();

    // Actualizar botón de hacer pública
    this.updatePublicButton();
  },

  /**
   * Actualizar información del host
   */
  updateHostInfo() {
    const hostNameEl = document.getElementById('host-name');
    const hostAvatarEl = document.getElementById('host-avatar');

    if (hostNameEl && this.currentRoom.host) {
      hostNameEl.textContent = this.currentRoom.host.firstName;
    }

    if (hostAvatarEl && this.currentRoom.host && this.currentRoom.host.photoUrl) {
      hostAvatarEl.src = this.currentRoom.host.photoUrl;
    }
  },

  /**
   * Actualizar slots de jugadores
   */
  updatePlayerSlots() {
    const player1Slot = document.getElementById('player-1-slot');
    const player2Slot = document.getElementById('player-2-slot');

    if (!player1Slot || !player2Slot) return;

    // Slot 1 (Host)
    if (this.currentRoom.host) {
      player1Slot.innerHTML = `
        <div class="player-info">
          <img src="${this.currentRoom.host.photoUrl || ''}" alt="Host" class="player-avatar">
          <div class="player-details">
            <div class="player-name">${Utils.escapeHtml(this.currentRoom.host.firstName)}</div>
            <div class="player-status">Anfitrión</div>
          </div>
        </div>
      `;
      player1Slot.classList.add('occupied');
    }

    // Slot 2 (Invitado)
    if (this.currentRoom.players && this.currentRoom.players.length > 1) {
      const guest = this.currentRoom.players.find(p => p.userId !== this.currentRoom.host.userId);
      if (guest) {
        player2Slot.innerHTML = `
          <div class="player-info">
            <img src="${guest.photoUrl || ''}" alt="Guest" class="player-avatar">
            <div class="player-details">
              <div class="player-name">${Utils.escapeHtml(guest.firstName)}</div>
              <div class="player-status">Invitado</div>
            </div>
          </div>
        `;
        player2Slot.classList.add('occupied');
      }
    } else {
      player2Slot.innerHTML = `
        <div class="player-placeholder">
          <div class="placeholder-icon">👤</div>
          <div class="placeholder-text">Esperando jugador...</div>
        </div>
      `;
      player2Slot.classList.remove('occupied');
    }
  },

  /**
   * Actualizar botón de hacer pública
   */
  updatePublicButton() {
    const makePublicBtn = document.getElementById('make-public-btn');
    if (!makePublicBtn) return;

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

    TelegramApp.shareUrl(shareUrl, shareText);
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

    TelegramApp.confirm(
      '¿Salir de la sala?',
      '¿Estás seguro de que quieres salir de esta sala?',
      (confirmed) => {
        if (confirmed) {
          SocketClient.leaveRoom(this.currentRoom.code);
          this.currentRoom = null;
          UI.showScreen('lobby-screen');
          TelegramApp.hapticFeedback('medium');
        }
      }
    );
  }
};
