class Player {
  constructor(username, x, y, currentDirection) {
    this.username = username;
    this.x = x;
    this.y = y;
    this.ready = false;
    this.alive = true;
    this.currentDirection = currentDirection;
    this.color = null;
  }

  //M : ajout setColor pour changer la couleur du joueur
  setColor(color) {
    if (
      typeof color === "string" &&
      color.startsWith("#") &&
      color.length === 7
    ) {
      this.color = color;
    }
  }

  setDirection(direction) {
    // On empêche le joueur de faire demi-tour
    if (this.isOppositeDirection(direction)) {
      return;
    }

    this.currentDirection = direction;
  }

  getNextPosition() {
    let nextX = this.x;
    let nextY = this.y;
    switch (this.currentDirection) {
      case "up":
        nextY -= 1;
        break;
      case "down":
        nextY += 1;
        break;
      case "left":
        nextX -= 1;
        break;
      case "right":
        nextX += 1;
        break;
    }
    return { x: nextX, y: nextY };
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

  // Fonction utilitaire
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
