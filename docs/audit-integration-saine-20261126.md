# Audit de consolidation Mon Taxi Pro — 26 novembre 2026

## Règles non négociables
- Ne pas modifier main, la version APK stable, les sauvegardes ou les données de production.
- Ne pas fusionner automatiquement une branche divergente ni supprimer les anciens workflows/services.
- Réintégrer chaque module par fichiers ou commits sélectionnés, avec tests et contrôle des dépendances.
- Aucun déploiement Supabase, aucun encaissement ou remboursement réel pendant l'audit.
- Une APK de test ne devient candidate à la mise à jour qu'après compilation et validation de la signature, de la persistance locale et des parcours critiques.

## Constat confirmé par lecture GitHub
- La branche de consolidation antérieure integration/mon-taxi-pro-2122-global-20261126 est basée sur test/recus-remarques-tva-20261126 et inclut deux fichiers multi-véhicules.
- Sur cette branche, .github/workflows/sumup-sync.yml et supabase/functions/taxi-sumup-sync/index.ts sont absents, alors qu'ils existent sur main. Il faut conserver et auditer ces deux composants, sans prétendre que leur présence suffit à résoudre le HTTP 502.
- .github/workflows/android-apk.yml et MainActivity.java diffèrent substantiellement entre main et l'ancienne branche. Risque de régression Android, de signature et de navigation.
- Le journal d'une exécution GitHub du 26 novembre montre Supabase REST HTTP 200, puis POST taxi-sumup-sync HTTP 502. La cause interne n'est pas encore établie.

## Ordre de raccordement sécurisé
1. Inventaire des services: GitHub Actions, Supabase Functions/migrations, OAuth, secrets (noms seulement), stockage, Android, sauvegardes, Chrome.
2. Contrats de données et sauvegarde/restauration; non-duplication et idempotence paiements/remboursements.
3. Intégration isolée des modèles multi-véhicules avec tests unitaires et compatibilité des anciens enregistrements.
4. Reçus cash/SumUp: remarque facultative, mention TVA incl., signature unique, partage et impression; tests de rendu.
5. Planning, hôtels/chauffeurs, commissions, historique, biométrie; tests de navigation croisés.
6. Diagnostic de la fonction taxi-sumup-sync HTTP 502 avec logs d'exécution, sans changer les secrets à l'aveugle.
7. Vérification des workflows CI et compilation APK de test, puis validation sur appareil avant toute mise à jour.

## État réel
Branche saine créée depuis main. Audit initial effectué; aucun module de fonctionnalité supplémentaire n'est encore raccordé sur cette nouvelle branche. Aucun test de bout en bout ni APK de cette branche n'a encore été exécuté.
