# PERSONAJE GLOBAL (Estilo NFT) – Diseño e Integración

## 1. Propósito y alcance

Este documento define el diseño del “Personaje Global” intercambiable (estilo NFT, sin requerir blockchain) que representa la identidad del usuario en toda la plataforma `telegram-game-room/`. El personaje:
- **Es la identidad del usuario**: entra a cualquier minijuego (TicTacToe, futuros plataformeros/arena).
- **Escala y progresa**: niveles, habilidades y atributos inspirados en Tibia.
- **Interactúa con la economía**: usa “fuegos” para adquirir equipamiento y puede canjearse por oro con límites.
- **Es intercambiable**: marketplace interno con custodia/escrow y tarifas anti-inflación.
- **Slot principal (main)**: cada cuenta puede tener hasta 4 personajes; uno es “main” y se muestra en perfil.

## 2. Principios de diseño
- **Modularidad total**: atributos/habilidades independientes del juego; cada juego mapea qué estadísticas usa.
- **Fair Play**: normalización de estadísticas en modos competitivos (ranked). El progreso nunca rompe el balance.
- **Economía saludable**: “fuegos” como soft currency y sinks suficientes para evitar inflación.
- **Autoridad del servidor**: todas las validaciones (equipar, comprar, tradear) son server-side.
- **Observabilidad**: logs estructurados y telemetría de acciones clave (compra/venta, equipar, recompensas).

## 3. Integración con la plataforma
- Proyecto base: `ytwice3.2.1/telegram-game-room/`.
- Backend Node.js/Socket.io/Redis. Se recomienda agregar DB persistente (MongoDB/PostgreSQL) para personajes e inventarios.
- El “Personaje Global” se integra con:
  - `backend/models/User.js` (asociación de hasta 4 personajes por cuenta, `mainCharacterId`).
  - `backend/models/Room.js` (añadir `characterId` del jugador al unirse).
  - `backend/services/socketService.js` (eventos de perfil, inventario y economy live).
  - `backend/services/redisService.js` (caché de estado/inventarios; persistencia definitiva en DB).

## 4. Modelo de datos (propuesta)

### 4.1 Character
```json
{
  "id": "uuid",
  "ownerUserId": "tg:123456",
  "name": "Allatratib #001",
  "archetype": "knight|paladin|sorcerer|druid",
  "level": 1,
  "xp": 0,
  "stats": {
    "vitality": 100,
    "energy": 100,
    "speed": 100,
    "melee": 10,
    "distance": 10,
    "magic": 10,
    "shielding": 10,
    "fishing": 0,
    "axeFighting": 0,
    "swordFighting": 0
  },
  "perks": ["crit+2%", "dash-cd-5%"],
  "loadout": {
    "weapon": "item:weapon:basic-sword",
    "armor": "item:armor:leather",
    "shield": "item:shield:wood",
    "accessories": ["item:acc:ring-stamina"]
  },
  "inventory": ["item:weapon:basic-bow", "item:powerup:heal-small"],
  "boundTo": null, 
  "createdAt": 1710000000,
  "updatedAt": 1710000000
}
```
Notas:
- `boundTo` permite (opcional) “ligar” un personaje temporalmente a propietario (no se puede tradear durante X horas tras obtenerlo).
- `archetype` define afinidades básicas (ver 4.4).

### 4.2 Wallet (a nivel de usuario)
```json
{
  "userId": "tg:123456",
  "fuegos": 1250,
  "oro": 300,
  "caps": { "dailyFuegosToGold": 500, "weeklyTrades": 10 }
}
```

### 4.3 Item (tipos)
```json
{
  "id": "item:weapon:basic-sword",
  "type": "weapon|armor|shield|accessory|powerup",
  "rarity": "common|rare|epic|legendary",
  "bindOnEquip": false,
  "stats": { "melee": +3, "speed": -1 },
  "effects": { "lifesteal": 0.02 },
  "slot": "weapon",
  "usableIn": ["brawl", "platformer"],
  "matchOnly": false
}
```
- `matchOnly=true` para power-ups consumibles de partida (no persisten).

### 4.4 Arquetipos (afinidades base)
- **Knight**: +shielding, +vitality, melee alto; velocidad media.
- **Paladin**: +distance, +movilidad; sustain ligero.
- **Sorcerer**: +magic (burst), -defensa; cooldowns especiales.
- **Druid**: soporte/control, escudos y curas, CC suaves.

### 4.5 Mapas de uso por juego
- TicTacToe: atributos no afectan al gameplay core (fairness); se usa para recompensas y progresión.
- Arena/Plataformas: se usan `speed`, `melee|distance|magic`, `shielding`, `vitality` y efectos de equipamiento.
- Cada juego declara una “tabla de mapeo” de stats que consume.

## 5. Progresión y balance

### 5.1 Niveles y XP
- Curva suave para móvil: `XP(lvl) ~ 60 * lvl^2 + 100 * lvl` (ajustable por tabla de tuning).
- Recompensas por nivel: puntos de maestría para perks ligeros (no romper balance en ranked).

### 5.2 Habilidades/Skills (inspirado en Tibia)
- `melee`, `distance`, `magic`, `shielding` progresan por uso/retos.
- Secundarias: `fishing`, `axeFighting`, `swordFighting` (activables según minijuegos/eventos).
- Velocidad crece levemente con nivel (cap duro en ranked, p.ej. +5% máx).

### 5.3 Normalización competitiva (ranked)
- Cap y “squeeze” de stats hacia una banda segura por modo.
- Loadouts limitados (rarity ≤ epic) y perks cosméticos/ligeros.

## 6. Economía: Fuegos y Oro
- **Fuegos (soft currency)**: ganados en partidas, retos, rachas. Usos: equipamiento, cosméticos, pases de evento.
- **Oro**: mercado/intercambios y servicios. Conversión `fuegos→oro` con ratio dinámico y límites diarios/semanales.
- **Sinks**: tarifas de marketplace, reparaciones cosméticas, rerolls de perks visuales, entradas a torneos.
- **Anti-inflación**: fees 5–10%, límites de canje, decay parcial del oro inactivo, cofres “quemadores de moneda”.

## 7. Trading/Marketplace
- Listar personaje o ítems con precio en fuegos/oro.
- Custodia (escrow) del servidor durante la orden.
- Tarifas (fee) + validaciones KYC ligeras (anti-bots/abuso).
- Post-trade: transferencias atómicas de propiedad, logs y eventos de telemetría.

## 8. API HTTP (borrador)
- `GET  /api/characters` → lista de personajes del usuario.
- `POST /api/characters` → crear nuevo personaje (si < 4). Body: archetype, name.
- `PATCH /api/characters/:id` → renombrar, set main, equipar ítems (`{ action, payload }`).
- `GET  /api/characters/:id/inventory` → inventario.
- `POST /api/market/listings` → crear listing (personaje o ítem).
- `POST /api/market/purchase/:listingId` → comprar (escrow + liquidación).
- `POST /api/rewards/chest` → reclamar cofre (e.g., desde TicTacToe), devuelve ítem.

Respuestas JSON con `requestId`, `ts`, `result`, `error` (si aplica).

## 9. Eventos Socket.io
- Cliente→Servidor:
  - `char_set_main { characterId }`
  - `char_equip { characterId, slot, itemId }`
  - `char_unequip { characterId, slot }`
  - `market_subscribe { }`
- Servidor→Cliente:
  - `char_updated { character }`
  - `inventory_updated { inventory }`
  - `market_event { type, listing }`
  - `reward_granted { item }`

## 10. Persistencia
- Redis para caché de estado (salas, inventarios activos).
- DB persistente (recomendado): MongoDB o PostgreSQL.
  - Colecciones/Tablas: `users`, `characters`, `items`, `wallets`, `listings`, `trades`.
- Índices por `ownerUserId`, `listing.status`, `rarity`.

## 11. Seguridad y anti-cheat
- Validación server-side de equipamiento y límites por modo.
- Rate limiting por usuario/IP y firma de payloads (`userId + ts + nonce`).
- Auditoría: logs estructurados (`action`, `userId`, `charId`, `delta_fuegos`, `ip`, `ua`).
- Reversiones controladas (ventana pequeña) para fraudes detectados.

## 12. Telemetría y logging
- KPIs: retención, canjes fuegos→oro, tasa de listings vendidos, % abuso bloqueado.
- Eventos: `char_created`, `char_traded`, `equip`, `reward_drop`, `economy_burn`, `economy_mint`.
- Logging con Winston a `logs/app.log` + `logs/economy.log` + `logs/trade.log`.

## 13. UI/UX
- Nuevas pantallas:
  - Perfil: mostrar `main` y selector de personajes (hasta 4).
  - Inventario: drag & drop/equipar con validación.
  - Mercado: listar/filtrar/comprar con resumen de fee.
- Accesibilidad móvil (Telegram WebApp): botones ≥44px, feedback háptico y toasts claros.

## 14. Interacción con minijuegos
- TicTacToe: no usa stats en gameplay; sí genera cofres y recompensas para el personaje main.
- Plataformero/Arena (futuro): usa `speed`, `melee/distance/magic`, `shielding`, `vitality` y loadout. Normalización en ranked.
- Flujo al entrar a sala (`Room.js`): `join(roomId, userId, characterId)`; servidor valida ownership y estado.

## 15. Roadmap de implementación
- Fase A (backend modelo/API)
  - `models/Character.js`, `models/Inventory.js`, `models/Wallet.js`, `models/Listing.js`.
  - `routes/characters.js`, `routes/market.js`, `routes/rewards.js`.
  - `services/economyService.js`, `services/tradeService.js`, `services/rewardService.js`.
- Fase B (frontend)
  - `frontend/js/profile.js`, `inventory.js`, `market.js`, nuevas vistas y HUD.
- Fase C (integración minijuegos)
  - TicTacToe → cofres y recompensas.
  - Brawl/Plataformas → consumo de stats y loadout + normalización.
- Fase D (telemetría/anti-cheat)
  - Logs, métricas, alertas y pruebas E2E.

## 16. Tablas de tuning (inicial)
- Niveles: XP por nivel (CSV/JSON de referencia en `backend/games/brawl/config.js`).
- Normalización ranked: caps por modo.
- Economía: ratios `fuegos↔oro`, fees, límites diarios/semanales.

---

Última actualización: generar PRs incrementales. Mantener este documento como “fuente de verdad” del Personaje Global, sincronizado con código y balance.
