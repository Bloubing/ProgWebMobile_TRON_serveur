## TODO

- **clean code (remplacer playerId par name et gameId par la connection elle-même), homégénéiser PWC et PWS, commenter PWC**

- PWC : empecher envoi de requetes si on appuie sur la meme direction

- fix bug reset couleur joueur qd rejouer

- PWC : mettre sur Cordova et tester

- PWS (optionnel): implémenter code spécifique au lobby : réapparition joueurs, non comptabilisation des scores

- PWS (optionnel) : optimiser le broadcast aux joueurs connectés : envoyer qu'à ceux qui ne sont pas dans une game

- PWS&PWC (très optionnel) : ajouter score -> si on fait pas, enlever score sur PWC

- PWC (très optionnel) : limiter choix couleurs

# Déroulé des requêtes-réponses

## Connexion du joueur

Quand le joueur se connecte, le serveur reçoit de la part du client:

```
  {
    type : "connectionPlayer",
    username : String,
    password : String,
  }
```

Le serveur regarde dans la base de données :

- username existe et password incorrect -> le serveur envoie :

```
{
  type : "connectionResponse",
  username : String,
  valid : false
  reason : "Mot de passe invalide"
}
```

- username existe et password correct -> le serveur envoie :

```
{
  type : "connectionResponse",
  username : String,
  valid : true
}
```

- username n'existe pas dans la base de données -> le serveur ajoute à la base de données un joueur à partir de la requête client. Le serveur envoie :

```
{
  type : "connectionResponse",
  username : String,
  valid : true
}
```

## Déconnexion du joueur

Si le client se déconnecte et qu'il était dans un lobby, le serveur enlève le client du lobby et informe en broadcast tous les joueurs connectés pour mettre à jour la liste des lobbies :

```
type: "updateLobbyInfos",
gameId: String,
```

Si le client était dans une game, le serveur envoie aux joueurs de la game :

```
{
  type: "playerDisconnected",
  disconnectedUsername: String,
  gameId: String,
}
```

## Classement

- Le client clique sur le bouton "Classement" et envoie une requête au serveur :

```
{
  type: "getLeaderboard",
}
```

Le serveur fait une requête à la base de données pour obtenir les 5 joueurs avec le plus de victoires et envoie au client :

```
{
  type: "getLeaderboardResponse",
  players: Array[Player]
  valid: true

  // Player
  {
    username: String,
    wins: Number,
    losses: Number,
  }
}
```

## Avant la Game

### Création de lobby

- Quand le client crée un lobby (qui est une game dont le statut est "lobby"), il envoie au serveur :

```
{
  type : "createGame",
  maxPlayers : Number, // entre 2 et 4
  creatorName : String,
  gameName : String,
  color: String, // couleur du joueur
}
```

- Si le lobby a bien été créé, le serveur envoie en broadcast, à tous les joueurs connectés :

```
{
  type : "createGameResponse",
  gameId : String,
  creatorName: String,
  valid: true,
}
```

- Sinon, en cas d'erreur (données invalides), le serveur envoie :

```
{
  type : "createGameResponse",
  valid: false,
  reason: "Données manquantes ou invalides"
}
```

### Rejoindre un lobby

- Le client demande la liste des lobbies :

```
{
  type: "getAllLobbies",
}
```

- Le serveur répond en donnant la liste des lobbies :

```
{
  type: "getAllLobbiesResponse"
  lobbies: [lobbies]
}
```

- Quand le client clique sur un lobby, il envoie au serveur :

```

{
type : "joinGame",
username : String,
gameToJoinId : String,
color: String,
}

```

- Si le lobby est déjà plein, le serveur informe le client en envoyant :

```

{
type : "joinGameResponse",
username : String,
gameId : String,
valid: false,
reason: "Le lobby ou la partie est plein(e)"
}

```

- Le serveur peut envoyant des valid:false avec d'autres valeurs de reason : la game n'existe pas, le player n'existe pas, etc.

- Si le joueur a réussi à rejoindre le lobby, le serveur informe tous les clients de l'arrivée du nouveau joueur :

```

{
type : "joinGameResponse",
newPlayerUsername: String,
gameId : String,
valid: true,
}

```

### Cliquer sur "Ready"

- Quand le joueur clique sur "Ready", cela envoie au serveur:

```

{
type : "playerReady",
username : String,
gameId : String,
ready : Boolean,
}

```

- S'il y a une erreur après cette action, le serveur envoie au client :

```

{
type : "playerReadyResponse",
username : String,
gameId : String,
valid : false,
reason : String,
}

```

- S'il n'y a pas d'erreur et que le statut "Ready" du joueur a bien été pris en compte, le serveur confirme :

```
{
type: "playerReadyResponse",
username: String,
gameId: String,
valid: true,
}
```

- Le serveur démarre lobby quand tous les clients ont envoyé "Ready". Il commence par envoyer aux clients un décompte :

```

{
type: "countdown",
gameId: String,
count: Number,
}

```

Quand le décompte est fait, il envoie :

```

{
type : "gameStart",
gameId : String,
}

```

## Game en cours

Client envoie au serveur :

```

{
type : "playerMovement",
username : String,
gameId : String,
direction: String, // "up", "down", "left", "right"
}

```

S'il y a eu une erreur, le serveur répond :

```

{
type : "playerMovementResponse",
username : String,
gameId : String,
valid: false,
reason: String,
}

```

Le serveur regarde s'il y a des collisions, met à jour les positions en envoyant à tous les clients à intervalle fixe :

```

{
type : "updateAllPlayerMovements",
gameId : String,
players : Array[Player],
}

// Player
{
username : String,
color: String,
}

```

S'il ne reste qu'un joueur en vie, le serveur déclenche la fin de la partie et envoie au client:

```

{
type: "endGame",
winnerName: String,
valid: true,
}

```

On arrête le jeu côté serveur.

## Rejouer une partie

Si le client souhaite relancer une partie, il envoie au serveur :

```
type: "restartGame"
username: String,
gameId: String,
color: String
```

Le serveur reçoit la requête. Si la partie n'est pas terminée, il informe le joueur qu'il faut qu'il attende :

```
type: "restartGameResponse",
valid: false,
reason : "La partie n'est pas encore terminée"
```

Sinon, il laisse le joueur rejoindre la partie.

Le serveur informe les joueurs de la partie terminée qu'un des joueurs souhaite rejouer:

```
type: "restartGameResponse",
gameId: String, // L'ID de la nouvelle partie
restartName : String, // Le joueur souhaitant rejouer
valid: true,
```
