# Ajouter un jeu

Cette première version prend en charge les jeux web dont le serveur est un module Node.js. Un jeu Unity, Godot ou un autre exécutable Windows nécessitera un adaptateur de lancement supplémentaire.

Crée `games/mon-jeu/` avec un `game.json` :

```json
{
  "id": "mon-jeu",
  "title": "Mon jeu",
  "version": "1.0.0",
  "engine": "node-web",
  "adapter": "server/launcher.mjs",
  "client": "client",
  "description": "Une aventure à partager.",
  "players": "1–6 joueurs",
  "multiplayer": true
}
```

Les identifiants sont en minuscules, chiffres et tirets. Les versions sont de la forme `1.2.3`. Les fichiers du jeu doivent être autonomes : aucune dépendance à un CDN ou à un service du site d’origine.

L’adaptateur exporte :

- `listMines(saveDir)` → liste de `{id,title,players,solo}` ; ne modifie pas les sauvegardes.
- `host({saveDir,name,identity,mineId,solo})` → `{port,mineId,bootstrap,join,close}`. Le serveur écoute uniquement sur `127.0.0.1`, sur un port disponible. `mineId` est fourni pour reprendre une sauvegarde.
- `join(name,identity)` retrouve ou crée le joueur et retourne son `bootstrap` d’authentification.
- `close()` sauvegarde puis libère le serveur, les connexions et les timers.

Le client reçoit son bootstrap dans `/config.js` et ouvre une connexion WebSocket vers `/ws` sur sa propre origine. Pour le moment, la clé exposée est `window.DEEP_MINERS_DESKTOP` ; un nouvel adaptateur peut la lire aussi, jusqu’à la généralisation de ce contrat.

Le serveur doit authentifier cette connexion et gérer reconnexion, autorité de l’hôte et sauvegarde. Le tunnel est un flux TCP chiffré ; il transporte le WebSocket de la partie. Les ressources graphiques et sonores restent servies depuis l’installation locale du joueur.

Lance `npm run pack:games` pour créer l’archive et ajouter le jeu au catalogue. Publie ensuite avec le workflow de publication. Les mises à jour d’un jeu conservent le profil et les sauvegardes, qui sont stockés hors de son dossier d’installation.
