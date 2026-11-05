# SumUp → Mon Taxi V11 (préparation)

**État : NON DÉPLOYÉ, NON CONNECTÉ.** Ce dossier est un prototype technique. Il n'est pas encore intégré à l'écran V11 et ne doit pas être considéré comme une synchronisation fonctionnelle.

## Sécurité
- Ne jamais copier la clé SumUp dans GitHub, GitHub Pages, localStorage ou dans ChatGPT.
- La clé SumUp doit être stockée comme secret chiffré côté serveur (SUMUP_API_KEY).
- Le Worker exige également ALLOWED_ORIGIN et ACCESS_TOKEN, mais le jeton d'accès ne doit **pas** être embarqué dans la page publique : prévoir une véritable authentification utilisateur (session serveur / identité).
- Le dépôt GitHub actuel est public. Ne pas déployer l'API sans authentification et tests d'accès.
- Une note OneNote n'est qu'un emplacement provisoire pour la clé ; privilégier un gestionnaire de secrets.

## Avant production
1. Créer un environnement privé pour le Worker et y ajouter SUMUP_API_KEY sans exposer sa valeur.
2. Vérifier les permissions exactes de la clé et préférer un accès limité aux transactions si possible.
3. Vérifier le schéma réel de /v0.1/me/transactions/history, les paramètres de pagination, statuts, remboursements, frais et fuseau horaire avec des transactions de test.
4. Mettre en place une session authentifiée, protection anti-abus, journalisation sans secrets, et une base de données persistante pour rapprochement.
5. Ajouter une intégration UI qui distingue les paiements SumUp des montants cash et des commissions manuelles, sans modifier les données locales existantes.
6. Tester en lecture seule avant activation. Prévoir détection des paiements remboursés et des paiements tardifs.

Les calculs doivent être faits en centimes ; la caisse journalière = carte + cash − commissions de courses. Les frais de transaction SumUp sont séparés pour éviter la double déduction.
