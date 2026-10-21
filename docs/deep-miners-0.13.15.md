# Deep Miners 0.13.15 — raccord des bras

Le buste du mineur articulé contenait encore des manches peintes. Les bras animés se superposaient à ces manches, créant un double contour aux épaules. Les trois bustes sont remplacés par des versions sans manches, avec le même costume, les sangles et le sac. Les manches appartiennent désormais uniquement aux bras articulés.

Le rendu conserve les proportions du buste sans l'étirer à l'ancienne largeur incluant les manches. Le bras proche passe devant son emmanchure ; le bras éloigné reste derrière. Les attaches de dos sont placées sous les sangles pour éviter une ouverture au niveau de l'épaule pendant la course. La préparation des planches exige les trois bustes nettoyés et ne peut plus réutiliser silencieusement les anciens bustes à manches.

Les 45 rectangles des autres éléments restent identiques. Les déplacements, la foulée, les jambes, les collisions, les règles du jeu et les sauvegardes sont conservés. Les trois textures préparées totalisent 706 014 octets, sans ajout de texture chargée.

## Vérification ciblée

- Nouveau contrôle de `tests/miner-arm-layers.test.mjs` : ordre des bras et du buste, maintien des proportions dans les quatre directions.
- 576 dessins natifs avec mains vides, pioche et pelle, quatre directions et variantes de couleur : aucun élément opaque détaché. Inspection des bustes seuls et des personnages assemblés, comparaison animée avec la version 0.13.14.
- Captures avec le vrai moteur Canvas et ses ressources, dans une mine créée en mémoire. Il ne s'agit pas d'une session interactive Electron ou multijoueur Internet. Aucune sauvegarde réelle utilisée.

Les anciennes suites de tests n'ont pas été relancées.

Sources PNG, consignes exactes d'édition imagegen, comparaison animée et rapports conservés dans `outputs/Personnage-Bras-2026-10-21/` de l'espace de travail. Préparation : `node scripts/prepare-miner-rig.mjs <planches-originales> <bustes-sans-manches>` ; ce second dossier contient `torso-south.png`, `torso-east.png`, `torso-north.png`.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.15
