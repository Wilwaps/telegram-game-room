# 🎮 Plan de Expansión - Sistema Global de Minijuegos

## Visión General
Transformar el proyecto de Tic Tac Toe en una plataforma de minijuegos multijugador con IA.

## Juegos a Implementar

### 1. **Tic Tac Toe** ✅ (Completado)
- Multijugador en tiempo real
- Salas públicas/privadas
- Sistema de revancha

### 2. **Damas Chinas** 🔄 (Planificado)
- **Tablero:** 8x8 con 12 piezas por jugador
- **Reglas:** Movimiento diagonal, captura obligatoria, coronación
- **IA:** Algoritmo Minimax con poda Alpha-Beta
  - Fácil: Profundidad 2
  - Medio: Profundidad 4
  - Difícil: Profundidad 6

### 3. **Ajedrez** 🔄 (Planificado)
- **Tablero:** 8x8 estándar
- **Reglas:** Completas (enroque, en passant, promoción)
- **IA:** Stockfish.js o Chess.js + Minimax
  - Fácil: Profundidad 2, evaluación simple
  - Medio: Profundidad 4, evaluación posicional
  - Difícil: Profundidad 6+, tablas de apertura

## Arquitectura Propuesta

### Backend
```
backend/
├── models/
│   ├── Room.js (base abstracta)
│   ├── TicTacToeRoom.js
│   ├── CheckersRoom.js (nuevo)
│   └── ChessRoom.js (nuevo)
├── services/
│   ├── gameLogic/
│   │   ├── ticTacToe.js ✅
│   │   ├── checkers.js (nuevo)
│   │   └── chess.js (nuevo)
│   ├── ai/
│   │   ├── minimax.js (nuevo)
│   │   ├── checkersAI.js (nuevo)
│   │   └── chessAI.js (nuevo)
│   └── statsService.js (expandir)
└── config/
    └── games.js (nuevo - configuración de juegos)
```

### Frontend
```
frontend/
├── js/
│   ├── games/
│   │   ├── ticTacToe.js (refactor actual game.js)
│   │   ├── checkers.js (nuevo)
│   │   └── chess.js (nuevo)
│   ├── ai/
│   │   └── aiOpponent.js (nuevo)
│   ├── stats.js (nuevo - pantalla de estadísticas)
│   └── gameSelector.js (nuevo - selector de juegos)
└── css/
    ├── games/
    │   ├── ticTacToe.css
    │   ├── checkers.css (nuevo)
    │   └── chess.css (nuevo)
```

## Base de Datos (Redis)

### Estructura de Stats
```javascript
user:{userId}:stats = {
  global: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0
  },
  ticTacToe: {
    vsPlayer: { wins: 0, losses: 0, draws: 0 },
    vsAI: { easy: {...}, medium: {...}, hard: {...} }
  },
  checkers: {
    vsPlayer: { wins: 0, losses: 0, draws: 0 },
    vsAI: { easy: {...}, medium: {...}, hard: {...} }
  },
  chess: {
    vsPlayer: { wins: 0, losses: 0, draws: 0 },
    vsAI: { easy: {...}, medium: {...}, hard: {...} }
  }
}
```

## UI/UX Mejorado

### Selector de Juegos (Lobby)
```
┌─────────────────────────────────────┐
│  🎮 Selecciona un Juego             │
├─────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐   │
│  │  ❌⭕  │  │  🔴⚫  │  │  ♔♕   │   │
│  │ Tic   │  │ Damas │  │Ajedrez│   │
│  │ Tac   │  │ Chinas│  │       │   │
│  │ Toe   │  │       │  │       │   │
│  └───────┘  └───────┘  └───────┘   │
│                                     │
│  Modo:                              │
│  ○ Multijugador  ○ vs IA            │
│                                     │
│  Dificultad IA:                     │
│  ○ Fácil  ○ Medio  ○ Difícil        │
└─────────────────────────────────────┘
```

### Pantalla de Estadísticas
```
┌─────────────────────────────────────┐
│  📊 Mis Estadísticas                │
├─────────────────────────────────────┤
│  Global: 45 partidas                │
│  🏆 25  ❌ 15  🤝 5                  │
├─────────────────────────────────────┤
│  ❌⭕ Tic Tac Toe                    │
│  vs Jugadores: 🏆 10  ❌ 5  🤝 2    │
│  vs IA Fácil:  🏆 5   ❌ 0  🤝 0    │
│  vs IA Medio:  🏆 3   ❌ 2  🤝 1    │
│  vs IA Difícil:🏆 0   ❌ 3  🤝 0    │
├─────────────────────────────────────┤
│  🔴⚫ Damas Chinas                   │
│  ...                                │
├─────────────────────────────────────┤
│  ♔♕ Ajedrez                         │
│  ...                                │
└─────────────────────────────────────┘
```

## Librerías Necesarias

### Backend
```json
{
  "chess.js": "^1.0.0-beta.8",  // Lógica de ajedrez
  "stockfish": "^16.0.0",        // Motor de ajedrez (opcional)
}
```

### Frontend
```json
{
  "chessboard.js": "^1.0.0",     // Tablero de ajedrez visual
  "chess.js": "^1.0.0-beta.8"    // Cliente
}
```

## Fases de Implementación

### Fase 1: Refactorización (2-3 horas)
- [x] Crear clase base `Game`
- [ ] Refactorizar Tic Tac Toe para usar arquitectura modular
- [ ] Implementar `GameFactory` para crear juegos
- [ ] Sistema de estadísticas expandido

### Fase 2: Damas Chinas (4-6 horas)
- [ ] Lógica del juego (movimientos, capturas, coronación)
- [ ] IA con Minimax (3 niveles)
- [ ] UI del tablero 8x8
- [ ] Integración con sistema de salas

### Fase 3: Ajedrez (6-8 horas)
- [ ] Integrar chess.js
- [ ] IA con evaluación posicional
- [ ] UI con chessboard.js
- [ ] Reglas especiales (enroque, promoción, etc.)

### Fase 4: Pulido Final (2-3 horas)
- [ ] Selector de juegos en lobby
- [ ] Pantalla de estadísticas completa
- [ ] Animaciones y transiciones
- [ ] Testing exhaustivo

## Estimación Total
**15-20 horas de desarrollo**

## Riesgos y Consideraciones

### Técnicos
1. **Complejidad de IA:** Ajedrez requiere motor robusto
2. **Performance:** Cálculos de IA pueden ser lentos en cliente
3. **Estado del juego:** Sincronización más compleja

### Soluciones
1. **IA en Backend:** Calcular movimientos de IA en servidor
2. **Web Workers:** Para cálculos pesados sin bloquear UI
3. **Validación robusta:** Todas las reglas validadas en backend

## Decisión: ¿Estamos Listos?

### ✅ Fortalezas Actuales
- Arquitectura Socket.io sólida
- Sistema de salas funcional
- UI/UX pulida
- Redis configurado
- Deploy en Railway estable

### ⚠️ Consideraciones
- Tic Tac Toe aún tiene bug de revancha (arreglar primero)
- Expansión requiere refactorización significativa
- Testing exhaustivo necesario antes de producción

## Recomendación

**Opción A: Arreglar y Estabilizar Primero** ⭐ (Recomendado)
1. Arreglar bug de revancha (30 min)
2. Testing completo de Tic Tac Toe (1 hora)
3. Deploy estable a Railway
4. **Luego** iniciar expansión en rama separada

**Opción B: Expansión Inmediata**
1. Arreglar bug de revancha
2. Iniciar refactorización para multi-juegos
3. Implementar Damas Chinas
4. Deploy cuando todo esté completo

## Mi Recomendación Final

**Sí, estamos preparados técnicamente**, pero sugiero:

1. **Ahora:** Arreglar bug de revancha + deploy estable
2. **Próxima sesión:** Iniciar expansión con arquitectura modular
3. **Desarrollo iterativo:** Un juego a la vez, testing exhaustivo

¿Qué prefieres?
- **A)** Arreglar revancha → deploy → expansión después
- **B)** Arreglar revancha → expansión completa → deploy todo junto
