const mongoose = require("mongoose");

// Schéma et modèle de Player en BDD

const gameSchema = new mongoose.Schema({
  // L'ID générée lors de la création du jeu != id stockée dans la base
  generatedGameId: String,
  name: String,
  players: [String],
  winnerName: String,
  startedAt: Date,
  endedAt: Date,
});

const gameModel = mongoose.model("Game", gameSchema);

module.exports = gameModel;
