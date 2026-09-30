/* Carte des stations (Leaflet + OpenStreetMap), chargée à la première ouverture. */
import { esc } from '../core/utils.js';
import { levelOf } from '../core/score.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
let loading = null;
let map = null;
let layer = null;
let fitted = false;

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${LEAFLET}leaflet.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${LEAFLET}leaflet.js`;
    js.onload = resolve;
    js.onerror = () => reject(new Error('Carte indisponible (connexion ?).'));
    document.head.appendChild(js);
  });
  return loading;
}

export async function renderMap(list, state) {
  const host = document.getElementById('map');
  try {
    await loadLeaflet();
  } catch (error) {
    host.innerHTML = `<div class="empty-state"><p>${esc(error.message)}</p></div>`;
    return;
  }
  const L = window.L;
  if (!map) {
    map = L.map(host, { zoomControl: true, attributionControl: true }).setView([46.75, 6.3], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16, attribution: '© OpenStreetMap' }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  setTimeout(() => map.invalidateSize(), 50);
  layer.clearLayers();
  if (state.origin) {
    L.marker([state.origin.lat, state.origin.lon], { icon: L.divIcon({ className: 'map-home', html: '<i></i>', iconSize: [18, 18] }), title: state.origin.name, zIndexOffset: 1000 }).addTo(layer);
  }
  const pts = [];
  list.forEach(r => {
    const s = r.station;
    const lvl = levelOf(r.score);
    const m = L.marker([s.lat, s.lon], {
      icon: L.divIcon({ className: 'map-pin-wrap', html: `<span class="map-pin is-${lvl}${r.fav ? ' is-fav' : ''}" data-station="${esc(s.id)}">${r.score ?? '—'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: s.name,
      riseOnHover: true,
      zIndexOffset: (r.score ?? 0) * 10
    });
    m.bindTooltip(`${r.fav ? '★ ' : ''}${esc(s.name)} · ${r.score ?? '—'}/100`, { direction: 'top', offset: [0, -14] });
    m.addTo(layer);
    pts.push([s.lat, s.lon]);
  });
  if (!fitted && pts.length) {
    map.fitBounds(pts, { padding: [24, 24] });
    fitted = true;
  }
}
