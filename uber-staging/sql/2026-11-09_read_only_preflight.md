# Uber staging — preflight en lecture seule (2026-11-09)

Ce contrôle ne connecte pas Uber, ne déploie rien et n'écrit aucune recette. Exécuter séparément les requêtes suivantes dans Supabase avant toute migration.

```sql
-- Etat de l'import (ne retourne aucun montant ni secret)
SELECT 'credentials' AS category, count(*) AS rows FROM public.taxi_uber_credentials
UNION ALL SELECT 'oauth', count(*) FROM public.taxi_uber_oauth_states
UNION ALL SELECT 'staging', count(*) FROM public.taxi_uber_driver_earnings_staging
UNION ALL SELECT 'payments', count(*) FROM public.taxi_uber_payments;

-- Index d'unicité réellement en vigueur
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='taxi_uber_driver_earnings_staging'
ORDER BY indexname;

-- Détecter d'éventuelles collisions avant de modifier la contrainte
SELECT source, external_payment_id, count(*) AS n,
       count(DISTINCT driver_external_id) AS drivers
FROM public.taxi_uber_driver_earnings_staging
GROUP BY source, external_payment_id
HAVING count(*) > 1 OR count(DISTINCT driver_external_id) > 1;
```

Observation au 2026-11-09 : quatre tables vides ; index actuel `taxi_uber_source_id_unique(source, external_payment_id)`. Le normaliseur identifie pourtant les événements par `source + driverId + externalEventId`. L'index proposé dans `2026-11-09_driver_scoped_uniqueness_REVIEW_ONLY.sql` **ne suffit pas** tant que l'ancien index subsiste. Ne pas le déployer isolément.

**Conditions préalables à tout import :** autorisation officielle Uber Fleet Supplier et preuve d'appartenance chauffeur/flotte ; contrat d'identifiants stables et distincts pour courses/ajustements ; mapping serveur `user_id` ↔ `driver_external_id` ; contrôle des accès service-role ; tests transactionnels des collisions et rejouements ; stratégie explicite de rapprochement avec la saisie manuelle « Appli » et sauvegarde vérifiée. Ne jamais additionner automatiquement un import à une journée déjà saisie sans rapprochement.

Alternative autorisée si Fleet Supplier indisponible : export de relevés de gains depuis le compte Uber du chauffeur, import explicite après validation du format et des droits. Aucun scraping, partage de mot de passe ni API non autorisée.
