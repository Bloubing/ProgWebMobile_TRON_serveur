const mongoose = require("mongoose");

// Schéma et modèle de Player en BDD

const gameSchema = new mongoose.Schema({
  generatedGameId: Number, // L'id générée lors de la création du jeu != id stockée dans la base
  players: [Number], // Tableau des playerIDs
  winnerID: Number,
  startedAt: Date,
  endedAt: Date,
});

const gameModel = mongoose.model("GameModel", gameSchema);

module.exports = gameModel;
