# Codemap: telegram-game-room

## Tech Stack
- **Backend**: Node.js 16+, Express 4, Socket.io 4
- **Storage**: Redis (ioredis)
- **Logging**: Winston
- **Frontend**: Vanilla JS/CSS (Frontend v2)
- **Integraciones**: Telegram WebApp

```mermaid
graph TD
  subgraph Frontend (v2)
    A[core/app.js]
    B[core/socket.js]
    C[plugins/bingo/index.js]
    D[plugins/tictactoe/index.js]
  end
  subgraph Backend
    S[backend/server.js]
    SS[services/socketService.js]
    BG[services/bingoService.js]
    EC[services/economyService.js]
    RS[services/redisService.js]
    XP[services/xpService.js]
    SU[services/supplyService.js]
  end
  R[(Redis)]
  TG[(Telegram WebApp)]

  A --> B -->|Socket.io| SS
  A --> C
  A --> D
  S --> SS
  SS --> BG
  SS --> EC
  SS --> RS
  EC --> RS
  SU --> RS
  XP --> RS
  SS --> R
  EC --> R
  SU --> R
  A -->|HTTP /api| S
  TG --> A
```

## Estructura de módulos
- **Backend**
  - `backend/config/` → `config.js`, `logger.js`
  - `backend/server.js`
  - `backend/middleware/` → `adminAuth.js`
  - `backend/models/` → `BingoRoom.js`, `Room.js`, `User.js`
  - `backend/services/` → `redisService.js`, `economyService.js`, `supplyService.js`, `xpService.js`, `profileService.js`, `bingoService.js`, `socketService.js`, `telegramService.js`, `tokenService.js`
  - `backend/routes/` → `economy.js`, `profile.js`, `store.js`, `xp.js`
  - `backend/utils/` → `gameLogic.js`, `validation.js`
- **Frontend v2**
  - `frontend-v2/js/core/` → `app.js`, `socket.js`, `ui.js`, `utils.js`, `registry.js`, `config.js`, `market.js`
  - `frontend-v2/js/plugins/` → `bingo/index.js`, `tictactoe/index.js`

## Endpoints HTTP (principales)
- `GET /api/economy/supply` → `backend/routes/economy.js`
- `GET /api/economy/supply/txs?limit=` → `backend/routes/economy.js`
- `GET /api/economy/supply/stream` (SSE) → `backend/routes/economy.js`
- `GET /api/economy/users?cursor=&limit=&search=` → `backend/routes/economy.js`
- `GET /api/economy/history/:userId` → `backend/routes/economy.js`
- `POST /api/economy/transfer` → `backend/routes/economy.js`
- `POST /api/economy/sponsors/add|remove|set-meta|set-key|remove-key` (admin) → `backend/routes/economy.js`
- `POST /api/economy/grant-from-supply` (admin) → `backend/routes/economy.js`
- `GET /api/profile/:userId` | `POST /api/profile/:userId` | `POST /api/profile/:userId/request-key-change` → `backend/routes/profile.js`
- `GET /api/store/catalog` | `POST /api/store/redeem` → `backend/routes/store.js`
- `GET /api/xp/config` | `POST /api/xp/config` → `backend/routes/xp.js`

## Eventos Socket.io (definidos en `backend/config/config.js`)
- **Conexión**: `connection`, `disconnect`, `authenticate`, `authenticated`, `error`
- **Salas**: `create_room`, `room_created`, `join_room`, `leave_room`, `close_room`, `make_public`, `rooms_list`, `room_updated`, `room_added`, `room_removed`, `room_closed`, `player_joined`, `player_left`
- **Economía**: `get_fires`, `fires_balance`, `earn_fire`, `spend_fires`, `transfer_fires`, `fires_updated`, `get_fires_history`, `fires_history`, `fires_transaction`, `welcome_status`, `welcome_info`, `welcome_claim`, `daily_bonus_status`, `daily_bonus_info`, `daily_bonus_claim`
- **XP**: `get_xp`, `xp_balance`, `earn_xp`, `lose_xp`, `xp_updated`, `get_xp_history`, `xp_history`, `xp_transaction`
- **Bingo (completo)**: `create_bingo_room`, `bingo_room_created`, `join_bingo`, `bingo_joined`, `bingo_make_public`, `bingo_room_updated`, `leave_bingo`, `start_bingo`, `bingo_started`, `draw_next`, `number_drawn`, `claim_bingo`, `bingo_valid`, `bingo_invalid`, `bingo_winner`, `bingo_finished`, `pause_bingo`, `resume_bingo`, `bingo_potential`, `player_joined_bingo`, `player_left_bingo`, `host_left_bingo`, `bingo_paused`, `bingo_resumed`, `room_full`, `bingo_set_mode`, `bingo_mode_updated`, `bingo_set_ready`, `bingo_ready_updated`, `bingo_set_cards`

## Flujos clave
- **Bingo: inicio**
  - Frontend emite: `bingo_set_cards` → `bingo_set_ready` → `bingo_set_mode`
  - Backend (`socketService.js`) valida, genera draw order, persiste sala (`redisService`), `BingoRoom.start()` y emite `bingo_mode_updated` → `bingo_started`/`bingo_room_updated`.
- **Bingo: claim & payout (70/20/10)**
  - Frontend emite: `claim_bingo` con `roomCode`, `cardId`.
  - Backend valida cartón, calcula distribución (`bingoService.calculateDistribution()`), acredita 70% ganador, 20% host, 10% sponsor `1417856820`, emite `fires_updated`/`fires_transaction` a involucrados, `bingo_winner`, `bingo_finished`.
- **Economía HUD**
  - Frontend escucha `fires_balance` y `fires_updated`, emite `get_fires` tras auth y eventos relevantes.

## Modelo principal: `BingoRoom`
- Campos: `code`, `hostId`, `status`, `isPublic`, `players[{ userId, userName, cardIds[], cardsCount, ready }]`, `pot`, `entries`, `mode`, `ecoMode`, `ticketPrice`, `maxCardsPerUser`, `autoDraw`, `drawIntervalMs`, `drawOrder`, `drawnSet`, `started`, `winner`, `winnerCardId`, timestamps.
- Métodos: `addPlayer()`, `removePlayer()`, `getPlayer()`, `setReady()`, `allReady()`, `isEmpty()`, `isFull()`, `start()`, `finish()`, `drawNumber()`, `toJSON()`, `fromJSON()`.

## Prefijos Redis (ver `config.js` → `REDIS_PREFIXES`)
- `room:`, `user:`, `session:`, `stats:`, `cache:`, `bingo:room:`, `bingo:cards:`, `xp:`, `xp:config:`

## Hotspots / Riesgos
- **Rate limit 429** durante pruebas en endpoints `economy`/`xp` y SSE. Sugerido: relajación temporal por entorno/UA o whitelist de IP del runner.
- **SSE** `/api/economy/supply/stream`: sensible a límites/proxy.
- **Identidad Dev**: en producción validar Telegram WebApp `initData` antes de depender de `userId` de desarrollo.

## Sugerencias de pruebas
- **Bingo Modo 🔥**: 10 usuarios con 2 cartones c/u, coste total=20 fuegos; payout 14/4/2 según 70/20/10.
- **Store**: `POST /api/store/redeem` gasta fuegos y registra ledger; assert en `fires_updated` y `ledger`.
- **Economy**: `/api/economy/supply/txs` con `limit` y paginación en `/users`.
- **XP**: `GET/POST /api/xp/config` y reflejo en `xpService`.

## Archivos del codemap
- JSON: `docs/codemap.json`
- Markdown: `docs/codemap.md`

Actualizado: 2025-10-11
