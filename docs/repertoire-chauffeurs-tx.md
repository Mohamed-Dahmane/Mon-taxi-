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
