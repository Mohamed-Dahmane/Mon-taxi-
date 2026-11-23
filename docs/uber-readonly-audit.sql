-- Audit en lecture seule : aucun changement de données ou de schéma.
-- Exécuter sur Supabase avant toute tentative d'import Uber.
select 'taxi_uber_credentials' as objet, count(*) as lignes from public.taxi_uber_credentials
union all select 'taxi_uber_oauth_states', count(*) from public.taxi_uber_oauth_states
union all select 'taxi_uber_payments', count(*) from public.taxi_uber_payments
union all select 'taxi_uber_driver_earnings_staging', count(*) from public.taxi_uber_driver_earnings_staging
union all select 'taxi_management_backups', count(*) from public.taxi_management_backups;
-- Détecte les doublons potentiels dans le staging sans exposer le contenu des courses.
select source, count(*) as groupes_doublons, sum(n)-count(*) as lignes_excedentaires
from (
 select source, driver_external_id, external_payment_id, count(*) n
 from public.taxi_uber_driver_earnings_staging
 where external_payment_id is not null
 group by source, driver_external_id, external_payment_id having count(*)>1
) d group by source;
-- Détecte les collisions d'identifiant de paiement par utilisateur.
select count(*) as groupes_doublons from (
 select user_id,payment_id from public.taxi_uber_payments
 group by user_id,payment_id having count(*)>1
) d;
-- Ne pas activer de transfert vers « Appli » à partir de ces requêtes.
