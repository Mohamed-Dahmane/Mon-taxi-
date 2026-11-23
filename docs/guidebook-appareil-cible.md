# Guidebook — appareil cible Mon Taxi

## Appareil de référence

- **Fabricant : Samsung**
- **Modèle : Samsung Galaxy Z Fold 8**
- **Variante : modèle Fold 8 standard, PAS une version Ultra**
- **Système : Android (Samsung Galaxy Z Fold 8)**

## Consignes de développement et de validation

1. Optimiser l'APK et les interfaces pour le **Samsung Galaxy Z Fold 8 standard (non-Ultra)**. Ne pas supposer que l'utilisateur possède un modèle Ultra.
2. Vérifier les mises en page sur l'écran externe étroit et l'écran interne déplié, ainsi qu'en cas de rotation et de changement de taille de fenêtre. Utiliser des dimensions réelles mesurées ou des émulateurs configurés, sans inventer les spécifications de l'appareil.
3. Éviter les boutons superposés, les champs masqués, les fenêtres dépassant de l'écran et les actions difficiles à toucher.
4. Préserver les données de l'application existante et la compatibilité des mises à jour APK (signature et versionCode) avant toute installation.
5. Tester les retours depuis les applications externes (notamment Waze et SumUp) vers la course en cours, sans déclencher de paiement ou d'archivage non confirmé.

**Note :** le modèle cible est fourni explicitement par l'utilisateur. Toute autre désignation (notamment « Fold Ultra ») est incorrecte pour son appareil.
