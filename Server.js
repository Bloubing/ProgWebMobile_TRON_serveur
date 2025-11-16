// ======== Script serveur Node.js WebSocket ==========
const http = require("http");
const WebSocketServer = require("websocket").server;

const server = http.createServer();
server.listen(9898);

const wsServer = new WebSocketServer({
  httpServer: server,
});

// Hash mot de passe
const bcrypt = require("bcrypt");

// Connexion à la base de données Mongo
const connectMongo = require("./db");
connectMongo();

// Import des modèles Mongoose Player et Game
const gameModel = require("./models/GameModel");
const playerModel = require("./models/PlayerModel");

// Import des classes Game et Player
const Game = require("./Game");
const Player = require("./Player");

// Liste des games en cours : associe gameId (clé) et game (valeur)
const games = new Map();
// Liste des connexions en cours : associe playerId (clé) et connexion (valeur)
const connections = new Map();

wsServer.on("request", function (request) {
  const connection = request.accept(null, request.origin);

  connection.on("message", function (message) {
    let data = JSON.parse(message.utf8Data);
    console.log(data);
    switch (data.type) {
      case "connectionPlayer":
        // Un joueur tente de se connecter/ s'inscrire
        handleConnectionPlayer(connection, data);
        break;
      case "createGame":
        // Un joueur crée un nouveau lobby
        // Un lobby === une game, seul le statut change
        handleCreateGame(connection, data);
        break;
      case "joinGame":
        // Un joueur clique sur rejoindre un lobby
        handleJoinGame(connection, data);
        break;
      case "playerReady":
        // Un joueur clique sur Ready dans le lobby
        handlePlayerReady(connection, data);
        break;
      case "playerMovement":
        // Partie en cours, le joueur clique sur une des flèches de déplacements
        handlePlayerMovement(connection, data);
        break;
    }
  });

  connection.on("close", function (reasonCode, description) {
    // Le joueur s'est déconnecté
    handleDisconnection(connection);
  });
});

async function handleConnectionPlayer(connection, data) {
  try {
    let player = await playerModel.findOne({ username: data.username });

    // Joueur existe mais mot de passe incorrect
    if (player && !(await bcrypt.compare(data.password, player.password))) {
      sendConnection(connection, {
        type: "connectionResponse",
        playerId: player._id,
        valid: false,
        reason: "Invalid password",
      });
      return;
    }

    // Joueur n'existe pas encore, le créer dans la base
    if (!player) {
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(data.password, salt);

      // create fait un save()
      player = await playerModel.create({
        username: data.username,
        password: hashedPassword,
        wins: 0,
        losses: 0,
      });
    }

    // On stocke la nouvelle connexion dans la liste de connexions
    connections.set(player._id.toString(), connection);

    // On renvoie une réponse valide si MDP correct ou création d'un nouveau joueur
    sendConnection(connection, {
      type: "connectionResponse",
      playerId: player._id,
      valid: true,
    });
  } catch (err) {
    console.log("Erreur dans handleConnection : " + err);
  }
}

function handleCreateGame(connection, data) {
  // Vérifier données valides
  if (
    !data.creatorId ||
    !data.gameName ||
    !data.maxPlayers ||
    data.maxPlayers < 2 ||
    data.maxPlayers > 4
  ) {
    sendConnection(connection, {
      type: "createGameResponse",
      valid: false,
      reason: "Missing or invalid data",
    });
    return;
  }

  // Le serveur crée un objet Game qui contient liste des joueurs
  // Ajoute par défaut le joueur créateur à la liste des joueurs
  const game = new Game(data.creatorId, data.gameName, data.maxPlayers);

  // On ajoute la game à la liste des games en cours
  games.set(game.id, game);

  sendConnection(connection, {
    type: "createGameResponse",
    gameId: game.id,
    valid: true,
  });
}

async function handleJoinGame(connection, data) {
  // Erreur : la game demandée n'existe pas
  if (!games.has(data.gameId)) {
    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Lobby/game doesn't exist",
    });
    return;
  }

  let game = games.get(data.gameId);

  // Vérifier si le playerId de la requête existe dans la BDD
  let player = await playerModel.findOne({ _id: data.playerId });

  if (!player) {
    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Player not found in database",
    });
    return;
  }

  if (game.checkPlayerInGame(data.playerId)) {
    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Player already in game",
    });
    return;
  }
  // Le serveur vérifie si le nombre de connexions < au nombre de joueurs max
  // défini de la game courante
  if (game.players.length >= game.maxPlayers) {
    // Serveur renvoie erreur au client

    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Lobby/game is full",
    });
    return;
  }

  // Si oui, le serveur ajoute la connexion à la game demandée et le serveur informe
  // tous les clients de l'arrivée du nouveau joueur
  let newPlayerInGame;
  if (game.players.length > 1) {
    newPlayerInGame = new Player(data.playerId, 90, 20);
  } else {
    newPlayerInGame = new Player(data.playerId, 10, 20);
  }
  game.players.push(newPlayerInGame);

  console.log(`Le joueur ${data.playerId} a rejoint la partie ${data.gameId}`);

  // broadcast informant de l'arrivée du nouveau joueur
  sendBroadcast(game, {
    type: "joinGameResponse",
    newPlayerId: data.playerId,
    newPlayerUsername: player.username,
    gameId: data.gameId,
    valid: true,
  });
}

function handlePlayerReady(connection, data) {
  // On vérifie si données valides
  if (!data.playerId || !data.gameId) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Missing data",
    });
    return;
  }

  let game = games.get(data.gameId);

  if (!game || !game.checkPlayerInGame(data.playerId)) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Player not found in game",
    });
    return;
  }
  let player = game.getPlayer(data.playerId);
  // Si le joueur était déjà prêt, pas besoin de renvoyer un paquet de confirmation
  if (player.ready) {
    return;
  }
  // Mettre à jour statut "ready" du joueur à true dans la game
  player.ready = true;

  // Le serveur confirme au client que le statut ready a bien été changé
  sendConnection(connection, {
    type: "playerReadyResponse",
    playerId: data.playerId,
    gameId: data.gameId,
    valid: true,
  });

  if (game.checkAllPlayersReady()) {
    startCountdown(game);
  }
}

function startCountdown(game) {
  let count = 3;
  let timeCountMs = 1000;
  // Countdown jusqu'à 3 en broadcast

  const countInterval = setInterval(() => {
    sendBroadcast(game, {
      type: "countdown",
      gameId: game.id,
      value: count,
    });
    count -= 1;
    if (count < 0) {
      clearInterval(countInterval);
      // Si oui, le serveur envoie à tous les clients un JSON qui les informe que la partie commence
      // Cela déclenche la fonction startGame()
      game.players.forEach((player) => {
        const connection = connections.get(player.id);

        // On vérifie si joueur toujours co et on envoie si oui
        if (connection) {
          sendConnection(connection, {
            type: "gameStart",
            gameId: game.id,
          });
        }
      });

      // Démarrage de la game
      game.start(updateAllPlayerMovements, game);
    }
  }, timeCountMs);
}

async function handlePlayerMovement(connection, data) {
  // On récupère la game et le joueur
  try {
    let game = games.get(data.gameId);

    if (!game || !game.checkPlayerInGame(data.playerId)) {
      // Serveur renvoie erreur si données invalides
      sendConnection(connection, {
        type: "playerMovementResponse",
        playerId: data.playerId,
        gameId: data.gameId,
        valid: false,
        reason: "Player, game or player in game not found",
      });

      return;
    }

    let player = game.getPlayer(data.playerId);

    // update position dans la game selon direction
    player.moveDirection(data.direction);

    // check collision
    if (game.checkCollision(player)) {
      // il y a eu une collision avec player
      // player de la connexion actuelle est mort, on met à jour son état alive dans la game
      player.alive = false;

      // check combien de joueurs vivants
      if (game.getAliveCount() <= 1) {
        let winner = game.getWinner();
        if (winner) {
          endGame(game, winner.id);
        } else {
          // Pas de gagnant, égalité
          // TODO A revoir, mettre un tableau des derniers joueurs restants avant fin du jeu
          endGame(game, -1);
        }
      }
    } else {
      // On update la case
      // On la remplit par l'id du joueur pour identifier par quel joueur chaque case est occupée
      game.grid[player.x][player.y] = player.id;
    }
  } catch (err) {
    console.log(err);
  }
}

function handleDisconnection(connection) {
  let disconnectedPlayerId = null;

  for (const [playerId, conn] of connections.entries()) {
    if (conn === connection) {
      disconnectedPlayerId = playerId;
      connections.delete(playerId);
      break;
    }
  }

  if (!disconnectedPlayerId) {
    return;
  }

  // Si le joueur est dans une partie
  for (const game of games) {
    if (game.checkPlayerInGame(disconnectedPlayerId)) {
      // Sinon si le joueur est dans une partie avec le statut "lobby",  retirer le joueur de la liste des joueurs
      if (game.status === "lobby") {
        game.players = game.players.filter(
          (player) => player.id !== disconnectedPlayerId
        );
      } else {
        // Sinon si le joueur est dans une partie avec le statut "game", le serveur change son état à "mort"
        let playerInGame = game.getPlayer(disconnectedPlayerId);
        playerInGame.alive = false;
      }

      // broadcast aux autres joueurs
      sendBroadcast(game, {
        type: "playerDisconnected",
        playerId: disconnectedPlayerId,
        gameId: game.id,
      });
    }
  }
}

function updateAllPlayerMovements(game) {
  // broadcast pour envoyer état du jeu à chaque client
  game.players.forEach((player) => {
    let connection = connections.get(player.id);

    // On vérifie si joueur toujours co et on envoie si oui
    if (connection) {
      sendConnection(connection, {
        type: "updateAllPlayerMovements",
        gameId: game.id,
        players: game.players,
      });
    }
  });
}

async function endGame(game, winnerId) {
  // Stocke la game courante et l'id du gagnant en base de données
  await gameModel.create({
    generatedGameId: game.id,
    players: game.players,
    winnerId: winnerId,
    startedAt: game.startedAt,
    endedAt: Date.now(),
  });

  // On stoppe le jeu
  game.stop();

  // broadcast fin de partie
  for (const player of game.players) {
    // Mettre à jour le nombre de victoires de chaque joueur de la partie

    // +1 victoire si player == winner, sinon +1 défaite
    await playerModel.updateOne(
      { _id: player.id },
      winnerId === player.id ? { $inc: { wins: 1 } } : { $inc: { losses: 1 } }
    );

    let connection = connections.get(player.id);

    // On vérifie si joueur toujours co et on envoie si oui
    if (connection) {
      sendConnection(connection, {
        type: "endGame",
        winnerId: winnerId,
        valid: true,
      });
    }
  }

  // Enlever la game de la liste game en cours
  games.delete(game.id);
}

// Fonctions utilitaires
function sendConnection(connection, data) {
  connection.send(JSON.stringify(data));
}

function sendBroadcast(game, data) {
  game.players.forEach((player) => {
    let connection = connections.get(player.id);
    // On vérifie si joueur toujours co et on envoie si oui

    if (connection) {
      sendConnection(connection, data);
    }
  });
}
