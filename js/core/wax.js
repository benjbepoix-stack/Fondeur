/*
 * Repère fart de retenue (grip), par bande de température — à titre indicatif.
 * Les plages ci-dessous suivent l'ordre classique des fartothèques (vert →
 * bleu → violet → rouge → jaune/klister) mais sont volontairement génériques
 * (pas liées à une marque). Le choix réel dépend aussi de l'état de la neige
 * (fraîche, transformée, humide, regelée) et de son grain, qu'on ne mesure
 * pas ici : à confirmer sur place ou avec le bulletin des pisteurs.
 */
const BANDS = [
  { max: -15, name: 'Vert', color: '#2f8f5b', note: 'neige très froide et sèche' },
  { max: -8, name: 'Bleu foncé', color: '#1f5fa8', note: 'neige froide' },
  { max: -3, name: 'Bleu', color: '#2f84d1', note: 'neige froide à tempérée' },
  { max: -1, name: 'Violet', color: '#8057b8', note: 'neige autour de 0 °C' },
  { max: 1, name: 'Rouge', color: '#c23b3b', note: 'neige humide' },
  { max: Infinity, name: 'Jaune / klister', color: '#cf9f1e', note: 'neige mouillée ou transformée' }
];

/** Bande de fart pour une température donnée, ou null si inconnue. */
export function waxFor(tempC) {
  if (tempC === null || tempC === undefined || Number.isNaN(tempC)) return null;
  const band = BANDS.find(b => tempC <= b.max);
  return { temp: tempC, ...band };
}
