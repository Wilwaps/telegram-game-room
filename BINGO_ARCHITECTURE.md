# Arquitectura Técnica: Bingo Multijugador

## Reglas de Negocio

### Capacidad y Roles
- **Máximo**: 30 usuarios por sala
- **Roles**: 
  - Host (anfitrión): crea la sala, puede iniciar sin sala completa, "canta" los números
  - Jugadores: compran cartones con fuegos 🔥

### Economía de Fuegos
- **Entrada**: 1 fuego por cartón
- **Pot (bote)**: acumula todos los fuegos gastados en cartones
- **Distribución al finalizar (70/20/10)**:
  - 70% → Ganador
  - 20% → Host
  - 10% → Pool global (admin @Wilcnct, TGID 1417856820)

### Cierre por Salida del Host
- **Si NO hay ganador**: 
  - Sala se cierra inmediatamente
  - Todos los jugadores son expulsados
  - Reembolso 100% de fuegos a cada usuario (según cartones comprados)
- **Si hay ganador**: 
  - Distribución normal del pot
  - Sala finaliza

### Flujo de Juego
1. Host crea sala Bingo
2. Jugadores se unen y seleccionan cantidad de cartones (1-N)
3. Se descuentan fuegos y se suman al pot
4. Host inicia partida (puede iniciar sin sala completa)
5. Host "canta" números (manual o automático)
6. Servidor transmite números en tiempo real
7. Jugador hace "Bingo" → servidor valida
8. Si válido: distribución 70/20/10 y finaliza
9. Si inválido: penalización y continúa

---

## Modelo de Datos

### Redis Keys

#### Sala Bingo
```javascript
bingo:room:{code} = {
  code: string,
  hostId: string,
  hostName: string,
  status: 'waiting' | 'playing' | 'finished',
  isPublic: boolean,
  maxPlayers: 30,
  players: [{ userId, userName, cardIds: [] }],
  
  // Economía
  pot: number,
  entries: { [userId]: fuegosGastados },
  
  // Juego
  mode: 'line' | 'double' | 'full',
  drawOrder: [1..75], // números en orden aleatorio
  drawnSet: Set<number>, // números ya cantados
  drawnCount: number,
  
  // Configuración
  ticketPrice: 1, // fuegos por cartón
  maxCardsPerUser: 10,
  autoDraw: boolean,
  drawIntervalMs: 5000,
  
  // Estado
  started: boolean,
  winner: userId | null,
  winnerCardId: string | null,
  createdAt: timestamp,
  startedAt: timestamp | null,
  finishedAt: timestamp | null
}
```

#### Cartones de Usuario
```javascript
bingo:cards:{roomCode}:{userId} = [
  {
    id: uuid,
    userId: string,
    numbers: [
      [B1-15], [I16-30], [N31-45], [G46-60], [O61-75]
    ],
    marked: Set<number>, // números marcados
    patterns: {
      line: boolean,
      double: boolean,
      full: boolean
    }
  }
]
```

#### Pool Global Admin
```javascript
global:firePool = number
```

---

## Backend: Eventos Socket.io

### Sala
- `create_bingo_room { mode, isPublic, autoDraw, drawIntervalMs }` → `bingo_room_created { room }`
- `join_bingo { roomCode, cardsCount }` → valida saldo → `player_joined_bingo { room, cards }`
- `leave_bingo { roomCode }` → `player_left_bingo`
- `start_bingo { roomCode }` (solo host) → `bingo_started { room, firstNumbers }`

### Juego
- `draw_next { roomCode }` (host o auto) → `number_drawn { number, index, total }`
- `claim_bingo { roomCode, cardId }` → valida → `bingo_valid { winner, distribution }` o `bingo_invalid`
- `pause_bingo { roomCode }` (host) → `bingo_paused`
- `resume_bingo { roomCode }` (host) → `bingo_resumed`

### Notificaciones
- `bingo_winner { userId, userName, cardId, pattern, distribution: { winner, host, global } }`
- `bingo_finished { reason, refunds? }`
- `host_left_bingo { refunds: { [userId]: amount } }`
- `insufficient_fires { required, current }`
- `room_full`

---

## Backend: Servicios

### `backend/services/bingoService.js`
```javascript
class BingoService {
  // Generación
  generateDrawOrder() // Fisher-Yates shuffle 1..75
  generateCard(userId) // Cartón 5x5 con números válidos por columna
  
  // Validación
  validateBingo(card, drawnSet, mode) // Verifica patrón ganador
  validatePattern(card, pattern) // line/double/full
  
  // Distribución
  async distributePot(room, winnerId) // 70/20/10
  async refundEntries(room) // Reembolso 100% si host sale
  
  // Estado
  async getRoom(roomCode)
  async setRoom(roomCode, room, ttl)
  async deleteRoom(roomCode)
}
```

### `backend/services/economyService.js` (ya existe)
- Extender para manejar transacciones batch (reembolsos múltiples)

---

## Frontend: Módulos

### `frontend/js/games/bingo.js`
```javascript
const Bingo = {
  currentRoom: null,
  myCards: [],
  
  init() // Setup listeners
  show(room, cards) // Mostrar sala
  renderCards() // Renderizar cartones del usuario
  renderDrawnNumbers() // Grid de números cantados
  handleNumberDrawn(number) // Marcar automáticamente en cartones
  handleClaimBingo(cardId) // Enviar claim al servidor
  handleBingoResult(data) // Mostrar resultado
  handleHostLeft(data) // Mostrar reembolso y volver al lobby
}
```

### `frontend/js/lobby.js` (extender)
- Botón "Crear Bingo"
- Selector de juego: Tic Tac Toe / Bingo

---

## UI/UX: Pantallas

### Lobby
- Selector de juego: [Tic Tac Toe] [Bingo]
- Botón "Crear Bingo" → modal con opciones:
  - Modo: Línea / Doble / Full
  - Público/Privado
  - Auto-canto (on/off)
  - Intervalo (4-10s)

### Pre-Join Bingo
- Mostrar info de sala:
  - Host, jugadores actuales, pot acumulado
  - Precio por cartón: 1 🔥
- Selector de cartones: [1] [2] [3] ... [10]
- Costo total: N 🔥
- Botón "Unirse" (valida saldo)

### Sala de Espera Bingo
- Lista de jugadores con cantidad de cartones
- Pot acumulado: X 🔥
- Host: botón "Iniciar Partida"
- Otros: "Esperando al anfitrión..."

### Juego Bingo
- **Panel superior**:
  - Números cantados (últimos 5 grandes, resto pequeños)
  - Pot: X 🔥
  - Jugadores: N/30
- **Cartones del usuario** (scroll horizontal si >1)
  - Auto-marcado al cantar número
  - Botón "¡Bingo!" por cartón (solo si patrón posible)
- **Host**: botón "Cantar Siguiente" (si manual)

### Resultado Bingo
- **Ganador**: 
  - "¡Ganaste!" + cartón ganador resaltado
  - Distribución: "Tú +X🔥 / Host +Y🔥 / Global +Z🔥"
- **Perdedor**:
  - "Ganó [userName]"
  - "Recibiste +1🔥 por participar"
- Botón "Volver al Lobby"

### Host Sale (sin ganador)
- Modal: "El anfitrión abandonó la sala"
- "Reembolso: +X🔥"
- Auto-redirect al lobby en 3s

---

## Seguridad y Antifraude

### RNG Auditable
- `drawOrder` generado con Fisher-Yates + seed
- Hash del seed publicado al inicio
- Seed revelado al final para verificación

### Validación Server-Side
- Todas las validaciones de bingo en servidor
- Rate limit en `claim_bingo` (1 por segundo por usuario)
- Verificar ownership de `cardId`
- Verificar que números del cartón estén en `drawnSet`

### Transacciones Atómicas
- Compra de cartones: WATCH/MULTI en Redis
- Distribución de pot: transacción única
- Reembolsos: batch atómico

---

## Implementación por Fases

### Fase 1: Infraestructura (2-3h)
- [ ] Modelo `BingoRoom` en `backend/models/BingoRoom.js`
- [ ] Servicio `backend/services/bingoService.js`
- [ ] Eventos socket en `backend/services/socketService.js`
- [ ] Constantes en `backend/config/config.js`

### Fase 2: Lógica de Sala (2-3h)
- [ ] Crear sala Bingo
- [ ] Unirse con compra de cartones (descuento fuegos)
- [ ] Salir de sala (reembolso si no empezó)
- [ ] Iniciar partida (solo host)
- [ ] Cierre por salida del host con reembolso

### Fase 3: Juego (3-4h)
- [ ] Generación de `drawOrder` y cartones
- [ ] Canto de números (manual y automático)
- [ ] Validación de bingo
- [ ] Distribución 70/20/10
- [ ] Pool global admin

### Fase 4: Frontend (4-5h)
- [ ] Selector de juego en lobby
- [ ] Modal crear Bingo
- [ ] Pre-join con selector de cartones
- [ ] Sala de espera Bingo
- [ ] Pantalla de juego con cartones
- [ ] Resultado y reembolso

### Fase 5: Pulido (2-3h)
- [ ] Animaciones de números cantados
- [ ] Sonidos y hápticos
- [ ] Reconexión y resume
- [ ] Testing de carga (30 usuarios)

---

## Estimación Total
**17-23 horas** de desarrollo

## Prioridad Inmediata
Empezar con **Fase 1** para tener la base técnica lista.
