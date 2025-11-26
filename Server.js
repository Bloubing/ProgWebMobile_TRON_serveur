// ======== Script serveur Node.js WebSocket ==========
const http = require("http");
const WebSocketServer = require("websocket").server;

const server = http.createServer();
server.listen(9898);

const wsServer = new WebSocketServer({
  httpServer: server,
});

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
var games = new Map();

// Liste des connexions en cours : associe playerId (clé) et connexion (valeur)
var connections = new Map();

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
      case "getAllLobbies":
        handleGetAllLobbies(connection);
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

    // Le joueur existe mais mot de passe incorrect
    if (player && data.password !== player.password) {
      sendConnection(connection, {
        type: "connectionResponse",
        playerId: player._id,
        valid: false,
        reason: "Mot de passe invalide",
      });
      return;
    }

    // Joueur n'existe pas encore, le créer dans la base
    if (!player) {
      // create() fait un save()
      player = await playerModel.create({
        username: data.username,
        password: data.password,
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
  // On vérifie si données valides
  if (
    !data.creatorId ||
    !data.gameName ||
    !data.maxPlayers ||
    Number(data.maxPlayers) < 2 ||
    Number(data.maxPlayers) > 4
  ) {
    sendConnection(connection, {
      type: "createGameResponse",
      valid: false,
      reason: "Données manquantes ou invalides",
    });
    return;
  }

  // Le serveur crée un objet Game qui contient liste des joueurs
  // Ajoute par défaut le joueur créateur à la liste des joueurs
  const game = new Game(
    data.creatorId,
    data.gameName,
    Number(data.maxPlayers),
    endGame,
    data.color // M : ajout param creatorColor
  );

  // On ajoute la partie à la liste des parties en cours
  games.set(game.id, game);

  // Broadcast pour informer tous les joueurs
  // (dont ceux qui ne sont pas dans une partie,
  // c'est pourquoi on utilise pas sendBroadcast qui est lié à une partie)
  // de la création d'une nouvelle partie
  // Pour que les clients n'aient pas à rafraîchir leur page pour voir la nouvelle partie
  for (const conn of connections.values()) {
    sendConnection(conn, {
      type: "createGameResponse",
      gameId: game.id,
      creatorId: data.creatorId,
      valid: true,
    });
  }
}

function handleGetAllLobbies(connection) {
  gamesArray = [];

  for (const game of games.values()) {
    gameItem = {
      gameId: game.id,
      gameName: game.name,
      maxPlayers: game.maxPlayers,
      currentPlayers: game.players.length,
    };

    gamesArray.push(gameItem);
  }

  sendConnection(connection, {
    type: "getAllLobbiesResponse",
    lobbies: gamesArray,
  });
  return;
}

async function handleJoinGame(connection, data) {
  // Erreur : la game demandée n'existe pas
  if (!games.has(data.gameId)) {
    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Le lobby ou la partie n'existe pas",
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
      reason: "Le joueur n'existe pas dans la base de données",
    });
    return;
  }

  if (game.checkPlayerInGame(data.playerId)) {
    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur est déjà dans la partie",
    });
    return;
  }
  // Le serveur vérifie que le nombre de connexions est inférieur au nombre de joueurs max
  // défini dans la partie courante
  if (game.players.length >= game.maxPlayers) {
    // Le serveur renvoie une erreur au client

    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Le lobby ou la partie est plein(e)",
    });
    return;
  }

  // Le serveur vérifie que la partie n'a pas encore commencée
  if (game.status != "lobby") {
    sendConnection(connection, {
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "La partie a déjà commencé",
    });
    return;
  }

  // Si oui, le serveur ajoute la connexion à la partie demandée et le serveur informe
  // tous les clients de l'arrivée du nouveau joueur
  let newPlayerInGame;
  if (game.players.length === 1) {
    // 2e joueur apparaît à droite
    newPlayerInGame = new Player(
      data.playerId,
      game.size - 1,
      Math.floor(game.size / 2),
      "left",
      data.color
    );
  } else if (game.players.length === 2) {
    // 3e joueur apparaît en bas
    newPlayerInGame = new Player(
      data.playerId,
      Math.floor(game.size / 2),
      game.size - 1,
      "up",
      data.color
    );
  } else if (game.players.length === 3) {
    // 4e joueur apparaît en haut
    newPlayerInGame = new Player(
      data.playerId,
      Math.floor(game.size / 2),
      0,
      "down",
      data.color
    );
  }
  game.players.push(newPlayerInGame);

  console.log(`Le joueur ${data.playerId} a rejoint la partie ${data.gameId}`);

  for (const conn of connections.values()) {
    sendConnection(conn, {
      type: "updateLobbyInfos",
      gameId: game.id,
    });
  }

  // Broadcast informant de l'arrivée du nouveau joueur
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
  if (!data.playerId) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "L'ID du joueur n'existe pas",
    });
    return;
  }

  if (!data.gameId) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "L'ID de la partie n'existe pas",
    });
    return;
  }

  let game = games.get(data.gameId);

  if (!game) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "La partie n'existe pas",
    });
    return;
  }

  if (!game.checkPlayerInGame(data.playerId)) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });
    return;
  }
  let player = game.getPlayer(data.playerId);
  // Si le joueur était déjà prêt : pas besoin de renvoyer un paquet de confirmation
  if (player.ready) {
    return;
  }
  // Mise à jour du statut "ready" du joueur à true dans la partie
  player.ready = true;

  // Le serveur confirme au client que le statut "ready" a bien été changé
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
  // Compte à rebours jusqu'à 3 en broadcast avant le début de la partie
  let count = 3;
  let timeCountMs = 1000;

  const countInterval = setInterval(() => {
    sendBroadcast(game, {
      type: "countdown",
      gameId: game.id,
      count: count,
    });
    count -= 1;
    if (count < 0) {
      clearInterval(countInterval);

      // Si oui, le serveur envoie à tous les clients un JSON qui les informe que la partie commence
      sendBroadcast(game, {
        type: "gameStart",
        gameId: game.id,
      });

      // Démarrage de la partie
      game.start(updateAllPlayerMovements, game);
    }
  }, timeCountMs);
}

function updateAllPlayerMovements(game) {
  // Broadcast pour envoyer état du jeu à chaque client
  sendBroadcast(game, {
    type: "updateAllPlayerMovements",
    gameId: game.id,
    players: game.players,
  });
}

async function handlePlayerMovement(connection, data) {
  // On récupère la partie et le joueur

  let game = games.get(data.gameId);

  if (!game) {
    // Le serveur renvoie une erreur si données invalides
    sendConnection(connection, {
      type: "playerMovementResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "La partie n'existe pas",
    });

    return;
  }

  if (!game.checkPlayerInGame(data.playerId)) {
    // Le serveur renvoie une erreur si données invalides
    sendConnection(connection, {
      type: "playerMovementResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });

    return;
  }

  let player = game.getPlayer(data.playerId);

  // Mise à jour de la position dans le jeu selon la direction
  player.setDirection(data.direction);
}

function handleDisconnection(connection) {
  let disconnectedPlayerId = null;

  // On récupère l'ID du joueur déconnecté
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

  for (const game of games.values()) {
    // Si le joueur est dans une partie
    if (game.checkPlayerInGame(disconnectedPlayerId)) {
      if (game.status === "lobby") {
        // Le joueur est dans une partie avec le statut "lobby",
        // on retire le joueur de la liste des joueurs
        game.players = game.players.filter(
          (player) => player.id !== disconnectedPlayerId
        );

        // Si le lobby est maintenant vide, on supprime le lobby
        if (game.players.length === 0) {
          games.delete(game.id);
        }

        // Broadcast pour tous les joueurs dont ceux pas dans une partie, pour mettre à jour le nombre de joueurs présents OU enlever le lobby qui est vide
        for (const conn of connections.values()) {
          sendConnection(conn, {
            type: "updateLobbyInfos",
            gameId: game.id,
          });
        }
      } else {
        // Le joueur est dans une partie avec le statut "game",
        // on change son état à "mort"
        let playerInGame = game.getPlayer(disconnectedPlayerId);
        playerInGame.alive = false;

        if (game.getAliveCount() === 1) {
          let winner = game.getWinner();
          endGame(game, winner.id);
        }
      }

      sendBroadcast(game, {
        type: "playerDisconnected",
        playerId: disconnectedPlayerId,
        gameId: game.id,
      });
      return;
    }
  }
}

async function endGame(game, winnerId) {
  // On stocke la partie courante et l'ID du gagnant en base de données
  await gameModel.create({
    generatedGameId: game.id,
    players: game.players,
    winnerId: winnerId,
    startedAt: game.startedAt,
    endedAt: Date.now(),
  });

  game.stop();

  for (const player of game.players) {
    // MàJ du nombre de victoires de chaque joueur de la partie

    // +1 victoire si le joueur === gagnant, sinon +1 défaite
    await playerModel.updateOne(
      { _id: player.id },
      winnerId === player.id ? { $inc: { wins: 1 } } : { $inc: { losses: 1 } }
    );

    // Broadcast de fin de partie
    let connection = connections.get(player.id);

    if (connection) {
      sendConnection(connection, {
        type: "endGame",
        winnerId: winnerId,
        valid: true,
      });
    }
  }

  // On enlève la partie de la liste des parties en cours
  games.delete(game.id);
}

// Fonctions utilitaires

function sendConnection(connection, data) {
  connection.send(JSON.stringify(data));
}

function sendBroadcast(game, data) {
  game.players.forEach((player) => {
    let connection = connections.get(player.id);

    // On vérifie si le joueur est toujours connecté
    //  et on envoie le paquet si oui
    if (connection) {
      sendConnection(connection, data);
    }
  });
}
