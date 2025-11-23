const mongoose = require("mongoose");
const Player = require("../Player");

// Schéma et modèle de Player en BDD

const gameSchema = new mongoose.Schema({
  generatedGameId: String, // L'id générée lors de la création du jeu != id stockée dans la base
  players: [
    {
      id: String,
      x: Number,
      y: Number,
      ready: Boolean,
      alive: Boolean,
      currentDirection: String,
      color: String, // M : ajout couleur du joueur
    },
  ], // Tableau des players
  winnerID: Number,
  startedAt: Date,
  endedAt: Date,
});

const gameModel = mongoose.model("GameModel", gameSchema);

module.exports = gameModel;
