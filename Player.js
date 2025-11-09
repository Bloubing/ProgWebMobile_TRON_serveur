class Player {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.ready = false;
    this.alive = true;
    this.currentDirection = null;
  }

  moveDirection(direction) {
    if (this.isOppositeDirection(direction)) {
      return;
    }

    switch (direction) {
      case "up":
        this.y += 1;
        break;
      case "down":
        this.y -= 1;
        break;
      case "left":
        this.x -= 1;
        break;
      case "right":
        this.x += 1;
        break;
    }

    this.currentDirection = direction;
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
