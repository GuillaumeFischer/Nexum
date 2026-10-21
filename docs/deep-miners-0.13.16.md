# Deep Miners 0.13.16 — orientation des pieds

De face, les deux bottes étaient affectées aux jambes opposées : leurs pointes se tournaient vers le centre du personnage. L'attribution des bottes est corrigée. De dos, les deux dessins de bottes présentaient la même orientation ; la botte droite est maintenant reflétée pour conserver une ouverture symétrique.

Le déroulé talon-pointe s'applique au profil. Les vues de face et de dos conservent une orientation stable des pointes, sans transformer ce déroulé en rotation latérale des bottes ou déplacement latéral des chevilles. Les pieds continuent de se lever et d'alterner leurs appuis pendant la marche et la course.

Les dessins existants sont réutilisés. Les vitesses, les commandes, les collisions et les sauvegardes sont conservées.

## Vérification ciblée

- Deux nouveaux contrôles de `tests/miner-foot-direction.test.mjs` : stabilité des chevilles de face et de dos sur toute la foulée, et conservation du déroulé en profil.
- Mesure de l'orientation dans les vrais appels de dessin des bottes : pointes orientées vers l'extérieur des deux côtés, de face et de dos.
- 384 rendus natifs dans les quatre directions, marche et course : aucun fragment opaque détaché. Les 192 rendus de profil sont identiques pixel par pixel à la version 0.13.15.
- Comparaison animée avec le rendu précédent et inspection de la position des pieds. Les anciennes suites n'ont pas été relancées. Ces contrôles utilisent le Canvas natif et ne constituent pas une session interactive Electron ou multijoueur Internet.

Captures, comparaison et rapport : `outputs/Personnage-Pieds-2026-10-21/` de l'espace de travail. Aucune sauvegarde réelle utilisée.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.16
