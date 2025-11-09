class Player {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.ready = false;
    this.alive = true;
  }
}

module.exports = Player;
