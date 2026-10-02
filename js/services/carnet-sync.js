/*
 * Envoi direct d'une course vers le planning de l'app Carnet (Mon tableau de
 * bord), onglet Courses — via sa base Firebase Realtime Database partagée,
 * sans mot de passe (même choix assumé que les autres synchronisations de la
 * suite d'apps). Pas besoin d'ouvrir Carnet : la course apparaît dans son
 * planning dès sa prochaine synchronisation.
 */
const DB_URL = 'https://dashboard---projet-default-rtdb.europe-west1.firebasedatabase.app';

const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * @param {{name:string, sport?:string, date:string, location?:string, distance?:string, elevation?:string, notes?:string}} race
 * @returns {Promise<string>} identifiant de la course créée dans Carnet
 */
export async function addRaceToCarnet(race) {
  const id = makeId();
  const payload = {
    id,
    name: String(race.name || '').slice(0, 100),
    sport: race.sport || 'Autre',
    date: race.date,
    time: '',
    location: String(race.location || '').slice(0, 100),
    distance: String(race.distance || '').slice(0, 12),
    elevation: String(race.elevation || '').slice(0, 12),
    price: '',
    target: '',
    notes: String(race.notes || '').slice(0, 2000),
    resultTime: '',
    resultRank: '',
    resultDistance: ''
  };
  const res = await fetch(`${DB_URL}/app/races/${id}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Carnet indisponible (${res.status})`);
  return id;
}
