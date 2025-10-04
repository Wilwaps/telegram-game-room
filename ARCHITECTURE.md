# 🏗️ Arquitectura del Proyecto

## 📋 Visión General

Este proyecto implementa una **arquitectura cliente-servidor** con comunicación en **tiempo real** usando WebSockets (Socket.io).

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Cliente   │ ◄─────────────────────────► │   Servidor  │
│  (Browser)  │                             │  (Node.js)  │
└─────────────┘                             └─────────────┘
      │                                            │
      │                                            │
      ▼                                            ▼
┌─────────────┐                             ┌─────────────┐
│  Telegram   │                             │    Redis    │
│   WebApp    │                             │  (Storage)  │
└─────────────┘                             └─────────────┘
```

## 🎯 Principios de Diseño

### 1. **Modularidad**
- Cada módulo tiene una responsabilidad única
- Fácil de mantener y extender
- Código reutilizable

### 2. **Escalabilidad**
- Arquitectura preparada para múltiples juegos
- Redis para manejo de sesiones distribuidas
- Socket.io con rooms para aislar partidas

### 3. **Tiempo Real**
- Sincronización instantánea entre jugadores
- Eventos bidireccionales con Socket.io
- Estado del juego centralizado en servidor

### 4. **Seguridad**
- Validación en servidor (nunca confiar en cliente)
- Rate limiting para prevenir abuso
- Sanitización de inputs

## 🔧 Backend

### Estructura de Capas

```
┌─────────────────────────────────────┐
│         HTTP/WebSocket API          │  ← Punto de entrada
├─────────────────────────────────────┤
│          Socket Service             │  ← Manejo de eventos
├─────────────────────────────────────┤
│      Business Logic (Models)        │  ← Lógica de negocio
├─────────────────────────────────────┤
│      Data Access (Services)         │  ← Acceso a datos
├─────────────────────────────────────┤
│         Redis / Database            │  ← Almacenamiento
└─────────────────────────────────────┘
```

### Componentes Principales

#### 1. **Server (server.js)**
- Punto de entrada de la aplicación
- Configuración de Express y Socket.io
- Middleware de seguridad
- Manejo de errores global

#### 2. **Socket Service**
- Gestión de conexiones WebSocket
- Emisión y recepción de eventos
- Lógica de salas y partidas
- Sincronización de estado

#### 3. **Redis Service**
- Almacenamiento de salas activas
- Gestión de sesiones de usuario
- Caché de estadísticas
- TTL automático para limpieza

#### 4. **Game Logic**
- Validación de movimientos
- Detección de victoria/empate
- Algoritmo Minimax (para IA futura)
- Lógica independiente del transporte

#### 5. **Models**
- **Room**: Representa una sala de juego
- **User**: Representa un usuario
- Métodos de validación y transformación

### Flujo de Datos

```
Cliente                Socket Service         Redis           Game Logic
  │                          │                  │                 │
  ├─ makeMove ────────────►  │                  │                 │
  │                          ├─ getRoom ───────►│                 │
  │                          │◄─ room ──────────┤                 │
  │                          ├─ validateMove ───┼────────────────►│
  │                          │◄─ valid ─────────┼─────────────────┤
  │                          ├─ updateRoom ─────►│                 │
  │                          ├─ checkWinner ────┼────────────────►│
  │                          │◄─ result ────────┼─────────────────┤
  │◄─ move_made ────────────┤                  │                 │
  │◄─ game_over ────────────┤                  │                 │
```

## 🎨 Frontend

### Arquitectura Modular

```
┌─────────────────────────────────────┐
│           app.js (Main)             │  ← Inicialización
├─────────────────────────────────────┤
│     Modules (Lobby, Game, etc)      │  ← Lógica de pantallas
├─────────────────────────────────────┤
│      Services (Socket, UI)          │  ← Servicios compartidos
├─────────────────────────────────────┤
│      Utils & Config                 │  ← Utilidades
└─────────────────────────────────────┘
```

### Módulos Principales

#### 1. **App (app.js)**
- Inicialización de la aplicación
- Gestión del ciclo de vida
- Coordinación entre módulos

#### 2. **Socket Client**
- Conexión con servidor
- Manejo de eventos
- Reconexión automática

#### 3. **UI Manager**
- Gestión de pantallas
- Componentes reutilizables
- Notificaciones (toasts)

#### 4. **Telegram Integration**
- Integración con WebApp SDK
- Haptic feedback
- Compartir y notificaciones

#### 5. **Game Modules**
- **Lobby**: Lista de salas
- **WaitingRoom**: Sala de espera
- **Game**: Juego activo
- **Result**: Pantalla de resultados

### Flujo de Navegación

```
Loading Screen
      │
      ▼
   Lobby ◄──────────────────┐
      │                     │
      ├─ Create Room        │
      │        │            │
      │        ▼            │
      │  Waiting Room       │
      │        │            │
      │        ▼            │
      ├─ Join Room ────► Game
      │                     │
      │                     ▼
      └──────────────── Result
```

## 🔄 Comunicación en Tiempo Real

### Eventos de Socket.io

#### Cliente → Servidor
```javascript
authenticate      // Autenticar usuario
create_room       // Crear nueva sala
join_room         // Unirse a sala
make_move         // Hacer movimiento
play_again        // Solicitar revancha
leave_room        // Salir de sala
close_room        // Cerrar sala (host)
make_public       // Hacer sala pública
```

#### Servidor → Cliente
```javascript
authenticated     // Confirmación de autenticación
room_created      // Sala creada
rooms_list        // Lista de salas
room_added        // Nueva sala disponible
room_updated      // Sala actualizada
room_removed      // Sala eliminada
game_start        // Inicio de juego
move_made         // Movimiento realizado
game_over         // Fin de juego (victoria)
game_draw         // Fin de juego (empate)
player_left       // Jugador abandonó
rematch_requested // Solicitud de revancha
game_restart      // Reinicio de juego
error             // Error
```

## 💾 Modelo de Datos

### Room (Sala)
```javascript
{
  code: string,           // Código único (6 chars)
  id: string,             // UUID
  host: string,           // ID del host
  gameType: string,       // Tipo de juego
  isPublic: boolean,      // Sala pública/privada
  status: string,         // waiting/playing/finished
  players: Array,         // Jugadores (max 2)
  board: Array,           // Estado del tablero
  moves: Array,           // Historial de movimientos
  currentTurn: string,    // Turno actual (X/O)
  winner: string,         // ID del ganador
  winningLine: Array,     // Línea ganadora
  createdAt: number,      // Timestamp
  startTime: number,      // Inicio de partida
  endTime: number         // Fin de partida
}
```

### User (Usuario)
```javascript
{
  userId: string,         // ID de Telegram
  userName: string,       // Nombre de usuario
  userAvatar: string,     // URL del avatar
  socketId: string,       // ID del socket actual
  currentRoom: string,    // Sala actual
  stats: {
    gamesPlayed: number,
    wins: number,
    losses: number,
    draws: number,
    winStreak: number
  }
}
```

## 🔐 Seguridad

### Validaciones

1. **Servidor**
   - Validar todos los inputs con Joi
   - Verificar permisos (host, turno, etc.)
   - Rate limiting por usuario
   - Sanitización de strings

2. **Cliente**
   - Validación básica de UI
   - Nunca confiar en validación del cliente
   - Feedback inmediato al usuario

### Prevención de Trampas

- ✅ Validación de movimientos en servidor
- ✅ Verificación de turnos
- ✅ Estado del juego en servidor (no cliente)
- ✅ Timeouts para prevenir AFK
- ✅ Rate limiting para prevenir spam

## 📈 Escalabilidad

### Horizontal Scaling

Para escalar horizontalmente (múltiples instancias):

1. **Redis Pub/Sub**
   ```javascript
   // Compartir eventos entre instancias
   io.adapter(redisAdapter({ 
     pubClient, 
     subClient 
   }));
   ```

2. **Load Balancer**
   - Nginx o HAProxy
   - Sticky sessions para WebSocket
   - Health checks

3. **Redis Cluster**
   - Sharding automático
   - Alta disponibilidad
   - Replicación

### Optimizaciones

- ✅ Compresión de respuestas (gzip)
- ✅ Caché de salas públicas
- ✅ Limpieza automática de salas expiradas
- ✅ Lazy loading de recursos
- ✅ Minificación de assets

## 🧪 Testing

### Estrategia de Testing

```
Unit Tests (70%)
  ├─ Game Logic
  ├─ Validations
  └─ Utils

Integration Tests (20%)
  ├─ Socket Events
  ├─ Redis Operations
  └─ API Endpoints

E2E Tests (10%)
  └─ User Flows
```

## 📊 Monitoreo

### Métricas Clave

- Usuarios activos simultáneos
- Salas activas
- Tiempo promedio de partida
- Tasa de abandono
- Latencia de movimientos
- Errores por minuto

### Logging

Niveles de log:
- **error**: Errores críticos
- **warn**: Advertencias
- **info**: Información general
- **debug**: Debugging detallado

## 🔮 Extensibilidad

### Agregar un Nuevo Juego

1. **Backend**
   ```javascript
   // utils/connectFourLogic.js
   class ConnectFourLogic {
     checkWinner(board) { ... }
     isValidMove(board, col) { ... }
   }
   ```

2. **Frontend**
   ```javascript
   // js/connectFour.js
   const ConnectFour = {
     init() { ... },
     renderBoard() { ... }
   }
   ```

3. **Configuración**
   ```javascript
   // config.js
   gameTypes: {
     TIC_TAC_TOE: 'tic-tac-toe',
     CONNECT_FOUR: 'connect-four'
   }
   ```

## 📚 Recursos

- [Socket.io Docs](https://socket.io/docs/)
- [Redis Docs](https://redis.io/docs/)
- [Telegram WebApp](https://core.telegram.org/bots/webapps)
- [Express.js](https://expressjs.com/)

---

**Arquitectura diseñada para ser escalable, mantenible y extensible.**
