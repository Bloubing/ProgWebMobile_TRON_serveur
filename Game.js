const crypto = require("crypto");
const Player = require("./Player");

class Game {
  constructor(creatorName, name, maxPlayers) {
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
    let creator = new Player(
      creatorName,
      0,
      Math.floor(this.size / 2),
      "right"
    );
    creator.setColor("#00ffff");

    this.players = [creator];
    this.usedColors = { creatorName: creator.color };
    this.startedAt = Date.now();
    this.interval = null;
  }

  start(updateAllPlayerMovements, endGame, game) {
    if (this.interval) {
      // On empêche le lancement d'une autre intervalle si une déjà existante
      return;
    }
    // On change le statut de la partie en "game" pour désactiver la réapparition des joueurs
    this.status = "game";
    // Lancer un intervalle de updateAllPlayerMovements
    this.interval = setInterval(() => {
      this.update(endGame);
      updateAllPlayerMovements(game);
    }, 100);
  }

  stop() {
    // Fin de partie, on stoppe l'intervalle
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.status = "gameEnded";

    // On nettoie la grille de jeu
    this.grid = Array.from({ length: this.size }, () =>
      Array(this.size).fill(null)
    );
  }

  update(endGame) {
    for (const player of this.players) {
      // On ne met pas à jour si le joueur est mort
      if (!player.alive) continue;

      // Vérifier s'il y aura une collision au prochain déplacement
      if (this.checkCollision(player.getNextPosition())) {
        player.alive = false;
      }

      if (player.alive) {
        // On déplace le joueur réellement
        player.move();
        // Marquer la case comme occupée
        this.grid[player.x][player.y] = player.username;
      }
    }

    // On fait la vérification à chaque intervalle et pas au moment où un joueur meurt
    // pour gérer les cas où des joueurs meurent en même temps
    if (this.getAliveCount() <= 1) {
      let winner = this.getWinner();
      endGame(this, winner.username);
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

  checkPlayerInGame(playerName) {
    return this.players.some((player) => player.username === playerName);
  }

  getPlayer(playerName) {
    return this.players.find((player) => player.username === playerName);
  }

  setPlayerColor(username, color) {
    let player = this.getPlayer(username);
    if (!player) {
      return false;
    }
    // On vérifie si la couleur a déjà été prise par un autre joueur
    if (
      this.players.some(
        (player) => player.color === color && player.username !== username
      )
    ) {
      return false;
    }

    // La couleur est disponible, on l'attribue au joueur
    player.setColor(color);
    return true;
  }

  isColorTaken(username) {
    return this.usedColors[username] !== null;
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

  checkCollision(nextPlayerPosition) {
    // Vérifier une collision hors-grille
    if (
      nextPlayerPosition.x < 0 ||
      nextPlayerPosition.x >= this.size ||
      nextPlayerPosition.y < 0 ||
      nextPlayerPosition.y >= this.size
    ) {
      return true;
    }
    // Vérifier une collision avec un autre joueur
    if (this.grid[nextPlayerPosition.x][nextPlayerPosition.y] != null) {
      return true;
    }

    return false;
  }
}

module.exports = Game;
