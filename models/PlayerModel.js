const mongoose = require("mongoose");

// Schéma et modèle de Player en BDD
const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
  },
  password: String,
  wins: Number,
  losses: Number,
});

const playerModel = mongoose.model("PlayerModel", playerSchema);

module.exports = playerModel;
