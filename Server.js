const crypto = require("crypto");

// ======== Déf Script serveur Node.js WebSocket ==========
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
    // Le serveur change son état à "mort"
    console.log("Client has disconnected.");
  });
});

async function handleConnectionPlayer(connection, data) {
  try {
    let player = await playerModel.findOne({ username: data.username });
    let connectionResponse;

    // Joueur existe mais mot de passe incorrect
    if (player && player.password !== data.password) {
      connectionResponse = JSON.stringify({
        type: "connectionResponse",
        playerId: player._id,
        valid: false,
      });
      connection.send(connectionResponse);
      return;
    }

    // Joueur n'existe pas encore, le créer dans la base
    if (!player) {
      // create fait un save()
      player = await playerModel.create({
        username: data.username,
        password: data.password,
        wins: 0,
        losses: 0,
      });
    }

    // On stocke la nouvelle connexion
    connections.set(player._id, connection);

    // On renvoie une réponse valide si MDP correct ou création d'un nouveau joueur
    connectionResponse = JSON.stringify({
      type: "connectionResponse",
      playerId: player._id,
      valid: true,
    });
    connection.send(connectionResponse);
  } catch (err) {
    console.log(err);
  }
}

function handleCreateGame(connection, data) {
  let connectionResponse;

  // Vérifier données valides
  if (
    !data.creatorId ||
    !data.gameName ||
    !data.maxPlayers ||
    data.maxPlayers < 2 ||
    data.maxPlayers > 4
  ) {
    connectionResponse = JSON.stringify({
      type: "createGameResponse",
      valid: false,
    });

    connection.send(connectionResponse);
    return;
  }

  // Le serveur crée un objet Game qui contient liste des joueurs
  const game = new Game(data.creatorId, data.gameName, data.maxPlayers);

  // On ajoute la game à la liste des games en cours
  games.set(game.id, game);

  connectionResponse = JSON.stringify({
    type: "createGameResponse",
    gameId: game.id,
    valid: true,
  });

  connection.send(connectionResponse);
}

async function handleJoinGame(connection, data) {
  let connectionResponse;
  // Erreur : la game demandée n'existe pas
  if (!games.has(data.gameId)) {
    connectionResponse = JSON.stringify({
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Lobby/game doesn't exist",
    });

    connection.send(connectionResponse);
    return;
  }

  let game = games.get(data.gameId);

  // vérifier si le playerId de la requête existe dans la BDD
  let player = await playerModel.findOne({ _id: data.playerId });

  if (!player) {
    connectionResponse = JSON.stringify({
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Player not found in database",
    });

    connection.send(connectionResponse);
    return;
  }
  // Le serveur vérifie si le nombre de connexions < au nombre de joueurs max
  // défini de la game courante
  if (game.players.length >= game.maxPlayers) {
    // Serveur renvoie erreur au client
    connectionResponse = JSON.stringify({
      type: "joinGameResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Lobby/game is full",
    });

    connection.send(connectionResponse);
    return;
  }

  // Si oui, le serveur ajoute la connexion à la game demandée et le serveur informe
  // tous les clients de l'arrivée du nouveau joueur
  let newPlayerInGame = new Player(data.playerId, 0, 0);
  game.players.push(newPlayerInGame);

  // broadcast informant de l'arrivée du nouveau joueur
  game.players.forEach((player) => {
    let gameConnection = connections.get(player.id);

    // On vérifie si joueur toujours co et on envoie si oui
    if (gameConnection) {
      connectionResponse = JSON.stringify({
        type: "joinGameResponse",
        newPlayerId: data.playerId,
        newPlayerUsername: player.username,
        gameId: data.gameId,
        valid: true,
      });
      gameConnection.send(connectionResponse);
    }
  });

  // Si non, le serveur envoie un JSON qui dit qu'il est impossible de rejoindre
}

function handlePlayerReady(connection, data) {
  let connectionResponse;
  // On vérifie si données valides
  if (!data.playerId || !data.gameId) {
    connectionResponse = JSON.stringify({
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Missing data",
    });

    connection.send(connectionResponse);
    return;
  }

  let game = games.get(data.gameId);

  if (!game || !game.checkPlayerInGame(data.playerId)) {
    connectionResponse = JSON.stringify({
      type: "playerReadyResponse",
      playerId: data.playerId,
      gameId: data.gameId,
      valid: false,
      reason: "Player not found in game",
    });

    connection.send(connectionResponse);
    return;
  }

  // Mettre à jour statut "ready" du joueur à true dans la game
  game.setPlayerReady(data.playerId);

  if (game.checkAllPlayersReady()) {
    // Si oui, le serveur envoie à tous les clients un JSON qui les informe que la partie commence
    // Cela déclenche la fonction startGame()
    game.players.forEach((player) => {
      let connection = connections.get(player.id);

      // On vérifie si joueur toujours co et on envoie si oui
      if (connection) {
        connectionResponse = JSON.stringify({
          type: "gameStart",
          gameId: data.gameId,
        });
        connection.send(connectionResponse);
      }
    });

    game.start();
  }
}

function handlePlayerMovement(connection, data) {
  // on recup la game et le joueur
  // update position dans la game selon direction
  // garder en mémoire les cases
  // check collision
  // game.checkCollision(playerId)
  // renvoie au client s'il est mort
}

function updateAllPlayerMovements(game) {
  let connectionResponse;
  game.players.forEach((player) => {
    let connection = connections.get(player.id);

    connectionResponse = JSON.stringify({
      type: "updateAllPlayerMovements",
      gameId: game.id,
      valid: true,
    });
    // On vérifie si joueur toujours co et on envoie si oui
    if (connection) {
      connection.send(connectionResponse);
    }
  });
}

async function endGame(gameId, players, winnerId, startedAt) {
  let connectionResponse;
  // Stocke la game courante et l'id du gagnant en base de données
  await gameModel.create({
    generatedGameId: gameId,
    players: players,
    winnerId: winnerId,
    startedAt: startedAt,
    endedAt: Date.now(),
  });
  const game = games.get(gameId);
  // check si la partie est toujours en cours
  if (!game) {
    return;
  }
  // On stoppe le jeu
  game.stop();

  // broadcast fin de partie
  game.players.forEach((player) => {
    let connection = connections.get(player.id);

    // On vérifie si joueur toujours co et on envoie si oui
    if (connection) {
      connectionResponse = JSON.stringify({
        type: "endGame",
        winnerId: winnerId,
        valid: true,
      });
      connection.send(connectionResponse);
    }
  });

  // Enlever la game de la liste game en cours
  games.delete(gameId);
}
