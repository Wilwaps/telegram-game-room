# Especificación — Mercado del Fuego y Recargas

## Redención de recompensas
- Catálogo configurable canjeable por Fuegos.
- Registro en `Ledger` de cada redención (tipo `redeem`).

## Solicitud de compra de Fuegos (usuario)
- Origen: badge de Fuegos → modal → botón “Comprar 🔥”.
- Formulario:
  - Monto (numérico)
  - Referencia (numérica)
  - Instrucciones de pago visibles (banco, CI, TLF, concepto)
- Mensaje: “Tu compra está siendo procesada”.
- Crea `Topup` con `status=pending`.

### Instrucciones de pago (config actual)
- Banco: **0102 Venezuela**
- CI: **20827955**
- TLF: **0412-225.00.16**
- Concepto: **Pago**

Estos datos se muestran en la ventana y deben ser copiables. Pueden moverse a variables de configuración para edición desde Admin.

## Panel de aprobación (admin 1417856820)
- Vista modal (80% pantalla) con lista de `Topup` pending.
- Acciones: aprobar/rechazar; botón “Actualizar”.
- Al aprobar:
  - Aplicar fee (flag `TOPUP_FEE_PCT`).
  - Descontar del `supply` y acreditar neto al usuario.
  - Registrar en `Ledger`: `topup_approved` y `transfer`.
  - Notificar: “El fuego está en tu poder (X 🔥)”.

## Seguridad
- Solo el usuario admin con `userId=1417856820` accede al panel.
- Trazabilidad completa y sanitizada en logs.
