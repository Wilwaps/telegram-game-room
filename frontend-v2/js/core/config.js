export const CONFIG = {
  SERVER_URL: window.location.origin,
  SOCKET: {
    TRANSPORTS: ['websocket', 'polling'],
    RECONNECTION: true,
    RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY: 1000,
    TIMEOUT: 20000
  },
  UI: {
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 300
  }
};
window.CONFIG_V2 = CONFIG;
