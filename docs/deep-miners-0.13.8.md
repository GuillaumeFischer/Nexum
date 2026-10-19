# Deep Miners 0.13.8 — personnage stable dans le wagon

Les oscillations de respiration, de translation et de rotation du personnage continuaient à s'appliquer dans le wagon, même à l'arrêt. Elles étaient indépendantes du mouvement du véhicule et rendaient visible un mouvement périodique dans le siège.

Le mineur conserve désormais un ancrage constant dans son siège. Son animation de marche est suspendue et remise au repos à bord ; les anciennes animations d'outil ne changent plus sa posture. En descendant, la marche normale reprend. Aucun changement de vitesse, de collision, de réseau, de chargement ou de sauvegarde.

## Vérification ciblée

Trois nouveaux contrôles dans `tests/wagon-seat.test.mjs`, sans relancer les anciennes suites :

- Exécution de la vraie fonction de dessin du mineur avec un contexte Canvas qui enregistre les transformations et les images : posture identique pendant huit secondes, six places et quatre directions, wagon arrêté.
- Même contrôle en déplacement : ancrage constant, même avec d'anciens états d'utilisation d'outil, de minage ou d'action temporaire.
- Retour de l'animation de marche après la descente du wagon.

Ce contrôle vérifie les commandes du dessin, pas un enregistrement vidéo du client.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.8
