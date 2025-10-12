# MAPA ARENA MVP – Diseño Técnico y Compatibilidad

## 1. Objetivo
Primer mapa de combate tipo arena, compatible con la plataforma `telegram-game-room/`, optimizado para partidas FFA (hasta 10 jugadores) y 5v5. Debe integrarse con el “Personaje Global” y el netcode autoritativo.

## 2. Compatibilidad con `telegram-game-room/`
- Proyecto base: `ytwice3.2.1/telegram-game-room/`
- Backend (propuesto):
  - `backend/games/brawl/engine.js` (física/colisiones/combat)
  - `backend/games/brawl/state.js` (estado/snapshots)
  - `backend/games/brawl/events.js` (handlers socket)
  - `backend/games/brawl/config.js` (constantes tuning)
- Frontend (propuesto):
  - `frontend/brawl/renderer.js` (Canvas 2D)
  - `frontend/brawl/input.js` (controles táctil/teclado)
  - `frontend/brawl/hud.js` (HUD y toasts)
  - `frontend/brawl/physics-client.js` (predicción/interpolación)
- Socket.io: namespace o filtrado por `room.gameType === 'brawl'` en `services/socketService.js`.
- Personaje Global: se usa `characterId` y su `loadout` al entrar. Ranked aplica normalización.

## 3. Especificación del mapa
- Tipo: Arena cerrada con bordes “out-of-bounds” (OOB) laterales y fondo letal.
- Capas:
  1) `collisions` (plataformas rectangulares, semi-plataformas desde abajo)
  2) `spawn_players` (10 puntos simétricos)
  3) `spawn_powerups` (4–6 puntos equilibrados)
  4) `killzones` (OOB izquierda/derecha y fondo)
  5) `decor` (no colisiona)
- Unidad y coordenadas:
  - Base Canvas/Web: 1 unidad = 1 píxel.
  - Resolución lógica: 1920×1080 (escalado responsivo en WebView).
  - Origen (0,0) en esquina superior izquierda; eje Y hacia abajo.
- Geometría MVP:
  - Suelo principal: y = 900, ancho 1600 px, centrado
  - Plataformas medias (izq/der): y = 650, ancho 450 px, x = 400 y x = 1120
  - Plataforma superior central: y = 400, ancho 320 px, x = 800
  - Bordes OOB: x < -120 o x > 2040, Fondo OOB: y > 1100

## 4. Física y movilidad (Brawlhalla-like, tuning inicial)
- Gravedad: 1800 px/s²
- Velocidad horizontal base: 240 px/s (máx 300 con buffs)
- Aceleración: 2800 px/s²; Desaceleración/fricción: 3200 px/s²
- Salto: impulso 680 px/s (doble salto: 85% del primero)
- Fast-fall: +30% velocidad de caída al bajar y sin colisión bajo pies
- Dash: +480 px/s durante 0.15 s, recuperación 0.10 s
- Dodge (i-frames): 0.30 s invencible, CD 2.0 s (gravity cancel permitido una vez aire)
- Cap velocidad vertical: 1400 px/s
- Semiplataformas: atraviesa desde abajo; colisiona al caer si `vy > 0` y tecla abajo no presionada

## 5. Combate
- Golpes: ligeros (rápidos, menos daño), pesados (start-up mayor), especiales (consumen energía)
- Frame data (base): start-up 6–12 f, active 4–8 f, recovery 8–12 f (1 f ≈ 16.67 ms @60Hz cliente)
- Daño base por tipo: ligero 6–10, pesado 12–18, especial 10–16 + efecto
- Crítico: 5% base, +perks (+2–3%) cap total 15% (no en ranked)
- Knockback: `KB = K0 + K1 * dañoAcumuladoVictima + K2 * dañoGolpe`
  - K0=80, K1=1.1, K2=0.9 (tuning)
- I-frames al respawn: 1.2 s
- Stun: 200–500 ms según golpe; reducible con “tech” al tocar suelo (70% del stun si botón correcto)
- Proyectiles: TTL 1.5–3.0 s, rebotan 0–1 veces, destruyen al chocar con OOB o tiempo

## 6. Netcode
- Servidor autoritativo, tickrate 30 Hz (balance CPU/red móvil)
- Snapshots servidor→cliente: 10 Hz (cada 100 ms) con delta-compression
- Inputs cliente→servidor: 60 Hz (bitmask), `ts` y `seq` para reconciliación
- Predicción cliente sólo de propio movimiento; servidor hace la verdad de colisiones/daño
- Interpolación de rivales: buffer 120 ms (100–150 ms)
- Corrección: “rewind & replay” de inputs locales tras snapshot
- Paquetes mínimos:
  - `client_input {roomId, userId, seq, ts, mask}`
  - `server_state {tick, time, players[], projs[], powerups[]}`

## 7. Power-ups (MVP)
- Tipos: `dmg+` (+15% por 8 s), `shield` (absorbe 25 daño), `speed+` (+15% mov por 6 s), `heal` (+20 vitality)
- Spawn: cada 30 ± 5 s; máximo simultáneo 2; distribución simétrica (round-robin por puntos)
- Denegar acumulación: no stackea del mismo tipo; refresca duración

## 8. Modos
- FFA (hasta 10): 3 vidas o 4 min; +1 kill, -1 autodestrucción; desempate por daño infligido/recibido ratio
- 5v5: Control de Zona (primer a 100% o 2 rondas); respawn por oleadas (5–8 s)

## 9. Archivo de mapa (Tiled JSON recomendado)
- Editor: Tiled (https://www.mapeditor.org/). Export JSON.
- Capas/layers esperadas: `collisions`, `spawn_players`, `spawn_powerups`, `killzones`, `decor`
- Propiedades por objeto (ejemplo):
```json
{
  "type": "collision",
  "shape": "rect",
  "x": 160,
  "y": 900,
  "width": 1600,
  "height": 60,
  "oneWay": false
}
```
```json
{
  "type": "spawn_player",
  "team": "A|B|null",
  "x": 300,
  "y": 860
}
```
```json
{
  "type": "spawn_powerup",
  "x": 960,
  "y": 600
}
```
```json
{
  "type": "killzone",
  "side": "left|right|bottom",
  "x": -200,
  "y": 0,
  "width": 200,
  "height": 1200
}
```

## 10. Modelos de estado y snapshot (resumen)
- `PlayerState`: id, pos(x,y), vel(vx,vy), dir, stocks, damageAccum, iFrames, anim, team, loadoutHash
- `ProjectileState`: id, pos, vel, ttl, ownerId, type
- `PowerUpState`: id, pos, type, active
- `MapState`: name, bounds, platforms[], killzones[], spawnPoints[]
- Snapshot (delta) incluye: `tick`, `players[]` minimizado (sólo campos cambiados), `events[]`

## 11. Eventos Socket (propuestos)
- Cliente→Servidor: `brawl_join {roomId, characterId}`, `brawl_input {mask, ts, seq}`, `brawl_leave {}`, `brawl_ready {}`
- Servidor→Cliente: `brawl_state {snapshot}`, `brawl_score {board}`, `brawl_spawn_powerup {id,type,pos}`, `brawl_respawn {at}`, `brawl_end {result}`
- Errores: `error {code, message}`

## 12. Integración con Personaje Global
- Al `brawl_join`, servidor carga `characterId` y aplica `loadout` y afinidades de arquetipo.
- En ranked, normaliza velocidad/daño/crit a caps; en casual aplica completos.
- Recompensas: al final, `rewardService` genera cofres o drop directo (según KPI/tiempo/posición).

## 13. Seguridad y anti-cheat
- Rate limit de inputs por socket y validación de `seq` y `ts`
- Cierres por “speed hacks” (vx/vy imposibles), teleports no autorizados, acciones fuera de cooldown
- Servidor calcula daño/colisiones; cliente sólo presenta

## 14. Telemetría y logs
- Logs: `logs/brawl.log` (eventos de match), `logs/economy.log` (recompensas), `logs/anti-cheat.log`
- KPIs: ping/jitter promedio, desync rate, tiempo medio por partida, kills por minuto, power-up pickup ratio

## 15. Pruebas
- Unitarias: física de colisión, gravedad, dash/dodge, knockback
- Integración: spawns, power-ups, scoreboard, respawns wave
- E2E: 10 bots simulando inputs a 60 Hz; validación de estabilidad/red

## 16. Roadmap de implementación
1) Loader de mapa (Tiled JSON) + plataformas/killzones
2) Física básica (movimiento, saltos, semiplataformas) + cámara
3) Colisión avanzada + fast-fall, dash, dodge + i-frames
4) Golpes/hitboxes/hurtboxes + knockback y stocks/respawns
5) Power-ups + balance inicial + HUD/scoreboard
6) Netcode: snapshots, predicción, interpolación
7) Optimización y test de carga (10 jugadores)
8) Modo 5v5 (control de zona) y oleadas de respawn

---

Este documento es la guía de implementación del mapa arena MVP y se alinea con el Personaje Global y la arquitectura Socket/Redis de la plataforma.
