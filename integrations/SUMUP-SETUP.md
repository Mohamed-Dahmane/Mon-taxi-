# SumUp — Android autonome (refonte)

Le nouveau Mon Taxi n'importe aucun historique général de transactions SumUp. Seul le paiement individuel demandé dans Mon Taxi est transmis au SDK Android, puis inscrit dans le registre local après retour confirmé et corrélé.

Les anciens workflows d'import, de contrôle d'accès à l'historique et le code de la fonction serveur d'import sont retirés de cette branche. Les anciennes migrations sont conservées comme trace de schéma : aucune suppression de données ou de table n'est exécutée. L'ancienne application en service, Chrome, la branche de production et les services déjà déployés restent inchangés pendant la refonte ; leur ancien import doit être arrêté au basculement définitif, après sauvegarde et vérification de l'absence de dépendance utile. Ne pas déployer l'ancienne fonction à nouveau.

Le lecteur Solo Lite et le SDK doivent être testés physiquement avant mise en service. Ne jamais relancer automatiquement un paiement de statut incertain, ni réimporter des transactions globales pour compenser.
