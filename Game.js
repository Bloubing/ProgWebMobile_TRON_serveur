const crypto = require("crypto");
const Player = require("./Player");

// Structure de la game pendant une partie
class Game {
  constructor(creatorId, name, maxPlayers, endGame, creatorColor = "#00ffff") {
    // M : ajout param creatorColor
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
    // On commence à remplir le tableau avec le joueur créateur qui apparaît à gauche
    this.players = [
      new Player(
        creatorId,
        0,
        Math.floor(this.size / 2),
        "right",
        creatorColor
      ),
    ]; // M : ajout creatorColor
    this.startedAt = Date.now();
    this.interval = null;
    this.endGame = endGame;
  }

  start(func, parameter) {
    if (this.interval) {
      // empêcher de lancer une autre intervalle si une déjà existante
      return;
    }
    // Change le statut de la game en "game" pour désactiver la réapparition des joueurs
    this.status = "game";
    // Lancer un intervalle de updateAllPlayerMovements
    this.interval = setInterval(() => {
      this.update();
      func(parameter);
    }, 1000);
  }

  stop() {
    // Stopper l'intervalle
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  update() {
    for (const player of this.players) {
      if (!player.alive) continue;

      // Faire avancer joueur
      player.move();

      // Check collision
      if (this.checkCollision(player)) {
        player.alive = false;

        if (this.getAliveCount() <= 1) {
          let winner = this.getWinner();
          this.endGame(this, winner.id);
          return;
        }
        continue;
      }

      // Marquer la case comme occupée
      this.grid[player.x][player.y] = player.id;
    }
  }

  getAliveCount() {
    return this.players.filter((player) => player.alive === true).length;
  }

  checkAllPlayersReady() {
    // Renvoie vrai si tous les joueurs de la partie sont prêts et que
    // le nombre de joueurs de la partie === maxPlayers
    if (this.players.length !== this.maxPlayers) {
      return false;
    }

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

  getPlayer(playerId) {
    return this.players.find((player) => player.id === playerId);
  }

  getWinner() {
    let winners = [];
    this.players.forEach((player) => {
      if (player.alive) {
        winners.push(player);
      }
    });

    // renvoie l'unique vainqueur
    // sinon renvoie "no_winner" quand 0 winner ou + d'1 winner
    return winners.length === 1 ? winners[0] : "no_winner";
  }

  checkCollision(player) {
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
}

module.exports = Game;
