# API REST (especificación)

Notas comunes:
- Autenticación: JWT (Bearer) para rutas protegidas. En WebApp Telegram, token de sesión emitido por backend tras validar payload.
- Idempotencia: `Idempotency-Key` requerido en `/store/checkout` y `/topup/fuegos`.
- Respuestas JSON: `{ success, ... }` con códigos 2xx/4xx/5xx estándar.

## Auth
- POST `/auth/login-email`
```json
{ "email": "user@mail.com", "password": "secret" }
=> { "success": true, "token": "jwt", "user": { ... } }
```
- POST `/auth/link-email` (vincula a cuenta Telegram)
```json
{ "email": "user@mail.com", "password": "secret" }
=> { "success": true }
```

## Store
- POST `/store/verify-user`
```json
{ "storeToken": "st_xxx", "userIdentifier": "1417856820|email" }
=> { "success": true, "valid": true, "userId": "...", "balances": {"fuegos": 100, "coins": 0} }
```
- POST `/store/checkout` (Idempotency-Key)
```json
{ "userId": "...", "storeId": "...", "items": [{"itemId":"it_","qty":1}], "burnPct": 0.02 }
=> { "success": true, "order": { ... }, "burnAmount": 0.2, "netStoreFuegos": 9.8, "rewards": { ... } }
```

## Topups (Fuegos)
- POST `/topup/fuegos` (Idempotency-Key)
```json
{ "userId": "...", "amount": 1000, "reference": "123456" }
=> { "success": true, "topupId": "tu_...", "fee": 5, "net": 995, "status": "pending" }
```
- POST `/topup/review` (admin 1417856820)
```json
{ "topupId": "tu_...", "action": "approve|reject" }
=> { "success": true, "topup": {"status":"approved"}, "ledgerId":"lg_..." }
```

## Quests
- GET `/quests/daily?userId=...`
```json
=> { "success": true, "items": [{"questId":"q_login","rewardCoins":100,"completed":false}] }
```
- POST `/quests/complete`
```json
{ "userId": "...", "questId": "q_login" }
=> { "success": true, "awardedCoins": 100 }
```

## Ledger
- GET `/ledger/events?type=order_paid&limit=50&offset=0`
```json
=> { "success": true, "items": [{"id":"lg_...","event":"order_paid","payload":{...},"createdAt":0}] }
```

## Rifas
- POST `/raffles/create`
```json
{ "type": "fuego|premio", "name":"", "isPublic": true, "range":"00-99", "priceFuego":10,
  "deadline": null|1700000000, "hostData": {"name":"","phone":"","email":"","prize":"","bank": {"code":"0102","acc":"..."}} }
=> { "success": true, "raffleId": "rf_..." }
```
- GET `/raffles/public?search=&limit=10`
- POST `/raffles/reserve-number`
```json
{ "raffleId": "rf_...", "number": 12 }
=> { "success": true, "status": "reserved", "expiresIn": 30 }
```
- POST `/raffles/buy-number`
```json
{ "raffleId": "rf_...", "number": 12 }
=> { "success": true, "status": "paid", "potFuego": 120 }
```
- POST `/raffles/host/approve-pending` (premio)
```json
{ "raffleId": "rf_...", "number": 12, "approve": true, "note": "ref 123" }
=> { "success": true, "status": "paid" }
```
- POST `/raffles/settle` (auto al completar/fecha)
```json
{ "raffleId": "rf_..." }
=> { "success": true, "winner": {"userId":"...","number":12}, "payout": {"winner":70,"host":20,"sponsor":10}, "pdfUrl":"..." }
```

## Mensajes / Chat
- GET `/messages/inbox?userId=...`
- POST `/messages/read`
- WS `/chat/*` para canales general/sala/anónimo.

## Mercado del Fuego
- GET `/market/rewards`
- POST `/market/redeem`

## Bingo (sesión)
- POST `/bingo/reconnect` → devuelve sala pineada si existe.

Errores comunes: `400 invalid_input`, `401 unauthorized`, `403 forbidden`, `409 conflict`, `429 too_many_requests`, `500 server_error`.
