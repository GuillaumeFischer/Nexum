# Deep Miners 0.13.11 — nouveau mineur illustré

Le personnage est reconstruit à partir du modèle illustré détaillé approuvé le 19 octobre : casque et veste jaunes, visage visible, foulard sombre, sac compact et bottes brunes, avec une perspective adaptée à la caméra du jeu.

180 poses originales remplacent les anciennes images : 8 pas de marche et 8 pas de course pour chacun des trois équipements (mains vides, pioche, pelle), 4 phases d'action par outil, repos équipé et posture assise. Face, profil droit et dos sont dessinés ; le profil gauche est obtenu par miroir. Les images sont alignées sur un point au sol commun, avec une échelle stable entre les équipements.

Le mouvement utilise réellement les nouvelles poses. La cadence suit la distance parcourue ; l'arrêt revient immédiatement au repos et un demi-tour change la direction sans recommencer la foulée. Les anciennes rotations et déformations procédurales du corps ne sont pas appliquées au nouveau mineur. Le wagon utilise une pose assise fixe, sans animation de marche ni d'outil. Les six couleurs des joueurs sont conservées.

Huit planches WebP transparentes ajoutent 1 476 788 octets. Les anciennes planches de personnage ne sont plus chargées au démarrage. Les variantes colorées sont produites par pose et gardées dans un cache limité à 256 entrées, au lieu de recolorer toutes les planches pour chaque joueur.

Les vitesses physiques, collisions, règles de jeu, synchronisation réseau et sauvegardes ne sont pas modifiées.

## Vérification ciblée

- Cinq nouveaux tests de `tests/rebuilt-miner.test.mjs` : nombre et ancrage des poses, directions/équipements, départ/course/demi-tour/arrêt, actions d'outil et posture assise stable pendant huit secondes.
- `scripts/verify-miner-art.mjs` exécuté avec le Canvas natif : 180 images non vides et sans découpe (marge minimale de 14 pixels), 24 cycles de huit images distinctes, six couleurs différentes, pose assise identique dans les quatre directions et les six couleurs, cache borné et libérable.
- Vrai moteur Canvas exécuté avec les ressources chargées par `loadAssets`, sur une mine de test en mémoire : captures mains vides, pioche, pelle et six occupants dans le wagon. 31 ressources chargées, aucune ancienne planche de personnage chargée.
- Aperçu GIF encodé à partir des images produites par le vrai module de dessin du personnage.

Les anciennes suites n'ont pas été relancées. Il s'agit d'un contrôle du moteur avec un Canvas natif, pas d'une partie interactive dans la fenêtre Electron ni d'une mesure des performances chez les joueurs. Aucun profil ni sauvegarde réelle n'a été ouvert ou modifié pour ces contrôles.

Reproduction du contrôle graphique : installer ou fournir `@napi-rs/canvas` via `CANVAS_MODULE_ROOT`, puis lancer `node scripts/verify-miner-art.mjs <dossier-de-sortie>`. Ce module est un outil de vérification facultatif, pas une dépendance du jeu distribué.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.11
