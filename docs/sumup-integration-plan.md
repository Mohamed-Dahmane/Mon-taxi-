# Intégration SumUp — Mon Taxi (branche de test)

## Objectif et ordre
1. Encaissement depuis l'APK avec Solo Lite Bluetooth.
2. Paiement sans contact sur le Samsung (Tap to Pay), si SDK/appareil/compte éligibles.
3. Création et partage de liens de paiement via backend sécurisé.

## Architecture existante vérifiée
- Android natif Java : app/src/main/java/be/montaxi/gestion/MainActivity.java, WebView de la page GitHub Pages.
- Gradle : app/build.gradle ; minSdk 26, targetSdk 35.
- Supabase : projet mon-taxi-v11, fonction taxi-sumup-sync v15 (service-role, JWT requis).
- Interface web : index.html lit taxi_sumup_transactions par transaction_id ; frais SumUp 1,69 %.

## Contraintes non négociables
- Ne pas changer main ni déployer sur GitHub Pages avant tests.
- Ne jamais stocker de clé secrète SumUp dans index.html, JavaScript client ou APK.
- Distinguer clé d'affiliation SDK (lecteur Android) et clé API serveur (liens/synchronisation).
- SDK Android SumUp : confirmer la version officielle, la compatibilité Solo Lite et le flux d'authentification avant ajout de dépendances.
- Utiliser un pont JavaScript WebView limité aux origines autorisées, sans exposer de secrets, avec validation du montant et protections contre doubles clics.
- Pas d'enregistrement de recette tant que le paiement n'est pas confirmé.
- Synchronisation existante = source de vérité pour les transactions SumUp, sans double comptage. Identifiant transaction_id unique ; upsert idempotent ; états remboursé/annulé à traiter.
- Les frais de 1,69 % ne sont déduits qu'une fois.
- Sauvegarder les données avant toute migration ; tester sur version de test distincte et APK signée compatible.

## Étapes à réaliser
- Vérifier la documentation officielle SumUp Android SDK et les prérequis pour Solo Lite.
- Examiner le pont JavaScript et les écrans d'encaissement existants.
- Implémenter SDK et UI sur cette branche seulement.
- Tester compilation, authentification, paiement de faible montant, annulation, échec et synchronisation retardée.
- Valider l'absence de doublons après synchronisation et la stabilité de l'APK.
- Ensuite seulement proposer installation.

## État
Branche de test créée. Aucune intégration SDK ni APK compilée à ce stade.
