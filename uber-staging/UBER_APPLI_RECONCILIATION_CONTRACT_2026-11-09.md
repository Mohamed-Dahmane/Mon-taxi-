# Contrat de rapprochement Uber → Appli (revue uniquement, 2026-11-09)

**État : non déployé.** Contrôles SQL en lecture seule sur `mon-taxi-v11` : 0 credentials, 0 OAuth states, 0 staging, 0 payments. Table `taxi_management_backups` : 1337 lignes ; dernier snapshot le 2026-11-08 17:19:28 UTC. **La présence d'un snapshot ne prouve pas qu'il est restaurable** : tester la restauration hors production avant tout import.

## Incompatibilités vérifiées

- Le normaliseur `normalize-uber-event.ts` produit `eventKey`, `amountCents`, `eventKind`, `tripId`, `originalEventId` et `serviceDateBrussels`. La table staging stocke `external_payment_id`, `gross_cents`, `fee_cents`, `net_cents`, `status`, `local_service_date` ; elle n'a **ni** `event_kind`, `trip_id`, `original_event_id`, `user_id` ni `event_key`. Ne pas écrire directement un événement normalisé sans mapping et validation de sémantique.
- L'index unique actif `taxi_uber_source_id_unique(source, external_payment_id)` n'est pas scoped par chauffeur. Ajouter un deuxième index ne corrige pas le blocage tant que l'ancien existe. Ne pas supprimer l'index sans migration transactionnelle et tests de collision/rejeu.
- La table `taxi_uber_payments` est keyed par `(user_id,payment_id)`. Le lien chauffeur externe → utilisateur doit être vérifié côté serveur avant tout transfert, jamais déduit d'un paramètre client.
- `amountCents` ne doit pas être présumé équivalent à `net_cents` : identifier les frais, cash collecté, annulations et ajustements d'après la documentation et les données autorisées du fournisseur.

## Conditions d'activation

1. Obtenir les droits officiels Fleet Supplier et vérifier le rattachement chauffeur/flotte ; sinon accepter uniquement un export de gains officiellement accessible au chauffeur.
2. Spécifier l'identité stable de chaque événement, la source, le chauffeur, la devise, le montant net, les corrections et les annulations. Rejeter tout événement sans identifiant stable.
3. Implémenter une association propriétaire serveur, avec tests de permissions (RLS et service role), puis une contrainte unique en base sur la bonne clé métier et un import transactionnel idempotent.
4. Comparer les totaux par jour avec les montants **déjà saisis manuellement** dans « Appli » : aucune addition automatique sur un jour déjà renseigné ; proposer un rapprochement explicite et conserver un journal d'audit.
5. Tester une sauvegarde/restauration hors production, les dates Europe/Brussels, les événements rejoués, les corrections tardives et les collisions entre chauffeurs ; vérifier Chrome et Android avant activation.

Aucun secret ni jeton ne doit être écrit dans GitHub, les journaux ou le navigateur. Aucun scraping ni connexion avec mot de passe partagé.
