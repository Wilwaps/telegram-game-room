# PRD — Actualización Casino Virtual (XYZWORLD)

## 1. Contexto y objetivos
- **Plataforma**: evolución de `telegram-game-room` a un casino virtual modular.
- **Monedas**:
  - **Fuegos**: token premium, recargable, divisible, con quema (burn) por transacción.
  - **Coins**: moneda gratuita (fun mode) para retención, pruebas de carga y conversión futura a Fuegos.
- **Módulos**: Bingo, Rifas, Tiendas, Mercado del Fuego, Perfil/Quests, Mensajería, Admin.
- **Objetivo**: integrar economía dual, tiendas ligadas al casino (con burn), recargas con comisión, quests diarias, autenticación Telegram + fallback email/clave y soporte a reconexión de salas.

## 2. Alcance
- Integración de tiendas (checkout con verificación de usuario, burn y recompensas a tienda/usuario).
- Recargas de Fuegos con comisión configurable y transparencia de desglose en UI (tooltip/detalle).
- Daily Quests que entregan Coins (no monetizables) con tope diario y reclamo manual.
- Autenticación doble: Telegram WebApp y login email/clave vinculado a un mismo usuario.
- Reglas de sesión Bingo: reconexión, sala pineada en lobbys; 1 sola sala activa por usuario.
- Mercado del Fuego (redención de recompensas).
- Sistema de Rifas (Fuego y Premio) con flujos de compra, reservas, mensajes, PDFs y payout.
- Bandeja de mensajes y canales de chat (general, por sala, anónimo).

Fuera de alcance (Fase posterior): integración on-chain real. La arquitectura será “blockchain-ready” y modular.

## 3. Roles
- **Usuario**: juega, gana saldo, compra en tienda, completa quests, recibe tokens/recompensas.
- **Tienda**: publica ítems, cobra en saldo del casino o dinero real (vía flujo de solicitud), recibe recompensas.
- **Plataforma**: identidad, saldo, juegos, ventas, auditoría, quests.
- **Admin**: configura tasas (burn, comisión), recompensas, límites y controla auditorías/alertas.

## 4. Reglas de negocio (RB)
- **RB1 Tienda ↔ Casino**: las compras de tienda se pagan con Fuegos o saldo casino (no fiat directo en la UI en esta fase; flujo de solicitud para compras de Fuegos con datos bancarios).
- **RB2 Burn**: en cada compra, quemar % configurable del importe (2–5%). Registrar en `Ledger` (append-only).
- **RB3 Verificación**: checkout requiere validar usuario (existencia, no bloqueado, saldo suficiente). Idempotencia obligatoria.
- **RB4 Recompensas post-venta**: emitir recompensas configurables a tienda y comprador (reputación, coins, badges, cashback en coins). Independientes del % quemado.
- **RB5 Comisión de recarga**: aplicar fee configurable (0.5–1.5%). UI muestra total neto y detalle accesible.
- **RB6 Daily Quests**: coins por objetivos diarios. Requiere reclamo manual; no acumulable si no reclama.
- **RB7 Reconexión Bingo**: si usuario cierra app, mantiene su sesión de sala hasta finalizar; sala pineada en lobbys. Solo 1 sala activa por usuario.
- **RB8 Autenticación**: si no hay Telegram, forzar email/clave (vinculable a un ID de Telegram existente). Si no ha configurado email/clave, mostrar CTA para registrarse vía bot `t.me/@xyz3w_bot`.
- **RB9 Mensajes**: bandeja de entrada con notificaciones de rifas, compras, premios; icono brilla hasta leído.

## 5. Flujos principales
### 5.1 Checkout tienda (verificación + burn + recompensas)
1) Tienda solicita ID de usuario.
2) Plataforma valida identidad/saldo.
3) Calcula importes y % burn (flags).
4) Descuenta del usuario; quema %; abona neto a tienda.
5) Emite recompensas (tienda y usuario).
6) Registra en `Ledger` (venta_id, user_id, store_id, burn, comisiones, ts).

### 5.2 Recarga Fuegos (comisión)
1) Usuario solicita compra de Fuegos (UI muestra “Comprar 🔥”).
2) UI presenta datos bancarios; captura monto y referencia.
3) Se genera solicitud para admin (Telegram ID 1417856820) con panel de aprobación.
4) Al aprobar, se descuenta del supply y se acredita neto (fee aplicado) al usuario. Registro `Ledger`.
5) Notificación al usuario: “El fuego está en tu poder (X 🔥)”.

### 5.3 Daily Quests
1) Generación diaria por segmento.
2) Usuario cumple condiciones.
3) Usuario “Reclama” → acreditación de Coins (tope diario). Registro `Ledger`.
4) Sugerencia suave a recargar Fuegos tras completar.

### 5.4 Rifas
- Ver `docs/xyzworld/raffles_spec.md` para detalle de Fuego/Premio, privacidad, reservas, payout, PDFs y mensajería.

## 6. Datos y modelos (resumen)
- Ver `data_models.md` (User, Store, Item, Order, Topup, Quest, QuestLog, Ledger, Raffle, RaffleNumber, Room, Message, etc.).

## 7. API (resumen)
- Ver `apis.md` para payloads/idempotencia. Endpoints clave:
  - `/store/verify-user`, `/store/checkout`
  - `/topup/fuegos`
  - `/quests/daily`, `/quests/complete`
  - `/ledger/events`
  - `/auth/login-email`, `/auth/link-email`
  - `/raffles/*`, `/messages/*`, `/market/*`, `/bingo/*`

## 8. UI/UX
- Transparencia mínima (tooltip “ver detalles”).
- Etiqueta de burn en recibo (“🔥 X fuegos quemados”).
- Tablero de quests con progreso + botón “Reclamar”.
- Lobbies: vista 1/3 + 10 salas públicas recientes; FAB para crear nueva sala por juego.
- Mercado del Fuego en hover/menu.

## 9. Métricas y KPIs
- ARPPU/ARPU, conversión Coins→Fuegos, LTV.
- % burn por categoría/tienda.
- Finalización de quests y uplift en recargas.
- GMV tienda y repetición de compra.
- Alertas de anomalías.

## 10. Criterios de aceptación (QA)
- Tienda no cobra sin ID válido.
- Burn aplicado y registrado en Ledger.
- Recompensas emitidas a tienda y comprador.
- Comisión de recarga aplicada y visible.
- Quests: reclamo único; tope diario; sin doble reclamo.
- Endpoints idempotentes (checkout/topup).
- Logs/auditoría íntegros (append-only) y sin exponer secretos.
- Reconexión Bingo estable; sala pineada; 1 sala activa por usuario.
- Autenticación email/clave funcional y vinculada correctamente con Telegram.

## 11. Despliegue
- Fase 1: sandbox (tiendas internas + usuarios de prueba).
- Fase 2: canary 5%.
- Fase 3: 100% si KPIs ≥ umbrales.

## 12. Riesgos y mitigaciones
- Fraude/abuso en quests/topups → rate-limit, idempotencia, auditoría y alertas.
- Soporte/manualidad en recargas → panel eficiente, colas y trazabilidad.
- Privacidad/PII → mascar headers/campos sensibles en logs.

## 13. Referencias
- Codemap del proyecto (`docs/codemap.*`).
- Specs complementarias en este directorio.
