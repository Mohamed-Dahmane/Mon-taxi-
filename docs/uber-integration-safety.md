# Uber chauffeur — critères de mise en production (7 novembre 2026)

État vérifié dans Supabase `mon-taxi-v11` : fonction `taxi-uber-oauth` déployée, mais aucune ligne dans `taxi_uber_credentials`, `taxi_uber_payments` ni `taxi_uber_driver_earnings_staging`. **Aucune synchronisation de gains Uber confirmée.**

## Garde-fous
- Ne jamais écrire dans les montants saisis manuellement ni dans les sauvegardes `taxi_management_backups` pendant les essais.
- Aucun jeton Uber dans le navigateur, le dépôt, les logs ou les notifications. Secrets uniquement côté serveur.
- L'autorisation OAuth `partner.payments` doit être officiellement accordée au compte et au produit Uber concernés ; ne pas déduire l'autorisation de la simple connexion à Uber.
- Vérifier le statut d'accès Uber Fleet Supplier / accès flotte avant d'utiliser les endpoints Fleet. En cas d'indisponibilité, rechercher une exportation autorisée par Uber, sans scraping ni détournement d'identifiants.
- Import idempotent par `(user_id,payment_id)` dans `taxi_uber_payments` et `(source,external_payment_id)` dans le staging. Traiter les corrections et remboursements sans doubler les courses.
- Comparer chaque jour les totaux Uber aux données du chauffeur et distinguer paiements, courses, cash collecté, commissions et net.
- Conserver la rubrique « Appli » manuelle jusqu'à rapprochement prouvé ; ne pas additionner automatiquement la même course importée et saisie.
- Tester l'actualisation Chrome/Android et le retour arrière sur copie avant tout basculement.

## Points bloquants observés
1. Aucune autorisation Uber enregistrée dans `taxi_uber_credentials`.
2. Aucun paiement Uber reçu dans les deux tables de staging / production.
3. L'Edge Function OAuth actuelle fournit le début et le callback, pas encore une synchronisation de paiements prouvée.

**Cette branche n'altère ni l'application publiée ni la base de données.**
