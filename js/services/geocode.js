/*
 * Recherche de commune (nom -> coordonnées de son centre), via l'API de géocodage
 * gratuite d'Open-Meteo (pas de clé, déjà utilisée pour la météo de l'app).
 */
const API = 'https://geocoding-api.open-meteo.com/v1/search';

/** Jusqu'à 6 communes correspondant à la recherche, avec leurs coordonnées. */
export async function searchPlace(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const p = new URLSearchParams({ name: q, count: '6', language: 'fr', format: 'json' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API}?${p}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return (json.results || []).map(r => ({
      name: r.name,
      detail: [r.admin1 && r.admin1 !== r.name ? r.admin1 : '', r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude
    }));
  } finally {
    clearTimeout(timer);
  }
}
