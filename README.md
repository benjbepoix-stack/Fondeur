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

## Fichiers
```
index.html · css/ · js/            application
data/stations.json                  liste des sites (positions, altitudes, identifiants des bulletins) : modifiable
data/bulletins.json                 généré automatiquement
tools/fetch_bulletins.py            relevé des bulletins (Python, bibliothèque standard)
.github/workflows/bulletins.yml     planification du relevé
```

Les bulletins appartiennent à leurs auteurs (ENJ, Nordic France, Suisse Tourisme) : usage personnel.
