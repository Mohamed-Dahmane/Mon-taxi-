# Uber → Mon Taxi : intégration sécurisée (préparation, 7 novembre 2026)

## État vérifié
- Projet Supabase `mon-taxi-v11` : fonction `taxi-uber-oauth` active (v2), mais **aucune autorisation enregistrée**, aucun paiement ni gain dans les tables Uber à la vérification.
- Fonction OAuth : demande `partner.payments`, valide une session Mon Taxi au démarrage, protège `state` par SHA-256 et chiffre les jetons avec AES-GCM. Le déploiement ne prouve **ni** l'approbation de la permission par Uber **ni** l'accès aux gains individuels.
- Ne jamais considérer les paiements Fleet comme les gains nets d'un chauffeur sans vérifier leur signification et leur association au chauffeur.

## Conditions avant activation
1. Déterminer officiellement si le compte est chauffeur indépendant ou rattaché à une flotte et si les endpoints Fleet Supplier sont accessibles au titulaire autorisé.
2. Obtenir l'accord explicite d'Uber pour les scopes/endpoints requis. Ne pas contourner les autorisations ni automatiser une session privée.
3. Confirmer la configuration serveur des secrets sans les afficher ; tester l'autorisation avec un compte autorisé.
4. Vérifier sur un petit échantillon le mapping chauffeur, devise, statut des courses, pourboires, annulations, espèces et ajustements.
5. Mettre en place une ingestion serveur idempotente (identifiant stable Uber + source + compte), une fenêtre de reprise et une journalisation sans secrets.
6. Comparer les totaux avec l'application Uber ; n'activer l'écriture dans « Appli » qu'après concordance. Ne jamais écraser les montants saisis manuellement sans rapprochement explicite.

## Alternative autorisée
En cas de refus de l'API, privilégier un export officiel des revenus ou relevés du compte Uber, importé avec validation, dédoublonnage et provenance. Cela ne constitue pas une synchronisation temps réel.

## Sécurité et déploiement
- Conserver la branche principale et les données Supabase inchangées pendant cette phase.
- Ne pas toucher à la synchronisation Chrome/Android ni à la surveillance APK.
- Avant activation : tests de doublons, de relance, de changement de jour/fuseau, d'absence de jeton et de révocation d'accès.
