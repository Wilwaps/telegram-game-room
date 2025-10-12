# Política de sesión — Bingo

- Si el usuario entra a una sala y esta inicia, y el usuario cierra la app o sale por accidente, mantiene consistencia en la sesión hasta que la sala finalice.
- La sala queda “pineada” en el lobby principal y en el lobby del juego para reconexión rápida.
- Restricción: un usuario solo puede estar activamente en una sola sala al mismo tiempo (servidor lo hace cumplir).
- Al reconectar, el backend expone `/bingo/reconnect` para recuperar el estado y reenlazar sockets.
- UI: cuando hay sala pineada, mostrar banner/carta con CTA “Reconectar”.
