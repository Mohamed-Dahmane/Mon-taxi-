# Reçus libres — spécification validée le 25 novembre 2026

Accès Comptabilité > Créer un reçu libre. Aucun objet course, paiement SumUp, ni écriture de recette automatique. Saisie libre de date, client, départ, destination, montant TTC, mode de paiement, description. Conserver l'en-tête société et le modèle PDF existants. Numéro chauffeur et signature habituels préremplis et visibles, chacun avec validation ou modification indépendante. Les modifications sont propres au reçu et ne changent jamais le profil enregistré. Invalider la validation après toute modification correspondante. Prévisualisation du PDF réel avant confirmation et envoi. Enregistrement PDF, WhatsApp, e-mail et SMS via MMS/RCS si compatible ; ne pas annoncer un PDF envoyé par SMS simple. Choix du destinataire et confirmation manuelle, aucun envoi automatique. Même possibilités de partage pour les reçus classiques. Historique des reçus libres avec protection biométrique et conservation des justificatifs nécessaires.

## Tests de non-régression
- Signature et numéro habituels intacts après reçu pour un autre chauffeur et redémarrage.
- PDF conforme aux champs validés, aucune signature dupliquée.
- Aucun changement des courses, du journal comptable, ni des transactions SumUp.
- Partage WhatsApp, e-mail, MMS/RCS réel sur Samsung ; annulation sans envoi.
- Suppression historique protégée par biométrie, annulation fictive espèces sans fausser les recettes, conservation des paiements réels.
- Préserver APK 2122 ; nouvelle version supérieure, même identité de signature Android, compilation et tests avant installation. Ne pas fusionner ni déployer avant validation.

Statut : spécification enregistrée, implémentation des reçus libres à réaliser ; suppression historique en branche de test.
