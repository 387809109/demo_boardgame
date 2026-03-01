/**
 * Here I Stand — Leaders, Conquistadors & Explorers
 *
 * Source: his_ref/img/processed/leaders_and_explorers.json
 * Total: 38 (15 army leaders, 3 naval leaders, 5 conquistadors, 15 explorers)
 */

export const ARMY_LEADERS = [
  { id: 'charles_brandon',     name: 'Charles Brandon',     battle: 0, command: 6,  faction: 'england' },
  { id: 'charles_v',           name: 'Charles V',           battle: 2, command: 10, faction: 'hapsburg' },
  { id: 'dudley',              name: 'Dudley',              battle: 0, command: 6,  faction: 'england' },
  { id: 'duke_of_alva',        name: 'Duke of Alva',        battle: 1, command: 6,  faction: 'hapsburg' },
  { id: 'ferdinand',           name: 'Ferdinand',           battle: 1, command: 6,  faction: 'hapsburg' },
  { id: 'francis_i',           name: 'Francis I',           battle: 1, command: 8,  faction: 'france' },
  { id: 'henry_ii',            name: 'Henry II',            battle: 0, command: 8,  faction: 'france' },
  { id: 'henry_viii',          name: 'Henry VIII',          battle: 1, command: 8,  faction: 'england' },
  { id: 'ibrahim',             name: 'Ibrahim',             battle: 1, command: 6,  faction: 'ottoman' },
  { id: 'john_frederick',      name: 'John Frederick',      battle: 0, command: 6,  faction: 'protestant' },
  { id: 'maurice_hapsburg',    name: 'Maurice of Saxony',   battle: 1, command: 6,  faction: 'hapsburg' },
  { id: 'maurice_protestant',  name: 'Maurice of Saxony',   battle: 1, command: 6,  faction: 'protestant' },
  { id: 'montmorency',         name: 'Montmorency',         battle: 1, command: 6,  faction: 'france' },
  { id: 'philip_of_hesse',     name: 'Philip of Hesse',     battle: 0, command: 6,  faction: 'protestant' },
  { id: 'renegade',            name: 'Renegade',            battle: 1, command: 6,  faction: 'independent' },
  { id: 'suleiman',            name: 'Suleiman',            battle: 2, command: 12, faction: 'ottoman' }
];

export const NAVAL_LEADERS = [
  { id: 'andrea_doria',  name: 'Andrea Doria',  battle: 2, piracy: null, faction: 'hapsburg' },
  { id: 'barbarossa',    name: 'Barbarossa',     battle: 2, piracy: 1,   faction: 'ottoman' },
  { id: 'dragut',        name: 'Dragut',         battle: 1, piracy: 2,   faction: 'ottoman' }
];

export const CONQUISTADORS = [
  { id: 'cordova',   name: 'Cordova',   conquest: 1, faction: 'hapsburg' },
  { id: 'coronado',  name: 'Coronado',  conquest: 1, faction: 'hapsburg' },
  { id: 'cortez',    name: 'Cortez',    conquest: 4, faction: 'hapsburg' },
  { id: 'montejo',   name: 'Montejo',   conquest: 2, faction: 'hapsburg' },
  { id: 'pizarro',   name: 'Pizarro',   conquest: 3, faction: 'hapsburg' }
];

export const EXPLORERS = [
  { id: 'cabot_eng',      name: 'Cabot',       exploration: 1,  faction: 'england' },
  { id: 'chancellor',     name: 'Chancellor',  exploration: 1,  faction: 'england' },
  { id: 'rut',            name: 'Rut',         exploration: 1,  faction: 'england' },
  { id: 'willoughby',     name: 'Willoughby',  exploration: 0,  faction: 'england' },
  { id: 'cabot_fra',      name: 'Cabot',       exploration: 1,  faction: 'france' },
  { id: 'cartier',        name: 'Cartier',     exploration: 3,  faction: 'france' },
  { id: 'roberval',       name: 'Roberval',    exploration: 0,  faction: 'france' },
  { id: 'verrazano',      name: 'Verrazano',   exploration: 2,  faction: 'france' },
  { id: 'cabot_hap',      name: 'Cabot',       exploration: 1,  faction: 'hapsburg' },
  { id: 'desoto',         name: 'DeSoto',      exploration: 2,  faction: 'hapsburg' },
  { id: 'de_vaca',        name: 'De Vaca',     exploration: 0,  faction: 'hapsburg' },
  { id: 'leon',           name: 'Leon',        exploration: 1,  faction: 'hapsburg' },
  { id: 'magellan',       name: 'Magellan',    exploration: 4,  faction: 'hapsburg' },
  { id: 'narvaez',        name: 'Narvaez',     exploration: -1, faction: 'hapsburg' },
  { id: 'orellana',       name: 'Orellana',    exploration: 3,  faction: 'hapsburg' }
];

/** All leaders combined for lookup */
export const ALL_LEADERS = [
  ...ARMY_LEADERS.map(l => ({ ...l, type: 'army' })),
  ...NAVAL_LEADERS.map(l => ({ ...l, type: 'naval' })),
  ...CONQUISTADORS.map(l => ({ ...l, type: 'conquistador' })),
  ...EXPLORERS.map(l => ({ ...l, type: 'explorer' }))
];

/** Lookup leader by id */
export const LEADER_BY_ID = Object.fromEntries(
  ALL_LEADERS.map(l => [l.id, l])
);
