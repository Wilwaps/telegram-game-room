# GameRoom v2 (Frontend)

Arquitectura modular y eficiente para minijuegos con UI unificada, logs en tiempo real y registro de plugins.

## Estructura
- `index.html`: shell principal (pantallas: splash, lobby, game)
- `css/core.css`: estilos base (tema oscuro, grid, toasts, log overlay)
- `js/core/`
  - `config.js`: configuración UI/Socket
  - `utils.js`: utilidades comunes
  - `ui.js`: gestor de pantallas, toasts y logs
  - `socket.js`: wrapper socket.io resiliente (stub offline)
  - `registry.js`: registro de juegos (plugins)
  - `app.js`: bootstrap, lobby dinámico, montaje/unmontaje de juegos
- `js/plugins/bingo/`: plugin Bingo (demo v2)
- `css/bingo.css`: estilos Bingo v2

## Principios
- Módulos pequeños, responsabilidades claras
- Logs en tiempo real visibles por defecto
- Navegación suave: Lobby ↔ Juego
- Plugins de juegos desacoplados: `Registry.register({ id, name, icon, mount, unmount })`

## Probar
1) Abrir `frontend-v2/index.html` en un server estático (o file:// para demo)
2) En Lobby, pulsar “Bingo” → se monta el plugin demo
3) “Simular número” para flujo rápido; marcar celdas; al completar línea aparece overlay “¡Bingo!”

## Próximos pasos
- Integrar `SocketV2` con backend real y eventos de salas
- Implementar Wallet VNC y panel admin (código 658072974) en v2
- Migrar Domino/TicTacToe como plugins v2
- Test E2E y métricas
