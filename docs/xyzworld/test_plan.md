# Plan de Pruebas (QA)

## Estrategia
- Automatizadas (TestSprite MCP) + Diagnóstico UI (Chrome DevTools MCP).
- Staging/Sandbox → Canary 5% → Producción.

## Casos clave
- **Store/Checkout**: usuario válido/ inválido; saldo suficiente; idempotencia; burn aplicado y registrado; recompensas emitidas.
- **Topups**: creación de solicitud; aprobación admin; fee aplicada; ledger actualizado; notificación al usuario.
- **Quests**: reclamo único; tope diario; múltiples usuarios/segmentos; rate limit.
- **Rifas**: crear Fuego/Premio; reservar número; compra; estados; cierre por completitud/fecha; PDFs; notificaciones.
- **Bingo**: reconexión y sala pineada; 1 sala activa; cartones y draw.
- **Auth**: login Telegram; login email/clave; vinculación; fallback UI con CTA a bot.
- **Mensajería/Chat**: inbox, lectura, canales; anónimo.

## Criterios de aceptación
- Ver PRD sección 10. Todo verde + sin 4xx/5xx inesperados + sin errores de consola.

## Evidencias
- Capturas/screencasts, logs de consola/red, PDFs generados (rifas), export `Ledger`.
