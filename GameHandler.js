// Connexion à la base de données Mongo
const connectMongo = require("./db");
connectMongo();

// Import des modèles Mongoose Player et Game
const gameModel = require("./models/GameModel");
const playerModel = require("./models/PlayerModel");

// Import des classes Game et Player
const Game = require("./Game");
const Player = require("./Player");

// Liste des games en cours : associe gameId (clé) et game (valeur)
var games = new Map();

// Liste des connexions en cours : associe nom de joueur (clé) et connexion (valeur)
var connections = new Map();

// === Fonctions utilitaires ===

// Envoi à un joueur
function sendConnection(connection, data) {
  connection.send(JSON.stringify(data));
}

// Broadcast de partie
function sendPlayersInGame(game, data) {
  game.players.forEach((player) => {
    let connection = connections.get(player.username);

    // On vérifie si le joueur est toujours connecté
    //  et on envoie le paquet si oui
    if (connection) {
      sendConnection(connection, data);
    }
  });
}

// Broadcast général
function sendBroadcast(data) {
  for (const conn of connections.values()) {
    sendConnection(conn, data);
  }
}

// === Fonctions handlers ===

async function handleConnectionPlayer(connection, data) {
  try {
    // On accède aux informations en base de données du joueur s'étant déconnecté
    let player = await playerModel.findOne({ username: data.username });

    // Le joueur existe mais mot de passe incorrect
    if (player && data.password !== player.password) {
      sendConnection(connection, {
        type: "connectionResponse",
        username: player.username,
        valid: false,
        reason: "Mot de passe invalide",
      });
      return;
    }

    // Le joueur s'inscrit pour la 1ère fois, enregistrer ses informations dans la base de données
    if (!player) {
      // Ici, create() fait un save()
      player = await playerModel.create({
        username: data.username,
        password: data.password,
        wins: 0,
        losses: 0,
      });
    }

    // On stocke la nouvelle connexion dans la liste de connexions
    connections.set(player.username, connection);

    // On renvoie une réponse valide si MDP correct ou création d'un nouveau joueur
    sendConnection(connection, {
      type: "connectionResponse",
      username: player.username,
      valid: true,
    });
  } catch (err) {
    console.log("Erreur dans handleConnection : " + err);
  }
}

async function handleGetLeaderboard(connection) {
  // Tableau pour récupérer les stats des joueurs
  let playersArray = [];

  // On récupère en base les 5 joueurs avec le + de victoires
  let topFivePlayers = await playerModel
    .find({})
    .sort({ wins: "desc" })
    .limit(5);

  // On remplit le tableau des stats de joueurs
  for (const player of topFivePlayers) {
    let playerStats = {
      username: player.username,
      wins: player.wins,
      losses: player.losses,
    };

    playersArray.push(playerStats);
  }

  sendConnection(connection, {
    type: "getLeaderboardResponse",
    players: playersArray,
    valid: true,
  });
  return;
}

function handleGetAllLobbies(connection) {
  // Tableau pour ne récupérer que les infos nécéssaires sur les parties
  gamesArray = [];

  for (const game of games.values()) {
    // On n'affiche les parties si ce sont des parties non vides et non terminées
    if (game.players.length > 0 && game.status !== "gameEnded") {
      let gameItem = {
        gameId: game.id,
        gameName: game.name,
        maxPlayers: game.maxPlayers,
        currentPlayers: game.players.length,
      };

      gamesArray.push(gameItem);
    }
  }

  sendConnection(connection, {
    type: "getAllLobbiesResponse",
    lobbies: gamesArray,
  });
  return;
}

function handleCreateGame(connection, data) {
  // On vérifie si les données sont valides
  if (
    !data.creatorName ||
    !data.gameName ||
    !data.maxPlayers ||
    Number(data.maxPlayers) < 2 ||
    Number(data.maxPlayers) > 4
  ) {
    sendConnection(connection, {
      type: "createGameResponse",
      valid: false,
      reason: "Données manquantes ou invalides",
    });
    return false;
  }

  // Le serveur crée un objet Game qui contient la liste des joueurs
  const game = new Game(
    data.creatorName,
    data.gameName,
    Number(data.maxPlayers)
  );

  // On ajoute la partie à la liste des parties en cours
  games.set(game.id, game);

  let creator = game.getPlayer(data.creatorName);

  startCountdownBeforeKick(connection, game, creator);

  // Broadcast général pour informer les joueurs de la création d'un nouveau lobby
  // Les joueurs n'ont pas à rafraîchir leur page pour voir le nouveau lobby s'afficher
  sendBroadcast({
    type: "createGameResponse",
    gameId: game.id,
    creatorName: data.creatorName,
    valid: true,
  });

  // Envoyer au créateur les couleurs prises (la sienne pour l'instant)
  sendConnection(connection, {
    type: "updateColor",
    gameId: game.id,
    colorsTaken: game.players.map((p) => ({
      username: p.username,
      color: p.color,
    })),
  });

  return game.id;
}

async function handleJoinGame(connection, data) {
  if (!games.has(data.gameId)) {
    sendConnection(connection, {
      type: "joinGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le lobby n'existe pas",
    });
    return;
  }

  let game = games.get(data.gameId);

  // Vérifier si le nom du joueur de la requête existe dans la base
  let player = await playerModel.findOne({ username: data.username });

  if (!player) {
    sendConnection(connection, {
      type: "joinGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'existe pas dans la base de données",
    });
    return;
  }

  if (game.checkPlayerInGame(data.username)) {
    sendConnection(connection, {
      type: "joinGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur est déjà dans la partie",
    });
    return;
  }
  // Le serveur vérifie que le nombre de connexions est inférieur au nombre de joueurs maximum
  // défini dans la partie courante
  if (game.players.length >= game.maxPlayers) {
    sendConnection(connection, {
      type: "joinGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le lobby ou la partie est plein(e)",
    });
    return;
  }

  // Le serveur vérifie que la partie n'a pas encore commencé ou que ce n'est pas une ancienne partie
  if (game.status !== "lobby") {
    sendConnection(connection, {
      type: "joinGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "La partie a déjà commencé",
    });
    return;
  }

  // Si le joueur était dans une autre partie, on le retire de cette dernière
  for (const gameItem of games.values()) {
    if (gameItem.checkPlayerInGame(data.username)) {
      gameItem.players = gameItem.players.filter(
        (player) => player.username !== data.username
      );
    }
    // On supprime l'ancienne partie si plus aucun joueur
    if (game.players.length === 0) {
      games.delete(game.id);
    }
  }

  // Si pas d'erreur, le serveur ajoute la connexion à la partie demandée et le serveur informe
  // tous les clients de l'arrivée du nouveau joueur
  let newPlayerInGame;

  // Vérifier si la position créateur est libre car expulsé ou parti
  const creatorStillPresent = game.players.some(
    (p) => p.x === 0 && p.y === Math.floor(game.size / 2)
  );

  // Si le joueur créateur n'est plus là, on place le nouveau joueur rejoignant à sa place
  if (!creatorStillPresent) {
    // Le nouveau joueur devient le premier joueur
    newPlayerInGame = new Player(
      data.username,
      0,
      Math.floor(game.size / 2),
      "right"
    );
  } else if (game.players.length === 1) {
    // Le créateur est présent (et placé à la création d'une partie, cf. Game)

    // 2e joueur apparaît à droite
    newPlayerInGame = new Player(
      data.username,
      game.size - 1,
      Math.floor(game.size / 2),
      "left"
    );
  } else if (game.players.length === 2) {
    // Le créateur est présent et le 3e joueur apparaît en bas
    newPlayerInGame = new Player(
      data.username,
      Math.floor(game.size / 2),
      game.size - 1,
      "up"
    );
  } else if (game.players.length === 3) {
    // Le créateur est présent et le 4e joueur apparaît en haut
    newPlayerInGame = new Player(
      data.username,
      Math.floor(game.size / 2),
      0,
      "down"
    );
  }

  // Couleur déjà prise, choisir une couleur disponible automatiquement
  const availableColors = ["#00ffff", "#ff00ff", "#00ff00", "#ffff00"];
  const takenColors = game.players.map((p) => p.color).filter(Boolean);
  const freeColor = availableColors.find((c) => !takenColors.includes(c));

  if (!freeColor) {
    sendConnection(connection, {
      type: "joinGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Aucune couleur n'est disponible",
    });
    return;
  }

  newPlayerInGame.setColor(freeColor);

  game.players.push(newPlayerInGame);

  // Enregistrer la couleur dans usedColors
  game.usedColors[data.username] = newPlayerInGame.color;

  // On commence un countdown pour le joueur ayant rejoint
  startCountdownBeforeKick(connection, game, newPlayerInGame);

  // Broadcast général pour mettre à jour le nombre de joueurs présents dans le lobby courant
  sendBroadcast({
    type: "updateLobbyInfos",
    gameId: game.id,
  });

  // On informe tous les joueurs de la partie de l'arrivée du nouveau joueur
  sendPlayersInGame(game, {
    type: "joinGameResponse",
    newPlayerUsername: player.username,
    gameId: data.gameId,
    valid: true,
  });

  // Envoyer les couleurs prises à tous les joueurs
  sendPlayersInGame(game, {
    type: "updateColor",
    gameId: game.id,
    colorsTaken: game.players.map((p) => ({
      username: p.username,
      color: p.color,
    })),
  });
}

function handleLeaveLobby(connection, data) {
  if (!data.username) {
    sendConnection(connection, {
      type: "leaveLobbyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'existe pas",
    });
    return;
  }

  if (!data.gameId) {
    sendConnection(connection, {
      type: "leaveLobbyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "L'ID de la partie n'existe pas",
    });
    return;
  }

  // Vérifier si gameId et username corrects
  if (!games.has(data.gameId)) {
    sendConnection(connection, {
      type: "leaveLobbyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le lobby n'existe pas",
    });
    return;
  }

  // Si oui, on récupère le joueur et la partie
  let game = games.get(data.gameId);

  if (!game.checkPlayerInGame(data.username)) {
    sendConnection(connection, {
      type: "leaveLobbyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });
    return;
  }

  // Si le joueur est dans un lobby, on le retire de la liste des joueurs
  game.players = game.players.filter(
    (player) => player.username !== data.username
  );

  // Si le lobby est maintenant vide, on supprime le lobby
  if (game.players.length === 0) {
    games.delete(game.id);
  } else {
    // Si le lobby n'est pas vide, on met à jour l'état des couleurs
    delete game.usedColors[data.username];

    sendPlayersInGame(game, {
      type: "updateColor",
      gameId: game.id,
      colorsTaken: game.players.map((p) => ({
        username: p.username,
        color: p.color,
      })),
    });
  }

  // On confirme au joueur ayant quitté qu'il a pu le faire
  sendConnection(connection, {
    type: "leaveLobbyResponse",
    username: data.username,
    gameId: data.gameId,
    valid: true,
  });

  // Broadcast général pour mettre à jour le nombre de joueurs présents OU enlever le lobby qui est vide
  sendBroadcast({
    type: "updateLobbyInfos",
    gameId: game.id,
  });
}

function handleChangeColor(connection, data) {
  if (!data.username) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'existe pas",
    });
    return;
  }

  if (!data.gameId) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "L'ID de la partie n'existe pas",
    });
    return;
  }

  if (!data.color) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "La couleur n'existe pas",
    });
    return;
  }

  if (!games.has(data.gameId)) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le lobby n'existe pas",
    });
    return;
  }

  const game = games.get(data.gameId);

  if (!game.checkPlayerInGame(data.username)) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });
    return;
  }

  // On vérifie si la partie est terminée ou non
  // Pour empecher le joueur de changer de couleur en pleine partie
  if (game.status === "game") {
    // Si elle n'est pas encore terminée, on renvoie une erreur au joueur
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Impossible de changer de couleur pendant la partie",
    });
    return;
  }

  // Vérifie que le joueur est bien dans la partie
  const player = game.getPlayer(data.username);

  if (!player) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'existe pas dans la base de données",
    });
    return;
  }
  // Le joueur souhaite changer de couleur mais il est déjà prêt : on refuse
  if (player.ready) {
    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Impossible de changer de couleur en étant Prêt !",
    });
    return;
  }

  // Utiliser la méthode de Game pour changer la couleur
  const success = game.setPlayerColor(data.username, data.color);

  if (!success) {
    // Couleur déjà prise, envoyer un message d'erreur au joueur
    const takenBy = Object.entries(game.usedColors).find(
      ([playerName, c]) => c === data.color && playerName !== data.username
    );

    sendConnection(connection, {
      type: "changeColorResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: takenBy
        ? `Couleur déjà prise par ${takenBy.username}`
        : "Couleur non disponible",
    });

    // Renvoyer aussi l'état actuel pour resynchroniser

    sendPlayersInGame(game, {
      type: "updateColor",
      gameId: game.id,
      colorsTaken: game.players.map((p) => ({
        username: p.username,
        color: p.color,
      })),
    });
    return;
  }

  // Le choix a été validé avec succès
  sendConnection(connection, {
    type: "changeColorResponse",
    username: data.username,
    gameId: game.id,
    valid: true,
  });

  // Broadcast des couleurs prises à tous les joueurs du lobby
  sendPlayersInGame(game, {
    type: "updateColor",
    gameId: game.id,
    // Tableau des joueurs avec nom et couleur
    colorsTaken: game.players.map((p) => ({
      username: p.username,
      color: p.color,
    })),
  });
}

function handlePlayerReady(connection, data) {
  // On vérifie si les données sont valides
  if (!data.username) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'existe pas",
    });
    return;
  }

  if (!data.gameId) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "L'ID de la partie n'existe pas",
    });
    return;
  }

  let game = games.get(data.gameId);

  if (!game) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "La partie n'existe pas",
    });
    return;
  }

  if (!game.checkPlayerInGame(data.username)) {
    sendConnection(connection, {
      type: "playerReadyResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });
    return;
  }

  let player = game.getPlayer(data.username);

  // Si le joueur était déjà prêt : pas besoin de renvoyer un paquet de confirmation
  if (player.ready) {
    return;
  }

  player.ready = true;

  // Le serveur confirme au client que le statut "Prêt" a bien été changé
  sendConnection(connection, {
    type: "playerReadyResponse",
    username: data.username,
    gameId: data.gameId,
    valid: true,
  });

  // Début du compte à rebours si tous les joueurs sont prêts
  if (game.checkAllPlayersReady()) {
    startCountdown(game);
  }
}

async function handlePlayerMovement(connection, data) {
  let game = games.get(data.gameId);

  if (!game) {
    // Le serveur renvoie une erreur si données invalides
    sendConnection(connection, {
      type: "playerMovementResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "La partie n'existe pas",
    });

    return;
  }

  if (!game.checkPlayerInGame(data.username)) {
    // Le serveur renvoie une erreur si données invalides
    sendConnection(connection, {
      type: "playerMovementResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });

    return;
  }

  let player = game.getPlayer(data.username);

  // Mise à jour de la position du joueur selon la direction
  player.setDirection(data.direction);
}

async function handleRestartGame(connection, data) {
  // On vérifie si les données sont valides
  if (!data.username) {
    sendConnection(connection, {
      type: "restartGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'existe pas",
    });
    return;
  }

  if (!data.gameId) {
    sendConnection(connection, {
      type: "restartGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "L'ID de la partie n'existe pas",
    });
    return;
  }

  let game = games.get(data.gameId);

  if (!game) {
    // Le serveur renvoie une erreur si données invalides
    sendConnection(connection, {
      type: "restartGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "La partie n'existe pas",
    });
    return;
  }

  if (!game.checkPlayerInGame(data.username)) {
    // Le serveur renvoie une erreur si données invalides
    sendConnection(connection, {
      type: "restartGameResponse",
      username: data.username,
      gameId: data.gameId,
      valid: false,
      reason: "Le joueur n'est pas dans la partie",
    });

    return;
  }

  // On vérifie si la partie est terminée ou non
  if (game.status === "game") {
    // Si elle n'est pas encore terminée, on renvoie une erreur au joueur lui demandant d'attendre
    sendConnection(connection, {
      type: "restartGameResponse",
      valid: false,
      reason: "La partie n'est pas encore terminée",
    });
    return;
  }

  // Si elle est terminée, on récupère la partie venant de se terminer pour créer une nouvelle partie
  // avec les mêmes propriétés

  let gameInfos = {
    creatorName: data.username, // Le premier à appuyer sur Rejouer devient le créateur de la nouvelle partie
    gameName: game.name,
    maxPlayers: game.maxPlayers,
    //M : Couleur : on privilégie celle envoyée par le client, sinon on réutilise celle de la partie terminée
    color:
      data.color ||
      game.players.find((player) => player.username === data.username)?.color,
  };

  // On délègue à la fonction qui va créer une partie si les informations sont correctes
  // On récupère l'ID de la nouvelle partie créé
  let newGameId = handleCreateGame(connection, gameInfos);
  if (!newGameId) {
    sendConnection(connection, {
      type: "restartGameResponse",
      valid: false,
      reason: "Erreur lors de la création de la partie",
    });
    return;
  }

  // On envoie une confirmation que la nouvelle partie a été créée à tous les joueurs de la partie terminée,
  // pour leur demander s'ils veulent la rejoindre

  // Pour ce faire, on récupère les IDs des joueurs de la partie terminée depuis la base de données
  for (let player of game.players) {
    let conn = connections.get(player.username);
    if (!conn) {
      // Si le  joueur n'est pas connecté, on passe à l'itération suivante
      continue;
    }

    // On retire le joueur demandant de rejouer de l'ancienne partie
    game.players = game.players.filter(
      (player) => player.username !== data.username
    );

    // On supprime l'ancienne partie si plus aucun joueur
    if (game.players.length === 0) {
      games.delete(game.id);
    }

    sendConnection(conn, {
      type: "restartGameResponse",
      gameId: newGameId,
      restartName: data.username,
      valid: true,
    });

    // Envoyer aux joueurs de la partie terminée les mises à jour de couleur :  créateur qui s'en va
    sendPlayersInGame(game, {
      type: "updateColor",
      gameId: game.id,
      colorsTaken: game.players.map((p) => ({
        username: p.username,
        color: p.color,
      })),
    });
  }
}

function handleDisconnection(connection) {
  let disconnectedPlayerName = null;

  // On récupère le nom du joueur déconnecté
  for (const [playerName, conn] of connections.entries()) {
    if (conn === connection) {
      disconnectedPlayerName = playerName;
      connections.delete(playerName);
      break;
    }
  }

  if (!disconnectedPlayerName) {
    return;
  }

  for (const game of games.values()) {
    if (game.checkPlayerInGame(disconnectedPlayerName)) {
      if (game.status === "lobby" || game.status === "gameEnded") {
        // Si le joueur est dans un lobby, on le retire de la liste des joueurs
        game.players = game.players.filter(
          (player) => player.username !== disconnectedPlayerName
        );

        // Si le lobby est maintenant vide, on supprime le lobby
        if (game.players.length === 0) {
          games.delete(game.id);
        } else {
          // Si le lobby n'est pas vide, on met à jour l'état des couleurs
          delete game.usedColors[disconnectedPlayerName];

          sendPlayersInGame(game, {
            type: "updateColor",
            gameId: game.id,
            colorsTaken: game.players.map((p) => ({
              username: p.username,
              color: p.color,
            })),
          });
        }

        // Broadcast général pour mettre à jour le nombre de joueurs présents OU enlever le lobby qui est vide
        sendBroadcast({
          type: "updateLobbyInfos",
          gameId: game.id,
        });
      } else {
        // Le joueur est dans une partie, on change son état à "mort"
        let playerInGame = game.getPlayer(disconnectedPlayerName);
        playerInGame.alive = false;

        // S'il ne reste maintenant qu'un joueur en vie, il gagne la partie et la termine
        if (game.getAliveCount() === 1) {
          let winner = game.getWinner();
          endGame(game, winner.username);
        }
      }

      // On informe les joueurs de la partie de la déconnexion du joueur
      sendPlayersInGame(game, {
        type: "playerDisconnected",
        disconnectedUsername: disconnectedPlayerName,
        gameId: game.id,
      });
      return;
    }
  }
}

function startCountdownBeforeKick(connection, game, player) {
  let count = 30;
  let timeCountMs = 1000;

  const countInterval = setInterval(() => {
    count -= 1;

    // Si le joueur est prêt ou s'il n'est plus dans la partie on arrête le compte à rebours
    if (player.ready || !game.checkPlayerInGame(player.username)) {
      clearInterval(countInterval);
    }

    if (count < 0) {
      clearInterval(countInterval);

      // Si au bout de 30 secondes, le joueur n'est pas prêt et qu'il est encore dans la partie, on le kick
      if (!player.ready && game.checkPlayerInGame(player.username)) {
        // Si le joueur est dans un lobby, on le retire de la liste des joueurs
        game.players = game.players.filter(
          (p) => p.username !== player.username
        );

        // Si le lobby est maintenant vide, on supprime le lobby
        if (game.players.length === 0) {
          games.delete(game.id);
        } else {
          // Si le lobby n'est pas vide, on met à jour l'état des couleurs
          delete game.usedColors[player.username];

          sendPlayersInGame(game, {
            type: "updateColor",
            gameId: game.id,
            colorsTaken: game.players.map((p) => ({
              username: p.username,
              color: p.color,
            })),
          });
        }

        // A la fin du compte, le serveur informe les joueurs de la partie qu'elle commence
        sendConnection(connection, {
          type: "kickPlayer",
          gameId: game.id,
        });

        // Broadcast général pour mettre à jour le nombre de joueurs présents dans le lobby courant
        sendBroadcast({
          type: "updateLobbyInfos",
          gameId: game.id,
        });
      }
    }
  }, timeCountMs);
}

// === Fonctions supports sur l'état de la partie ===

function startCountdown(game) {
  // Fonction support à handlePlayerReady
  // Compte à rebours jusqu'à 3 en broadcast de partie avant le début de la partie
  let count = 3;
  let timeCountMs = 1000;

  const countInterval = setInterval(() => {
    sendPlayersInGame(game, {
      type: "countdown",
      gameId: game.id,
      count: count,
    });
    count -= 1;
    if (count < 0) {
      clearInterval(countInterval);

      // A la fin du compte, le serveur informe les joueurs de la partie qu'elle commence
      sendPlayersInGame(game, {
        type: "gameStart",
        gameId: game.id,
      });

      // Démarrage de la partie
      game.start(updateAllPlayerMovements, endGame, game);
    }
  }, timeCountMs);
}

function updateAllPlayerMovements(game) {
  // Fonction support à Game.start(), qui permet de  découpler Game.js de Websocket
  // Broadcast de partie pour envoyer l'état du jeu à chaque client
  sendPlayersInGame(game, {
    type: "updateAllPlayerMovements",
    gameId: game.id,
    players: game.players,
  });
}

async function endGame(game, winnerName) {
  // Fonction support à Game.update(), qui permet de  découpler Game.js de Websocket
  // On parcourt game.players pour n'extraire que les propriétés à sauvegarder en base de données
  let playersData = [];
  for (let player of game.players) {
    playersData.push(player.username);
  }
  // On stocke la partie courante et le nom du gagnant en base de données
  await gameModel.create({
    generatedGameId: game.id,
    name: game.name,
    players: playersData,
    winnerName: winnerName,
    startedAt: game.startedAt,
    endedAt: Date.now(),
  });

  game.stop();

  for (const player of game.players) {
    // Mise à jour du nombre de victoires de chaque joueur de la partie

    // +1 victoire si le joueur === gagnant, sinon +1 défaite
    await playerModel.updateOne(
      { username: player.username },
      winnerName === player.username
        ? { $inc: { wins: 1 } }
        : { $inc: { losses: 1 } }
    );

    // Broadcast de fin de partie
    // On envoie l'ID du gagnant à tous les joueurs
    // Le client affiche "Gagné" si le nom du joueur === le nom du gagnant, "Perdu" sinon
    let connection = connections.get(player.username);

    if (connection) {
      sendConnection(connection, {
        type: "endGame",
        winnerName: winnerName,
        valid: true,
      });
    }
  }
}

module.exports = {
  handleConnectionPlayer,
  handleGetLeaderboard,
  handleGetAllLobbies,
  handleCreateGame,
  handleJoinGame,
  handleLeaveLobby,
  handlePlayerReady,
  handleChangeColor,
  handlePlayerMovement,
  handleRestartGame,
  handleDisconnection,
};
