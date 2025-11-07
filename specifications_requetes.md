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
  valid : false
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

## Game

- Quand le client crée un lobby (qui est une game dont le statut est "lobby"), il envoie au serveur :

```
{
  type : "createGame",
  maxPlayers : Number, // entre 2 et 4
  creatorId : Number,
  gameName : String,
  status : "lobby",
}
```

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
}
```

- Si le joueur a réussi à rejoindre le lobby, le serveur informe tous les clients de l'arrivée du nouveau joueur :

```
{
  type : "joinGameResponse",
  newPlayerId : Number,
  gameId : Number,
  valid: true,
}
```

Quand le joueur clique sur "Ready", cela envoie au serveur:

```
{
  type : "playerReady",
  playerId : Number,
  gameId : Number,
  ready : Boolean,
}
```

- Le serveur démarre lobby quand tous les clients ont envoyé "Ready". Il envoie aux clients :

```
{
  type : "gameReady",
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
  playerMovement, // "up", "down", "left", "right"
}

```

Le serveur regarde s'il y a des collisions, met à jour les positions en envoyant à tous les clients à intervalle fixe :

```
{
  type : "updateAllPlayerMovements",
  gameId : Number,
  players : Array[Player]
}

// Player
{
  id : Number,
  x : Number,
  y : Number,
  direction : String,
  alive : Boolean
}
```

S'il ne reste qu'un joueur en vie, le serveur déclenche la fin de la partie. On arrête le jeu côté serveur.
