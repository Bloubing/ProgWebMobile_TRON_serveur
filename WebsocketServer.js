// Mise en place de Websocket
const http = require("http");
const WebSocketServer = require("websocket").server;

const server = http.createServer();
server.listen(9898);

const wsServer = new WebSocketServer({
  httpServer: server,
});

// Import du fichier qui gère les parties
const gameHandler = require("./GameHandler");

wsServer.on("request", function (request) {
  const connection = request.accept(null, request.origin);

  connection.on("message", function (message) {
    let data = JSON.parse(message.utf8Data);

    // console.log(data);

    switch (data.type) {
      case "connectionPlayer":
        // Un joueur tente de se connecter / s'inscrire
        gameHandler.handleConnectionPlayer(connection, data);
        break;
      case "getLeaderboard":
        gameHandler.handleGetLeaderboard(connection);
        break;
      case "getAllLobbies":
        // Un joueur met à jour les lobbies existants actuellement
        gameHandler.handleGetAllLobbies(connection);
        break;
      case "createGame":
        // Un joueur crée un nouveau lobby
        // Un lobby === une game, seul le statut change
        gameHandler.handleCreateGame(connection, data);
        break;
      case "joinGame":
        // Un joueur clique sur rejoindre un lobby
        gameHandler.handleJoinGame(connection, data);
        break;
      case "leaveLobby":
        // Un joueur clique sur Quitter dans un lobby
        gameHandler.handleLeaveLobby(connection, data);
        break;
      case "changeColor":
        // Un joueur change de couleur
        gameHandler.handleChangeColor(connection, data);
        break;
      case "playerReady":
        // Un joueur clique sur Prêt dans un lobby
        gameHandler.handlePlayerReady(connection, data);
        break;
      case "playerMovement":
        // Partie en cours, un joueur clique sur une des flèches de déplacements
        gameHandler.handlePlayerMovement(connection, data);
        break;
      case "restartGame":
        // Un joueur clique sur Rejouer
        gameHandler.handleRestartGame(connection, data);
        break;
    }
  });

  connection.on("close", function (reasonCode, description) {
    // Un joueur s'est déconnecté
    gameHandler.handleDisconnection(connection);
  });
});
