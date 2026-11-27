# SumUp — Android autonome (refonte)

Le nouveau Mon Taxi n'importe aucun historique général de transactions SumUp. Seul le paiement individuel demandé dans Mon Taxi est transmis au SDK Android, puis inscrit dans le registre local après retour confirmé et corrélé.

Les anciens workflows d'import, de contrôle d'accès à l'historique et le code de la fonction serveur d'import sont retirés de cette branche. Les anciennes migrations sont conservées comme trace de schéma : aucune suppression de données ou de table n'est exécutée. La synchronisation historique par clé API (`taxi-sumup-sync`) a été neutralisée sur Supabase le 27/11/2026 : la version 31 répond `410 legacy_sumup_sync_disabled` et ne réalise plus d'import. Ne pas redéployer son ancien code ni réactiver le workflow historique de la branche principale. La connexion OAuth (`taxi-sumup-oauth`) reste une fonction distincte ; sa présence sur le serveur ne prouve pas encore une connexion utilisateur ni une synchronisation réelle réussie. La branche principale et l'APK stable ne sont pas modifiées par cette branche de test.

Le lecteur Solo Lite et le SDK doivent être testés physiquement avant mise en service. Ne jamais relancer automatiquement un paiement de statut incertain, ni réimporter des transactions globales pour compenser.

## Identité Android séparée — Mon Taxi Pro

Identifiant de la nouvelle application : `be.montaxi.pro` (ancien : `be.montaxi.gestion.empreinte`). Avant la connexion au lecteur, ajouter le nouvel identifiant à la clé d'affiliation dans le tableau de bord SumUp, section développeurs / Affiliate Keys. La clé existante peut être associée à plusieurs identifiants selon https://developer.sumup.com/tools/authorization/affiliate-keys/. Ne pas retirer l'ancien identifiant tant que l'ancienne application est utilisée. Aucune clé n'est stockée dans GitHub. Saisir la clé autorisée dans la nouvelle application, vérifier la connexion puis le paiement réel sur Solo Lite avant toute mise en service. La signature de production ne prouve pas l'autorisation SumUp.
