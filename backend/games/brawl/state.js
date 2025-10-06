const EventEmitter = require('events');
const config = require('./config');

// Bitmask de inputs
const INPUT = {
  LEFT: 1 << 0,
  RIGHT: 1 << 1,
  JUMP: 1 << 2,
  DASH: 1 << 3,
  DODGE: 1 << 4,
  FAST_FALL: 1 << 5
};

class Match extends EventEmitter {
  constructor(ns, roomId) {
    super();
    this.ns = ns; // namespace Socket.io
    this.roomId = roomId;
    this.players = new Map(); // socketId -> state
    this.lastSnapshot = 0;
    this.accumulator = 0;
    this.tickMs = 1000 / config.tickrate;
    this.snapshotMs = 1000 / config.snapshotRate;
    this.running = false;
  }

  addPlayer(socket, user) {
    // Spawn aleatorio
    const spawn = config.map.spawns[Math.floor(Math.random() * config.map.spawns.length)] || { x: 960, y: 860 };
    const state = {
      socketId: socket.id,
      userId: user.userId,
      userName: user.userName || `Player-${user.userId?.slice?.(-4) || 'X'}`,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      dir: 1,
      onGround: false,
      jumpsLeft: 2,
      jumpBuffered: false,
      lastDashAt: 0,
      lastDodgeAt: 0,
      iFramesUntil: 0,
      damage: 0,
      inputs: 0
    };
    this.players.set(socket.id, state);
    socket.join(this.roomId);
    return state;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  setInput(socketId, mask) {
    const p = this.players.get(socketId);
    if (p) p.inputs = mask >>> 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = Date.now();
    const loop = () => {
      if (!this.running) return;
      const now = Date.now();
      const dt = (now - last) / 1000; // seg
      last = now;
      this.update(dt);
      setTimeout(loop, this.tickMs);
    };
    loop();
  }

  stop() { this.running = false; }

  update(dt) {
    // Física básica por jugador
    const g = config.physics.gravity;
    const maxVy = config.physics.maxVy;
    const baseSpeed = config.physics.baseSpeed;
    const accel = config.physics.accel;
    const friction = config.physics.friction;

    // Colisiones simples con plataformas rectangulares oneWay y suelo
    const plats = config.map.platforms;

    for (const p of this.players.values()) {
      const inp = p.inputs;
      const left = !!(inp & INPUT.LEFT);
      const right = !!(inp & INPUT.RIGHT);
      const wantFastFall = !!(inp & INPUT.FAST_FALL);
      const wantJump = !!(inp & INPUT.JUMP);
      const jumpPressed = wantJump && !p.jumpBuffered; // edge detection

      // Horizontal
      const targetVx = (left ? -baseSpeed : 0) + (right ? baseSpeed : 0);
      if (targetVx !== 0) {
        // Acelerar hacia target
        const dv = Math.sign(targetVx - p.vx) * accel * dt;
        if (Math.abs(dv) > Math.abs(targetVx - p.vx)) {
          p.vx = targetVx;
        } else {
          p.vx += dv;
        }
      } else {
        // Frenar por fricción
        const dv = Math.min(Math.abs(p.vx), friction * dt) * Math.sign(p.vx);
        p.vx -= dv;
      }
      if (p.vx > config.physics.maxSpeed) p.vx = config.physics.maxSpeed;
      if (p.vx < -config.physics.maxSpeed) p.vx = -config.physics.maxSpeed;

      // Dirección
      if (left && !right) p.dir = -1; else if (right && !left) p.dir = 1;

      // Gravedad y salto
      const gravity = wantFastFall ? g * config.physics.fastFallFactor : g;
      p.vy += gravity * dt;
      if (p.vy > maxVy) p.vy = maxVy;
      
      // Saltos: salto en suelo o doble salto en aire
      if (jumpPressed) {
        if (p.onGround && p.jumpsLeft > 0) {
          p.vy = -config.physics.jumpImpulse;
          p.jumpsLeft -= 1;
          p.onGround = false;
        } else if (!p.onGround && p.jumpsLeft > 0) {
          p.vy = -config.physics.jumpImpulse * config.physics.doubleJumpFactor;
          p.jumpsLeft -= 1;
        }
        p.jumpBuffered = true;
      }
      if (!wantJump) p.jumpBuffered = false;

      // Integración
      let nextX = p.x + p.vx * dt;
      let nextY = p.y + p.vy * dt;
      let grounded = false;

      // Resolver colisiones simples con plataformas
      for (const rect of plats) {
        // Rect: {x,y,w,h, oneWay}
        const wasAbove = p.y <= rect.y;
        const willBeBelow = nextY >= rect.y;
        const withinX = nextX >= rect.x && nextX <= rect.x + rect.w;
        if (withinX) {
          if (rect.oneWay) {
            // Colisión solo si venimos de arriba cayendo
            if (wasAbove && willBeBelow && p.vy >= 0) {
              nextY = rect.y;
              p.vy = 0;
              grounded = true;
            }
          } else {
            // Plataforma sólida (suelo)
            if (wasAbove && willBeBelow && p.vy >= 0) {
              nextY = rect.y;
              p.vy = 0;
              grounded = true;
            }
          }
        }
      }

      p.x = nextX;
      p.y = nextY;
      p.onGround = grounded;
      if (grounded) {
        // Restaurar saltos cuando estamos en suelo
        p.jumpsLeft = 2;
      }

      // OOB -> respawn
      if (p.x < config.map.oob.left || p.x > config.map.oob.right || p.y > config.map.oob.bottom) {
        const spawn = config.map.spawns[Math.floor(Math.random() * config.map.spawns.length)] || { x: 960, y: 860 };
        p.x = spawn.x; p.y = spawn.y; p.vx = 0; p.vy = 0; p.onGround = false; p.jumpsLeft = 2; p.jumpBuffered = false; p.damage = 0; p.iFramesUntil = Date.now() + 1200;
      }
    }

    // Snapshots
    if (Date.now() - this.lastSnapshot >= this.snapshotMs) {
      this.lastSnapshot = Date.now();
      this.broadcastState();
    }
  }

  broadcastState() {
    const players = Array.from(this.players.values()).map(p => ({
      userId: p.userId,
      userName: p.userName,
      x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), dir: p.dir, onGround: p.onGround
    }));
    this.ns.to(this.roomId).emit('brawl_state', { roomId: this.roomId, ts: Date.now(), players });
  }
}

class BrawlManager {
  constructor(ns) {
    this.ns = ns;
    this.matches = new Map(); // roomId -> Match
  }

  getOrCreate(roomId) {
    if (!this.matches.has(roomId)) {
      const m = new Match(this.ns, roomId);
      this.matches.set(roomId, m);
      m.start();
    }
    return this.matches.get(roomId);
  }

  removeIfEmpty(roomId) {
    const m = this.matches.get(roomId);
    if (m && m.players.size === 0) {
      m.stop();
      this.matches.delete(roomId);
    }
  }
}

module.exports = { BrawlManager, INPUT };
