#!/usr/bin/env bash
# Relevé n°2 : widget Nordic France, API Geotrek de la carte ENJ, bulletin suisse.
set -u
mkdir -p _snapshots/2
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
get() { curl -sSL -m 40 -A "$UA" -H "Referer: https://www.espacenordiquejurassien.com/bulletin-neige.html" -o "_snapshots/2/$1" -w "$1 %{http_code} %{size_download} %{content_type}\n" "$2" || echo "$1 ERREUR"; }
API="https://admin.snowmap.espacenordiquejurassien.com/api/v2"
{
get nf-widget.js "https://www.nordicfrance.fr/widgets/widget.js"
get nf-home.html "https://www.nordicfrance.fr/"
get gt-root.json "$API/"
get gt-structure.json "$API/structure/?language=fr&page_size=200"
get gt-practice.json "$API/practice/?language=fr"
get gt-district.json "$API/district/?language=fr&page_size=200"
get gt-trek.json "$API/trek/?language=fr&practices=2&page_size=500&fields=id,name,structure,departure,departure_geom,length_2d,cities,districts,difficulty,themes,practice,ambiance,update_date"
get gt-touristiccontent-cat.json "$API/touristiccontent_category/?language=fr"
get ch-myswitzerland.html "https://snow.myswitzerland.com/bulletin_enneigement/ski_fond/ski-de-fond-de-suisse-romande/?sort=openlifts&noidx=1"
} > _snapshots/2/_index.txt 2>&1
grep -hoE 'https?://[a-zA-Z0-9./_-]+(\?[a-zA-Z0-9=&_.%-]*)?' _snapshots/2/nf-widget.js | sort -u > _snapshots/2/_nf-urls.txt
cat _snapshots/2/_index.txt
