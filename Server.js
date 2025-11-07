// Node.js WebSocket server script
const http = require("http");
const WebSocketServer = require("websocket").server;

//  ======= Partie BDD ========
const mongoose = require("mongoose");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mongo-data");
}

// Schémas et modèles
const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
  },
  password: String,
  wins: Number,
  losses: Number,
});

const playerModel = mongoose.model("Player", playerSchema);

const gameSchema = new mongoose.Schema({
  players: [Number], // Tableau des playerIDs
  winnerID: Number,
  startedAt: Date,
  endedAt: Date,
});

//  ======= Fin Partie BDD ========

// ======= Définition de Game ========

class Game {
  constructor(creatorId, name, maxPlayers) {
    // Id unique pour la game
    this.id = crypto.randomUUID();
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.status = "lobby";
    this.players = [{ id: creatorId, ready: false }];
  }
}

// ======= Fin Définition de Game ========

// Liste des games en cours
const games = [];
const connections = [];

const server = http.createServer();
server.listen(9898);
const wsServer = new WebSocketServer({
  httpServer: server,
});

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

// TODO refactoriser code
// TODO stocker connexion et infos joueurs si le joueur se connecte avec succès
function handleConnectionPlayer(connection, data) {
  playerModel
    .findOne({ username: data.username })
    .then(async (player) => {
      let connectionResponse;

      // Le joueur existe déjà dans la BDD
      if (player) {
        if (player.password !== data.password) {
          // MDP incorrect
          connectionResponse = JSON.stringify({
            type: "connectionResponse",
            playerId: player._id,
            valid: false,
          });
          connection.send(connectionResponse);
        } else {
          // MDP correct
          connectionResponse = JSON.stringify({
            type: "connectionResponse",
            playerId: player._id,
            valid: true,
          });
          connection.send(connectionResponse);
        }
      } else {
        const newPlayer = new playerModel({
          username: data.username,
          password: data.password,
          wins: 0,
          losses: 0,
        });
        // Insérer nouveau player dans bdd
        newPlayer.save();

        connectionResponse = JSON.stringify({
          type: "connectionResponse",
          playerId: player._id,
          valid: true,
        });
        connection.send(connectionResponse);
      }
    })
    .catch((err) => console.log(err));
}

function handleCreateGame(connection, data) {
  // Le serveur crée un objet Game qui contient liste des joueurs
  // => donc le créateur
}

function handleJoinGame(connection, data) {
  // Le serveur vérifie si le nombre de connexions < au nombre de joueurs max
  // défini de la game courante
  // Si oui, le serveur ajoute la connexion à la game demandée et le serveur informe
  // tous les clients de l'arrivée du nouveau joueur
  // Si non, le serveur envoie un JSON qui dit qu'il est impossible de rejoindre
}

function handlePlayerReady(connection, data) {
  // Le serveur met à jour l'état du joueur qui a mis Ready dans la game qu'il a rejoint
  // Le serveur vérifie si tous les joueurs de la game sont ready
  // Si oui, le serveur envoie à tous les clients un JSON qui les informe que la partie commence
  // Cela déclenche la fonction startGame()
}

function handlePlayerMovement(connection, data) {}

function startGame(gameId) {
  // Change le statut de la game en "game" pour désactiver la réapparition des joueurs
  // Lancer un intervalle de updateAllPlayerMovements
}

function updateAllPlayerMovements() {}

function endGame(gameId) {
  // Stocke la game courante et l'id du gagnant en base de données
}
