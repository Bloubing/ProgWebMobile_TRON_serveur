const crypto = require("crypto");
const Player = require("./Player");

class Game {
  constructor(creatorId, name, maxPlayers, endGame, creatorColor = "#00ffff") {
    // ID unique pour la game
    this.id = crypto.randomUUID();
    this.name = name;
    // On part du principe que l'aire de jeu est carrée : 100*100
    this.size = 100;
    // Génération d'une grille vide de taille size*size
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
    ];
    this.startedAt = Date.now();
    this.interval = null;
    // Permet d'utiliser la fonction endGame dans Server.js
    this.endGame = endGame;
  }

  start(updateAllPlayerMovements, game) {
    if (this.interval) {
      // On empêche le lancement d'une autre intervalle si une déjà existante
      return;
    }
    // On change le statut de la partie en "game" pour désactiver la réapparition des joueurs
    this.status = "game";
    // Lancer un intervalle de updateAllPlayerMovements
    this.interval = setInterval(() => {
      this.update();
      updateAllPlayerMovements(game);
    }, 1000);
  }

  stop() {
    // Fin de partie, on stoppe l'intervalle
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  update() {
    for (const player of this.players) {
      // On ne met pas à jour si le joueur est mort
      if (!player.alive) continue;

      // Faire avancer le joueur
      player.move();

      // Vérifier s'il y a une collision après avoir déplacé le joueur
      if (this.checkCollision(player)) {
        player.alive = false;
      }

      if (player.alive) {
        // Marquer la case comme occupée
        this.grid[player.x][player.y] = player.id;
      }
    }

    // On fait la vérification à chaque intervalle et pas au moment où un joueur meurt
    // pour gérer les cas où des joueurs meurent en même temps
    if (this.getAliveCount() <= 1) {
      let winner = this.getWinner();
      this.endGame(this, winner.id);
      return;
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

    // Renvoie l'unique vainqueur
    // sinon renvoie "no_winner" quand 0 winner ou + d'1 winner
    return winners.length === 1 ? winners[0] : "no_winner";
  }

  checkCollision(player) {
    // Vérifier une collision hors-grille
    if (
      player.x < 0 ||
      player.x >= this.size ||
      player.y < 0 ||
      player.y >= this.size
    ) {
      return true;
    }
    // Vérifier une collision avec un autre joueur
    if (this.grid[player.x][player.y] != null) {
      return true;
    }

    return false;
  }
}

module.exports = Game;
