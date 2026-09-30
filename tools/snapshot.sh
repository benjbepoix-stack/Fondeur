#!/usr/bin/env bash
# Relevé n°3 : liste des stations Nordic France et format des bulletins du widget.
set -u
mkdir -p _snapshots/3
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
get() { curl -sSL -m 40 -A "$UA" -H "Referer: https://www.espacenordiquejurassien.com/bulletin-neige.html" -o "_snapshots/3/$1" -w "$1 %{http_code} %{size_download} %{content_type}\n" "$2" || echo "$1 ERREUR"; }
NF="https://www.nordicfrance.fr"
{
get nf-bulletin.html "$NF/le-bulletin-neige/"
get nf-assoc.html "$NF/associations-adherentes/"
get nf-sitemap.xml "$NF/sitemap.xml"
get nf-wp-sitemap.xml "$NF/wp-sitemap.xml"
get nf-sitemap-index.xml "$NF/sitemap_index.xml"
for a in ENJ enj espace-nordique-jurassien Espace-Nordique-Jurassien; do get "w-assoc-$a.html" "$NF/widget/marqueblanche/association/$a"; done
for s in 1 10 100 200; do get "w-station-$s.html" "$NF/widget/marqueblanche/station/$s"; done
} > _snapshots/3/_index.txt 2>&1
cat _snapshots/3/_index.txt
