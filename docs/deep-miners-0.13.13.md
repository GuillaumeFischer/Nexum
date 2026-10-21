# Deep Miners 0.13.13 — contact du personnage avec le sol

Le grand ovale sombre décalé sous le mineur donnait l'impression qu'il flottait. L'alignement précédent se fondait sur le haut du casque ; la position des semelles variait selon les poses.

Le rendu à pied utilise désormais le point de contact des bottes de chaque pose. La semelle porteuse est alignée sur le sol, sans modifier l'échelle ni les images du personnage. Le grand aplat est remplacé par une ombre diffuse au bord transparent et de petites ombres de contact sous les semelles. Le contact du pied relevé est atténué pendant les pas. L'ombre suit la direction, y compris le profil gauche en miroir.

Les points sont préparés une fois depuis les planches existantes et enregistrés dans `client/miner-ground-layout.js` : aucun examen des pixels ni génération de métadonnées à chaque image dans le jeu. Pour régénérer ces données après une modification des planches, exécuter `node scripts/prepare-miner-grounding.mjs` avec `@napi-rs/canvas` disponible via `CANVAS_MODULE_ROOT`.

Le changement concerne uniquement le dessin à pied. La posture assise dans le wagon garde son ancrage précédent et ne reçoit pas d'ombres de pieds. Vitesses, collisions, déplacements réseau, profil et sauvegardes inchangés.

## Vérification ciblée

- Quatre nouveaux tests de `tests/miner-grounding.test.mjs` : 177 poses à pied, alignement effectif des semelles dans les commandes du vrai dessin, ombres transparentes et miroir, exclusion des trois poses assises.
- Contrôle graphique des données : les 236 contacts de semelles tombent sur des pixels opaques des sprites ; aucun contact invalide. Les huit planches ont été rendues avec les points de contact pour inspection.
- Comparaison avant/après produite avec les vrais modules du moteur Canvas et les mêmes ressources, dans une mine de test en mémoire. Le grand ovale détaché est remplacé par des ombres au contact des bottes.

Les anciennes suites n'ont pas été relancées. Le contrôle du moteur utilise un Canvas natif, sans revendiquer une partie interactive Electron ou multijoueur Internet. Aucune sauvegarde réelle n'a été utilisée.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.13
