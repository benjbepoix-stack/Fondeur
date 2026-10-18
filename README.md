# Glisse

*(dépôt « Fondeur », premier nom de l'application, puis « Trace »)*

Où skier (skating) aujourd'hui dans le Massif du Jura ? Classement des sites nordiques du Doubs, du Jura, de l'Ain et du Jura suisse selon la neige, la météo et les bulletins des pisteurs, depuis un lieu de départ enregistré (Ville-du-Pont, Boussières…) ou la position GPS.

HTML/CSS/JavaScript purs (modules ES), sans serveur, hébergement GitHub Pages.

## Données
| Source | Contenu | Comment |
|---|---|---|
| Nordic France / Espace Nordique Jurassien | ouverture, km et pistes ouvertes, hauteur de neige mesurée, dernier damage, qualité, **commentaires des pisteurs** | relevé par GitHub Actions toutes les 30 min en saison → `data/bulletins.json` |
| Suisse Tourisme | état des sites de ski de fond de Suisse romande | idem |
| Open-Meteo | température, regel nocturne, neige fraîche, pluie, vent, hauteur de neige estimée, prévisions 5 jours, à l'altitude de chaque site | appelé depuis l'app (gratuit, sans clé) |
| OSRM / OpenStreetMap | temps de trajet en voiture, carte | appelé depuis l'app |
| [Météo Franc-Comtoise](https://www.meteofranccomtoise.fr/) | avis d'un prévisionniste local sur la région | lien vers le site (pas d'API publique) sous les prévisions 5 jours de chaque fiche station, à recouper avec le modèle Open-Meteo |

Le relevé des bulletins (`tools/fetch_bulletins.py`, via GitHub Actions) enregistre l'heure de **chaque** vérification réussie, pas seulement celle des changements constatés — sinon la date affichée dans l'app pouvait dater de plusieurs jours hors saison (quand rien ne change d'un jour à l'autre) alors que les bulletins avaient bien été revérifiés entre-temps.

## Note « skating » (/100)
Neige (35) · pistes ouvertes (20) · regel de la nuit (15) · température du jour (10) · damage récent (10) · pluie et vent (10), malus en cas de grosse chute non damée. Le trajet n'entre pas dans la note (filtre « trajet max » disponible). Détail dans `js/core/score.js`.

## Classement
Trois tris sont disponibles (menu « Trier ») :
- **Meilleure note** (par défaut) : note skating, favoris en tête à note proche.
- **Trajet le plus court** : temps de route depuis le point de départ choisi.
- **Nuit la plus froide** : minimum de température de la nuit dernière (meilleur regel).

Chaque ligne du classement affiche aussi ce minimum nocturne. La neige fraîche récente n'étant pas en soi un bon indicateur pour le skating (elle doit d'abord être damée), c'est la température de regel nocturne qui est mise en avant plutôt qu'un badge de neige fraîche.

## Fart conseillé
La fiche de chaque station propose un repère de fart de retenue (vert → bleu → violet → rouge → jaune/klister) calculé à partir du minimum de la nuit (départ matinal) et du maximum du jour (après-midi). C'est une indication basée sur la seule température : le choix réel dépend aussi de l'état de la neige (fraîche, transformée, humide), non mesuré ici — à confirmer sur place ou avec le bulletin des pisteurs. Détail dans `js/core/wax.js`.

## Navigation
Écran « La Réponse » : en haut une phrase d'état général du massif (« Bonne glisse ce matin, regel partout. », `js/core/summary.js`), puis le meilleur choix en grand (note, verdict, « Y aller » et « Fiche ») et les stations suivantes en cartes horizontales (« Ensuite »). Point de départ, pays/favoris, trajet maximum et tri sont regroupés dans la pastille « Réglages » en haut. Deux onglets en bas : **Aujourd'hui** et **Courses** ; la carte s'ouvre avec le bouton carte de l'en-tête. La fiche d'une station se lit en trois volets (Conditions, Bulletin, 5 jours) avec le bouton Itinéraire toujours visible.

Liens directs : `#station=<id>` ouvre la fiche d'une station, `#courses` l'onglet Courses, `#carte` la carte (utilisés par les widgets).

## Widgets iPhone (Scriptable)
`tools/build_widget.mjs` (lancé par l'action « Bulletins nordiques ») recalcule les notes avec les mêmes modules que l'app et publie `data/widget.json` : stations triées, phrase d'état général, trajet depuis Ville-du-Pont, fart, prochaines courses. Le script `widgets/glisse-scriptable.js`, à coller dans l'app gratuite Scriptable, affiche les widgets : meilleur choix (moyen, grand), favoris ou top (petit), fart du jour, prochaine course, et sur l'écran verrouillé note / regel / fart. Le paramètre de chaque widget est décrit en tête du script.

## Lieux de départ
Le sélecteur de point de départ (feuille « Réglages ») propose des lieux enregistrés, modifiables via le bouton crayon à côté : ajout, renommage, changement de coordonnées et suppression, depuis la feuille « Lieux de départ ». « 📍 Ici » (position GPS) reste toujours disponible à part et ne se gère pas dans cette liste. Les lieux sont stockés localement (`fondeur_places`) ; par défaut, Ville-du-Pont et Boussières. Avec plusieurs lieux (4-5 et plus), le sélecteur défile horizontalement plutôt que d'écraser le texte des pastilles. Ce sélecteur et son bouton de gestion se trouvent dans la feuille « Réglages ».

À l'ajout ou la modification d'un lieu, deux façons de le positionner : **rechercher une commune** (son nom suffit, coordonnées de son centre remplies automatiquement — API de géocodage gratuite d'Open-Meteo, `js/services/geocode.js`) ou **renseigner un point précis** (saisie manuelle des coordonnées, ou bouton « Utiliser ma position actuelle » pour un endroit exact comme un parking ou un départ de piste).

## Onglet Courses
Sélection curatée (`js/data/races.js`, mise à jour à la main) de 20 courses populaires de ski de fond : Massif du Jura (France et Suisse), Vosges, Alpes du Nord et Massif Central — la France entière hors Alpes du Sud et Pyrénées. Un filtre par région (dont un filtre dédié « 🏁 Marathon Ski Tour ») et un sélecteur d'édition (année en cours / suivante) permettent de restreindre l'affichage. Les courses sont triées par date de l'édition affichée (la plus proche en premier). La plupart des dates précises ne sont pas encore publiées aussi loin à l'avance : une date estimée est pré-remplie mais reste modifiable avant d'ajouter.

**Circuit Marathon Ski Tour** : les 8 épreuves du circuit officiel 2025-2026 ([marathonskitour.fr](https://www.marathonskitour.fr/)) portent un badge « Marathon Ski Tour » (champ `circuit` dans `js/data/races.js`) — La Transjurassienne, Les Belles Combes, La Foulée Blanche, La Savoyarde, le Marathon du Grand Bec, le Marathon des Glières, l'Étoile des Saisies et le Marathon de Bessans. Le circuit ne couvre que le Jura et les Alpes (pas les Vosges, Pyrénées ni le Massif Central). La Traversée du Massacre, qui en faisait partie jusqu'à la saison 2024-2025, n'y figure plus depuis 2025-2026.

**Présélection, puis validation.** Deux temps, sur l'édition affichée :
- **★ Présélectionner** (bouton étoile de chaque carte) : la course rejoint **« ★ Ma saison »** (filtre dédié, avec leur nombre), sur l'appareil uniquement (`fondeur_races_picked`, avec la date retenue, modifiable). Rien n'est envoyé à Allure tant que le choix n'est pas validé ; un nouvel appui retire la présélection.
- **Valider** (bouton de la carte, ou « Tout valider » dans la barre du bas, depuis « Ma saison ») envoie la course dans le planning de l'app **Allure** ; elle sort alors de la présélection et passe « validée » (cadre en surbrillance, coche verte, bouton désactivé). La barre du bas rappelle le nombre de présélectionnées à valider et mène à « Ma saison ».

**Envoi vers Allure** (`js/services/allure-sync.js`) : Allure range ses courses dans le nœud qu'elle partage avec Carnet (`users/<uid>/carnet/races`) sur le projet Firebase commun, protégé par compte. La première validation demande donc de se connecter avec **le même compte qu'Allure** (Carnet, Mon Garage, Ma Maison) ; la session reste ensuite sur l'appareil (ligne « Allure : … · Se déconnecter » sous le filtre). L'ajout est une transaction : la liste d'Allure est relue puis complétée, jamais écrasée, et une course déjà présente (même nom, même date) n'est pas dupliquée. Si le compte n'a pas encore été transféré depuis l'ancienne base (Allure jamais ouverte), rien n'est écrit et un message invite à ouvrir Allure une fois. Le SDK Firebase n'est chargé qu'à l'ouverture de l'onglet Courses, jamais au démarrage. La distance chiffrée est à préciser dans Allure une fois le format choisi ; le champ note n'est pas pré-rempli.

**Marque « déjà dans Allure »** : le badge calendrier de chaque carte marque une course comme déjà présente dans Allure (ou retire la marque) sans l'envoyer — utile si elle y a été ajoutée autrement. Stocké localement (`fondeur_races_added`, même clé que l'ancienne marque « ajoutée à Carnet », conservée).

**Mise à jour annuelle** : chaque course porte deux éditions dans `editions: [{year, date, confirmed}, ...]` (en cours / suivante). Une fois par an (idéalement en fin de saison, au moment où les dates de la saison suivante commencent à sortir) : décaler l'édition « suivante » vers « en cours », ajouter une nouvelle édition « suivante » (même date estimée +364 jours en attendant l'annonce officielle), et passer `confirmed: true` dès qu'une date officielle est publiée par l'organisateur.

## Hors ligne (PWA)
Un service worker (`sw.js`) met en cache l'app (HTML/CSS/JS, icônes, dernier instantané des données) pour un chargement hors ligne ou en réseau instable. Les appels météo (Open-Meteo) et trajet (OSRM) restent en réseau direct ; seule l'app elle-même fonctionne hors ligne, avec les dernières données chargées.

## Fichiers
```
index.html · css/ · js/            application
sw.js                                service worker (mode hors ligne)
data/stations.json                  liste des sites (positions, altitudes, identifiants des bulletins) : modifiable
data/bulletins.json                 généré automatiquement
tools/fetch_bulletins.py            relevé des bulletins (Python, bibliothèque standard)
.github/workflows/bulletins.yml     planification du relevé
```

Les bulletins appartiennent à leurs auteurs (ENJ, Nordic France, Suisse Tourisme) : usage personnel.
