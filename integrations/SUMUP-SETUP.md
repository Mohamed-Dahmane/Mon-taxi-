# SumUp → Mon Taxi : état technique et vérifications

Ce document décrit le code présent dans le dépôt, **pas une preuve de synchronisation opérationnelle**. Ne jamais publier de clés API, de jetons ou de données financières.

## Architecture existante
- `.github/workflows/sumup-sync.yml` : déclenchement manuel et programmation cron toutes les cinq minutes (GitHub Actions peut retarder ou omettre une exécution).
- Secrets GitHub Actions attendus : `SUMUP_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Ne jamais afficher leurs valeurs.
- `supabase/functions/taxi-sumup-sync/index.ts` : fonction serveur protégée, appel de l'API SumUp et écriture dans `taxi_sumup_transactions`.
- Les transactions sont récupérées à partir du 1er novembre 2026 (heure de Bruxelles), validées et regroupées avant un upsert. Les pages incomplètes et les identifiants répétés entraînent un échec sans écriture.
- Les calculs `integrations/sumup-reconciliation.js` ne retiennent que les transactions `SUCCESSFUL` en EUR. Cela ne prouve pas que l'écran principal consomme automatiquement ces totaux.

## Points à vérifier avant toute activation de l'encodage automatique
1. Confirmer une exécution GitHub Actions récente **et** le résultat de l'écriture côté Supabase, sans publier de montant ni d'identifiant de transaction.
2. Vérifier la présence de la fonction déployée et les politiques d'accès aux tables et vues.
3. Comparer, en privé, une journée de transactions SumUp avec les totaux de la base puis l'affichage dans Mon Taxi.
4. Prévoir un mode de rapprochement évitant de compter à nouveau les montants de carte déjà saisis manuellement. Ne jamais remplacer automatiquement les données existantes avant validation.
5. Vérifier les remboursements, les changements de statut, les transactions tardives et la pagination réelle de l'API.
6. Exécuter les tests `node integrations/sumup-reconciliation.test.mjs` et `node integrations/sumup-sync-contract.test.mjs` après toute modification du calcul ou du contrat.

**État : infrastructure de synchronisation présente dans le dépôt ; transfert effectif jusqu'aux recettes affichées non confirmé.** Aucun nouveau service n'est requis pour poursuivre les vérifications avec GitHub Actions et Supabase existants.
