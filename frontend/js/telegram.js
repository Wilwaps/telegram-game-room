/**
 * ============================================
 * INTEGRACIÓN CON TELEGRAM
 * ============================================
 */

const TelegramApp = {
  tg: null,
  user: null,
  isReady: false,

  /**
   * Inicializar Telegram WebApp
   */
  init() {
    try {
      this.tg = window.Telegram?.WebApp;
      
      if (!this.tg) {
        console.warn('Telegram WebApp no disponible');
        return false;
      }

      // Expandir a pantalla completa
      this.tg.expand();

      // Habilitar cierre de confirmación
      this.tg.enableClosingConfirmation();

      // Obtener datos del usuario
      this.user = this.tg.initDataUnsafe?.user;

      // Configurar tema
      this.setupTheme();

      // Configurar botón principal
      this.setupMainButton();

      // Configurar botón de atrás
      this.setupBackButton();

      this.isReady = true;
      console.log('Telegram WebApp inicializado');
      return true;

    } catch (error) {
      console.error('Error al inicializar Telegram WebApp:', error);
      return false;
    }
  },

  /**
   * Configurar tema de Telegram
   */
  setupTheme() {
    if (!this.tg) return;

    // Aplicar colores del tema
    document.documentElement.style.setProperty('--tg-theme-bg-color', this.tg.backgroundColor);
    document.documentElement.style.setProperty('--tg-theme-text-color', this.tg.themeParams.text_color);
    document.documentElement.style.setProperty('--tg-theme-hint-color', this.tg.themeParams.hint_color);
    document.documentElement.style.setProperty('--tg-theme-link-color', this.tg.themeParams.link_color);
    document.documentElement.style.setProperty('--tg-theme-button-color', this.tg.themeParams.button_color);
    document.documentElement.style.setProperty('--tg-theme-button-text-color', this.tg.themeParams.button_text_color);
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', this.tg.themeParams.secondary_bg_color);
  },

  /**
   * Configurar botón principal
   */
  setupMainButton() {
    if (!this.tg) return;
    
    this.tg.MainButton.hide();
  },

  /**
   * Configurar botón de atrás
   */
  setupBackButton() {
    if (!this.tg) return;
    
    this.tg.BackButton.hide();
  },

  /**
   * Mostrar botón principal
   */
  showMainButton(text, onClick) {
    if (!this.tg) return;

    this.tg.MainButton.setText(text);
    this.tg.MainButton.onClick(onClick);
    this.tg.MainButton.show();
  },

  /**
   * Ocultar botón principal
   */
  hideMainButton() {
    if (!this.tg) return;
    this.tg.MainButton.hide();
  },

  /**
   * Mostrar botón de atrás
   */
  showBackButton(onClick) {
    if (!this.tg) return;

    this.tg.BackButton.onClick(onClick);
    this.tg.BackButton.show();
  },

  /**
   * Ocultar botón de atrás
   */
  hideBackButton() {
    if (!this.tg) return;
    this.tg.BackButton.hide();
  },

  /**
   * Mostrar alerta
   */
  showAlert(message) {
    if (this.tg) {
      this.tg.showAlert(message);
    } else {
      alert(message);
    }
  },

  /**
   * Mostrar confirmación
   */
  showConfirm(message, callback) {
    if (this.tg) {
      this.tg.showConfirm(message, callback);
    } else {
      const result = confirm(message);
      callback(result);
    }
  },

  /**
   * Mostrar popup
   */
  showPopup(params) {
    if (this.tg) {
      this.tg.showPopup(params);
    } else {
      alert(params.message);
    }
  },

  /**
   * Cerrar WebApp
   */
  close() {
    if (this.tg) {
      this.tg.close();
    }
  },

  /**
   * Obtener datos del usuario
   */
  getUser() {
    if (this.user) {
      return {
        userId: this.user.id,
        userName: this.user.username || this.user.first_name || 'Usuario',
        firstName: this.user.first_name || '',
        lastName: this.user.last_name || '',
        languageCode: this.user.language_code || 'es',
        userAvatar: this.user.photo_url || ''
      };
    }

    // Datos de prueba para desarrollo
    return {
      userId: 'dev_' + Math.random().toString(36).substr(2, 9),
      userName: 'Usuario Dev',
      firstName: 'Usuario',
      lastName: 'Dev',
      languageCode: 'es',
      userAvatar: ''
    };
  },

  /**
   * Compartir enlace
   */
  shareLink(url, text) {
    if (this.tg) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      this.tg.openTelegramLink(shareUrl);
    } else {
      // Fallback
      if (navigator.share) {
        navigator.share({ title: text, url: url });
      } else {
        Utils.copyToClipboard(url);
        UI.showToast('Enlace copiado', 'success');
      }
    }
  },

  /**
   * Abrir enlace
   */
  openLink(url) {
    if (this.tg) {
      this.tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  },

  /**
   * Enviar datos al bot
   */
  sendData(data) {
    if (this.tg) {
      this.tg.sendData(JSON.stringify(data));
    }
  },

  /**
   * Habilitar/deshabilitar confirmación de cierre
   */
  setClosingConfirmation(enabled) {
    if (this.tg) {
      if (enabled) {
        this.tg.enableClosingConfirmation();
      } else {
        this.tg.disableClosingConfirmation();
      }
    }
  },

  /**
   * Obtener parámetros de inicio
   */
  getStartParam() {
    if (this.tg) {
      return this.tg.initDataUnsafe?.start_param;
    }
    return null;
  },

  /**
   * Verificar si está en Telegram
   */
  isInTelegram() {
    return this.tg !== null && this.tg !== undefined;
  },

  /**
   * Obtener versión de la plataforma
   */
  getPlatform() {
    if (this.tg) {
      return this.tg.platform;
    }
    return 'unknown';
  },

  /**
   * Obtener versión de Telegram
   */
  getVersion() {
    if (this.tg) {
      return this.tg.version;
    }
    return 'unknown';
  },

  /**
   * Haptic feedback
   */
  hapticFeedback(type = 'medium') {
    if (this.tg && this.tg.HapticFeedback) {
      switch (type) {
        case 'light':
          this.tg.HapticFeedback.impactOccurred('light');
          break;
        case 'medium':
          this.tg.HapticFeedback.impactOccurred('medium');
          break;
        case 'heavy':
          this.tg.HapticFeedback.impactOccurred('heavy');
          break;
        case 'success':
          this.tg.HapticFeedback.notificationOccurred('success');
          break;
        case 'warning':
          this.tg.HapticFeedback.notificationOccurred('warning');
          break;
        case 'error':
          this.tg.HapticFeedback.notificationOccurred('error');
          break;
        default:
          this.tg.HapticFeedback.impactOccurred('medium');
      }
    }
  }
};

// Hacer TelegramApp global
window.TelegramApp = TelegramApp;
