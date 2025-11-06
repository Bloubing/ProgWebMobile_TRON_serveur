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

export const playerModel = mongoose.model("Player", playerSchema);

const gameSchema = new mongoose.Schema({
  players: [Number], // Tableau des playerIDs
  winnerID: Number,
  startedAt: Date,
  endedAt: Date,
});
