# Seguridad y Antifraude

## Autenticación y autorización
- Telegram WebApp: validación de payload firmado.
- Fallback Web: email/clave (hash bcrypt), login con JWT y refresh tokens.
- Vinculación de identidades: si email/clave coincide con perfil con `userId` Telegram, se unifican datos.

## Protección API
- Rate limit por IP/usuario/ruta (por entorno). QA con bypass solo si: `ALLOW_TEST_RUNNER=true` + `X-Test-Runner`.
- Idempotencia con `Idempotency-Key` (cabecera) para checkout/topup.
- Validación estricta de inputs (schema validation) y límites.
- CORS restringido; HTTPS obligatorio.

## Auditoría y registros
- `Ledger` como lista append-only.
- Sanitizar logs: ocultar `authorization`, `cookie`, `x-admin-code`, `x-admin-username`, `x-test-runner`.
- Trazabilidad: `requestId`, `userId`, `ip`, `ts`.

## Antifraude básico
- Heurísticas: rachas anómalas de quests, topups repetidos, múltiples checkouts con montos similares.
- Alertas: umbrales configurables → notificación a admin.
- Congelar cuentas/salas ante sospecha y requerir verificación manual.

## Gestión de secretos
- Variables de entorno: `ADMIN_CODE`, `ALLOW_TEST_RUNNER`, `BURN_PCT_DEFAULT`, `TOPUP_FEE_PCT`, etc.
- Nunca imprimir secretos; rotación periódica.
