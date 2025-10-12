# Notas de Implementación (resumen)

- Mantener módulos desacoplados: economy, store, raffles, quests, messaging.
- Persistencia compatible con Redis actual; considerar capa DAO para alternar a DB relacional/noSQL si escala.
- Idempotencia con claves por entidad (`checkout:or_...`, `topup:tu_...`) y TTL.
- SSE/WS: reconexión automática y persistencia mínima de estado de salas en Redis.
- QA bypass: requerir `ALLOW_TEST_RUNNER=true` + header; nunca en prod por defecto.
- Logs: mascar cabeceras sensibles; `requestId` por petición.
- PDFs: generar y almacenar en bucket o filesystem accesible; vincular a `Ledger`/`Raffle`.
