# Deep Miners 0.13.14 — mouvements continus du mineur

Le déplacement passait entre huit poses illustrées différentes. Les changements de proportions et de hauteur d'appui entre ces images provoquaient des sauts visibles, même avec une cadence plus rapide. Le rendu à pied utilise désormais les membres articulés d'un même modèle illustré.

Trois nouvelles planches transparentes reprennent le mineur validé : casque et veste jaunes, foulard sombre, sac, gants, genouillères et bottes. Chaque planche contient 16 éléments, dont une référence complète ; les 45 autres éléments servent au corps et aux outils dans les trois vues dessinées. Le profil gauche est obtenu par miroir. Les sources sont préparées par `scripts/prepare-miner-rig.mjs`, et les joints sont déclarés dans `client/miner-rig-layout.js`.

L'animation calcule les positions des membres à chaque image : alternance des appuis, flexion des genoux, relèvement et rotation des bottes, balancement opposé des bras, accompagnement du buste et de la tête. La cadence suit toujours la distance parcourue. L'amplitude de la course et le retour au repos évoluent progressivement ; la phase est conservée pendant les demi-tours. Ces transitions concernent la pose et n'ajoutent aucun délai aux commandes de déplacement.

La pioche et la pelle sont attachées à la main et accompagnent les gestes de travail. Les ombres diffuses et de contact suivent les pieds ; le pied relevé projette un contact atténué. La posture assise du wagon conserve exactement son ancien dessin. Les vitesses, collisions, règles des outils, réseau et sauvegardes ne changent pas.

Les trois planches ajoutent 699 378 octets. Les anciennes planches de marche/course ne sont plus chargées : 27 ressources au démarrage contre 31 auparavant, avec uniquement l'ancienne planche de repos pour le wagon et les personnages décédés. Les couleurs des six joueurs sont conservées dans un cache de composants limité à 240 entrées.

## Vérification ciblée

- Huit nouveaux contrôles de `tests/continuous-miner.test.mjs` : continuité de la boucle et de l'ombre, alternance des appuis, départ et arrêt sans modification de position, marche/course et miroir, cadence à 30/60/144 images/s, 96 transformations de dessin distinctes par cycle, conservation de la posture assise et repli sûr lors du décès.
- Comparaison native de 24 cycles (quatre directions, trois équipements, marche/course) : 96 images distinctes par cycle contre huit auparavant. La variation maximale entre deux images est inférieure à un quart de l'ancien maximum dans chaque comparaison. Cette mesure porte sur les pixels du test, pas sur la fréquence d'affichage du jeu.
- 2 304 rendus vérifiés sans fragment séparé. La posture assise est identique pixel par pixel dans les quatre directions et les six couleurs (24 comparaisons).
- Vrai moteur du jeu exécuté avec ses ressources et une mine en mémoire : rendu mains vides, pioche et pelle, captures et aperçu animé avant/après. Les anciennes planches de marche/course ne sont pas chargées.
- Dessin de six joueurs après préparation du cache : 0,60 ms au 95e percentile sur le Canvas natif local, cache de 195 entrées. Ce contrôle ne constitue pas une mesure de performance dans la fenêtre du joueur.

Les anciennes suites n'ont pas été relancées. Les contrôles graphiques utilisent un Canvas natif ; aucune partie interactive Electron ou multijoueur Internet n'est revendiquée. Aucune sauvegarde réelle n'a été utilisée ou modifiée.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.14
