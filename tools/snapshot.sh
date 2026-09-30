#!/usr/bin/env bash
# Relevé n°4 : bulletins détaillés des 32 sites ENJ (commentaires des pisteurs).
set -u
mkdir -p _snapshots/4
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
for id in 1854 2161 1766 1753 4774 4491 1775 2195 1850 1900 1802 20380 1990 2066 1846 1902 2185 4405 1974 1808 1944 4519 3857 1837 1878 1897 1881 2779 2778 2698 1858 1874; do
  curl -sSL -m 40 -A "$UA" -o "_snapshots/4/st-$id.html" -w "$id %{http_code} %{size_download}\n" "https://www.nordicfrance.fr/widget/marqueblanche/association/station/$id/espace-nordique-jurassien" || echo "$id ERREUR"
  sleep 1
done > _snapshots/4/_index.txt 2>&1
cat _snapshots/4/_index.txt
