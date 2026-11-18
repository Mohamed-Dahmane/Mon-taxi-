# Répertoire Chauffeurs TX — spécification de développement (18/11/2026)

## Interface
- Ajouter le bouton « Chauffeurs » en haut à droite de l'accueil sans déplacer le menu ni le bouton d'actualisation.
- Ouvrir deux catégories : « Petite voiture » et « Van ».
- Fiche chauffeur : nom, numéro, catégorie, Appeler, SMS, Modifier, Supprimer.
- Déplacement entre catégories dans les deux sens, et modification du nom et du numéro.
- Confirmation avant suppression ou modification du contact Samsung.
- Ne pas fusionner automatiquement avec les listes d'hôtels ou les contacts d'attribution DoubleTree / The Standard.

## Import et classement
- Noms commençant par « TX Van » (insensible à la casse, espaces normalisés) => Van.
- Autres noms commençant par « TX » => Petite voiture.
- Préserver le numéro et l'identifiant natif du contact.
- Réimporter sans doublons et conserver les reclassements manuels jusqu'à synchronisation explicitement validée.
- Ne jamais effacer silencieusement un chauffeur local parce que le contact téléphone est inaccessible.

## Android / Chrome
- Android : implémenter une passerelle native Capacitor/Android Contacts avec permissions READ_CONTACTS et WRITE_CONTACTS demandées à l'utilisation ; vérification du manifeste, de la compatibilité du plugin et de l'APK avant livraison.
- Chrome/PWA : accès au répertoire complet non garanti ; proposer import explicite compatible (sélection de contacts lorsque disponible, ou fichier vCard), gestion locale et export. Ne pas annoncer une synchronisation Samsung automatique depuis Chrome.
- La mise à jour du contact natif n'a lieu qu'après autorisation et confirmation ; si refus, conserver la modification uniquement dans Mon Taxi et afficher cet état.
- Sauvegarder l'association contact-id / fiche chauffeur et éviter les collisions, doublons et modifications du mauvais contact.
- Supprimer dans Mon Taxi et, sur demande explicite séparée, supprimer le contact Samsung ; prévoir sauvegarde préalable.

## Validation avant production
- Tests : import TX/TX Van, numéro modifié, reclassement aller-retour, suppression locale / téléphone, refus de permissions, absence de doublons, reprise après fermeture, écran étroit Galaxy Fold, non-régression planning/réservations.
- Déploiement Chrome puis compilation APK et vérification réelle ; ne déclarer « fait » qu'après ces vérifications.

## Appels et SMS depuis le répertoire et le Planning
- Sur chaque fiche chauffeur, bouton Appeler : ouvrir le composeur téléphonique avec le numéro sélectionné (tel:), sans lancer un appel silencieux.
- Bouton SMS : choix « Depuis une réservation », « Depuis une course directe / Planning », « Message libre ».
- Depuis une course existante, action « Envoyer au chauffeur » qui ouvre le répertoire, conserve l'identifiant de course et permet de sélectionner un ou plusieurs chauffeurs selon les affectations.
- Générer le SMS à partir des données réelles de la course : date, heure, départ, destination, client, téléphone, véhicules, vol/train et remarques pertinentes ; ne pas inventer les champs absents.
- Prévisualisation et édition du texte avant l'ouverture de l'application SMS du téléphone (sms:), avec confirmation finale par l'utilisateur ; ne pas envoyer automatiquement.
- Les contacts de DoubleTree et The Standard qui sont des contacts d'attribution ne deviennent pas des chauffeurs par cette fonctionnalité.
- Tests Android et Chrome pour liens tel:/sms:, encodage Unicode, numéros internationaux et permissions ; ne pas déclarer l'envoi effectué avant confirmation par le système SMS.

## Chauffeurs sans préfixe TX — ajout volontaire
- Bouton « Importer un chauffeur » : l'utilisateur choisit explicitement un contact Samsung, même sans préfixe TX, puis sélectionne Petite voiture ou Van.
- Bouton « Ajouter manuellement » : nom, numéro et catégorie, sans contact natif obligatoire.
- Conserver le nom natif du contact sans TX ; ne pas le préfixer automatiquement lors de l'import ni lors d'un changement de catégorie.
- Distinguer la source et la catégorie de la fiche chauffeur (TX auto, contact choisi, saisie manuelle) ; préserver ce choix après actualisation des contacts TX.
- Éviter les doublons par identifiant natif, et proposer confirmation en cas de même numéro.
- Les fiches sans TX bénéficient aussi d'Appeler, SMS réservation/course/message libre, Modifier et Supprimer.
