# Atelier Jeux

Un launcher Windows pour installer, mettre à jour et lancer les jeux de l’atelier. Deep Miners est le premier jeu disponible.

## Jouer

1. [Télécharge le launcher Windows](https://github.com/GuillaumeFischer/atelier-jeux/releases/latest), puis installe **Atelier-Jeux-Setup-1.0.1.exe**.
2. Choisis ton pseudo dans **Mon profil** et installe **Deep Miners** dans la bibliothèque.
3. Choisis **Jouer seul** ou **Héberger une partie**, puis retrouve une mine existante dans le sélecteur ou choisis **Créer une nouvelle mine**.
4. Pour jouer entre amis, l’un de vous clique sur **Héberger une partie**, choisit une mine et copie son invitation. Les autres la collent dans **Rejoindre des amis**.

Tu peux descendre seul dans une partie hébergée, puis accueillir tes amis. Jusqu’à six joueurs peuvent se retrouver dans une mine. Il faut la même version du jeu chez tous les joueurs.

Le PC de l’hôte fait tourner la partie et conserve la mine. S’il ferme le jeu ou le launcher, ses amis sont déconnectés. Pour continuer un autre soir, il reprend la même mine et partage une nouvelle invitation. Le même profil retrouve son personnage.

Pas besoin de compte GitHub ni d’installer Node.js pour jouer. Le launcher propose ses propres mises à jour, et les jeux se mettent à jour dans la bibliothèque. L’installeur initial n’a pas de signature éditeur.

## Sauvegardes

Dans **Mon profil → Ouvrir les sauvegardes**, tu trouveras les mines hébergées sur ce PC. Le dossier de données complet se trouve dans `%APPDATA%/atelier-jeux/` :

- `profile.json` contient l’identité du joueur : conserve-le pour retrouver tes personnages.
- `saves/deep-miners/rooms.json` contient les mines dont ce PC est l’hôte.
- `games/` contient les versions installées et peut être téléchargé à nouveau.

Sauvegarde **le profil et les mines ensemble** avant de changer de PC. Une désinstallation du launcher conserve ses données. Les sauvegardes de l’ancien site ne sont pas automatiquement importées dans cette édition.

## Connexion Internet

Le jeu est hébergé par un joueur ; GitHub ne fait pas tourner les parties. Les invitations utilisent [HyperDHT](https://github.com/holepunchto/hyperdht) et des connexions chiffrées. Les fichiers du jeu sont servis localement sur chaque PC ; les échanges de la partie passent vers l’hôte.

HyperDHT s’appuie sur des nœuds publics de découverte. La traversée des routeurs fonctionne sur de nombreux réseaux, sans garantir tous les pare-feu ou NAT. Si une connexion échoue, essaie un autre hôte ou un autre réseau. Le test entre deux connexions Internet indépendantes reste à effectuer pour cette première édition.

## Développer et publier

Sur Windows x64 avec Node.js 24 et GitHub CLI :

```powershell
npm ci
npm run configure:github -- MON_COMPTE atelier-jeux
npm run pack:games
npm start
```

Le code du launcher est dans `apps/launcher/`, l’installation et le réseau dans `packages/`, et chaque jeu dans `games/`. Les secrets, sauvegardes, dépendances et exécutables générés sont exclus du dépôt.

Pour publier, connecte GitHub CLI à ton compte puis lance **Actions → Publier le launcher et les jeux → Run workflow**. Le workflow construit les archives des jeux, vérifie les versions existantes, publie les nouvelles versions, actualise le catalogue, puis fabrique et publie l’installeur Windows. Décoche l’option du launcher pour ne publier qu’une mise à jour de jeu. Aucun ancien test de gameplay n’est exécuté automatiquement.

Augmente `games/<id>/game.json` et le numéro affiché par le jeu avant une modification d’un jeu déjà publié. Augmente `package.json` pour publier un nouveau launcher. Une version publiée n’est jamais remplacée. Les versions de jeux ne deviennent pas la version « Latest » du dépôt : celle-ci reste réservée au launcher et à ses mises à jour.

Pour une fabrication locale : `npm run pack:games`, puis `npm run dist`. Les résultats apparaissent dans `artifacts/` et `release/`. Les nouveaux contrôles du launcher sont dans `tests/launcher.test.mjs` ; on peut les lancer individuellement avec `node --test --test-name-pattern="nom du contrôle" tests/launcher.test.mjs`.

Voir [Ajouter un jeu](docs/ajouter-un-jeu.md) pour étendre le catalogue.
