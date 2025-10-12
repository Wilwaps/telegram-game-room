# XYZWORLD — Documentación de la próxima actualización (Casino Virtual)

Este directorio centraliza la documentación para planificar y ejecutar la actualización del proyecto `telegram-game-room` hacia un casino virtual modular con doble moneda, tiendas, rifas, quests y flujos de recarga.

Contenidos:
- PRD y visión: `PRD.md`
- Arquitectura técnica y seguridad: `architecture.md`, `security_and_fraud.md`
- Modelos de datos: `data_models.md`
- API REST (especificación e idempotencia): `apis.md`
- UI/UX y flujos: `ui_ux.md`
- Especificaciones de módulos:
  - Mercado del Fuego: `fire_market_spec.md`
  - Rifas: `raffles_spec.md`
  - Autenticación (Telegram + email/clave) y vinculación: `authentication.md`
  - Política de sesión Bingo (reconexión, pin de sala): `bingo_session_policy.md`
  - Bandeja de mensajes y Chat/Logs: `message_inbox_and_chat.md`
- Flags de configuración: `config_flags.md`
- Plan de pruebas (QA): `test_plan.md`
- Roadmap por fases + KPIs: `roadmap.md`

Notas:
- Toda la documentación es agnóstica de proveedor.
- Los porcentajes (burn, comisión, límites diarios) se rigen por flags.
- Esquemas y endpoints incluyen ejemplos JSON estandarizados.
