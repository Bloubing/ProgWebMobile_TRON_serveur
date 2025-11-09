const mongoose = require("mongoose");

async function connectMongo() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/mongo-data");
  } catch (err) {
    console.log("Erreur connexion Mongo DB : " + err);
  }
}

module.exports = connectMongo;
