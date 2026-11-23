# Mon Taxi — exigences validées à restaurer (22–23 novembre 2026)

Référence fonctionnelle : commit 54249d1f (après 7cf5de92). **Ne pas réinstaller l'ancien APK** : porter les fonctionnalités sur la branche Android actuelle. Ne pas fusionner dans main ni déployer sans tests. Préserver les données locales, les courses, les encaissements et la signature Android.

## Priorité 0 — circuit complet
1. Planning → Charger (commission enregistrée une seule fois, pas de doublon au second clic) → démarrer et naviguer → Finir la course (arrêter compteur sans archiver) → encaissement.
2. Espèces : sans SDK SumUp, confirmation → montant dans Cash une seule fois → son de caisse/vibration → course archivée dans Historique → accueil.
3. SumUp Solo : Mon Taxi transmet montant au terminal ; n'enregistrer qu'après résultat authentiquement confirmé ; Carte brut = montant ; Carte net = montant moins 1,69 % ; son → archivage → accueil. Échec/incertitude : garder course et ne jamais encaisser deux fois. Ne pas réactiver ancienne synchronisation périodique.
4. Le bouton « Course effectuée » peut rester en dépannage pour clôturer/archiver ; ne doit pas déclencher de deuxième encaissement. « Fausse course » reste séparé.
5. Test navigateur + Android réel sur course fictive, cash, SumUp accepté, refusé, incertain, retour appli et redémarrage. Ne pas modifier les vraies recettes pour tester.

## Planning et navigation
- Accueil : Planning, Réservation, Course directe ; badge orange pour validations en attente ; retour accueil après création et clôture.
- Dépose/Pick-up, aéroports BRU/CRL, gares, tracking vol/train, horaires, véhicule petite voiture/van, plusieurs véhicules et chauffeurs, contact/téléphone, notifications 1 h et 30 min avec son.
- Les courses non terminées restent dans Planning ; archives accessibles directement via Historique ; pas de boutons superposés ; menus déroulants lisibles ; « Terminer » distinct de « Clôturer ».

## Hôtels, chauffeurs, commissions
- DoubleTree (Papa/Day/Night), The Standard (contacts validés), autres hôtels ; recherche, tri priorité manuel/A–Z/Z–A ; contacts hôtel distincts des chauffeurs.
- Commissions par hôtel/aéroport/véhicule proposées automatiquement et modifiables ; vide = 0 € ; à 0 €, aucun message de commission SMS/WhatsApp ; charger n'enregistre jamais la commission deux fois.
- Commission déduite du Cash réel seulement si chauffeur « Moi » ; totaux mensuels et par hôtel/contact ; liste chauffeurs réordonnable.

## Comptabilité et sécurité
- Cash réel = Cash - commissions ; recette = Carte net + Cash réel + Appli ; résultat = recette - dépenses - carburant - frais fixes/jour ; moyenne uniquement jours travaillés.
- Paiement vide refusé, montant 0 explicitement saisi accepté selon le formulaire ; contrôle anti-double paiement ; pourboires conservés.
- Sauvegarde/restauration, données locales et mode nuit ; ne pas synchroniser automatiquement les listes hôtels/chauffeurs contre la volonté de l'utilisateur.
- Version Chrome et APK : ne pas supposer qu'une modification de branche est visible dans l'APK, qui charge la page GitHub Pages publiée. Tests avant livraison d'un APK direct, sans ZIP.

## État d'implémentation dans cette branche
- Commit 842ffba : paiement espèces confirmé → enregistrement et archivage dans la même écriture ; message de confirmation mis à jour.
- SumUp authentifié, écriture comptable Cash/Carte, son et parcours complet **à vérifier et implémenter**. Pas encore prêt pour installation.
