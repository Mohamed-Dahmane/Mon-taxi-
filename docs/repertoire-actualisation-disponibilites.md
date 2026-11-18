# Répertoire chauffeurs : actualisation et disponibilités

Le bouton d’accueil « Répertoire » ouvre le choix Petite voiture / Van. Les filtres Tous, Jour et Nuit s’appliquent ensuite au véhicule choisi. Chaque ligne permet d’appeler, de préparer un SMS et de modifier la fiche.

Le véhicule réel reste distinct des courses acceptées : une petite voiture figure uniquement dans Petite voiture ; un van figure dans Van et peut aussi figurer dans Petite voiture en cochant cette case. Les deux cases Jour et Nuit sont indépendantes, avec au moins une période cochée. Les mentions Nuit/Night sont reconnues à l’import ; sans mention, Jour est proposé et reste modifiable.

« Actualiser le répertoire » est une action explicite. Sur Android, une seule lecture du fournisseur de contacts récupère les nouveaux TX et les contacts liés aux fiches déjà importées, même sans TX ou renommés sans préfixe. Les noms et numéros du téléphone sont repris. L’identifiant natif évite les doublons. Le véhicule, les cases modifiées, les identifiants locaux et les éventuelles métadonnées de priorité sont conservés. Une absence dans le téléphone ne supprime aucune fiche ; les suppressions volontaires restent exclues des imports TX suivants.

Chrome utilise la sélection de contacts lorsque disponible ou un fichier vCard récent ; il ne peut pas garantir une analyse complète du téléphone. Les saisies manuelles sans association native restent conservées. Un refus d’autorisation et une erreur de lecture ne vident jamais le répertoire.

Les données existantes sous montaxi:driver-directory:v1 sont lues puis normalisées vers le schéma version 2 lors du prochain enregistrement. Champs ajoutés : acceptsCar, availability (day/night), manualServices, manualAvailability, lastSyncedAt. Le champ category reste le véhicule réel. Aucun ordre de priorité nouveau n’est imposé.

Validation : tests Node des règles et de la migration, parcours Playwright sur 360 px avec l’interface réelle et le Planning, compilation/signature Android. Les appels et SMS sont vérifiés avec une passerelle simulée ; l’accès au carnet Samsung réel demande une vérification sur le téléphone.
