/*
 * Envoi des courses validées vers le planning de l'app Allure.
 *
 * Allure range ses courses dans le nœud qu'elle partage avec Carnet,
 * `users/<uid>/carnet/races`, sur le projet Firebase commun à la suite d'apps
 * (connexion e-mail / mot de passe, même compte qu'Allure, Carnet, Mon Garage
 * et Ma Maison). La session est partagée avec les autres apps ouvertes à la
 * même adresse dans le même navigateur ; sur iPhone, l'app installée sur
 * l'écran d'accueil demande une connexion, une seule fois.
 *
 * - Le SDK est chargé à la demande (onglet Courses), jamais au démarrage.
 * - L'ajout passe par une transaction sur la tranche `races` : la liste
 *   existante est relue et complétée, jamais écrasée ; une course déjà
 *   présente (même nom, même date) n'est pas ajoutée deux fois.
 * - Tant que le nœud n'a pas été transféré depuis l'ancienne base (marqueur
 *   `migrated`, posé par Allure ou Carnet), rien n'est écrit : une tranche
 *   `races` créée trop tôt empêcherait la reprise des courses existantes.
 */
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const LOAD_TIMEOUT = 12000;

/* Configuration Web du projet commun (valeurs publiques par conception ; données protégées par compte). */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdtuzUxcc7JIxtYDXh3dPmrXMP3HePBT4',
  authDomain: 'test-e27e9.firebaseapp.com',
  databaseURL: 'https://test-e27e9-default-rtdb.europe-west1.firebasedatabase.app/',
  projectId: 'test-e27e9',
  storageBucket: 'test-e27e9.firebasestorage.app',
  messagingSenderId: '435431704932',
  appId: '1:435431704932:web:abc6928490d225a1021271'
};

export class AllureError extends Error {
  /** @param {'signed-out'|'not-migrated'|'unavailable'} code */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

let loading = null;
let user; // undefined : réponse du service de connexion attendue ; null : pas de compte
let userReady = null;
let listeners = [];

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('délai dépassé')), ms))]);

/** Charge le SDK une seule fois ; résout { authMod, dbMod, auth, db }. */
function load() {
  if (!loading) {
    loading = withTimeout(
      Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-database.js`)]),
      LOAD_TIMEOUT
    ).then(async ([appMod, authMod, dbMod]) => {
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      const db = dbMod.getDatabase(app);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {});
      userReady = new Promise(resolve => {
        authMod.onAuthStateChanged(auth, u => {
          user = u || null;
          resolve();
          listeners.forEach(fn => fn(user));
        });
      });
      return { authMod, dbMod, auth, db };
    });
    loading.catch(() => {
      loading = null; // nouvel essai au prochain appel (retour du réseau)
    });
  }
  return loading;
}

async function ready() {
  try {
    const mods = await load();
    await userReady;
    return mods;
  } catch (error) {
    console.warn('[allure] Firebase injoignable', error);
    throw new AllureError('unavailable', 'Allure injoignable (connexion ?).');
  }
}

/** Prépare la connexion en arrière-plan (sans erreur visible). */
export const warmUp = () => ready().catch(() => {});

/** Compte connecté (null si aucun), après réponse du service de connexion. */
export async function allureUser() {
  await ready();
  return user;
}

/** Abonnement aux changements de compte. */
export function onAllureUser(fn) {
  listeners.push(fn);
  if (user !== undefined) fn(user);
}

export async function signInAllure(email, password) {
  const { authMod, auth } = await ready();
  return authMod.signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAllure() {
  const { authMod, auth } = await ready();
  return authMod.signOut(auth);
}

export function describeAuthError(error) {
  const map = {
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cette adresse e-mail.',
    'auth/missing-password': 'Indiquez votre mot de passe.',
    'auth/network-request-failed': 'Connexion Internet indisponible.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.'
  };
  return map[error?.code] || error?.message || 'Une erreur est survenue. Réessayez.';
}

const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
/* Firebase peut rendre un tableau sous forme d'objet indexé (comme le relit Allure). */
const asArray = v => (Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
const sameRace = (a, b) => String(a.name || '').trim().toLowerCase() === b.name.trim().toLowerCase() && a.date === b.date;

/** Format d'une course dans Allure (mêmes champs que sa fiche). */
function toAllure(race) {
  return {
    id: makeId(),
    name: String(race.name || '').slice(0, 100),
    sport: race.sport || 'Autre',
    date: race.date,
    time: '',
    location: String(race.location || '').slice(0, 100),
    distance: String(race.distance || '').slice(0, 12),
    elevation: String(race.elevation || '').slice(0, 12),
    price: '',
    target: '',
    notes: '',
    resultTime: '',
    resultRank: '',
    resultDistance: ''
  };
}

/**
 * Ajoute des courses au planning d'Allure, en une seule transaction.
 * @param {{name:string, sport?:string, date:string, location?:string}[]} races
 * @returns {Promise<{added:number, already:number}>}
 */
export async function addRacesToAllure(races) {
  const { dbMod, db } = await ready();
  if (!user) throw new AllureError('signed-out', 'Connectez-vous pour envoyer vers Allure.');
  const base = `users/${user.uid}/carnet`;
  const migrated = await dbMod.get(dbMod.ref(db, `${base}/migrated`));
  if (!migrated.exists()) throw new AllureError('not-migrated', 'Ouvrez Allure une fois pour transférer vos données, puis réessayez.');

  let counts = { added: 0, already: 0 };
  await dbMod.runTransaction(dbMod.ref(db, `${base}/races`), current => {
    const list = asArray(current);
    counts = { added: 0, already: 0 };
    for (const race of races) {
      if (list.some(r => sameRace(r, race))) counts.already++;
      else {
        list.push(toAllure(race));
        counts.added++;
      }
    }
    return list;
  });
  return counts;
}
