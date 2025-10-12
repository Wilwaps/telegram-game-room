# Modelos de datos (agnóstico de DB)

## User
```json
{
  "userId": "1417856820", "email": "", "emailVerified": false,
  "passwordHash": "...", "status": "active|blocked",
  "balances": { "fuegos": 0, "coins": 0 },
  "reputation": 0, "badges": ["..."],
  "telegram": { "linked": true, "username": "", "firstName": "", "lastName": "" },
  "createdAt": 0, "lastSeen": 0
}
```

## Store
```json
{ "storeId": "st_...", "ownerId": "...", "name": "", "reputation": 0, "status": "active|blocked", "createdAt": 0 }
```

## Item
```json
{ "itemId": "it_...", "storeId": "st_...", "name": "", "priceFuegos": 10, "priceCoins": 0, "stock": 100, "status": "active|hidden", "createdAt": 0 }
```

## Order
```json
{
  "orderId": "or_...", "userId": "...", "storeId": "...",
  "items": [{ "itemId": "it_...", "qty": 1, "unitPriceFuegos": 10 }],
  "totalFuegos": 10, "burnPct": 0.02, "burnAmount": 0.2,
  "netStoreFuegos": 9.8,
  "rewards": { "toStore": { "coins": 5 }, "toUser": { "coins": 5 } },
  "status": "paid|refunded|failed", "ts": 0
}
```

## Topup (Recarga)
```json
{
  "topupId": "tu_...", "userId": "...", "gross": 1000,
  "feePct": 0.005, "fee": 5, "netFuegos": 995,
  "method": "bank_transfer", "reference": "...", "status": "pending|approved|rejected",
  "ts": 0
}
```

## Quest / QuestLog
```json
{ "questId": "q_login", "type": "login|streak|play|mini", "criteria": {"days": 1}, "rewardCoins": 100, "segment": "all", "active": true }
{ "questLogId": "ql_...", "userId": "...", "questId": "q_login", "completedAt": 0 }
```

## Ledger (append-only)
```json
{ "id": "lg_...", "event": "order_paid|topup_approved|quest_award|burn|transfer",
  "payload": { }, "createdAt": 0 }
```

## Raffle / RaffleNumber
```json
{ "raffleId": "rf_...", "type": "fuego|premio", "name": "", "hostId": "...", "isPublic": true,
  "range": "00-99|000-999", "priceFuego": 10, "potFuego": 0, "rewardSplit": {"winner": 0.7, "host": 0.2, "sponsor": 0.1},
  "deadline": 0|null, "status": "open|closed|settled", "createdAt": 0 }
{ "raffleId": "rf_...", "number": 12, "status": "free|reserved|paid|pending_host", "userId": "...", "ts": 0 }
```

## Room (Bingo/Raffle)
```json
{ "roomCode": "000000", "game": "bingo|raffle", "hostId": "...", "isPublic": true,
  "players": [{"userId": "...", "ready": false, "cardsCount": 1}],
  "started": false, "ecoMode": "friendly|fire", "maxPlayers": 30, "maxCardsPerUser": 10,
  "pinnedUntil": 0, "status": "waiting|running|finished" }
```

## Message (Inbox/Chat)
```json
{ "msgId": "m_...", "userId": "...", "type": "system|room|dm|raffle", "roomId": "...|null", "text": "...", "read": false, "ts": 0 }
```
