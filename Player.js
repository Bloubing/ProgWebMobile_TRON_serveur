class Player {
  constructor(id, x, y, currentDirection) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.ready = false;
    this.alive = true;
    this.currentDirection = currentDirection;
  }

  setDirection(direction) {
    if (this.isOppositeDirection(direction)) {
      return;
    }

    this.currentDirection = direction;
  }

  move() {
    switch (this.currentDirection) {
      case "up":
        this.y -= 1;
        break;
      case "down":
        this.y += 1;
        break;
      case "left":
        this.x -= 1;
        break;
      case "right":
        this.x += 1;
        break;
    }
  }

  isOppositeDirection(newDirection) {
    if (this.currentDirection === "up" && newDirection === "down") return true;
    if (this.currentDirection === "down" && newDirection === "up") return true;
    if (this.currentDirection === "left" && newDirection === "right")
      return true;
    if (this.currentDirection === "right" && newDirection === "left")
      return true;
    return false;
  }
}

module.exports = Player;
