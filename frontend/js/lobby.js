/**
 * ============================================
 * GESTIÓN DEL LOBBY
 * ============================================
 */

const Lobby = {
  rooms: [],
  currentFilter: 'all',

  /**
   * Inicializar lobby
   */
  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Botón crear sala
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => this.handleCreateRoom());
    }

    // Botón unirse con código
    const joinCodeBtn = document.getElementById('join-code-btn');
    if (joinCodeBtn) {
      joinCodeBtn.addEventListener('click', () => this.handleJoinWithCode());
    }

    // Botón refrescar salas
    const refreshBtn = document.getElementById('refresh-rooms-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshRooms());
    }

    // Botón unirse en modal
    const joinRoomBtn = document.getElementById('join-room-btn');
    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => this.handleJoinRoom());
    }

    // Input de código (Enter para unirse)
    const roomCodeInput = document.getElementById('room-code-input');
    if (roomCodeInput) {
      roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleJoinRoom();
        }
      });

      // Formatear código mientras se escribe
      roomCodeInput.addEventListener('input', (e) => {
        e.target.value = Utils.formatRoomCode(e.target.value);
      });
    }

    // Filtros de salas
    const filterTabs = document.querySelectorAll('.filter-tabs .tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.handleFilterChange(tab.dataset.filter);
      });
    });

    // Delegación de eventos para cards de salas
    const roomsList = document.getElementById('rooms-list');
    if (roomsList) {
      roomsList.addEventListener('click', (e) => {
        const roomCard = e.target.closest('.room-card');
        if (roomCard) {
          const roomCode = roomCard.dataset.roomCode;
          this.handleJoinRoomByCode(roomCode);
        }
      });
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Lista de salas actualizada
    SocketClient.on('rooms_list', (rooms) => {
      this.rooms = rooms;
      this.renderRooms();
    });

    // Nueva sala agregada
    SocketClient.on('room_added', (room) => {
      this.rooms.push(room);
      this.renderRooms();
    });

    // Sala actualizada
    SocketClient.on('room_updated', (room) => {
      const index = this.rooms.findIndex(r => r.code === room.code);
      if (index !== -1) {
        this.rooms[index] = room;
        this.renderRooms();
      }
    });

    // Sala eliminada
    SocketClient.on('room_removed', (roomCode) => {
      this.rooms = this.rooms.filter(r => r.code !== roomCode);
      this.renderRooms();
    });

    // Sala creada (navegar a sala de espera)
    SocketClient.on('room_created', (room) => {
      WaitingRoom.show(room);
    });
  },

  /**
   * Manejar creación de sala
   */
  handleCreateRoom() {
    TelegramApp.hapticFeedback('medium');
    UI.showLoading('Creando sala...');
    SocketClient.createRoom(false);
  },

  /**
   * Manejar unirse con código
   */
  handleJoinWithCode() {
    TelegramApp.hapticFeedback('light');
    UI.showModal('code-modal');
    
    // Enfocar input
    setTimeout(() => {
      const input = document.getElementById('room-code-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }, 100);
  },

  /**
   * Manejar unirse a sala
   */
  handleJoinRoom() {
    const input = document.getElementById('room-code-input');
    if (!input) return;

    const roomCode = input.value.trim().toUpperCase();

    if (!Utils.isValidRoomCode(roomCode)) {
      UI.showToast('Código inválido (6 caracteres)', 'error');
      TelegramApp.hapticFeedback('error');
      return;
    }

    UI.hideModal('code-modal');
    this.handleJoinRoomByCode(roomCode);
  },

  /**
   * Unirse a sala por código
   */
  handleJoinRoomByCode(roomCode) {
    TelegramApp.hapticFeedback('medium');
    UI.showLoading('Uniéndose a sala...');
    SocketClient.joinRoom(roomCode);
  },

  /**
   * Cambiar filtro
   */
  handleFilterChange(filter) {
    this.currentFilter = filter;

    // Actualizar tabs activos
    const tabs = document.querySelectorAll('.filter-tabs .tab');
    tabs.forEach(tab => {
      if (tab.dataset.filter === filter) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.renderRooms();
  },

  /**
   * Refrescar lista de salas
   */
  refreshRooms() {
    TelegramApp.hapticFeedback('light');
    // Las salas se actualizan automáticamente via Socket.io
    UI.showToast('Actualizando...', 'info', 1000);
  },

  /**
   * Renderizar salas
   */
  renderRooms() {
    let filteredRooms = this.rooms;

    // Aplicar filtro
    if (this.currentFilter === 'waiting') {
      filteredRooms = this.rooms.filter(r => r.status === 'waiting');
    }

    UI.renderRoomsList(filteredRooms);
  },

  /**
   * Mostrar lobby
   */
  show() {
    UI.showScreen('lobby-screen');
    TelegramApp.hideBackButton();
    TelegramApp.hideMainButton();
  }
};

/**
 * ============================================
 * SALA DE ESPERA
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
    // Botón volver al lobby
    const backBtn = document.getElementById('back-to-lobby-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBack());
    }

    // Botón copiar código
    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.handleCopyCode());
    }

    // Botón invitar amigos
    const inviteBtn = document.getElementById('invite-friends-btn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => this.handleInvite());
    }

    // Botón hacer pública
    const publicBtn = document.getElementById('make-public-btn');
    if (publicBtn) {
      publicBtn.addEventListener('click', () => this.handleMakePublic());
    }

    // Botón salir
    const leaveBtn = document.getElementById('leave-waiting-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => this.handleLeave());
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Inicio de juego
    SocketClient.on('game_start', (data) => {
      Game.start(data);
    });

    // Sala cerrada
    SocketClient.on('room_closed', () => {
      Lobby.show();
    });
  },

  /**
   * Mostrar sala de espera
   */
  show(room) {
    this.currentRoom = room;
    UI.showScreen('waiting-room-screen');

    // Actualizar información
    this.updateRoomInfo(room);

    // Configurar botón de atrás
    TelegramApp.showBackButton(() => this.handleBack());
  },

  /**
   * Actualizar información de la sala
   */
  updateRoomInfo(room) {
    // Código de sala
    const codeDisplay = document.getElementById('room-code-display');
    if (codeDisplay) {
      codeDisplay.textContent = room.code;
    }

    // Host
    const host = room.players[0];
    if (host) {
      const hostName = document.getElementById('host-name');
      const hostAvatar = document.getElementById('host-avatar');

      if (hostName) hostName.textContent = host.userName;
      if (hostAvatar) {
        hostAvatar.src = host.userAvatar || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(host.userName)}&background=2481cc&color=fff`;
      }
    }
  },

  /**
   * Manejar volver
   */
  handleBack() {
    TelegramApp.showConfirm('¿Salir de la sala?', (confirmed) => {
      if (confirmed) {
        this.handleLeave();
      }
    });
  },

  /**
   * Manejar copiar código
   */
  async handleCopyCode() {
    if (!this.currentRoom) return;

    const success = await Utils.copyToClipboard(this.currentRoom.code);
    if (success) {
      UI.showToast('Código copiado', 'success');
      TelegramApp.hapticFeedback('success');
    } else {
      UI.showToast('Error al copiar', 'error');
      TelegramApp.hapticFeedback('error');
    }
  },

  /**
   * Manejar invitar amigos
   */
  handleInvite() {
    if (!this.currentRoom) return;

    const url = `${window.location.origin}?room=${this.currentRoom.code}`;
    const text = `¡Únete a mi partida de Tic Tac Toe!\nCódigo: ${this.currentRoom.code}`;

    TelegramApp.shareLink(url, text);
    TelegramApp.hapticFeedback('medium');
  },

  /**
   * Manejar hacer pública
   */
  handleMakePublic() {
    TelegramApp.hapticFeedback('medium');
    SocketClient.makePublic();
    UI.showToast('Sala ahora es pública', 'success');
    
    // Deshabilitar botón
    UI.disableButton('make-public-btn');
  },

  /**
   * Manejar salir
   */
  handleLeave() {
    TelegramApp.hapticFeedback('medium');
    SocketClient.leaveRoom();
    Lobby.show();
  }
};

// Hacer módulos globales
window.Lobby = Lobby;
window.WaitingRoom = WaitingRoom;
