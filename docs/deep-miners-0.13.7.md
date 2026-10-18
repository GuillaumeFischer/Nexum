# Deep Miners 0.13.7 — déplacement des wagons

Statut : publié sur GitHub le 18 octobre 2026, catalogue NEXUM mis à jour. L'installation locale reste en 0.13.6 ; installer la mise à jour depuis NEXUM.

Le conducteur était replacé directement à la position calculée depuis le dernier paquet réseau à chaque image, ce qui rendait visibles les variations de synchronisation. Un passager utilisait sa propre position autoritaire au lieu de l'interpolation réservée aux autres joueurs.

- Maintien de la prédiction du conducteur avec corrections progressives sur les rails.
- Interpolation des passagers, avec une position commune pour le wagon et ses occupants.
- Interpolation suivant les segments et les virages, pour les véhicules occupés ou automatiques vides.
- Réutilisation de l'index des rails lors des calculs de prédiction d'un même état réseau.
- Conservation des données actuelles du joueur et du chargement pendant le lissage.

Les grandes corrections de position, les changements de véhicule et les descentes conservent leur resynchronisation immédiate. La simulation autoritaire, les collisions, les vitesses, les itinéraires et les sauvegardes restent compatibles.

## Validation

Les sept nouveaux contrôles de `tests/wagon-motion.test.mjs` passent : conducteur soumis aux corrections réseau, passager entre les paquets, virage sans diagonale et reprise de simulation, wagon automatique vide, arrêt et descente, conservation des données affichées, simulation autoritaire avec deux occupants jusqu'à l'arrivée. Aucune ancienne suite relancée.

Le nouveau parcours `tests/wagon-motion-electron.mjs` est préparé pour vérifier E, la conduite, l'arrêt, le trajet automatique et la descente dans une mine de test isolée. Il n'a pas été validé sur cette session : Electron s'arrête au démarrage avec le code Windows 2147483651, avant la création du rapport. Aucun succès visuel n'est revendiqué.

Archive publique téléchargée intégralement et vérifiée : 48 142 611 octets, SHA256 `4626aa52cccfc4f93a366f05757b5b4a13402bff5f052db30867da9dbd97e3f7`. Catalogue distant identique au catalogue local. La dernière version du launcher reste 1.1.2. Aucun profil ni sauvegarde réelle n'a été modifié pour cette livraison.

Publication : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.7
