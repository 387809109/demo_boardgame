/**
 * Here I Stand — 1517 Scenario (6-Player) Starting Setup
 *
 * Source: his_ref/rulebook_extraction/SCENARIO_1517_SETUP.md
 * 9 turns (1517–1555), full game
 */

export const SCENARIO_1517 = {
  name: '1517 Scenario',
  description: 'Full 9-turn game (1517–1555)',
  turns: 9,
  startTurn: 1,

  // ── Starting VP ────────────────────────────────────────────────
  vp: {
    ottoman: 8,
    hapsburg: 9,
    england: 9,
    france: 12,
    papacy: 19,
    protestant: 0
  },

  // ── Unit Placements ────────────────────────────────────────────
  // Each entry: { space, units: { regulars, mercenaries, cavalry, squadrons, corsairs, leaders[] } }
  // Only non-zero fields are listed.
  deployments: {
    ottoman: [
      { space: 'Istanbul',  units: { regulars: 7, cavalry: 1, squadrons: 2, leaders: ['suleiman', 'ibrahim'] } },
      { space: 'Edirne',    units: { regulars: 1 } },
      { space: 'Salonika',  units: { regulars: 1, squadrons: 2 } },
      { space: 'Athens',    units: { regulars: 1, squadrons: 2 } }
    ],
    hapsburg: [
      { space: 'Valladolid', units: { regulars: 4, leaders: ['charles_v', 'duke_of_alva'] } },
      { space: 'Seville',    units: { regulars: 1, squadrons: 2 } },
      { space: 'Barcelona',  units: { regulars: 1, squadrons: 2 } },
      { space: 'Navarre',    units: { regulars: 1 } },
      { space: 'Tunis',      units: { regulars: 1 } },
      { space: 'Naples',     units: { regulars: 2, squadrons: 2 } },
      { space: 'Besançon',   units: { regulars: 1 } },
      { space: 'Brussels',   units: { regulars: 1 } },
      { space: 'Vienna',     units: { regulars: 4, leaders: ['ferdinand'] } },
      { space: 'Antwerp',    units: { regulars: 3 } }
    ],
    england: [
      { space: 'London',     units: { regulars: 3, squadrons: 2, leaders: ['henry_viii', 'charles_brandon'] } },
      { space: 'Portsmouth', units: { squadrons: 2 } },
      { space: 'Calais',     units: { regulars: 2 } },
      { space: 'York',       units: { regulars: 1 } },
      { space: 'Bristol',    units: { regulars: 1 } }
    ],
    france: [
      { space: 'Paris',      units: { regulars: 4, leaders: ['francis_i', 'montmorency'] } },
      { space: 'Rouen',      units: { regulars: 1, squadrons: 2 } },
      { space: 'Bordeaux',   units: { regulars: 2 } },
      { space: 'Lyon',       units: { regulars: 1 } },
      { space: 'Marseille',  units: { regulars: 1, squadrons: 2 } },
      { space: 'Milan',      units: { regulars: 2 } },
      { space: 'Turin',      units: { regulars: 1 } }
    ],
    papacy: [
      { space: 'Rome',       units: { regulars: 1, squadrons: 2 } },
      { space: 'Ravenna',    units: { regulars: 1 } }
    ],
    protestant: [
      { space: 'Wittenberg',  units: { regulars: 2 } },
      { space: 'Augsburg',    units: { regulars: 2 } },
      { space: 'Cologne',     units: { regulars: 1 } },
      { space: 'Trier',       units: { regulars: 1 } },
      { space: 'Mainz',       units: { regulars: 1 } },
      { space: 'Brandenburg', units: { regulars: 1 } }
    ]
  },

  // ── Minor Power Deployments ────────────────────────────────────
  minorDeployments: {
    venice: [
      { space: 'Venice', units: { regulars: 2, squadrons: 3 } },
      { space: 'Corfu',  units: { regulars: 1 } },
      { space: 'Candia', units: { regulars: 1 } }
    ],
    genoa: [
      { space: 'Genoa', units: { regulars: 2, squadrons: 2, leaders: ['andrea_doria'] } }
    ],
    hungary_bohemia: [
      { space: 'Belgrade', units: { regulars: 1 } },
      { space: 'Buda',     units: { regulars: 5 } },
      { space: 'Prague',   units: { regulars: 1 } }
    ],
    scotland: [
      { space: 'Edinburgh', units: { regulars: 3, squadrons: 2 } },
      { space: 'Stirling',  units: {} }  // fortress marker only
    ]
  },

  // ── Independent Garrisons ──────────────────────────────────────
  independentDeployments: [
    { space: 'Rhodes',   units: { regulars: 1 } },  // Knights of St. John
    { space: 'Metz',     units: { regulars: 1 } },
    { space: 'Florence', units: { regulars: 1 } }
  ],

  // ── Control Markers ────────────────────────────────────────────
  // Spaces with Square Control Markers (political control) by power
  controlMarkers: {
    ottoman:  ['Istanbul', 'Edirne', 'Salonika', 'Athens'],
    hapsburg: ['Valladolid', 'Seville', 'Barcelona', 'Navarre', 'Tunis', 'Naples', 'Vienna', 'Antwerp'],
    england:  ['London', 'Calais', 'York', 'Bristol'],
    france:   ['Paris', 'Rouen', 'Bordeaux', 'Lyon', 'Marseille', 'Milan', 'Turin'],
    papacy:   ['Rome', 'Ravenna']
  },

  // Hexagonal Control Markers (Catholic) on all 21 Protestant home spaces
  // (= all German-zone spaces with controller 'protestant' in map data)
  catholicMarkers: [
    'Augsburg', 'Brandenburg', 'Bremen', 'Brunswick', 'Cologne', 'Erfurt',
    'Hamburg', 'Kassel', 'Leipzig', 'Lübeck', 'Magdeburg', 'Mainz',
    'Münster', 'Nuremberg', 'Regensburg', 'Salzburg', 'Stettin',
    'Strasburg', 'Trier', 'Wittenberg', 'Worms'
  ],

  // French HCM on Turin
  specialMarkers: [
    { space: 'Turin', type: 'catholic_control', power: 'france' }
  ],

  // ── Diplomatic Status ──────────────────────────────────────────
  wars: [
    { a: 'hapsburg', b: 'france' },
    { a: 'france',   b: 'papacy' },
    { a: 'ottoman',  b: 'hungary_bohemia' }
  ],

  // ── Power-Specific State ───────────────────────────────────────
  powerState: {
    ottoman: {
      piracyTrack: 0
    },
    england: {
      maritalStatus: 'catherine_of_aragon'
    },
    france: {
      chateauxTrack: 0
    },
    papacy: {
      ruler: 'leo_x',
      stPetersProgress: 0,
      stPetersVp: 0,
      debaters: ['eck', 'campeggio', 'aleander', 'tetzel', 'cajetan']
    },
    protestant: {
      debaters: ['luther', 'melanchthon', 'bucer', 'carlstadt'],
      protestantSpaces: 0,
      translationTracks: {
        german: 0,
        english: 0,
        french: 0
      }
    }
  },

  // ── Starting Deck ──────────────────────────────────────────────
  // Cards NOT in starting deck (added Turn 3+): #14–#23, #38–#64, #113–#116
  excludedCards: [
    ...Array.from({ length: 10 }, (_, i) => 14 + i),   // 14–23
    ...Array.from({ length: 27 }, (_, i) => 38 + i),    // 38–64
    ...Array.from({ length: 4 }, (_, i) => 113 + i)     // 113–116
  ]
};
