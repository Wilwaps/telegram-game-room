// Configuración y constantes de Brawl (MVP)
module.exports = {
  tickrate: 30, // Hz servidor
  snapshotRate: 10, // Hz snapshots
  physics: {
    gravity: 1800, // px/s^2
    maxVy: 1400, // px/s
    baseSpeed: 240, // px/s
    maxSpeed: 300, // px/s con buffs
    accel: 2800, // px/s^2
    friction: 3200, // px/s^2
    jumpImpulse: 680, // px/s
    doubleJumpFactor: 1.0,
    dashSpeed: 480, // px/s
    dashDuration: 0.15, // s
    dodgeIframes: 0.30, // s
    dodgeCooldown: 2.0, // s
    fastFallFactor: 1.3,
    // Calidad de vida del salto
    coyoteTimeMs: 80,     // ventana tras dejar plataforma donde aún puedes saltar
    jumpBufferMs: 120     // ventana antes de tocar suelo que guarda el salto
  },
  map: {
    name: 'arena_mvp',
    width: 1920,
    height: 1080,
    groundY: 900, // suelo principal
    oob: { left: -120, right: 2040, bottom: 1100 },
    platforms: [
      // rect: x, y, w, h (y es top)
      { x: 160, y: 900, w: 1600, h: 60, oneWay: false }, // suelo
      { x: 400, y: 650, w: 450, h: 30, oneWay: true },
      { x: 1120, y: 650, w: 450, h: 30, oneWay: true },
      { x: 800, y: 400, w: 320, h: 30, oneWay: true }
    ],
    spawns: [
      { x: 300, y: 860 }, { x: 1620, y: 860 }, { x: 500, y: 860 }, { x: 1420, y: 860 },
      { x: 960, y: 360 }, { x: 760, y: 610 }, { x: 1160, y: 610 }, { x: 960, y: 860 }
    ],
    powerups: [ { x: 960, y: 600 }, { x: 620, y: 620 }, { x: 1300, y: 620 }, { x: 960, y: 380 } ]
  }
};
