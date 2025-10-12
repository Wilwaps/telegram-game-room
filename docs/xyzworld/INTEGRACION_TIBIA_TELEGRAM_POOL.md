# Integración Tibia ↔ Telegram: Pool de Fuegos y Drops Aleatorios

## Objetivo
- Garantizar que solo circulen fuegos previamente minteados (pagos reales) y almacenados en un pool.
- Distribuir fuegos como drops aleatorios en Tibia sin generar inflación ni farmeo abusivo.
- Mantener auditoría completa del supply y del pool.

## Componentes existentes (en este repo)
- `backend/services/supplyService.js`: controla MAX_SUPPLY y reserva, auditoría `supply:txs`.
- `backend/services/economyService.js`: saldos por usuario, `grant`, `spend`, `transfer`, historial.
- `backend/routes/economy.js`: endpoints de supply/sponsors/transfer/grant.
- `backend/routes/store.js`: `POST /api/store/redeem` (gasta fuegos; ledger por usuario).

## Diseño de Pool de Emisión (TIBIA_POOL)
- Crear usuario lógico `TIBIA_POOL` como patrocinador con `sponsorKey`.
- Cargar el pool solo desde la reserva (mint real confirmado) usando `POST /api/economy/grant-from-supply`.
- Toda transferencia a jugadores desde Tibia será `transfer()` del pool → jugador (no mint directo).

## Hook de Drop Aleatorio
- Endpoint: `POST /api/hooks/tibia/roll-drop`
  - Headers: `x-hook-secret: <secreto>`
  - Body: `{ eventId, tibiaPlayer, telegramUserId, mob, map, ts }`
  - Lógica:
    1) Validar `x-hook-secret` y `eventId` (idempotencia con `SET NX` por 24h).
    2) Resolver probabilidad de drop (ver sección Probabilidad).
    3) Si hay drop, ejecutar `POST /api/economy/transfer` con `{ fromUserId: 'TIBIA_POOL', toUserId, amount, sponsorKey }`.
    4) Registrar auditoría del hook y resultado (Redis: `pool:txs`).

## Probabilidad y Fairness
- Base por mob: `p0[mob]` configurable.
- Probabilidad dinámica: `p(t) = min(p_max, pool_restante / kills_esperadas_restantes)` en ventanas horarias.
- Pity timer por usuario: aumenta p tras N kills sin premio, con tope `p_cap_user`.
- Rarezas: distribución de montos {1,2,5} con pesos `{0.85, 0.13, 0.02}` (ejemplo).

## Antiexploit/Antifarm
- Caps diarios por usuario (p.ej. 5–10 fuegos/día) `pool:limits:user:{id}:day`.
- Cooldown por mob y variedad de mobs/zonas.
- Rate limit de hooks y bloqueo por IP/UA.
- Límite global por ventana (p.ej. máx 1% del pool por hora).

## Vínculo Tibia ↔ Telegram
- `!link <code>` en Tibia → `POST /api/hooks/tibia/link` para asociar `tibiaPlayer ↔ telegramUserId`.
- Alternativa: link code generado en la MiniApp y validado por el TFS.

## Auditoría y Monitoreo
- Supply: `GET /api/economy/supply`, `GET /api/economy/supply/txs`, SSE `/api/economy/supply/stream`.
- Pool (nuevo): `GET /api/economy/pool/summary`, `GET /api/economy/pool/txs`, SSE `/api/economy/pool/stream`.

## Flujos E2E
1) Pago real confirmado → `allocateAndGrant()` al `TIBIA_POOL`.
2) Kill en Tibia → `POST /api/hooks/tibia/roll-drop` (idempotente) → `transfer()` en caso de drop.
3) Usuario canjea en la MiniApp → `POST /api/store/redeem`.

## Roadmap de Implementación
- Fase 1: TIBIA_POOL + endpoint `roll-drop` con probabilidad fija + caps diarios + idempotencia.
- Fase 2: Probabilidad dinámica, pity timer, SSE y dashboard de pool; antiexploit reforzado.
- Fase 3: Integración de pagos (Stripe/Telegram/Cripto). Cofres/eventos/misiones.

## Notas de Seguridad
- Mantener `sponsorKey` del pool fuera del código TFS (leer de entorno o archivo protegido).
- Validar `x-hook-secret` y restringir IPs del hook si es posible.
- Registrar todo (supply/pool/hooks/transfers) con timestamps para auditoría.
