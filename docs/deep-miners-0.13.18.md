# Deep Miners 0.13.18 — essai du mineur D industriel stylisé

À la demande du joueur, la proposition D remplace le personnage pixel art : mineur barbu, casque rouge terracotta, veste ardoise, pantalon anthracite, gants clairs et bottes sombres. Le dessin conserve des formes simples et un ombrage lisse en aplats. Les trois vues dessinées sont face, profil droit et dos ; le profil gauche est reflété.

Les mouvements utilisent des silhouettes complètes et un cycle court en quatre temps, avec une pose de passage commune de profil. La cadence suit la distance parcourue et le repos revient à l'arrêt. Les gestes de pioche et de pelle ont trois poses complètes chacun ; l'outil porté suit le gant hors des gestes. Le wagon utilise une pose assise fixe. Les six couleurs de casque et le traitement du personnage décédé sont conservés.

La préparation extrait les silhouettes complètes des nouvelles planches transparentes, harmonise l'échelle autour d'une hauteur de 72 pixels au repos et enregistre les semelles sur le sol. Les ombres de contact sont atténuées pour le pied levé. Les membres sont déjà dessinés dans chaque pose.

Deux textures WebP sont chargées pour ce personnage et ses outils : 250 018 octets. Le chargement total reste de 25 ressources. Le pixel art reste archivé dans les sources et dans la version 0.13.17. Les vitesses, commandes, collisions, règles, réseau et sauvegardes sont conservés.

## Vérification ciblée

- Trois nouveaux tests de `tests/industrial-miner.test.mjs` : cycle/repos/miroir, gestes et wagon, silhouette complète et lissage du dessin.
- 36 cases vérifiées sans découpe ni fragment détaché ; marge minimale de 17 pixels.
- Douze cycles de marche, avec mains vides/pioche/pelle dans les quatre directions ; 32 échantillons d'outil porté vérifiés.
- Six couleurs distinctes, 96 vérifications de posture assise stable, cache de 180 variantes colorées limité à 256 et libérable.
- Vrai moteur Canvas exécuté avec ses ressources et une mine créée en mémoire : captures de face, de profil, de dos et de six occupants du wagon. Seules les nouvelles textures D sont chargées pour le personnage.

Les anciennes suites n'ont pas été relancées. Ces contrôles utilisent le Canvas natif, sans session interactive Electron ou multijoueur Internet. Aucune sauvegarde réelle utilisée ou modifiée.

Sources et prompts imagegen exacts, aperçu animé et rapports : `outputs/Personnage-Industriel-D-2026-10-21/` de l'espace de travail. Préparation : `node scripts/prepare-industrial-miner.mjs <dossier-source>` ; contrôle graphique optionnel : `node scripts/verify-industrial-miner.mjs <dossier-rapport>`, avec le module Canvas natif configuré comme pour les autres outils graphiques du projet.

Distribution : https://github.com/GuillaumeFischer/Nexum/releases/tag/game-deep-miners-v0.13.18
