# Deep Miners 0.13.9 — mouvements dynamiques

Marche plus vive, course plus penchée, léger accompagnement des épaules et changement de direction réactif. Les huit images existantes de chaque direction sont utilisées pour les mains vides, la pioche et la pelle ; aucun nouveau sprite n'est ajouté à cette version.

La cadence dépend de la distance réellement parcourue. La course tient compte du ralentissement causé par le sac, afin de rester reconnaissable lorsque le personnage est chargé. Les transformations pivotent autour des pieds ; la légère détente du corps revient à zéro aux phases d'appui. Le personnage cesse de courir sur place quand un obstacle bloque sa progression.

Les transformations sont entièrement neutres dans le wagon. Les vitesses physiques, les collisions, les outils disponibles, le réseau et les sauvegardes ne changent pas.

## Validation ciblée

Six nouveaux contrôles de `tests/dynamic-gait.test.mjs` réussis : marche/course et huit images, cadence à 30/60/144 images par seconde, sac chargé, arrêt contre un obstacle, changements de direction et neutralité à bord, application de la gestuelle par la vraie fonction de dessin pour les trois équipements. Les contrôles du dessin enregistrent les commandes Canvas ; ils ne constituent pas une observation vidéo. Aucune ancienne suite relancée.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.9
