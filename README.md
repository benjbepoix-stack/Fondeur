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
Écran « La Réponse » : en haut une phrase d'état général du massif (« Bonne glisse ce matin, regel partout. », `js/core/summary.js`), puis le meilleur choix en grand (note, verdict, « Y aller » et « Fiche ») et les stations suivantes en cartes horizontales (« Ensuite »). Point de départ, pays/favoris, trajet maximum et tri sont regroupés dans la pastille « Réglages » en haut. Plus de barre d'onglets : les courses de ski de fond se choisissent dans **Cadence** (onglet Courses) ; la carte s'ouvre avec le bouton carte de l'en-tête. La fiche d'une station se lit en trois volets (Conditions, Bulletin, 5 jours) avec le bouton Itinéraire toujours visible.

Liens directs : `#station=<id>` ouvre la fiche d'une station, `#carte` la carte, `#courses` renvoie vers Cadence (utilisés par les widgets).

## Widgets iPhone (Scriptable)
`tools/build_widget.mjs` (lancé par l'action « Bulletins nordiques ») recalcule les notes avec les mêmes modules que l'app et publie `data/widget.json` : stations triées, phrase d'état général, trajet depuis Ville-du-Pont, fart, prochaines courses. Le script `widgets/glisse-scriptable.js`, à coller dans l'app gratuite Scriptable, affiche les widgets : meilleur choix (moyen, grand), favoris ou top (petit), fart du jour, prochaine course, et sur l'écran verrouillé note / regel / fart. Le paramètre de chaque widget est décrit en tête du script.

## Lieux de départ
Le sélecteur de point de départ (feuille « Réglages ») propose des lieux enregistrés, modifiables via le bouton crayon à côté : ajout, renommage, changement de coordonnées et suppression, depuis la feuille « Lieux de départ ». « 📍 Ici » (position GPS) reste toujours disponible à part et ne se gère pas dans cette liste. Les lieux sont stockés localement (`fondeur_places`) ; par défaut, Ville-du-Pont et Boussières. Avec plusieurs lieux (4-5 et plus), le sélecteur défile horizontalement plutôt que d'écraser le texte des pastilles. Ce sélecteur et son bouton de gestion se trouvent dans la feuille « Réglages ».

À l'ajout ou la modification d'un lieu, deux façons de le positionner : **rechercher une commune** (son nom suffit, coordonnées de son centre remplies automatiquement — API de géocodage gratuite d'Open-Meteo, `js/services/geocode.js`) ou **renseigner un point précis** (saisie manuelle des coordonnées, ou bouton « Utiliser ma position actuelle » pour un endroit exact comme un parking ou un départ de piste).

## Courses
La liste des courses de ski de fond (`js/data/races.js`) reste ici pour le widget « prochaine course », mais le choix des courses se fait dans **Cadence** (onglet Courses, avec les cyclosportives d'Échappée), qui en garde une copie : penser à mettre à jour les deux fichiers lors de la mise à jour annuelle des éditions.

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
