## remarques

- sur l'interface, enlever le fade des trails car + dur a implementer et cest pas tron
- coté client, faire les websockets avec le format des requetes demandés

## TODO

- tester
- update wins/losses de chaque joueur a la fin de partie
- ajouter countdown serveur dans game.start() : 3,2,1
- mettre au propre le fichier markdown, et les requetes/reponses (metre des valid:true là ou j'ai oublié)
- hasher mdp pour ne pas stocker en clair
- implémenter code spécifique au lobby : réapparition joueurs, non comptabilisation des scores
- json schema ?
- refactoriser connectionResponse "valid:false"
- gérer la déconnexion

# Déroulé des requêtes

## Connexion utilisateur :

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
  playerId : Number,
  valid : false
  reason : "Invalid password"
}
```

- username existe et password correct -> le serveur envoie :

```
{
  type : "connectionResponse",
  playerId : Number,
  valid : true
}
```

- username n'existe pas dans la base de données -> le serveur ajoute à la base de données un joueur à partir de la requête client.

Format du document Player :

```
{
  id: ID,
  username: String, // voir requête client
  password : String, // voir requête client
  wins: 0,
  losses: 0,
}
```

## Avant la Game

### Création de lobby

- Quand le client crée un lobby (qui est une game dont le statut est "lobby"), il envoie au serveur :

```
{
  type : "createGame",
  maxPlayers : Number, // entre 2 et 4
  creatorId : Number,
  gameName : String,
}
```

- Si le lobby a bien été créé, le serveur envoie :

```
{
  type : "createGameResponse",
  gameId : Number,
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

- Quand le client clique sur un lobby, il envoie au serveur :

```
{
  type : "joinGame",
  playerId : Number,
  gameToJoinId : Number,
}
```

- Si le lobby est déjà plein, le serveur informe le client en envoyant :

```
{
  type : "joinGameResponse",
  playerId : Number,
  gameId : Number,
  valid: false,
  reason: "Lobby/game is full"
}
```

- Le serveur peut envoyant des valid:false avec d'autres valeurs de reason : la game n'existe pas, le player n'existe pas, etc.

- Si le joueur a réussi à rejoindre le lobby, le serveur informe tous les clients de l'arrivée du nouveau joueur :

```
{
  type : "joinGameResponse",
  newPlayerId : Number,
  newPlayerUsername: String,
  gameId : Number,
  valid: true,
}
```

### Cliquer sur "Ready"

- Quand le joueur clique sur "Ready", cela envoie au serveur:

```
{
  type : "playerReady",
  playerId : Number,
  gameId : Number,
  ready : Boolean,
}
```

- S'il y a une erreur après cette action, le serveur envoie au client :

```
{
  type: "playerReadyResponse",
  playerId: Number,
  gameId: Number,
  valid: false,
  reason: String,
}
```

- S'il n'y a pas d'erreur et que le statut "Ready" du joueur a bien été pris en compte, le serveur confirme :

```
{
  type: "playerReadyResponse",
  playerId: Number,
  gameId: Number,
  valid: true,
}
```

- Le serveur démarre lobby quand tous les clients ont envoyé "Ready". Il envoie aux clients :

```
{
  type : "gameStart",
  gameId : Number,
}
```

## Game en cours

Client envoie au serveur :

```

{
  type : "playerMovement",
  playerId : Number,
  gameId : Number,
  direction: String, // "up", "down", "left", "right"
}

```

S'il y a eu une erreur, le serveur répond :

```
{
  type : "playerMovementResponse",
  playerId : Number,
  gameId : Number,
  valid: false,
  reason: String,
}
```

Le serveur regarde s'il y a des collisions, met à jour les positions en envoyant à tous les clients à intervalle fixe :

```
{
  type : "updateAllPlayerMovements",
  gameId : Number,
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
winnerId: Number,
valid: true,
}
```

On arrête le jeu côté serveur.
