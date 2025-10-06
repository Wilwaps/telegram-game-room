/**
 * ============================================
 * UTILIDADES GENERALES
 * ============================================
 */

const Utils = {
  /**
   * Formatear duración en formato MM:SS
   */
  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Generar ID único
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Copiar texto al portapapeles
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback para navegadores antiguos
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      }
    } catch (error) {
      console.error('Error al copiar:', error);
      return false;
    }
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Sanitizar HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    return text.replace(/[&<>"'/]/g, char => map[char]);
  },

  /**
   * Obtener parámetros de URL
   */
  getUrlParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  },

  /**
   * Guardar en localStorage
   */
  saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error al guardar en storage:', error);
      return false;
    }
  },

  /**
   * Obtener de localStorage
   */
  getFromStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error al leer de storage:', error);
      return defaultValue;
    }
  },

  /**
   * Eliminar de localStorage
   */
  removeFromStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error al eliminar de storage:', error);
      return false;
    }
  },

  /**
   * Vibrar dispositivo (si está disponible)
   */
  vibrate(pattern = 100) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },

  /**
   * Reproducir sonido
   */
  playSound(soundName) {
    // Implementar si se agregan sonidos
    console.log('Playing sound:', soundName);
  },

  /**
   * Animar elemento
   */
  animate(element, animationName, duration = 300) {
    return new Promise(resolve => {
      element.style.animation = `${animationName} ${duration}ms`;
      element.addEventListener('animationend', () => {
        element.style.animation = '';
        resolve();
      }, { once: true });
    });
  },

  /**
   * Esperar tiempo
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Validar código de sala
   */
  isValidRoomCode(code) {
    return /^[A-Z0-9]{6}$/.test(code);
  },

  /**
   * Validar código de sala numérico (Domino)
   */
  isValidNumericRoomCode(code) {
    return /^\d{6}$/.test(code);
  },

  /**
   * Formatear código de sala
   */
  formatRoomCode(code) {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  }
};

// Hacer Utils global
window.Utils = Utils;
