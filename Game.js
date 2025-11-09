const Player = require("./Player");

// Structure de la game pendant une partie
class Game {
  constructor(creatorId, name, maxPlayers) {
    // Id unique pour la game
    this.id = crypto.randomUUID();
    this.name = name;
    // On part du principe que l'aire de jeu est carrée : 100*100
    this.size = 100;
    // Génération d'une aire size*size
    this.grid = Array.from({ length: this.size }, () =>
      Array(this.size).fill(null)
    );

    this.maxPlayers = maxPlayers;
    // Une game est un lobby lors de sa création
    this.status = "lobby";
    // On commence à remplir le tableau avec le joueur créateur
    this.players = [new Player(creatorId, 0, 0)];
    this.startedAt = Date.now();
    this.interval = null;
  }

  start() {
    // Change le statut de la game en "game" pour désactiver la réapparition des joueurs
    this.status = "game";
    // Lancer un intervalle de updateAllPlayerMovements
    this.interval = setInterval(() => {
      updateAllPlayerMovements(this);
    }, 10);
  }

  stop() {
    // Stopper l'intervalle
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  checkAllPlayersReady() {
    let allReady = true;
    this.players.forEach((player) => {
      if (!player.ready) {
        allReady = false;
      }
    });
    return allReady;
  }

  checkPlayerInGame(playerId) {
    return this.players.some((player) => player.id === playerId);
  }

  checkCollision(playerId) {
    let player = this.players.find((player) => player.id === playerId);

    // check collision hors-grille
    if (
      player.x < 0 ||
      player.x >= this.size ||
      player.y < 0 ||
      player.y >= this.size
    ) {
      return true;
    }
    // check si la case est déjà occupée par un autre joueur
    if (this.grid[player.x][player.y] != null) {
      return true;
    }

    return false;
  }

  setPlayerReady(playerId) {
    this.players.forEach((player) => {
      if (playerId === player.id) {
        player.ready = true;
        return true;
      }
    });
    return false;
  }
}

module.exports = Game;
