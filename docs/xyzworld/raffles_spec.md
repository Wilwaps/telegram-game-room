# Especificación — Rifas (Fuego y Premio)

## Tipos y privacidad
- Tipo **Fuego**: compra con Fuegos, pot visible, payout 70% ganador, 20% anfitrión, 10% sponsor (ID 1417856820).
- Tipo **Premio**: requiere datos reales del anfitrión y flujo de aprobación manual de compras.
- Privacidad: pública (en lobby) o privada (código 6 dígitos y link compartible).

## Lobby Rifas
- Buscador por código.
- Lista pública con: pot Fuego, nombre rifa, anfitrión, costo, recompensa, fecha/hora.
- FAB crear sala → modal de configuración.

## Crear sala (modal)
- Campos comunes: nombre, pública/privada, rango (00-99|000-999), sin fecha o fecha/hora.
- Fuego: precio por número (mín. 10; ajustable), validación de saldo anfitrión (debe disponer al menos ese monto). Al crear: transferir ese monto a `userId=1417856820` (registro de inicio de sala).
- Premio: monto inicial (mín. 100 ajustable) + datos reales y bancarios del anfitrión; se persiste en perfil (autorrelleno la próxima vez).

## Estados de números
- `free` → `reserved` (ventana de confirmación con brillo); si el usuario cancela, vuelve a `free`.
- `reserved` → `paid` (Fuego) tras cobro automático.
- `pending_host` (Premio) hasta aprobación del anfitrión (con nota opcional de referencia).

## Compra/Reserva
- Usuario sin Fuegos: puede ver sala pero no comprar; notificación “Necesitas fuego para participar”.
- Compra múltiple permitida mientras haya disponibilidad.
- Sección inferior muestra números del usuario/anfitrión y sus estados.

### UI pot (Fuego)
- Botón flotante central con ícono 🔥 (mismo tamaño que una celda del número), con brillo rojo/amarillo.
- Al presionarlo, se expande y muestra la leyenda: “X 🔥 que va por el ganador!!” (para usuario) o “X 🔥 este fuego te espera!!” (para anfitrión), según contexto.

## Cierre y liquidación
- Auto-cierre al completar todos los números o alcanzar la fecha/hora (según configuración).
- Selección de ganador (aleatoria/algoritmo definido); payout 70/20/10 (Fuego) o notificación de premio (Premio).
- Generar PDF con detalles: ids, premio declarado, participantes, ganador y evidencia. Guardar accesible desde dashboard.
- Notificaciones: participantes, ganador y anfitrión con enlaces al PDF.
 - Emails diarios al anfitrión (si tiene correo registrado) con informe PDF de su rifa (participantes/estado).

## Mensajería
- Íconos de compartir en lobby y sala.
- Bandeja de mensajes notifica unión a rifa, compras, resultados y aprobaciones.

## Rifa Premio — Disclaimers y doble confirmación
- Al intentar comprar un número:
  1) Modal principal con aviso: “NO SOMOS RESPONSABLES DE ESTE PREMIO...” y checkbox obligatorio “YA LEÍ”.
  2) Segunda ventana con el número elegido resaltado y datos bancarios del anfitrión (componentes de copiar).
     - Campo de texto opcional para referencia/notas.
     - Botón Aceptar. Si cancela, el número vuelve inmediatamente a `free`.
