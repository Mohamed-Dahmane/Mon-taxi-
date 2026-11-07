# Uber chauffeur — intégration préparatoire (non activée)

Cette branche est isolée de `main`. Aucune donnée de production ni écran Chrome/Android n'est modifié.

## Données et sécurité
- Source officielle : endpoint Uber Fleet Supplier « driver payments » **si** le compte flotte possède l'accès, ou API chauffeur autorisée après validation de l'éligibilité. Ne jamais contourner les restrictions Uber.
- Jetons OAuth et secrets exclusivement côté serveur (Supabase Edge Function / secrets), jamais dans HTML, PWA, GitHub ou journaux.
- Synchronisation par fenêtre chevauchante (ex. 7 jours), curseur de reprise et upsert par identifiant stable fourni par Uber.
- Clé de déduplication : `(source, external_payment_id)`; si l'API ne fournit pas d'identifiant stable, ne pas importer automatiquement avant de définir une clé fiable.
- Conserver les montants en centimes EUR, la date/heure d'origine, la date locale Europe/Brussels, le statut et le montant de gain **individuel** du chauffeur; distinguer montant brut, frais, corrections et net selon les champs réellement disponibles.
- Exclure les autres chauffeurs de la flotte. Ne jamais déduire un gain individuel du total flotte.
- Retraits, remboursements et corrections doivent modifier la ligne source existante et recalculer les totaux, jamais ajouter un doublon.
- Import initial : comparer les journées à partir du 2 novembre 2026 lorsque les données du 1er sont indisponibles.

## Contrat d'intégration
La rubrique « Appli » affiche les revenus Uber autorisés agrégés par date locale. Préserver les montants saisis manuellement : tant qu'une correspondance sûre n'est pas établie, afficher un rapprochement en lecture seule plutôt que d'écraser les valeurs. Ne jamais additionner deux fois un gain déjà encodé. Le total quotidien doit être dérivé d'une source canonique avec provenance explicite.

## Étapes avant activation
1. Vérifier l'autorisation et le périmètre Uber (chauffeur individuel vs flotte), la disponibilité de l'endpoint et le format des données.
2. Créer une table de transactions avec contrainte UNIQUE, RLS et accès serveur uniquement; préparer une migration réversible.
3. Déployer une Edge Function protégée avec OAuth côté serveur, pagination, reprise sur erreur et limite de fréquence.
4. Effectuer un import en lecture seule, comparer les sommes avec l'application Uber, puis tester les rejouements et les corrections.
5. Après validation, raccorder l'interface aux données réconciliées sans toucher à la synchronisation existante.

## État vérifié le 7 novembre 2026
Supabase : projet `mon-taxi-v11` (`uenyvsiturkihectolxp`), tables `taxi_sumup_transactions` et `taxi_management_backups`; fonction `taxi-sumup-sync`. Aucune table ni fonction Uber observée. Aucune autorisation Uber ou synchronisation des gains démontrée.
