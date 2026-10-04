# Trace

*(dépôt « Fondeur », ancien nom de l'application)*

Où skier (skating) aujourd'hui dans le Massif du Jura ? Classement des sites nordiques du Doubs, du Jura, de l'Ain et du Jura suisse selon la neige, la météo et les bulletins des pisteurs, depuis un lieu de départ enregistré (Ville-du-Pont, Boussières…) ou la position GPS.

HTML/CSS/JavaScript purs (modules ES), sans serveur, hébergement GitHub Pages.

## Données
| Source | Contenu | Comment |
|---|---|---|
| Nordic France / Espace Nordique Jurassien | ouverture, km et pistes ouvertes, hauteur de neige mesurée, dernier damage, qualité, **commentaires des pisteurs** | relevé par GitHub Actions toutes les 30 min en saison → `data/bulletins.json` |
| Suisse Tourisme | état des sites de ski de fond de Suisse romande | idem |
| Open-Meteo | température, regel nocturne, neige fraîche, pluie, vent, hauteur de neige estimée, prévisions 5 jours, à l'altitude de chaque site | appelé depuis l'app (gratuit, sans clé) |
| OSRM / OpenStreetMap | temps de trajet en voiture, carte | appelé depuis l'app |

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
Barre d'onglets fixée en bas de l'écran (comme sur les autres apps de la famille) : **Où skier ?** (classement), **Carte** et **Courses**. Sur grand écran, la barre passe sous l'en-tête plutôt qu'en bas.

## Lieux de départ
Le sélecteur de point de départ (sous le titre) propose des lieux enregistrés, modifiables via le bouton crayon à côté : ajout, renommage, changement de coordonnées et suppression, depuis la feuille « Lieux de départ ». « 📍 Ici » (position GPS) reste toujours disponible à part et ne se gère pas dans cette liste. Les lieux sont stockés localement (`fondeur_places`) ; par défaut, Ville-du-Pont et Boussières. Avec plusieurs lieux (4-5 et plus), le sélecteur défile horizontalement plutôt que d'écraser le texte des pastilles.

À l'ajout ou la modification d'un lieu, deux façons de le positionner : **rechercher une commune** (son nom suffit, coordonnées de son centre remplies automatiquement — API de géocodage gratuite d'Open-Meteo, `js/services/geocode.js`) ou **renseigner un point précis** (saisie manuelle des coordonnées, ou bouton « Utiliser ma position actuelle » pour un endroit exact comme un parking ou un départ de piste).

## Onglet Courses
Sélection curatée (`js/data/races.js`, mise à jour à la main) de 20 courses populaires de ski de fond : Massif du Jura (France et Suisse), Vosges, Alpes du Nord et Massif Central — la France entière hors Alpes du Sud et Pyrénées. Un filtre par région (dont un filtre dédié « 🏁 Marathon Ski Tour ») et un sélecteur d'édition (année en cours / suivante) permettent de restreindre l'affichage. La plupart des dates précises ne sont pas encore publiées aussi loin à l'avance : une date estimée est pré-remplie mais reste modifiable avant d'ajouter.

**Circuit Marathon Ski Tour** : les 8 épreuves du circuit officiel 2025-2026 ([marathonskitour.fr](https://www.marathonskitour.fr/)) portent un badge « Marathon Ski Tour » (champ `circuit` dans `js/data/races.js`) — La Transjurassienne, Les Belles Combes, La Foulée Blanche, La Savoyarde, le Marathon du Grand Bec, le Marathon des Glières, l'Étoile des Saisies et le Marathon de Bessans. Le circuit ne couvre que le Jura et les Alpes (pas les Vosges, Pyrénées ni le Massif Central). La Traversée du Massacre, qui en faisait partie jusqu'à la saison 2024-2025, n'y figure plus depuis 2025-2026.

« Ajouter » (une course, ou plusieurs via les cases à cocher et la barre en bas) envoie directement la course dans le planning de l'app **Carnet** (Mon tableau de bord), onglet Courses — via sa base Firebase partagée (même choix assumé, sans mot de passe, que ses autres synchronisations) : pas besoin d'ouvrir Carnet, la course y apparaît dès la prochaine synchronisation. Le détail (distances, source) part en note ; la distance chiffrée est à préciser dans Carnet une fois le format choisi. Détail dans `js/services/carnet-sync.js`.

**Marque « déjà ajoutée »** : le badge rond en haut de chaque carte de course permet de la marquer comme déjà présente au calendrier (ou de retirer la marque) sans repasser par l'envoi vers Carnet — utile si elle y a été ajoutée autrement. Ce marquage est indépendant du bouton « Ajouter » (stocké localement, `fondeur_races_added`).

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
