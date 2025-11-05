A traiter par le serveur:

## Connexion utilisateur :

Serveur :

```
  {
  username,
  password
  }
```

Soit :

- username existe et password incorrect : on interdit

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
nbDeJoueursMax,
nomLobby
}
```

Le serveur ajoute un lobby à Mongo :

```
lobby : (pas sur de lui mais ça peut-être pas mal pour les files d'attentes)

{
  "_id": ID,
  "hostId": ID,
  "players": [
    { "userId": ID, "username": "player1", "ready": true },
	...
  ],
  "maxPlayers": 2,
  "status": "waiting",
  "createdAt": Date
}
```

- Quand le client clique sur un lobby, il envoie au serveur :

```
{
    username/id,
    lobbyARejoindreID,
    ready?,
}
```

Le serveur met les joueurs sur le lobby souhaité s'il n'est pas plein.

- Le serveur démarre lobby que si tous les clients ont envoyé Ready

## Partie en cours (lobby/partie)

Client envoie au serveur :

```
{
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
    gameId,
    finPartie, (on peut le déduire de l'état des joueurs)
    étatsDesJoueurs (vie/mort)
    tableau avec vrai état jeu,
}
```
