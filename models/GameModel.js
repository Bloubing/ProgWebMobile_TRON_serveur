const mongoose = require("mongoose");

// Schéma et modèle de Player en BDD

const gameSchema = new mongoose.Schema({
  generatedGameId: String, // L'ID générée lors de la création du jeu != id stockée dans la base
  name: String,
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
  ], // Tableau des joueurs
  winnerID: Number,
  startedAt: Date,
  endedAt: Date,
});

const gameModel = mongoose.model("Game", gameSchema);

module.exports = gameModel;
