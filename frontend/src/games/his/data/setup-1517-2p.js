/**
 * Here I Stand — Two-Player Variant Setup (derived from the 1517 scenario)
 *
 * Source: his_ref/Scenarios.pdf pp. 37–40 (see docs/games/his/TWO_PLAYER_PLAN.md).
 * Produces a transformed copy of SCENARIO_1517 with the variant's deck removals
 * and board deltas applied, leaving the German/Italian-zone religious battleground
 * intact. Fully additive — the standard 1517 scenario object is never mutated.
 */

import { SCENARIO_1517 } from './setup-1517.js';
import { LAND_SPACES } from './map-data.js';

/** Main-deck cards removed for the two-player variant (49 cards; pp. 39–40). */
export const TWO_PLAYER_REMOVED_CARDS = [
  1, 2, 3, 4, 9, 18, 30, 34, 40, 42, 48, 49, 50, 53, 54, 58, 59, 66, 68, 69,
  72, 73, 74, 77, 80, 82, 83, 84, 86, 87, 89, 92, 93, 94, 96, 97, 98, 99, 100,
  101, 103, 108, 110, 111, 112, 113, 114, 115, 116
];

/** Land language zones kept at full strength (the religious battleground). */
const INNER_ZONES = new Set(['german', 'italian']);

/** The only ports that keep their naval units at start (§Setup). */
const KEEP_NAVAL_PORTS = new Set(['Marseille', 'Genoa', 'Naples', 'Venice', 'Rome']);

/** The only leader left on the map at start (§Setup). */
const KEEP_LEADERS = new Set(['andrea_doria']);

/**
 * Hungary/Bohemia (Eastern Europe, all outside the inner zones) is reassigned:
 * Prague → Hapsburg; Buda & Belgrade → Ottoman (1 regular each). Brunn/Breslau
 * are Hapsburg HCM (Catholic) — already Catholic by default, so no unit change.
 */
const EASTERN_REASSIGN = { Prague: 'hapsburg', Buda: 'ottoman', Belgrade: 'ottoman' };

const ZONE_BY_SPACE = Object.fromEntries(
  LAND_SPACES.map((s) => [s.name, s.languageZone])
);

/**
 * Apply the §13/§Setup unit reduction to one deployment's `units`:
 * outside the inner zones → at most 1 regular and no other land units; naval
 * kept only in the five named ports; only Andrea Doria kept among leaders.
 * @param {string} space
 * @param {Object} units - raw deployment units (only non-zero fields present)
 * @returns {Object} transformed units
 */
function reduceUnits(space, units) {
  const inner = INNER_ZONES.has(ZONE_BY_SPACE[space]);
  const out = {
    regulars: units.regulars || 0,
    mercenaries: units.mercenaries || 0,
    cavalry: units.cavalry || 0,
    squadrons: units.squadrons || 0,
    corsairs: units.corsairs || 0,
    leaders: (units.leaders || []).filter((l) => KEEP_LEADERS.has(l))
  };

  if (!KEEP_NAVAL_PORTS.has(space)) {
    out.squadrons = 0;
    out.corsairs = 0;
  }

  if (!inner) {
    const hadLand = out.regulars + out.mercenaries + out.cavalry > 0;
    out.regulars = hadLand ? 1 : 0;
    out.mercenaries = 0;
    out.cavalry = 0;
  }

  return out;
}

function mapDeployments(group) {
  const result = {};
  for (const [power, placements] of Object.entries(group)) {
    result[power] = placements.map((d) => ({
      space: d.space,
      units: reduceUnits(d.space, d.units)
    }));
  }
  return result;
}

/**
 * Build the two-player scenario: a transformed deep copy of SCENARIO_1517.
 * @returns {Object} scenario object consumed by buildInitialState/buildSpaces
 */
export function buildTwoPlayerScenario() {
  const base = SCENARIO_1517;
  const s = structuredClone(base);

  // 1. Deck removals (merge with the scenario's own timing exclusions).
  s.excludedCards = [...new Set([...base.excludedCards, ...TWO_PLAYER_REMOVED_CARDS])];

  // 2. Reassign the Hungary/Bohemia spaces out of the minor power and into the
  //    appropriate major power before the generic reduction runs.
  const hb = s.minorDeployments.hungary_bohemia || [];
  const remainHB = [];
  for (const dep of hb) {
    const target = EASTERN_REASSIGN[dep.space];
    if (target) {
      s.deployments[target] = s.deployments[target] || [];
      s.deployments[target].push({ space: dep.space, units: { regulars: 1 } });
    } else {
      remainHB.push(dep);
    }
  }
  s.minorDeployments.hungary_bohemia = remainHB;
  s.controlMarkers.hapsburg = [...(s.controlMarkers.hapsburg || []), 'Prague'];
  s.controlMarkers.ottoman = [...(s.controlMarkers.ottoman || []), 'Buda', 'Belgrade'];

  // 3. Generic §Setup unit reduction across every deployment group.
  s.deployments = mapDeployments(s.deployments);
  s.minorDeployments = mapDeployments(s.minorDeployments);
  s.independentDeployments = s.independentDeployments.map((d) => ({
    space: d.space,
    units: reduceUnits(d.space, d.units)
  }));

  // 4. Diplomatic status: the non-player powers start at peace — per §3 they
  //    only participate once activated by an Invasion card (or the Schmalkaldic
  //    League), so the standard 1517 starting wars do not carry over. Hungary
  //    starts as a Hapsburg ally (§Setup).
  s.wars = [];
  s.alliances = [
    ...(base.alliances || []),
    { a: 'hapsburg', b: 'hungary_bohemia' }
  ];

  s.name = '1517 Scenario (Two-Player)';
  s.variant = 'two_player';
  return s;
}
