# CodeMap — telegram-game-room (instalación limpia)

## Estructura de directorios

```
telegram-game-room/
├─ .env / .env.local / .env.example
├─ docs/
│  ├─ xyzworld/ (PRD, arquitectura, API, modelos, UI/UX, pruebas, roadmap)
│  └─ codemap.* (este archivo y JSON)
├─ testsprite_tests/ (...)
├─ backend/
│  ├─ config/
│  │  ├─ config.js (PORT, seguridad, admin)
│  │  └─ logger.js (winston)
│  ├─ services/
│  │  └─ memoryStore.js (supply/users/txs en memoria)
│  └─ server.js (Express, rate-limit, /health)
├─ frontend-v2/ (vacío por ahora)
├─ scripts/ (vacío por ahora)
├─ package.json / package-lock.json
├─ docker-compose.yml
└─ rebuild_log.txt
```

## Endpoints HTTP (vivos)
- `GET /health` → `{ success, status: 'ok', time }`
- `GET /api/economy/supply` → resumen de supply
- `GET /api/economy/supply/txs?limit&offset` → transacciones
- `GET /api/economy/supply/stream` → SSE de supply
- `POST /api/economy/supply/burn` (admin)
- `GET /api/xp/config` → configuración de umbrales XP
- `POST /api/xp/config` (admin) → actualizar umbrales XP

## Middlewares/seguridad
- `helmet`, `cors`, `express-rate-limit` con bypass endurecido: requiere `ALLOW_TEST_RUNNER=true` + `User-Agent` o `X-Test-Runner` que contenga “testsprite/chrome devtools”.

## Configuración/env
- `PORT` (por defecto 3000)
- `ADMIN_USERNAME` (por defecto `wilcnct`)
- `ADMIN_CODE` (secreto; fallback actual `658072974` hasta moverlo solo a env)
- `RL_WINDOW_MS`, `RL_MAX_REQ`, `ALLOW_TEST_RUNNER`

## Servicios
- `memoryStore` (en memoria): resumen de supply, quemas, y lista de transacciones (cap 500).

## Observabilidad
- Logger: `backend/config/logger.js` (winston a consola)
- Logs de servidor: `logs/server_out.log`, `logs/server_err.log` (creados al iniciar)

## Pendiente de implementación (siguiente fase)
- Economía (supply/stream SSE, usuarios, sponsors, transfer, XP config)
- Auth (Telegram + email/clave)
- Store checkout (idempotente, burn, recompensas)
- Topups (fee, aprobación admin 1417856820)
- Quests (daily)
- Rifas (Fuego/Premio) + PDFs
- Mensajería/Inbox/Chat
- UI base en `frontend-v2/`
