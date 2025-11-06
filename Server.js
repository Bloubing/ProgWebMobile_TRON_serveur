// Node.js WebSocket server script
const http = require("http");
const WebSocketServer = require("websocket").server;

const mongoose = require("mongoose");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mongo-data");
}

// Schémas et modèles
const playerSchema = new mongoose.Schema({
  username: String,
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

const server = http.createServer();
server.listen(9898);
const wsServer = new WebSocketServer({
  httpServer: server,
});

wsServer.on("request", function (request) {
  const connection = request.accept(null, request.origin);

  connection.on("message", function (message) {
    //console.log("Received Message:", message.utf8Data);

    let data = JSON.parse(message.utf8Data);
    console.log(data);
    switch (data.type) {
      case "connectionPlayer":
        console.log("entré connectionPlayer");
        const player = playerModel.findOne({ username: data.username });
        console.log(player.password);

        // user existe et mdp correct
        if (player.username && playerModel.password === data.password) {
          console.log(" player existe et mdp correct");

          // user existe et mdp incorrect
        } else if (player.username && playerModel.password !== data.password) {
          console.log("player et mdp incorrect");
          connection.send({ type: "connectionResponse", valid: false });
        } else {
          // user n'existe pas, le créer
          console.log("entré dans new player");
          const newPlayer = new playerModel({
            username: data.username,
            password: data.password,
            wins: 0,
            losses: 0,
          });

          // Insérer nouveau player dans bdd
          newPlayer.save();
        }

        break;
    }
  });
  connection.on("close", function (reasonCode, description) {
    console.log("Client has disconnected.");
  });
});
