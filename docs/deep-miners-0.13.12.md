# Deep Miners 0.13.12 — découpage du personnage corrigé

Les images sources n'étaient pas disposées sur une grille exacte : certaines pioches et pelles dépassaient la limite théorique d'une case. Le découpage de la 0.13.11 tronquait l'outil et attribuait son extrémité à la pose voisine, d'où les morceaux flottant à côté du personnage. Le premier contrôle des marges ne détectait pas ces morceaux, puisqu'ils étaient à l'intérieur des cases.

Les 180 poses sont maintenant extraites à partir de leur silhouette complète, outil compris, dans les sources originales. Une attribution par silhouette exclut les pixels de la pose voisine même lorsque les rectangles se chevauchent. Le contour adouci est conservé. Les tailles et ancrages précédents sont maintenus exactement. Aucun nouveau dessin n'a été généré et le code du mouvement n'est pas modifié.

## Vérification ciblée

- Trois nouveaux tests de `tests/sprite-extraction.test.mjs` : outils dépassant l'ancienne case, rectangles qui se chevauchent, contour adouci sans fragments éloignés et refus d'un nombre incorrect de silhouettes.
- Contrôle des 180 poses réellement encodées : 43 poses contenaient des fragments séparés avant le correctif ; aucune après (zéro pixel opaque dans un fragment séparé d'au moins quatre pixels).
- Les 180 rectangles complets tiennent dans les nouvelles cases : marge minimale projetée de 14,31 pixels ; tailles et points d'ancrage identiques aux valeurs de la 0.13.11.
- Planches de contact produites pour les huit animations, avec comparaison avant/après des vues de dos à la pioche.
- Le contrôle graphique `scripts/verify-miner-art.mjs` vérifie désormais également l'absence de fragments séparés. Les anciennes suites n'ont pas été relancées.

Extraction reproductible : fournir les PNG originaux et leur fichier `packed-measurements.json` à `scripts/repair-miner-atlases.mjs <dossier-source> <dossier-assets> [dossier-rapport]`, avec `@napi-rs/canvas` disponible via `CANVAS_MODULE_ROOT`. Les scripts de préparation sont hors du jeu distribué. Huit planches finales : 1 513 964 octets.

Physique, collisions, réseau, profil et sauvegardes inchangés. Mise à jour à installer via NEXUM puis relancer le jeu.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.12
