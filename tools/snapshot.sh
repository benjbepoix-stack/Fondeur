#!/usr/bin/env bash
# Télécharge les pages publiques des bulletins et les ressources qu'elles chargent.
set -u
mkdir -p _snapshots
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
get() { curl -sSL -m 30 -A "$UA" -o "_snapshots/$1" -w "$1 %{http_code} %{size_download}\n" "$2" || echo "$1 ERREUR"; }
{
get enj-bulletin.html "https://www.espacenordiquejurassien.com/bulletin-neige.html"
get enj-accueil.html "https://www.espacenordiquejurassien.com/"
get snowmap-search.html "https://snowmap.espacenordiquejurassien.com/fr/search?practices=2"
get snowmap-home.html "https://snowmap.espacenordiquejurassien.com/fr"
get loipen.html "https://www.loipen.ch/fr/pistes-et-chemins/"
get openmeteo.json "https://api.open-meteo.com/v1/forecast?latitude=46.6&longitude=6.1&elevation=1100&daily=temperature_2m_min,snowfall_sum&hourly=snow_depth&past_days=2&forecast_days=2&timezone=Europe%2FParis"
} > _snapshots/_index.txt 2>&1
# Scripts et appels de données référencés par la carte (pour trouver le flux JSON)
for f in _snapshots/snowmap-*.html _snapshots/enj-bulletin.html; do
  grep -oE '(src|href)="[^"]+\.(js|json)[^"]*"' "$f" | sed -E 's/^(src|href)="//; s/"$//' ; done | sort -u > _snapshots/_assets.txt
i=0
while read -r a; do
  case "$a" in http*) url="$a";; //*) url="https:$a";; /*) url="https://snowmap.espacenordiquejurassien.com$a";; *) continue;; esac
  i=$((i+1)); get "asset-$i.txt" "$url" >> _snapshots/_index.txt
  [ $i -ge 12 ] && break
done < _snapshots/_assets.txt
grep -hoE 'https?://[a-zA-Z0-9./_-]*(api|json|ajax|graphql|bulletin|snow|piste|trail)[a-zA-Z0-9./_?=&-]*' _snapshots/*.html _snapshots/asset-*.txt 2>/dev/null | sort -u | head -200 > _snapshots/_endpoints.txt
cat _snapshots/_index.txt
