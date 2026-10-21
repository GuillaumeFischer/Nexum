# Deep Miners 0.13.17 — nouveau mineur pixel art

Le joueur a choisi la proposition C pour repartir sur un personnage plus simple. Le mineur utilise désormais des silhouettes complètes en pixel art : casque jaune avec lampe, veste bleu marine, pantalon rouille, gants et bottes bruns. Les trois vues dessinées sont face, profil droit et dos ; le profil gauche est reflété.

La marche suit un cycle court de quatre images, avec alternance gauche/droite et passage des pieds sous les hanches. Le cycle suit la distance parcourue ; courir accélère sa cadence. Le repos revient dès l'arrêt. Les gestes de pioche et de pelle ont chacun trois poses complètes. En dehors des gestes, l'outil sélectionné suit le gant. La posture assise est une pose fixe dédiée, commune à tous les équipements et sans animation de marche.

La préparation extrait chaque silhouette complète depuis les planches transparentes, enregistre les bottes sur le sol, harmonise la taille entre les vues et applique une palette de 26 couleurs sans pixels semi-transparents. Les réflexions frontales et de dos assurent l'alternance des appuis du cycle court. Le rendu conserve des pixels nets et les couleurs de casque des six joueurs. Les silhouettes corporelles restent complètes pendant l'animation.

Deux textures PNG sont chargées pour le personnage et ses outils : 68 261 octets au total. Le chargement du jeu utilise 25 ressources au lieu de 27. Le modèle articulé et ses anciennes textures restent archivés dans les sources mais ne sont plus chargés pour le personnage. Les vitesses physiques, commandes, collisions, règles des outils, réseau et sauvegardes sont conservés.

## Vérification ciblée

- Quatre nouveaux tests de `tests/pixel-miner.test.mjs` : cycle, arrêt et miroir, gestes/outils, posture assise/décès, dessin complet et pixels nets.
- Vérification graphique native de 36 cases de poses : 26 couleurs, alpha binaire, marge minimale de quatre pixels, aucun fragment détaché.
- Douze cycles (quatre directions, trois équipements) comportent chacun quatre dessins distincts ; 32 échantillons d'outil porté vérifiés.
- Six couleurs distinctes ; 96 comparaisons de posture assise stable. Cache de 180 variantes colorées, limité à 256 et libérable.
- Vrai moteur Canvas exécuté avec ses ressources et une mine en mémoire : captures de face, de profil et de dos, plus six occupants d'un wagon. Aucun ancien modèle de personnage chargé.

Les anciennes suites n'ont pas été relancées. Les vérifications utilisent le Canvas natif ; aucune partie interactive Electron ou multijoueur Internet n'est revendiquée. Aucune sauvegarde réelle n'a été utilisée ou modifiée.

Préparation : `node scripts/prepare-pixel-miner.mjs <dossier-source>` avec `source-south.png`, `source-east.png`, `source-north.png`, `source-tools.png`. Le contrôle graphique optionnel est `node scripts/verify-pixel-miner.mjs <dossier-rapport>` ; il utilise `@napi-rs/canvas`, comme les autres outils graphiques du projet. Les sources générées, prompts exacts, rapports et aperçu animé sont conservés dans `outputs/Personnage-Pixel-2026-10-21/` de l'espace de travail.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.17
