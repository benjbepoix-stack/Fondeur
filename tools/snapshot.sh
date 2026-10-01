#!/usr/bin/env bash
# Relevé ponctuel : pages webcams ENJ (pour en étudier la structure).
set -u
mkdir -p _snapshots/w
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
get() { curl ${3:-} -sSL -m 150 -A "$UA" -o "_snapshots/w/$1" -w "$1 %{http_code} %{size_download} %{url_effective}\n" "$2" || echo "$1 ERREUR"; }
{
get accueil.html "https://www.espacenordiquejurassien.com/"
get webcams.html "https://www.espacenordiquejurassien.com/webcams.html"; get webcams-http1.html "https://www.espacenordiquejurassien.com/webcams.html" --http1.1
} > _snapshots/w/_index.txt 2>&1
grep -oiE 'href="[^"]*webcam[^"]*"' _snapshots/w/accueil.html | sort -u > _snapshots/w/_liens.txt

cat _snapshots/w/_index.txt
