/*
 * Courses populaires de ski de fond du Massif du Jura (France et Jura
 * suisse), sélection curatée et mise à jour à la main (pas de flux en
 * direct). La plupart des dates précises de l'édition 2027 ne sont pas
 * encore publiées début octobre 2026 (elles sortent en général fin
 * octobre/novembre) : `date` est une estimation à vérifier et corriger
 * avant d'ajouter la course au planning — le champ reste modifiable.
 */
export const RACES = [
  {
    id: 'transjurassienne',
    name: 'La Transjurassienne (Transju’Classic)',
    location: 'Lamoura → Les Rousses (Jura)',
    period: '13–14 février 2027 (confirmé — nouveau parcours unique de 50 km)',
    date: '2027-02-13',
    confirmed: true,
    distance: 'Classique le 13/02, skating le 14/02 — détail des distances 2027 non finalisé',
    notes: 'Classique le 13 février, skating le 14. Nouveau tracé permanent de 50 km à partir de 2027.',
    link: 'https://www.latransju.com/'
  },
  {
    id: 'belles-combes',
    name: 'Les Belles Combes',
    location: 'Les Moussières (Jura)',
    period: 'Mi-décembre, date 2026 non confirmée (édition précédente ~19–20 décembre)',
    date: '2026-12-19',
    confirmed: false,
    distance: '15, 30 km (+ Marathon Ski Tour FFS associé : 15 / 23 / 42 km)',
    notes: '',
    link: 'https://www.ski-massif-jurassien.com/'
  },
  {
    id: 'risouxloppet',
    name: 'La Risouxloppet',
    location: 'Chaux-Neuve (Doubs)',
    period: 'Fin décembre, date 2026 non confirmée (généralement ~27 décembre)',
    date: '2026-12-27',
    confirmed: false,
    distance: '12,5 et 25 km, skating',
    notes: '',
    link: 'https://www.nordicmag.info/'
  },
  {
    id: 'ronde-des-cimes',
    name: 'La Ronde des Cîmes',
    location: 'Les Fourgs (Doubs)',
    period: 'Début janvier, date 2027 non annoncée',
    date: '2027-01-10',
    confirmed: false,
    distance: '10 et 30 km, skating',
    notes: '⚠️ Sensible à l’enneigement : déjà annulée certaines années.',
    link: 'https://www.ski-massif-jurassien.com/'
  },
  {
    id: 'envolee-nordique',
    name: 'L’Envolée Nordique',
    location: 'Chapelle-des-Bois (Doubs)',
    period: 'Fin janvier, date 2027 non annoncée (généralement ~24–25 janvier)',
    date: '2027-01-24',
    confirmed: false,
    distance: '25 et 42 km, skating',
    notes: '',
    link: 'https://www.envoleenordique.com/'
  },
  {
    id: 'marathon-des-neiges',
    name: 'Le Marathon des Neiges',
    location: 'Nanchez — Plateau du Grandvaux (Jura)',
    period: 'Début février, date 2027 non annoncée',
    date: '2027-02-06',
    confirmed: false,
    distance: '15 et 30 km, skating',
    notes: '⚠️ Édition 2026 annulée faute de neige.',
    link: 'https://www.ski-massif-jurassien.com/'
  },
  {
    id: 'marathon-du-turchet',
    name: 'Le Marathon du Turchet',
    location: 'Les Pontets (Doubs)',
    period: 'Mi-février, date 2027 non annoncée',
    date: '2027-02-14',
    confirmed: false,
    distance: '15 et 30 km',
    notes: '',
    link: 'https://www.ski-massif-jurassien.com/'
  },
  {
    id: 'traversee-du-massacre',
    name: 'La Traversée du Massacre',
    location: 'Prémanon (Jura)',
    period: 'Début mars, date 2027 non annoncée (généralement ~1er mars)',
    date: '2027-03-01',
    confirmed: false,
    distance: '21 et 42 km, skating',
    notes: '',
    link: 'https://www.ski-massif-jurassien.com/'
  },
  {
    id: 'franches-nordique',
    name: 'La Franches Nordique (Swiss Loppet)',
    location: 'Les Breuleux / Saignelégier (Jura suisse)',
    period: '21 février 2027 (calendrier Swiss Loppet)',
    date: '2027-02-21',
    confirmed: true,
    distance: '25 km, skating',
    notes: '⚠️ Déjà annulée certaines années faute de neige.',
    link: 'https://www.swiss-ski.ch/fr/events/swiss-loppet/'
  },
  {
    id: 'siberienne',
    name: 'La Sibérienne',
    location: 'La Brévine (Neuchâtel, Jura suisse)',
    period: 'Fin février, date 2027 non annoncée',
    date: '2027-02-27',
    confirmed: false,
    distance: '15 et 30 km, skating (classique pour les jeunes)',
    notes: '',
    link: 'https://www.mso.swiss/fr/events/785-la-siberienne'
  }
];
