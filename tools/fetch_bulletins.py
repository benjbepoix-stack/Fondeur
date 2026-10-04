#!/usr/bin/env python3
"""
Relevé des bulletins nordiques -> data/bulletins.json

- France (Espace Nordique Jurassien) : widget public Nordic France
  (/widget/marqueblanche/association/...), un bulletin détaillé par site :
  ouverture, km et pistes ouvertes, hauteur de neige, dernier damage,
  qualité, mise à jour, commentaires des pisteurs (secteurs et pistes).
- Suisse (Jura) : bulletin d'enneigement de Suisse Tourisme (ski de fond
  Suisse romande) : état et informations disponibles par site.

Bibliothèque standard uniquement (exécuté par GitHub Actions).
Usage : python3 tools/fetch_bulletins.py [--offline DOSSIER]
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.request

NF = "https://www.nordicfrance.fr"
ASSOC = "espace-nordique-jurassien"
CH_URL = "https://snow.myswitzerland.com/bulletin_enneigement/ski_fond/ski-de-fond-de-suisse-romande/?sort=openlifts&noidx=1"
UA = "Mozilla/5.0 (compatible; Fondeur/1.0; +https://github.com/benjbepoix-stack/Fondeur)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "bulletins.json")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.espacenordiquejurassien.com/bulletin-neige.html"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", errors="replace")


def text(fragment):
    """HTML -> texte propre sur une ligne."""
    t = re.sub(r"<svg.*?</svg>|<script.*?</script>|<style.*?</style>", " ", fragment, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def num(s):
    try:
        return float(str(s).replace(",", "."))
    except (TypeError, ValueError):
        return None


def iso_from_ddmm(ddmm, today):
    """'08/03' -> '2026-03-08' (année déduite : jamais dans le futur de plus d'un mois)."""
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?", ddmm or "")
    if not m:
        return None
    d, mo = int(m.group(1)), int(m.group(2))
    y = int(m.group(3)) if m.group(3) else today.year
    if y < 100:
        y += 2000
    try:
        date = dt.date(y, mo, d)
    except ValueError:
        return None
    if not m.group(3) and date > today + dt.timedelta(days=31):
        date = date.replace(year=y - 1)
    return date.isoformat()


# ---------------------------------------------------------------- France
def parse_association(page):
    """Liste des sites : identifiant Nordic France, nom, ouverture."""
    sites = []
    for block in page.split('class="Weather-itemContainer')[1:]:
        m = re.search(r"generateBulletinStationId\((\d+)", block)
        name = re.search(r'Weather-name">([^<]+)', block)
        if m and name:
            sites.append({"id": m.group(1), "name": html.unescape(name.group(1)).strip(), "open": "ouvertureFlag--closed" not in block})
    return sites


NOT_XC = re.compile(r"raquette|alpin|luge|snowtubing|chiens|piéton", re.I)
XC = re.compile(r"\bski|fond|skating|classique", re.I)


def skip_sector(name, comment):
    """Secteurs sans intérêt pour le ski de fond (raquettes, alpin, luge…)."""
    return bool(NOT_XC.search(name or "")) or (bool(NOT_XC.search(comment)) and not XC.search(comment))


def parse_station(page, today):
    """Bulletin détaillé d'un site."""
    def field(label):
        m = re.search(r'StationWidget-snowTitle">\s*' + label + r'\s*</span>\s*:\s*([^<]*)', page)
        return m.group(1).strip() if m else ""

    snow = re.match(r"(\d+(?:[.,]\d+)?)\s*cm\s*/\s*(\d+(?:[.,]\d+)?)\s*cm", field("Hauteur de neige"))
    temps = re.findall(r'Weather-temp">\s*(-?\d+(?:[.,]\d+)?)\s*°C', page)
    km = re.search(r"#sign\"\s*/>\s*</svg>\s*([\d.,]+)\s*/\s*([\d.,]+)\s*km", page)
    quality = field("Qualité de neige")
    out = {
        "snowMin": num(snow.group(1)) if snow else None,
        "snowMax": num(snow.group(2)) if snow else None,
        "lastGrooming": iso_from_ddmm(field("Dernier damage"), today),
        "quality": "" if quality.lower().startswith("non renseign") else quality,
        "updated": iso_from_ddmm(field("Mise à jour"), today),
        "tempMorning": num(temps[0]) if temps else None,
        "tempAfternoon": num(temps[1]) if len(temps) > 1 else None,
        "kmOpen": num(km.group(1)) if km else None,
        "kmTotal": num(km.group(2)) if km else None,
    }

    # Pistes de ski de fond : ouvertes / total ; commentaires des secteurs et des pistes
    comments, xc_open, xc_total = [], 0, 0
    sector = None
    tokens = re.split(r'(?=<div class="NordicDetail-secteurHeader)|(?=<div class="NordicDetail-piste")', page)
    for tok in tokens:
        if tok.startswith('<div class="NordicDetail-secteurHeader'):
            name = re.search(r'NordicDetail-secteurName">(.*?)</', tok, re.S)
            sector = text(name.group(1)).replace("Secteur :", "").replace("Secteur", "").strip(" :") if name else None
            dmg = re.search(r'NordicDetail-damagelabel">\s*([^<]+)', tok)
            c = re.search(r'data-comment="([^"]*)"', tok.split("NordicDetail-pisteList")[0])
            if c and html.unescape(c.group(1)).strip() and not skip_sector(sector, html.unescape(c.group(1))):
                comments.append({"scope": "secteur", "name": sector, "text": html.unescape(c.group(1)).strip(), "groomed": iso_from_ddmm(dmg.group(1), today) if dmg else None})
        elif tok.startswith('<div class="NordicDetail-piste"'):
            name = re.search(r'NordicDetail-pisteName">(.*?)</', tok, re.S)
            is_xc = "#ski-de-fond" in tok
            opened = "pisteOuverture--opened" in tok
            if is_xc:
                xc_total += 1
                xc_open += opened
            c = re.search(r'data-comment="([^"]*)"', tok)
            if c and html.unescape(c.group(1)).strip() and is_xc:
                comments.append({"scope": "piste", "name": text(name.group(1)) if name else "", "sector": sector, "text": html.unescape(c.group(1)).strip(), "open": opened})
    out.update({"xcOpen": xc_open, "xcTotal": xc_total, "comments": comments[:25]})
    return out


def france(today, offline=None):
    page = open(os.path.join(offline, "assoc.html"), encoding="utf-8").read() if offline else fetch(f"{NF}/widget/marqueblanche/association/{ASSOC}")
    result = {}
    for site in parse_association(page):
        try:
            if offline:
                path = os.path.join(offline, f"st-{site['id']}.html")
                if not os.path.exists(path):
                    continue
                detail = open(path, encoding="utf-8").read()
            else:
                detail = fetch(f"{NF}/widget/marqueblanche/association/station/{site['id']}/{ASSOC}")
                time.sleep(0.6)  # courtoisie envers le serveur
            result[site["id"]] = {"name": site["name"], "open": site["open"], **parse_station(detail, today)}
        except Exception as exc:  # un site en erreur n'empêche pas les autres
            print(f"[FR] {site['name']} : {exc}", file=sys.stderr)
            result[site["id"]] = {"name": site["name"], "open": site["open"], "error": True}
    return result


# ---------------------------------------------------------------- Suisse
def switzerland(offline=None):
    page = open(os.path.join(offline, "ch.html"), encoding="utf-8").read() if offline else fetch(CH_URL)
    result = {}
    for row in page.split('class="FilterGridTable--row"')[1:]:
        title = re.search(r'FilterGridTable--title"[^>]*>([^<]+)', row)
        if not title:
            continue
        name = html.unescape(title.group(1)).strip()
        info = re.search(r'FilterGridTable--info">([^<]+)', row)
        link = re.search(r'FilterGridTable--link" href="([^"?]+)', row)
        cells = [text(c) for c in re.findall(r'<td class="FilterGridTable--cell[^"]*">(.*?)</td>', row, re.S)]
        body = " · ".join(c for c in cells if c)
        km = re.findall(r"(\d+(?:[.,]\d+)?)\s*(?:/\s*(\d+(?:[.,]\d+)?)\s*)?km", body)
        snow = re.search(r"(\d+)\s*cm", body)
        result[name] = {
            "place": html.unescape(info.group(1)).strip() if info else "",
            "noSeason": "Pas de saison" in body,
            "summary": body[:400],
            "kmOpen": num(km[0][0]) if km else None,
            "kmTotal": num(km[0][1]) if km and km[0][1] else None,
            "snow": num(snow.group(1)) if snow else None,
            "url": "https://snow.myswitzerland.com" + link.group(1) if link else None,
        }
    return result


def main():
    offline = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--offline" else None
    today = dt.date.today()
    data = {"source": "Nordic France · Espace Nordique Jurassien · Suisse Tourisme", "france": {}, "suisse": {}}
    try:
        data["france"] = france(today, offline)
    except Exception as exc:
        print(f"[FR] relevé impossible : {exc}", file=sys.stderr)
    try:
        data["suisse"] = switzerland(offline)
    except Exception as exc:
        print(f"[CH] relevé impossible : {exc}", file=sys.stderr)
    if not data["france"] and not data["suisse"]:
        sys.exit("Aucune donnée : fichier existant conservé.")

    # fetchedAt enregistre l'heure de CE relevé réussi, à chaque exécution — y compris quand le
    # contenu est identique au précédent (hors saison, rien ne change d'un jour à l'autre). Avant,
    # le script n'écrivait (et donc ne publiait) rien dans ce cas, et la date affichée dans l'app
    # finissait par dater de plusieurs jours alors que les bulletins avaient bien été revérifiés
    # entre-temps — trompeur. On écrit désormais systématiquement, pour que « bulletins relevés
    # le... » reflète toujours la dernière vérification réussie, pas le dernier changement constaté.
    previous = None
    if os.path.exists(OUT):
        try:
            previous = json.load(open(OUT, encoding="utf-8"))
        except ValueError:
            previous = None
    unchanged = previous is not None and {k: v for k, v in previous.items() if k != "fetchedAt"} == data
    data["fetchedAt"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    if unchanged:
        print(f"Bulletins inchangés, date de relevé mise à jour : {len(data['france'])} sites FR, {len(data['suisse'])} sites CH.")
    else:
        print(f"Bulletins écrits : {len(data['france'])} sites FR, {len(data['suisse'])} sites CH.")


if __name__ == "__main__":
    main()
