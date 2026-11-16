# Sauvegarde automatique OneDrive — Mon Taxi

## État
Préparation technique. **Non activé** : aucun consentement OAuth ni envoi OneDrive n'a encore été effectué.

## Existant vérifié
- `index.html` propose déjà `export`, `importBtn` et `importFile` avec format `gestion-taxi-test-v3`.
- Le menu ☰ a des raccourcis vers ces fonctions.
- Les données taxi sont conservées localement et une synchronisation Supabase est présente.
- Le client Android expose `TaxiDownload` pour l'export manuel.

## Architecture cible
1. Enregistrer une application Microsoft Entra prenant en charge les **comptes Microsoft personnels** (et, si utile, professionnels). Ne pas utiliser le portail Entra comme écran de connexion de l'utilisateur final.
2. Utiliser OAuth 2.0 authorization code + PKCE, sans secret client dans JavaScript ou APK. Consentement limité à `Files.ReadWrite.AppFolder` si compatible avec le scénario et les comptes visés; sinon réévaluer la portée minimale requise. Prévoir `offline_access` uniquement si nécessaire à une sauvegarde en arrière-plan.
3. Conserver les jetons de renouvellement côté serveur sécurisé, pas dans `localStorage` ni dans GitHub. Associer l'identité Microsoft à l'utilisateur authentifié Mon Taxi, avec possibilité de déconnexion et révocation.
4. Déclencher une sauvegarde quotidienne **côté serveur** depuis un snapshot Supabase validé, pas uniquement via minuterie JavaScript (Chrome peut être fermé et Android suspendu).
5. Sauvegarder des fichiers JSON datés dans le dossier applicatif OneDrive; vérifier l'upload, conserver les 30 versions les plus récentes, supprimer les anciennes uniquement après confirmation de réussite d'une nouvelle sauvegarde.
6. Éviter les sauvegardes vides ou manifestement anormales; inclure version de format, horodatage, taille et empreinte SHA-256; tester une restauration sur données isolées avant toute activation.
7. Interface Mon Taxi : état connecté/déconnecté, dernière sauvegarde confirmée, erreur éventuelle, bouton « Sauvegarder maintenant » et déconnexion. Aucun écrasement automatique des données taxi.

## Dépendances bloquantes
- ID client (application Microsoft) et redirect URI correctement enregistrés pour le site Chrome et le flux Android.
- Backend sécurisé permettant de gérer les jetons et la planification, avec secrets configurés hors dépôt.
- Consentement explicite du propriétaire lors de la première connexion Microsoft.
- Test de bout en bout sur compte personnel : création, lecture, rotation, échec réseau, restauration isolée.

## Sécurité et déploiement
Ne pas déployer une fausse connexion OneDrive ni afficher « sauvegarde réussie » sans confirmation Microsoft Graph. Ne pas modifier les données métier existantes. Valider la sauvegarde initiale et le flux de restauration avant activation quotidienne.
