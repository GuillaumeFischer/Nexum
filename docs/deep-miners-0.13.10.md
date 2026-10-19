# Deep Miners 0.13.10 — déplacements plus réactifs

Référence : extrait local fourni le 19 octobre 2026, `Desktop 2026.10.19 - 17.59.24.01.mp4`, d'une durée de 3,85 secondes. Il montre essentiellement un déplacement vers le haut, avec des pas courts, un corps compact et une caméra suivant de près. Les touches n'étant pas visibles, cet extrait ne permet pas de mesurer un délai de réponse aux commandes.

- La première pose de pas apparaît dès le premier déplacement observé, au lieu de commencer sur une image proche du repos.
- Arrêt de l'animation sur l'image de l'arrêt réel, sans pas de stabilisation supplémentaire.
- Orientation et inclinaison changent ensemble lors d'un demi-tour, sans recommencer le cycle de marche.
- Foulée raccourcie, balancement et déformation du corps réduits, légère inclinaison de course conservée.
- Caméra plus proche : suivi exponentiel à 30/s au lieu de 16/s, indépendant du débit d'images et avec resynchronisation après téléportation.

Les sprites actuels et les trois équipements sont conservés. Le personnage reste neutre dans le wagon. Les vitesses physiques, les collisions, les règles des outils, la synchronisation réseau et les sauvegardes ne changent pas.

## Vérification

Six nouveaux contrôles de `tests/reactive-motion.test.mjs` réussis : premier pas, arrêt/obstacle, demi-tour, stabilité du corps et du wagon, suivi de caméra à 30/60/144 images/s et téléportation, vraie fonction de dessin pour les trois équipements. Aucun ancien test relancé. Les tests de dessin enregistrent les commandes Canvas ; ils ne constituent pas une observation vidéo du nouveau client.

La vidéo a été décodée localement ; elle n'a pas été transmise à un service externe.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.10
