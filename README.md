# Trace

*(dépôt « Fondeur », ancien nom de l'application)*

Où skier (skating) aujourd'hui dans le Massif du Jura ? Classement des sites nordiques du Doubs, du Jura, de l'Ain et du Jura suisse selon la neige, la météo et les bulletins des pisteurs, depuis Ville-du-Pont, Besançon ou la position GPS.

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
