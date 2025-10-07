export const Registry = {
  games: new Map(),
  register(game){
    if (!game || !game.id) throw new Error('Game inválido');
    this.games.set(game.id, game);
  },
  list(){ return Array.from(this.games.values()); },
  get(id){ return this.games.get(id); }
};
window.Registry_V2 = Registry;
