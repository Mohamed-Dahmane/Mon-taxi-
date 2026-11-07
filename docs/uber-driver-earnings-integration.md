# Uber chauffeur — intégration préparatoire (non activée)

Branche isolée de `main`. Aucun changement à l'application Chrome/Android ou aux recettes de production.

## État vérifié le 7 novembre 2026, 10 h (Bruxelles)
Projet Supabase `mon-taxi-v11` (`uenyvsiturkihectolxp`), état ACTIVE_HEALTHY.
Fonction `taxi-uber-oauth` active, version 2, `verify_jwt=false` (authentification utilisateur vérifiée uniquement sur la route POST /start).
Tables existantes : `taxi_uber_credentials`, `taxi_uber_oauth_states`, `taxi_uber_payments`, `taxi_uber_driver_earnings_staging`.
Comptages vérifiés : credentials 0, oauth_states 0, payments 0, staging 0.
La fonction OAuth ne récupère aucun paiement et utilise actuellement le scope `partner.payments`; l'accès Fleet Supplier et son autorisation doivent être confirmés. Aucun import réel ni lien avec « Appli ».

## Risques et corrections à traiter avant activation
1. Ne pas confondre le compte gestionnaire de flotte avec les gains d'un chauffeur précis. Vérifier la disponibilité et le scope officiel de l'endpoint Fleet Supplier « driver payments »; ne jamais extrapoler à partir des recettes globales.
2. L'URL de retour OAuth est construite sous la forme `/functions/v1/taxi-uber-oauth/callback`. Tester que le routage de la fonction accepte effectivement ce chemin avant toute invitation de connexion.
3. La route `/callback` supprime l'état OAuth après lecture. Rendre sa consommation atomique afin d'empêcher deux callbacks simultanés d'utiliser le même état.
4. Vérifier que `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET` et `UBER_TOKEN_ENCRYPTION_KEY` sont configurés sans afficher leur valeur; ne jamais stocker de secret côté navigateur ou GitHub.
5. Conserver les montants en centimes EUR, identifiant de transaction stable, ID chauffeur, date locale Europe/Brussels, statut et corrections. Appliquer un upsert idempotent; ne pas importer si identifiant stable absent.
6. Prévoir rafraîchissement du jeton, pagination, reprise et gestion des erreurs/rate limits; importer d'abord en lecture seule.
7. Ne jamais écraser les saisies manuelles « Appli » ni additionner automatiquement des gains déjà encodés. Rapprochement et validation avant activation.
8. Protéger les tables par RLS et accès serveur limité; vérifier les contraintes UNIQUE et politiques avant la première écriture.

## Critères d'acceptation
- Autorisation officielle Uber accordée et testée pour le chauffeur ciblé.
- Import réel de transactions avec rapprochement des montants et dates contre les relevés Uber.
- Deux exécutions identiques ne créent aucun doublon; corrections prises en compte.
- Aucune modification des données existantes; Chrome et Android restent synchronisés.
- Sauvegarde et procédure de retour arrière validées avant le raccordement à « Appli ».

Aucun accès Uber, revenu importé ou synchronisation automatique ne doit être annoncé sans preuve.
