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

## Vérification officielle du 21/11/2026
- Documentation: https://developer.sumup.com/terminal-payments/sdks/android/setup/
- SDK lecteur officiel : `com.sumup:merchant-sdk:7.2.0`, dépôt `https://maven.sumup.com/releases`.
- Exigences SDK lecteur : minSdk 26, targetSdk 36, Android Gradle Plugin 9.2.1, Kotlin 2.4.0, Java 17.
- État actuel vérifié : `app/build.gradle` targetSdk 35 ; `MainActivity extends Activity` ; `settings.gradle` ne référence pas Maven SumUp.
- Le quickstart recommande une Activity `ComponentActivity` ou `AppCompatActivity` pour les contrats Activity Result. Vérifier les impacts sur la biométrie et WebView avant refonte.
- `applicationId` actuel : `be.montaxi.gestion.empreinte`. La clé d'affiliation doit correspondre exactement à cet identifiant ; vérifier le rattachement côté SumUp sans afficher la clé.
- Le SDK Tap to Pay Android est distinct et nécessite un accès Maven SumUp dédié ; ne pas mélanger les deux intégrations.
- La connexion Bluetooth de l'application SumUp officielle ne garantit pas une session déjà authentifiée dans le SDK intégré : prévoir connexion SDK et appairage si requis.
- Documentation : https://developer.sumup.com/terminal-payments/sdks/android/quickstart/
- Ne pas modifier la production ni lancer de paiement réel avant la vérification de la chaîne de build et des autorisations.
