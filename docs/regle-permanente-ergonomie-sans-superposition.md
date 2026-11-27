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


## Règle obligatoire — clavier Samsung et champs de saisie
- Lorsqu'un clavier Samsung apparaît (texte, chiffres, heure, nom d'hôtel, nom de contact, téléphone, remarque ou toute autre saisie), **le champ actif, son libellé et les commandes nécessaires pour valider ou poursuivre doivent rester visibles et accessibles**, jamais masqués sous le clavier.
- L'écran, la fenêtre ou le formulaire doit pouvoir se redimensionner et défiler jusqu'au champ actif avec une marge confortable au-dessus du clavier, y compris dans les dialogues, listes, menus déroulants et formulaires à étapes.
- Gérer les variations de hauteur du clavier Samsung, le mode clavier flottant ou partagé, l'ouverture/fermeture du clavier, le changement d'orientation et les écrans extérieur/intérieur du Galaxy Z Fold 8. Éviter les hauteurs fixes qui emprisonnent la saisie.
- Au focus, amener le champ à l'écran sans sauts intempestifs ni perte du contenu saisi ; permettre de fermer le clavier ou de passer au champ suivant sans bloquer l'interface.
- **Test de non-régression obligatoire :** saisir un hôtel, un contact, une heure et un champ numérique sur écran externe et interne, avec clavier Samsung ouvert ; vérifier que le curseur, le champ et l'action de validation restent utilisables. Aucun correctif ne peut être considéré validé sans ce contrôle.


## Règle obligatoire — touche Retour système Samsung / Android
- Dans Mon Taxi Pro (y compris les modules et fenêtres internes), la touche ou le geste **Retour** du système Samsung/Android doit revenir **d'une seule étape dans l'historique de navigation interne** : sous-écran → écran parent → accueil, sans saut direct à l'accueil depuis un sous-écran profond.
- Si un menu, une liste déroulante, une fenêtre modale ou un clavier est ouvert, Retour ferme d'abord cet élément au premier appui, en préservant la page et les données saisies. L'appui suivant revient à l'étape précédente.
- La touche Retour ne doit **jamais quitter, fermer, redémarrer ou réinitialiser l'application** tant qu'un retour interne est possible. Ne pas vider l'historique ni perdre les champs en cours de saisie.
- Sur l'écran d'accueil, où aucune page interne précédente n'existe, prévoir un comportement explicite et sûr, distinct de la navigation interne ; éviter toute fermeture accidentelle.
- Harmoniser le comportement de la touche système avec les éventuelles flèches Retour de l'interface, dans Chrome/WebView et l'APK Android ; tenir compte du bouton physique/virtuel et du geste Retour.
- **Tests de non-régression :** parcourir au moins trois niveaux de pages, ouvrir puis fermer clavier/menu/dialogue avec Retour, revenir niveau par niveau jusqu'à l'accueil, vérifier qu'aucune étape ne ferme l'APK ni ne réinitialise une saisie. Tester sur les deux écrans du Galaxy Z Fold 8.


## Règle fonctionnelle — Planning : courses restantes et tri chronologique
- Le Planning ne montre **que les courses restant à effectuer** (statut actif/en attente). Les courses validées « Effectuée », « Fausse course », annulées ou archivées ne doivent plus apparaître dans cette liste ; elles restent accessibles dans l'Historique selon leurs règles de conservation.
- **Tri par défaut : ordre chronologique croissant de la date et de l'heure prévues**. La prochaine course prévue est en haut, puis les suivantes : 05 h 30 → 08 h 00 → 09 h 00. Utiliser la date complète, pas seulement l'heure, pour gérer plusieurs journées ; ne pas éliminer une course encore à effectuer simplement parce que son heure est passée.
- Le bouton existant à deux flèches ne fait **plus aucun tri alphabétique** : il inverse uniquement l'ordre chronologique de la liste (plus ancienne/prochaine d'abord ↔ plus tardive d'abord). Adapter son libellé accessible et son indication d'état au tri par date/heure.
- Quand l'utilisateur entre dans une fiche puis revient en arrière dans le Planning, **conserver exactement le sens de tri et la position de consultation** tant qu'il reste dans la session de navigation.
- Après une véritable sortie/fermeture de l'application puis une nouvelle ouverture, **réinitialiser le sens de tri au chronologique croissant**, prochaine course en tête. Ne pas réinitialiser ce choix sur un simple retour arrière, changement de page ou ouverture/fermeture du clavier.
- Ne pas modifier les statuts, dates, heures, attributions ni données de course pour réaliser ce tri. Si une course est modifiée, recalculer sa position sans la dupliquer.
- Tests de non-régression : courses à 05 h 30, 08 h 00 et 09 h 00 ; inversion et retour arrière ; passage à une autre page ; sortie et réouverture ; plusieurs dates ; courses déjà effectuées/fausses/annulées ; course encore active dont l'heure est dépassée.

## Méthode avant toute modification
1. Consulter les anciens incidents, corrections et branches GitHub concernant menus, superpositions et Fold avant de réinventer une solution.
2. Examiner globalement les écrans, menus et dépendances avant de modifier des éléments isolés.
3. Corriger sur une branche de travail, jamais sur l'APK stable de référence.
4. Après une correction cohérente, exécuter une campagne de tests couvrant les tailles d'écran et les parcours critiques ; ne pas relancer une compilation à chaque retouche.
5. Documenter la cause, la correction et le test de non-régression pour que le même problème ne revienne pas.

**Statut : règle de conception documentée ; sa présence dans ce fichier ne signifie pas que l'interface a déjà été corrigée ou testée.**
