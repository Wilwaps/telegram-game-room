# datosbot

Módulo opcional (removible) para responder el comando `/start` en el webhook de Telegram.

## Activar
1. Mantén este directorio `datosbot/` dentro del proyecto.
2. El webhook `backend/routes/telegram.js` detecta automáticamente `datosbot/startResponder.js` si existe.

## Desactivar
- Borra este directorio (o renómbralo). El webhook continuará funcionando sin responder al comando `/start`.

## Personalizar
- Edita `datosbot/startResponder.js` para modificar el formato del mensaje que se envía al usuario.
