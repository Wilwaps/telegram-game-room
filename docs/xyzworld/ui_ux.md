# UI/UX — Lobbies, Flujos y Componentes

## Patrones generales
- Bottom nav con secciones: Perfil, Lobby, Rifas, Bingo, Mercado.
- Vistas de lobby con layout 1/3 para destacados y lista de 10 salas públicas recientes.
- FAB por juego para crear sala (Bingo, Rifas).
- Tooltips para desglose de comisión; etiqueta de burn en recibos.
- Bandeja de mensajes con icono que parpadea hasta leer.
 - En la pestaña "Juegos" del lobby principal mostrar estado "En desarrollo" hasta habilitar módulos adicionales.

## Bingo
- Encabezado superior con `Compartir`, `Salir` y `Iniciar` (host).
- Botón global `Estoy listo` que se vuelve verde al estar listo.
- Cartones ocultos antes de iniciar; visibles al iniciar; número de cartones = selección.
- Pinned room en lobbys mientras la sala no finalice.

## Rifas
- Lobby principal: buscador por código, lista de salas públicas con: pot Fuego, nombre, anfitrión, costo en Fuegos (modo Fuego), recompensa, fecha/hora.
- Crear sala (modal): tipo (Fuego/Premio), privacidad, rango (00-99|000-999), precio, fecha/hora opcional.
- Reserva/compra números: estado `free|reserved|paid|pending_host` con brillo para `reserved`.
- Contador hasta deadline. Sección inferior con números comprados del usuario/anfitrión.
- PDFs disponibles para ganador/anfitrión en histórico.

## Mercado del Fuego
- Hover/menú que abre catálogo de recompensas canjeables por Fuegos.
- Acceso rápido desde badge de Fuegos.

## Recarga de Fuegos
- Desde el badge de Fuegos, abrir modal con botón “Comprar 🔥”.
- Formulario con datos bancarios, monto y referencia; mensaje “Tu compra está siendo procesada”.
- En admin (1417856820): panel 80% pantalla con lista de solicitudes, acciones aprobar/rechazar y botón “Actualizar”.

## Quests
- Tablero diario con progreso, botón “Reclamar” y CTA suave a recargar Fuegos.

## Autenticación Web
- Si no es Telegram: forzar login email/clave; si no tiene email configurado, mostrar CTA para `t.me/@xyz3w_bot`.

## Mensajería/Chat
- Pestaña de logs (izquierda): stream de creación de salas públicas; clic navega a la sala.
- Canales: general, por sala (autocrea al entrar, autocierra al salir), anónimo.
