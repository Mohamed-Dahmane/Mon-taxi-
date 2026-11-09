# Uber → Appli : contrôle SQL en lecture seule (2026-11-09)

État : **revue uniquement**. Ne déclenche ni import, ni écriture, ni modification de recette.

Le 09/11/2026, interrogation directe du projet Supabase `mon-taxi-v11` : les tables réelles sont `taxi_uber_credentials`, `taxi_uber_oauth_states`, `taxi_uber_driver_earnings_staging`, `taxi_uber_payments`. Les quatre comptages étaient à **0**. Attention : `taxi_uber_earnings_staging` **n'existe pas** ; utiliser le nom complet `taxi_uber_driver_earnings_staging` dans les contrôles. Ne jamais afficher le contenu de la table credentials.

```sql
-- Lecture seule ; aucun secret retourné.
select 'credentials' as item,count(*) as n from public.taxi_uber_credentials
union all select 'oauth',count(*) from public.taxi_uber_oauth_states
union all select 'staging',count(*) from public.taxi_uber_driver_earnings_staging
union all select 'payments',count(*) from public.taxi_uber_payments;
```

Avant tout import : vérifier l'autorisation officielle Fleet Supplier et le lien chauffeur/flotte/utilisateur côté serveur ; sauvegarder et **tester une restauration hors production** ; résoudre la contrainte unique non scoped par chauffeur et les colonnes manquantes de staging ; assurer un upsert transactionnel idempotent et un journal d'audit. Ne jamais additionner un gain importé à une journée « Appli » déjà saisie manuellement sans rapprochement explicite. Ne pas écrire de jeton dans GitHub ou les journaux. Les 13 tests existants n'ont pas été exécutés lors de ce contrôle. Aucune synchronisation Uber confirmée.
