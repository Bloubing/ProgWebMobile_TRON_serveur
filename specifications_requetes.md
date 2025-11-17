## TODO

- RECHECK createGameResponse car pour l'instant il est en broadcast donc ca va changer le gameId de TOUS les joueurs connectés => dans getGameId : changer que si data.creatorId === playerId

- tester (check mouvements players)
- renvoyer qqch de différent qd nombre de winners > 1
- décomposer les réponses valid:false qui renvoient plusieurs erreurs en OR pour+ de précision
- implémenter code spécifique au lobby : réapparition joueurs, non comptabilisation des scores
- json schema ?
- côté client : désactiver le bouton ready quand premiere reponse countdown recue par client

# Déroulé des requêtes

## Connexion utilisateur

Serveur reçoit :

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
  playerId : String,
  valid : false
  reason : "Invalid password"
}
```

- username existe et password correct -> le serveur envoie :

```
{
  type : "connectionResponse",
  playerId : String,
  valid : true
}
```

- username n'existe pas dans la base de données -> le serveur ajoute à la base de données un joueur à partir de la requête client. Le serveur envoie :

```
{
  type : "connectionResponse",
  playerId : String,
  valid : true
}
```

## Déconnexion utilisateur

Si le client se déconnecte et qu'il était dans un lobby, le serveur enlève le client du lobby et informe en broadcast tous les joueurs connectés pour mettre à jour la liste des lobbies :

```
type: "updateLobbyInfos",
gameId: game.id,
```

Si le client était dans une game, le serveur envoie aux joueurs de la game :

```
{
  type: "playerDisconnected",
  playerId: String,
  gameId: String,
}
```

## Avant la Game

### Création de lobby

- Quand le client crée un lobby (qui est une game dont le statut est "lobby"), il envoie au serveur :

```
{
  type : "createGame",
  maxPlayers : Number, // entre 2 et 4
  creatorId : String,
  gameName : String,
}
```

- Si le lobby a bien été créé, le serveur envoie en broadcast, à tous les joueurs connectés :

```
{
  type : "createGameResponse",
  gameId : String,
  creatorId: String,
  valid: true,
}
```

- Sinon, en cas d'erreur (données invalides), le serveur envoie :

```
{
  type : "createGameResponse",
  valid: false,
  reason: "Missing or invalid data"
}
```

### Rejoindre un lobby

- Le client demande la liste des lobbies :

```
{
  type: "getAllLobbies",
  playerId: String
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
playerId : String,
gameToJoinId : String,
}

```

- Si le lobby est déjà plein, le serveur informe le client en envoyant :

```

{
type : "joinGameResponse",
playerId : String,
gameId : String,
valid: false,
reason: "Lobby/game is full"
}

```

- Le serveur peut envoyant des valid:false avec d'autres valeurs de reason : la game n'existe pas, le player n'existe pas, etc.

- Si le joueur a réussi à rejoindre le lobby, le serveur informe tous les clients de l'arrivée du nouveau joueur :

```

{
type : "joinGameResponse",
newPlayerId : String,
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
playerId : String,
gameId : String,
ready : Boolean,
}

```

- S'il y a une erreur après cette action, le serveur envoie au client :

```

{
type: "playerReadyResponse",
playerId: String,
gameId: String,
valid: false,
reason: String,
}

```

- S'il n'y a pas d'erreur et que le statut "Ready" du joueur a bien été pris en compte, le serveur confirme :

```

{
type: "playerReadyResponse",
playerId: String,
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
playerId : String,
gameId : String,
direction: String, // "up", "down", "left", "right"
}

```

S'il y a eu une erreur, le serveur répond :

```

{
type : "playerMovementResponse",
playerId : String,
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
id : Number,
x : Number,
y : Number,
alive : Boolean,
ready : Boolean;
currentDirection : String,
}

```

S'il ne reste qu'un joueur en vie, le serveur déclenche la fin de la partie et envoie au client:

```

{
type: "endGame",
winnerId: String,
valid: true,
}

```

On arrête le jeu côté serveur.

```

```
