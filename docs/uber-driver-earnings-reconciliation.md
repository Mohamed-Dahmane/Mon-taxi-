# Uber chauffeur — rapprochement sécurisé (proposition, non activée)

État vérifié le 11 novembre 2026 : Supabase `mon-taxi-v11` contient `taxi-uber_credentials`, `taxi_uber_oauth_states`, `taxi_uber_payments` et `taxi_uber_driver_earnings_staging`, toutes vides. La fonction `taxi-uber-oauth` v2 existe, mais ne récupère pas les revenus. L'identité fiscale MARAL (entité juridique) ne prouve pas l'accès Fleet Supplier.

## Conditions préalables
1. Vérifier auprès d'Uber le rattachement du chauffeur à une flotte et l'accès officiel aux données **individuelles** de revenus ; ne pas confondre `partner.payments` avec un accès effectivement accordé.
2. Aucun scraping de l'application, aucun contournement de CAPTCHA, aucune conservation de mot de passe Uber.
3. Ne jamais inscrire client secret, refresh token ou identifiants bancaires dans GitHub, les journaux ou le navigateur.

## Règles d'import (à implémenter seulement après autorisation)
- Ingestion **serveur seulement** ; conserver l'identifiant fournisseur de chaque événement et son type. Clé de dédoublonnage : `(source, external_payment_id)` ou identifiant d'événement officiel stable. Ne pas utiliser le seul `trip_id` pour dédoublonner paiements, ajustements et remboursements distincts.
- Stocker les sommes en centimes EUR, la date UTC et la date de service Europe/Brussels ; garder le payload brut protégé côté serveur. Rejeter toute devise inconnue et toute ligne sans identifiant stable.
- Insertion idempotente avec contrainte unique en base, et transaction atomique ; ne jamais additionner deux fois une course renvoyée par plusieurs pages ou synchronisations.
- Séparer gains de courses, commissions, pourboires, ajustements, remboursements et cash collecté ; vérifier le sens comptable avant toute agrégation. Ne pas confondre versement bancaire et gain du jour.
- Rapprocher les sommes par jour et par chauffeur avec les relevés Uber ; marquer `pending`, `verified`, `rejected`. Les entrées `pending` ne doivent jamais alimenter la rubrique « Appli ».
- **Ne pas écraser** la saisie manuelle « Appli » ni le JSON de synchronisation existant. Proposer un mode de prévisualisation/rapprochement et un basculement explicite, uniquement après validation d'un échantillon réel.
- Avant changement de schéma ou de logique : export restaurable, migration additive, test de restauration sur environnement isolé, tests de non-régression Chrome/Android.
- Repli autorisé si l'API est refusée : export officiel Uber (CSV/relevé), import manuel contrôlé, mêmes identifiants et règles anti-doublons ; jamais une synchronisation « temps réel » annoncée sans preuve.

## Vérification avant mise en production
Tests : même événement importé 2 fois => 1 ligne ; événement corrigé => version/réconciliation sans double somme ; deux événements d'une même course => conservation correcte ; changement de date locale ; échec réseau et reprise ; aucun effet sur saisies manuelles ; accès non autorisé refusé. Comparer un total réel Uber à la prévisualisation et contrôler une sauvegarde restaurée. Aucune donnée de production modifiée par ce document.
