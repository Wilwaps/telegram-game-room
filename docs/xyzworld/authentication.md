# Autenticación y Vinculación

## Telegram WebApp
- Validar payload firmado; emitir token de sesión (JWT) y crear/actualizar perfil (userId).

## Fallback Web (email/clave)
- Si el usuario no viene de Telegram:
  - Mostrar login email/clave. Si coincide con un perfil vinculado a un `userId` Telegram, unificar datos.
  - Si el usuario no tiene email/clave configurados, mostrar mensaje: “Regístrate en Telegram” y link `t.me/@xyz3w_bot`.
- Hash de claves con bcrypt; bloqueo por intentos fallidos; verificación de email opcional.

## Vinculación
- POST `/auth/link-email`: requiere sesión Telegram; guarda email/clave y habilita login Web.

## Mensajes de Grupo → Coins
- Bot escucha mensajes en `https://web.telegram.org/a/#-1002660157966_1` (grupo oficial).
- Almacena actividad por `userId` y otorga Coins de forma periódica (jobs) con límites diarios.
- Mostrar Coins en el perfil (`frontend-v2`), junto con Fuegos y actividad reciente.
