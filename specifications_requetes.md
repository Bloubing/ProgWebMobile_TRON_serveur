A traiter par le serveur:

## Connexion utilisateur :

Serveur :

```
  {
    type, //connectionPlayer
  username,
  password
  }
```

Soit :

- username existe et password incorrect : on interdit, le serveur envoie :

```
{
  type : "connectionResponse",
  valid : bool
}
```

- username existe et password correct : on autorise

- username n'existe pas dans Mongo : le serveur ajoute sur Mongo un user à partir de cette requête

```
user :
{
  "_id": ID,
  "username": "john",
  "password" : "blabla,
  "wins": 0,
  "losses": 0
}
```

# Lobbies

- Quand le client crée un lobby, il envoie au serveur :

```
{
  type,
nbDeJoueursMax (2 à 4),
creatorID
nomLobby
}
```

- Quand le client clique sur un lobby, il envoie au serveur :

```

{
  type,
username/id,
lobbyARejoindreID,
}

```

Quand le joueur clique sur "Ready", cela envoie au serveur:

```
{
  type,
  username/id
  lobbyARejoindreID
  ready (booleen)
}
```

Le serveur met les joueurs sur le lobby souhaité s'il n'est pas plein.

- Le serveur démarre lobby quand tous les clients ont envoyé Ready

## Partie en cours (lobby/partie)

Client envoie au serveur :

```

{
  type,
userId,
gameId,
différencesTableau,
}

```

Le serveur regarde s'il y a des collisions, met à jour les positions.

S'il ne reste qu'un joueur en vie, le serveur déclenche la fin de la partie. On arrête le jeu côté serveur et on attend de

Serveur envoie au client :

```

{
  type,
gameId,
finPartie, (on peut le déduire de l'état des joueurs)
étatsDesJoueurs (vie/mort)
tableau avec vrai état jeu,
}

```
