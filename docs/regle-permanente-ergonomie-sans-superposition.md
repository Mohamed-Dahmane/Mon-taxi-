# Règle permanente — ergonomie sans superposition (Mon Taxi Pro)

## Principe non négociable
Aucun bouton, menu à trois barres, menu déroulant, panneau, dialogue, clavier, barre de navigation, notification ou commande flottante ne doit masquer, recouvrir, rendre inaccessible ou intercepter le toucher d'une autre commande utile. Cette règle vaut pour **tous les écrans et toutes les fonctions**, pas uniquement l'accueil.

## Application systématique
- Privilégier le flux normal de mise en page (flex/grid avec retour à la ligne), des espaces tactiles suffisants et des dimensions adaptatives ; éviter `position: fixed`/`absolute` et les `z-index` élevés pour les commandes ordinaires.
- Si l'espace manque, réorganiser les boutons en lignes ou dans un menu accessible, sans supprimer de fonctionnalité ni masquer un accès essentiel.
- Le bouton « Menu » de l'accueil doit rester compact, lisible, avec une cible tactile confortable, et ne pas flotter au-dessus des autres boutons ; conserver les rubriques existantes.
- Les véritables fenêtres modales peuvent recouvrir le fond **uniquement de manière intentionnelle**, avec fermeture et retour accessibles, gestion correcte du focus et sans bloquer une action requise dans la fenêtre.
- Contrôler l'écran externe étroit et l'écran interne du Samsung Galaxy Z Fold 8, les changements de taille/orientation, le clavier ouvert, le défilement et les zones sûres.
- Un bouton visible mais non cliquable est un défaut bloquant. Les tests doivent détecter chevauchements réels, interceptions de clic et éléments hors écran, sans confondre deux chemins légitimes vers une même fonction avec un doublon fonctionnel.

## Méthode avant toute modification
1. Consulter les anciens incidents, corrections et branches GitHub concernant menus, superpositions et Fold avant de réinventer une solution.
2. Examiner globalement les écrans, menus et dépendances avant de modifier des éléments isolés.
3. Corriger sur une branche de travail, jamais sur l'APK stable de référence.
4. Après une correction cohérente, exécuter une campagne de tests couvrant les tailles d'écran et les parcours critiques ; ne pas relancer une compilation à chaque retouche.
5. Documenter la cause, la correction et le test de non-régression pour que le même problème ne revienne pas.

**Statut : règle de conception documentée ; sa présence dans ce fichier ne signifie pas que l'interface a déjà été corrigée ou testée.**
