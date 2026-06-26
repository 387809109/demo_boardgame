# Here I Stand — Developer Rules Specification

**Source basis:**
- This file consolidates the former `RULEBOOK_FOR_DEVELOPMENT.md` (English implementation reference)
- `docs/games/his/RULEBOOK_SECTION_NORMALIZED_ZH.md` (Chinese primary reference — authoritative)

**Purpose:**  
Implementation-first rules document for building the HIS game engine.  
Rule text is rewritten into deterministic data and resolution algorithms.  
Card-specific text effects are not reprinted; implement from card data.

**Companion data files:**
- `POWER_CARDS.md` — Action costs, ruler attributes, VP/key tracks, power-specific mechanics
- `SCENARIO_1517_SETUP.md` — Initial unit placements, VP, diplomatic status for 6-player 1517 setup
- `RELIGIOUS_STRUGGLE.md` — Protestant Spaces Track (0–50 dual VP values), all 27 debater stats
- `SEQUENCE_OF_PLAY.md` — 9-phase structure, turn-by-turn debater/card/mandatory event schedule

**Deferred extraction (use image sources when developing these modules):**
- Combat tables: `his_ref/img/classified/action summary.jpg`
- Map topology: `his_ref/img/classified/world map.jpg`

---

## 1. Game Summary

- **Players:** 2–6 (major powers may be shared in low player counts).
- **Major powers:** Ottoman, Hapsburg, England, France, Papacy, Protestant.
- **Minor powers:** Genoa, Hungary/Bohemia, Scotland, Venice.
- **Turn limit:** up to 9 turns.

**Immediate wins (during Action Phase):**
1. **Military victory:** Non-Protestant power controls enough key spaces to expose their `Auto Win` marker on the power card, with no required key space in unrest.  
   - Only `isKey: true` spaces count. German electorates (`isElectorate: true, isKey: false`) do **not** count toward auto-win thresholds.  
   - If auto-win is briefly exposed in Diplomacy Phase via peace/transfers but not maintained at Action Phase start, it does not trigger.
2. **Religious victory:** Protestant reaches 50 Protestant-influence spaces at any point (spaces in unrest do not count).

**End-of-turn wins (Victory Determination Phase):**
1. **Standard victory:** Any power has VP ≥ 25 and highest total.
2. **Domination victory:** Turn ≥ 4; a power has VP < 25 but is at least +5 VP ahead of **every** other power.
3. **Time limit victory:** Highest VP after Turn 9.

**Tie-breaking:** Compare previous turn VP; walk backward turn-by-turn until broken.

---

## 2. Core State Model

```ts
type MajorPower = 'ottoman' | 'hapsburg' | 'england' | 'france' | 'papacy' | 'protestant';
type MinorPower = 'genoa' | 'hungary_bohemia' | 'scotland' | 'venice';
type Religion = 'catholic' | 'protestant' | 'other';
type LanguageZone = 'german' | 'english' | 'french' | 'spanish' | 'italian';

interface SpaceState {
  id: string;
  homePower: MajorPower | MinorPower | 'independent';
  controller: MajorPower | MinorPower | 'independent' | null;
  religion: Religion;
  unrest: boolean;
  isKey: boolean;             // counts toward VP/auto-win track
  isElectorate: boolean;      // Diet of Worms / Schmalkaldic League mechanic only
  isFortress: boolean;        // has permanent fortification
  isPort: boolean;
  languageZone: LanguageZone | null;  // null for Ottoman/non-European spaces
  adjacentSpaces: string[];
  adjacentSeaZones: string[];
  passConnections: string[];          // costs 2 CP to cross
  hasJesuitUniversity: boolean;
  siege?: { besieger: MajorPower };
  units: UnitStack[];
}

interface UnitStack {
  owner: MajorPower | MinorPower;
  regulars: number;
  mercenaries: number;
  cavalry: number;       // Ottoman only
  squadrons: number;
  corsairs: number;      // Ottoman only
  leaders: string[];     // leader IDs
}

interface LeaderState {
  id: string;
  owner: MajorPower | MinorPower;
  type: 'army' | 'naval';
  commandRating: number;   // max units in formation
  battleRating: number;    // extra dice in combat
  location: string | null; // space/sea zone id; null = off-map/captured
  captured: boolean;
  capturedBy: MajorPower | null;
}

interface ReformerState {
  id: string;             // 'luther' | 'calvin' | 'zwingli' | 'cranmer' | ...
  alive: boolean;
  location: string | null;
  committed: boolean;
  debateValue: number;
  excommunicated: boolean;
}

interface RulerState {
  power: MajorPower;
  rulerId: string;
  adminRating: number;  // max cards retained between turns
  cardBonus: number;    // extra cards dealt each turn
}

interface DiplomaticState {
  atWar: Record<MajorPower, Record<MajorPower | MinorPower, boolean>>;
  alliedMajor: Record<MajorPower, Record<MajorPower, boolean>>;
  alliedMinor: Record<MinorPower, MajorPower | null>;
  loanedSquadrons: Array<{ from: MajorPower; to: MajorPower; count: number }>;
}

interface GameState {
  turn: number;
  phase: 'luther_95' | 'card_draw' | 'diplomacy' | 'diet_of_worms' |
         'spring_deployment' | 'action' | 'winter' | 'new_world' | 'victory_determination';
  impulseIndex: number;
  activePower: MajorPower | null;
  consecutivePasses: number;
  spaces: Record<string, SpaceState>;
  rulers: Record<MajorPower, RulerState>;
  diplomacy: DiplomaticState;
  deck: string[];
  discard: string[];
  removedCards: string[];
  hands: Record<MajorPower, string[]>;
  homeCardPlayed: Record<MajorPower, boolean>;
  vp: Record<MajorPower, number>;
  bonusVp: Record<MajorPower, number>;
  leaders: Record<string, LeaderState>;
  reformers: Record<string, ReformerState>;
  debaters: Record<'papal' | 'protestant', DebaterState[]>;

  // England-specific
  henryMaritalStatus: string;  // 'catherine' | 'anne_boleyn' | 'jane_seymour' | 'anne_cleves' | 'kathryn_howard' | 'katherine_parr'
  edwardBorn: boolean;
  elizabethBorn: boolean;

  // Papacy-specific
  stPetersProgress: number;
  jesuitUnlocked: boolean;

  // Protestant-specific
  schmalkaldicLeagueFormed: boolean;
  translationTrack: Record<LanguageZone, number>;
  protestantSpaceCount: number;

  // Ottoman-specific
  piracyVp: number;         // 0–10 cap
  algiersInPlay: boolean;   // true after Barbary Pirates event

  // New World
  newWorld: {
    colonies: Record<MajorPower, number>;
    explorersUnderway: Array<{ power: MajorPower; explorer: string; destination: string }>;
    conquestsUnderway: Array<{ power: MajorPower; conquistador: string; destination: string }>;
    galleons: Record<MajorPower, boolean>;
    plantations: Record<MajorPower, boolean>;
    potosi: MajorPower | null;
    raiders: Record<MajorPower, boolean>;
  };

  // Active global event markers
  augsburgConfessionActive: boolean;
  printingPressActive: boolean;
  wartburgActive: boolean;

  // Tracking
  turnTrack: {
    navalLeaders: Array<{ power: MajorPower; leaderId: string; returnTurn: number; source: string; space: string }>;
    navalUnits: Array<{ power: MajorPower; type: string; count: number; returnTurn: number; source: string; space: string }>;
  };
}
```

---

## 3. Constants and Ordering

**Impulse order (fixed):**
1. Ottoman
2. Hapsburg
3. England
4. France
5. Papacy
6. Protestant

**Hit rule:** Each die result `≥ 5` is a hit.  
**Tie rule:** Defender wins (except where specific religious tie-break rules override).

**Key VP thresholds (auto-win):** See `POWER_CARDS.md`. Only `isKey: true` spaces count; electorates never count.

---

## 4. Turn and Phase Engine

**Turn 1 phase order:**
1. `luther_95`
2. `card_draw`
3. `diplomacy` (abbreviated — no peace/ransom/excommunication segments)
4. `diet_of_worms`
5. `spring_deployment`
6. `action`
7. `winter`
8. `new_world`
9. `victory_determination`

**Turn 2+ phase order:** phases 2–9 only (skip `luther_95` and `diet_of_worms`).

**`card_draw` auto-executes** and immediately advances to `diplomacy`; it is never an interactive phase.

### Action Phase Loop

Each impulse, the active power must choose exactly one:
1. Play card for CP.
2. Play card as event.
3. Pass.

**Pass is illegal if:**
1. Home card still in hand.
2. Any mandatory event still in hand.
3. Hand size exceeds current ruler admin rating.

**Additional pass restrictions:**
- A power **cannot** pass while it has cards to play if passing would skip a mandatory event it is obligated to play that turn.
- Response cards can be played outside the active power's impulse (in interrupt windows).

**Phase ends:** After 6 consecutive passes from all powers combined.

---

## 5. Card System

**Card types:**
- **Home:** starts in owner hand each turn; cannot be randomly stolen; goes to power card board after play (not discard pile).
- **Mandatory event:** must be played in Action Phase of designated turn; event resolves first, then grants 2 CP (except Luther's 95 Theses, which grants 0 CP); usually removed after resolution.
- **Event:** normal optional event; can be used for event or CP.
- **Response:** may interrupt impulses/combat/event windows; can be played outside active power's impulse.
- **Combat:** playable as event only during field battle/assault/naval combat where owner participates; otherwise usable for CP only.

**"Other phase" cards (5 cards):** certain cards can be played outside the Action Phase; see card data for specifics.

**Special card restrictions:**
- `Here I Stand` and `Papal Inquisition`: even after being discarded and recycled, cannot be recovered by the powers that originally played them.
- Protestant card draw threshold: exactly 5 cards if Protestant has political control of ≥ 4 electorates; otherwise 4.

### Deck Lifecycle

1. At Card Draw Phase: add turn-gated cards and variable cards if conditions met.
2. Shuffle shared deck.
3. Deal base cards + ruler card bonus to each power.
4. Hand = dealt cards + retained carryover (≤ admin rating) + home card(s).
5. Discard pile is recycled into deck next turn.

**Base card draw (non-Protestant):** determined by key-control track on power card, reduced by unrest markers on key boxes; minimum 1 base card.

**Base card draw (Protestant):** 5 if ≥ 4 electorates under Protestant political control, else 4.

---

## 6. Rulers and Admin

- **`adminRating`:** max cards retained between turns (excess discarded).
- **`cardBonus`:** extra cards dealt each turn.
- Ottoman (Suleiman) and Hapsburg (Charles V) rulers remain constant throughout the game.
- Other powers receive ruler changes through mandatory events.
- Some rulers alter religious subsystem behavior (e.g., Mary I, Edward VI, Elizabeth I).

---

## 7. Units and Formations

**Land unit types:**
- Regulars (all powers)
- Mercenaries (all major powers except Ottoman)
- Cavalry (Ottoman only)

**Naval unit types:**
- Squadrons (all except Protestant and Hungary/Bohemia)
- Corsairs (Ottoman only)

**Unit denomination replacement:** when a unit type is eliminated, it must be replaced in order (e.g., mercenaries before regulars as losses) per the specific card/event text; applies mainly to naval losses and certain event effects.

**Formation rules (land):**
- No leader: max 4 land units.
- One leader: max = that leader's command rating.
- Two+ leaders: max = sum of top two command ratings.
- Army leaders are **not** counted as units toward the cap.

**Formation cap for naval transport:** max 5 land units + leaders.

---

## 8. Diplomacy Phase

**Segments execute in this strict order:**
1. Negotiations (includes alliance formation)
2. Suing for Peace
3. Ransom of Leaders
4. Remove Excommunication
5. Declarations of War

**Turn 1 Diplomacy is abbreviated:** only Negotiations and Declarations of War; no Peace/Ransom/Excommunication segments.

### 8.1 Negotiations

Legal state changes during negotiations:
- End war by mutual agreement (white peace; **no** War Winner VP awarded).
- Form one-turn alliance (removed in Winter Phase).
- Loan naval squadrons and naval leaders within an alliance (one-way per turn).
- Return captured army leaders.
- Transfer political control of non-capital, non-allied-minor-home-key spaces.
- Give up to 2 random card draws to another power (one-way; Home cards excluded from random draws).
- Give up to 4 mercenaries to another power (one-way; not to Ottoman).
- Papacy may grant Henry VIII a divorce (advances marital status track).
- Papacy may rescind excommunication of a ruler (requires power to surrender a card draw per §9.5).

**Binding rule:** Only clauses that immediately mutate current game state are rules-binding; future promises are non-binding.  
**Confirmation rule:** All agreements must be publicly declared in impulse order and confirmed by all involved powers; partial confirmation voids the entire package.

**Alliance restrictions:**
- Duration: one turn (markers removed in Winter).
- Papacy and Ottoman can **never** be allied.
- No loaned-squadron swaps in both directions in the same turn (one-way only).
- Allied spaces count as friendly for LOC and movement purposes.

**Loaned squadron mechanics:**
- Loaned squadrons operate under the borrowing power's command.
- They return to the lending power at Winter Phase when loan markers are removed.
- During the loan, they count against the lending power's unit pool.

### 8.2 Suing for Peace (Full 8-step procedure)

**Eligibility:** At least one of: captured leader, or loss of home space.  
**Peace segment is skipped on Turn 9 (final turn).**

Full procedure:
1. Losing side declares intent to sue.
2. Winning side decides whether to accept.
3. If accepted: loser pays War Winner VP (+1; +2 if war involved Ottoman).
4. Territory settlement: winner may demand return/transfer of up to 2 spaces (excluding loser's capital).
5. Units in ceded spaces: withdraw to nearest friendly controlled fortified space (LOC not required for peace retreat).
6. Captured leaders returned per §9.4 Ransom rules.
7. War state removed from diplomatic matrix.
8. Alliance markers with the now-at-peace power examined for forced dissolution.

**Protestant vs Hapsburg/Papacy:** Cannot sue for peace; `Schmalkaldic League` creates permanent war state.

### 8.3 Declarations of War (Full procedure)

**CP cost:** Determined by diplomatic matrix (varies 0–4 CP by relationship).

**Always-on restrictions (cannot DOW):**
- Allied targets.
- Pre-Schmalkaldic Protestant (others cannot declare war on Protestant; Protestant cannot declare war on others).
- Independent key spaces are not valid DOW targets (they can be attacked without DOW).
- Cannot DOW a power already at war with you.

**Diplomacy-phase-only restrictions:**
- Cannot DOW powers just peaced or allied during the same Diplomacy Phase.
- Cannot DOW during Action Phase (except via specific card events: `Six Wives of Henry VIII` and `Machiavelli: "The Prince"` at Turn 3+).

**DOW procedure:**
1. Declare war on target power; pay CP cost.
2. If target has minor power allies: France gets intervention window on Scotland DOW; Papacy gets intervention window on Venice DOW.
3. France-Scotland natural alliance: France can intervene when England uses `Six Wives` to DOW Scotland.
4. Successful intervention: activates the minor power as ally and creates new war states.
5. Hapsburg-Hungary/Bohemia: if Ottoman defeats Hungary/Bohemia under specific conditions, Hapsburg **must** intervene (§22.5).

**Action-phase war triggers:** if a card event forces war during Action Phase, update diplomatic status immediately. If both navies already share a sea zone, resolve immediate naval combat (tie forces both sides to retreat).

---

## 9. Spring Deployment (Phase 5)

- Free move for **one formation** from a capital to a friendly-controlled destination.
- Resolved in impulse order.
- Hapsburg may deploy from **either** capital (not both; one deployment action total).
- Protestant has no capital and **cannot** use spring deployment.

**Path constraints:**
1. Path must be friendly-controlled throughout.
2. No unrest along path.
3. Optional one sea-zone crossing (with strict naval/port conditions).
4. No pass crossing (unless overridden by event).

**Other-power units block path:** units of other powers (including allied powers) on the path spaces prevent movement through those spaces.

**Spring Preparations exceptions (*):** certain cards grant exceptions to the standard path constraints; see card data.

---

## 10. Action Catalog

Actions consume CP immediately and resolve fully before the next action in the same impulse.

**CP does not carry between impulses.**

**Action families:**
1. Land movement (clear: 1 CP; pass: 2 CP).
2. Naval movement (1 CP; moves all eligible naval stacks of active power).
3. Build units (land or naval).
4. Assault (1 CP; see §14).
5. Fight Foreign War (1 CP per attempt; see §21.7).
6. Control unfortified space / remove unrest (1 CP).
7. Religious actions:
   - Publish Treatise (2 CP, 2 attempts in chosen language zone).
   - Translate Scripture (1+ CP, advance translation track).
   - Call Theological Debate (3 CP).
   - Burn Books (2 CP, Papacy counter-reformation).
   - Found Jesuit University (requires `Society of Jesus` event first; Papacy only).
   - Build St. Peter's (CP investment; see §21.5).
   - Publish Treatise for England (3 CP, English zone only).
8. New World actions: Explore, Colonize, Conquer (each max once per power per turn).

---

## 11. Control, LOC, and Unrest

### Line of Communication (LOC)

**Required for:** control change actions and assault.

**Trace from:** a friendly-controlled fortified home space (major or allied minor home as allowed).

**Path must be:**
- Friendly-controlled throughout.
- Free of unrest.
- Intermediate nodes (except final target) must also be free of enemy units/leaders (including naval units).

**Pre-Schmalkaldic League:** LOC may **not** trace through electorate spaces.

**Sea zone LOC:** must trace through friendly-controlled ports and be supported by friendly naval presence in those sea zones.

### Unrest

**Placement restrictions:**
- Cannot place unrest in a space that contains friendly land units (with 2 specific card exceptions).

**Unrest effects (6 effects):**
1. Blocks LOC tracing through that space.
2. Blocks movement into/through that space (certain movement types blocked).
3. Prevents unit construction in that space.
4. Reduces card draw (key boxes with unrest reduce base draw count).
5. Affected space does not count toward auto-win threshold checks.
6. Piracy fortress anti-dice: disabled if fortress is in unrest or currently besieged.

**Removing unrest:** via `Control Unfortified Space` action does **not** require LOC to the target space (unlike flipping political control, which does require LOC).

### Controlling Unfortified Spaces

- Cost: 1 CP.
- Requires qualifying adjacency/occupation and no illegal enemy occupation.
- Can also remove unrest under special conditions.

---

## 12. Land Movement and Reaction

**Move formation in clear:** 1 CP.  
**Move over pass:** 2 CP.

**Core checks:**
1. Formation legality (unit cap, leader constraints).
2. Destination legality by war/alliance/control state.
3. Enemy interception opportunities.
4. Defender may avoid battle (evade) or withdraw into fortifications.
5. If opposing stacks remain in same unfortified space → field battle.

**Entering enemy spaces:** legal only if relationship is `atWar` or `allied`.

**Leader-only movement:** legal, but leaders cannot enter enemy-controlled or enemy-occupied spaces alone; lone leaders in unfortified spaces are captured if enemy land force enters.

**Stacks that cannot move:** stacks that already lost a field battle this impulse, or are currently in a siege relation, cannot be used for new proactive move actions.

### Interception

- Triggered when an adjacent eligible enemy stack could enter the moving formation's path.
- Resolve in impulse order when multiple powers can intercept.
- First successful intercept blocks others from intercepting the same movement.
- A stack may attempt interception at most once per impulse.
- **No intercept over passes.**
- Besieged units **cannot** intercept.
- Moves entering an unbesieged friendly fortified space **cannot** be intercepted.

**Complex entry rules for besieged spaces:**
- A friendly relief force entering a besieged friendly space does so as a field battle against the besieging force (not as interception).
- If both sides have forces in the same besieged space, the resolution order follows the field battle procedure.

**Interception complex rules:**
- Evasion auto-succeeds if the moving formation has no leaders and consists solely of naval transport.
- If interception fails (evader succeeds), the intercepting force stays in place and does not follow the evader.

### Retreat Constraints

- No retreat into: unrest space, enemy-occupied space, illegal-controlled space, or sea zone.
- If no legal retreat: units eliminated; leaders captured.
- Specific defender/attacker retreat directions may be constrained by map topology (e.g., must retreat toward home territory if surrounded).

**Fortification withdrawal:** A losing defender may withdraw into the same space's fortification (starting a siege) rather than retreating, if the space has a fortification.

---

## 13. Field Battle

### Dice Pool

- **Attacker:** 1 die per land unit + highest leader battle rating.
- **Defender:** 1 die per land unit + highest leader battle rating + 1 additional defender die.

### 12-Step Field Battle Procedure

1. Response window: Landsknechts / Swiss Mercenaries cards.
2. Count attacker dice: 1 per land unit + highest leader battle rating.
3. Count defender dice: same formula + 1 defender die.
4. Attacker may play a Combat card.
5. Defender may play a Combat card.
6. Both roll; each die ≥ 5 = 1 hit.
7. Ottoman Janissaries response window (once per turn).
8. Declare winner (tie = defender wins).
9. Apply casualties:
   - If both sides eliminated: side with more dice retains 1 unit; if equal dice, defender retains 1.
10. Capture eliminated side's leaders.
11. Loser retreats (or withdraws into fortification if eligible).
12. If fortified space and attacker won with more units than inside fortification, siege begins.

### Special Sack of Rome Battle Notes

The Sack of Rome battle uses field battle rules with modifications (see §21.5).

---

## 14. Siege, Assault, Relief

### Siege State

Begins when: defenders withdraw into fortification AND besieger land count exceeds units inside.

### Assault Action

- **Cost:** 1 CP.
- Cannot assault in the **same impulse** the siege was established (except `Roxelana` event override).

**4 prerequisites:**
1. Siege was established in a prior impulse.
2. Attacker has LOC to the space.
3. No enemy naval in adjacent sea zone.
4. Naval superiority in adjacent sea zone if enemy is in port.

**Dice:**
- **No defenders:** 1 die per attacker unit (cavalry excluded from dice).
- **Defenders present:** 1 die per 2 attacker units (rounded up; cavalry excluded).
- **Defender:** 1 die per unit (cavalry excluded) + 1 defender die.

**Cavalry in assault:** cavalry units **may** be taken as assault losses (unlike field battle where cavalry count differently).

**Success condition:** at least 1 hit scored + no defenders remain + at least 1 attacker survives.

**Siege Artillery** response card window: after initial assault rolls (before success/failure determination).

**Naval requirement for assault:** assaulting force must be adjacent (via sea zone) if the space is a port; must have naval superiority in that sea zone.

### Relief Force

- Friendly force enters besieged fortification space.
- Field battle fought between relief force and besieging force.
- Possible outcomes: break siege, partial relief, or failed relief (retreat/capture).

### Breaking Siege

If besieger no longer has strictly more land units than defenders inside fortification: siege breaks; besieger retreats or is eliminated if no legal retreat.

---

## 15. Naval Subsystem

### Naval Movement

- **Cost:** 1 CP.
- Moves **all** eligible naval stacks of the active power in that single action.
- Movement to adjacent sea zone or port only.
- Entering an enemy-controlled port is legal only if enemy naval units are present there.
- Genoese, Venetian naval units, and Andrea Doria may **not** enter Atlantic Ocean.

**Naval orientation:** the game uses lateral/vertical orientation to determine adjacency between sea zones; this is map-topology driven (see map data).

**Evasion conditions:** a weaker naval force may attempt to evade battle; evasion auto-succeeds if the evading force has no squadron remaining (corsairs only), or under specific card conditions.

### Naval Combat (10-Step Procedure)

1. Both sides present; check for evasion/avoidance.
2. Count attacker dice: 2 per squadron + 1 per corsair + highest naval leader battle rating.
3. Count defender dice: same formula + 1 extra die if defending in port.
4. Attacker may play Combat card.
5. Defender may play Combat card.
6. Roll; each die ≥ 5 = 1 hit.
7. Janissaries response window.
8. Professional Rowers response window.
9. Tie = defender wins. Declare winner.
10. Apply casualties and retreat.

**Casualty formula:**
- 1 squadron lost per 2 hits on that side.
- Remaining hits vs Ottoman: eliminate corsairs first.
- Odd hit vs **loser**: eliminates 1 extra squadron.
- Odd hit vs **winner**: ignored.
- Both sides eliminated: side with more dice retains 1 unit; equal dice → defender retains 1.

**Retreat:**
- **Port combat:** attacker always retreats to adjacent sea zone (even if attacker wins).
- **Sea zone combat:** loser retreats to controlled port or empty sea zone with no enemy naval.

### Naval Transport

- Semantics: Move Formation in Clear, with naval path.
- **Cost:** 1 CP per leg.
- Formation cap: 5 land units + leaders.
- Must end in port before impulse ends.
- If losing arrival field battle, transported units are eliminated.
- Starting a naval transport chain requires at least 2 CP available in the impulse (must be able to leave sea zone and end in port).

### Piracy (Ottoman Only)

- **Cost:** 2 CP; once per sea zone per turn.
- Ottoman selects target power.

**Anti-piracy dice pool (separate sources):**
- Target power's squadrons in target sea zone: 2 dice each.
- Squadrons of other powers at war with Ottoman in adjacent sea zones: 1 die each.
- Adjacent fortress spaces: 1 die each. Key squares do **not** qualify (fortresses only).
- Fortress anti-piracy dice disabled if the fortress is in unrest or currently besieged.

**Piracy resolution:**
1. Target rolls anti-piracy dice.
2. Each anti-piracy hit eliminates 1 corsair.
3. Remaining corsairs roll piracy hits (1 die each).
4. Per piracy hit, target chooses one cost:
   - Lose 1 squadron.
   - Give 1 random card to Ottoman (if hand is non-empty).
   - Give Ottoman 1 piracy VP.

**Piracy VP cap:** global maximum 10 VP total.  
**Empty hand:** "give random card" is **not** a legal per-hit choice if target hand is empty.

**Corsair-only anti-dice:** if Ottoman has only corsairs in target zone (no squadrons), the formula uses corsairs only; anti-dice resolution is the same.

---

## 16. Unit Construction

**General rules:**
- Build only in friendly home spaces/ports (unless event exception).
- Cannot build in a space that has unrest.
- Counter availability is a hard cap (physical component limit).
- Cannot build corsairs before `Barbary Pirates` event fires.

**Exceptions for building outside home spaces:** certain event cards allow building in non-home friendly controlled spaces; see card data.

**Land build costs:**
| Unit | CP Cost | Availability |
|------|---------|--------------|
| Regular | 2 CP | All powers |
| Mercenary | 1 CP | All major powers except Ottoman |
| Cavalry | 1 CP | Ottoman only |

**Naval build costs:**
| Unit | CP Cost | Availability |
|------|---------|--------------|
| Squadron | 2 CP | All except Protestant |
| Corsair | 1 CP | Ottoman only; specific pirate port rules |

**Naval loss recovery:** eliminated naval units may be tracked on the Turn Track and recovered to the unit pool on a specified return turn (see Turn Track rules in §19).

---

## 17. Reformation Subsystem

### Overview

Religious actions form a dedicated combat-like system with adjacency modifiers.

**Main entry points:**
- Luther's 95 Theses (Turn 1, separate phase before card draw).
- Diet of Worms (Turn 1 religious contest).
- Publish Treatise (2 CP, 2 attempts in chosen language zone).
- Translate Scripture (1+ CP, advance translation track per zone).
- Call Theological Debate (3 CP).
- Burn Books (2 CP, Papacy counter-reformation).
- Found Jesuit University (Papacy only; requires `Society of Jesus` event first).
- Build St. Peter's (VP construction engine; see §21.5).
- Event-driven reform/counter-reform attempts.

### Religious Modifiers

**Protestant attack dice bonuses (adjacency via connections only, NOT passes; exclude unrest spaces):**
- +2 if reformer in target space.
- +1 per adjacent reformer.
- +2 if Protestant army stack in target space.
- +1 per adjacent Protestant army stack.
- +1 per adjacent Protestant space.
- Minimum 1 die even if all above are 0.

**Papal defense dice bonuses (same adjacency rules):**
- +2 if Jesuit university in target space.
- +1 per adjacent Jesuit university.
- +2 if Catholic army stack in target space.
- +1 per adjacent Catholic army stack.
- +1 per adjacent Catholic space.
- Minimum 1 die.

**Unit confession rules:**
- Edward VI / Elizabeth I troops: Protestant side.
- Mary I troops: Catholic side.
- Henry VIII troops: **neutral** (no religious modifier contribution).
- Ottoman units: **always neutral** (never contribute religious modifiers).

**Bonus dice (if applicable):**
- +1 if Printing Press played this turn.
- +1 from Luther's 95 Theses event (Turn 1 phase only).
- +1 from applicable debater bonus.
- +1 per attempt in Luther's 95 Theses phase (stacks across 5 attempts: attempt 1 = +1, attempt 2 = +1 more, etc. — check card text for exact stacking).

**Augsburg Confession effect:** if played this turn, each Papal die −1 (counter-reformation only).

**Full Bible / Calvin's Institutes:** if applicable and target is in the target language zone, each die result +1.

### Debater Constraints

- Each debater committed at most once per turn; reset in Winter Phase.
- Per impulse, Protestant and Papacy may each apply at most **one** debater bonus for reform/counter-reform/translation class actions.
- Debaters granting "extra attempts" must be committed **before** that attempt series starts.
- Debater bonus limits: cannot stack multiple debater bonuses for a single action.

### 17.1 Luther's 95 Theses (Turn 1, Phase 1)

Interactive phase — Protestant player acts:

1. Wittenberg becomes Protestant; Luther reformer placed there; 2 Protestant regulars placed from Electorate board.
2. Protestant gets **5 reformation attempts**, German zone only.
3. Each attempt: Protestant player chooses a valid target → dice rolled → result displayed.
4. After each attempt, valid targets are **recalculated** (newly converted spaces create new adjacency).
5. Each attempt gets **+1 bonus die** (from Luther's 95 Theses event).
6. This is the only mandatory event that does **not** grant 2 CP afterwards.

### 17.2 Reformation Attempt Algorithm

1. **Select target:** Must be Catholic and satisfy one of: contains a reformer, is adjacent to a Protestant space (connections + passes), or is port-linked to a Protestant port. Target can be in any language zone; tie-break and auto-success only apply in the **action's target language zone**.
2. **Protestant base dice:** see modifier table above; minimum 1 die.
3. **Apply bonus dice** (Printing Press, Theses, debater).
4. **Roll:** record highest single modified die.
5. **Auto-success:** if highest modified die ≥ 6 AND target is in target language zone → automatic success; no Papal defense roll.
6. **Papal defense dice:** see modifier table above; minimum 1 die.
7. **Papal rolls:** record highest single die.
8. **Compare:** Protestant highest > Papal highest → success. **Tie:** Protestant wins if target is in the action's target language zone; otherwise Papal wins.
9. **On success:** flip to Protestant. If electorate space, place 2 Protestant regulars from Electorate board.

### 17.3 Counter-Reformation Algorithm

Mirrors reformation with reversed roles:

- Papal attacks; Protestant defends.
- **Auto-success:** Papal max = 6 AND target in target zone AND Pope is Paul III or Julius III.
- **Tie:** Papal wins only if Pope is Paul III/Julius III and target is in target zone; otherwise Protestant wins.
- Augsburg Confession: if played this turn, each Papal die −1.

### 17.4 Theological Debate

- Debater selection: random from zone, or selected per specific rules.
- **Attacker dice:** debater debate value + 3 dice; each 5 or 6 = 1 hit.
- **Defender dice:** if uncommitted: debater value + 2; if committed: debater value + 1.
- First round tie → second round with new debaters from same zone.
- Second round tie → debate ends with no result.
- Winner converts spaces equal to **hit differential**.
- **Burn Protestant debater:** if Papal margin > debater's debate value → Papacy gains VP.
- **Disgrace Papal debater:** if Protestant margin > debater's debate value → Protestant gains VP.

**Carlstadt unrest:** if the Carlstadt event triggers unrest, the debater's unrest effect applies to the target space; see card text.

### 17.5 Diet of Worms (Turn 1 Only)

Full procedure:
1. Hapsburg, Papacy, and Protestant each simultaneously reveal 1 card from hand (face-down, then reveal simultaneously).
2. Compare CP values of the revealed cards.
3. Result determines Catholic or Protestant outcome per the Diet of Worms resolution table.
4. Revealed cards are discarded after resolution.

**Translate Scripture track rules:**
- Full track 0–6 per language zone.
- Each completed language zone: Protestant +1 VP (one-time bonus).
- Completing the German zone first grants an additional VP bonus.
- See `RELIGIOUS_STRUGGLE.md` for exact values.

**Build Saint Peter's VP cap:** capped at the value shown on the St. Peter's track marker; see §21.5.

---

## 18. Winter Phase

**Execute globally in this order:**
1. Remove loan markers (loaned squadrons return to nearest legal owner ports).
2. Remove temporary renegade leader (if active).
3. Return naval units/leaders to ports.
4. Return land units/leaders to legal fortified destinations; apply attrition where path fails.
5. Remove major-power alliance markers.
6. Add 1 regular to each friendly-controlled, non-unrest capital.
7. Remove piracy markers.
8. Uncommit all debaters.
9. Auto-trigger overdue mandatory events.

**Return path rules (land):**
- All path spaces except origin must be **friendly-controlled** and **unrest-free**.
- Unlike LOC, **enemy unit presence is ignored** for Winter return paths.
- Non-capital fortified spaces have stack cap 4; excess units must continue toward capital/home key and re-run attrition checks.
- If a power's capital is enemy-controlled: units that would return there are eliminated instead.

**Protestant Winter return:**
- Protestant has no capital; always returns to nearest legal Protestant-controlled fortified space(s).
- Stacks split when necessary to find legal spaces.
- Protestant regulars released from electorate spaces that have flipped Protestant religion return from the electorate board at Winter.

**Hapsburg Winter return:**
- May return to either capital (Valladolid or Vienna).
- **Before `Schmalkaldic League`:** Hapsburg winter return may **not** enter or pass through electorate spaces.

**Winter reinforcement:**
- +1 regular to each friendly-controlled non-unrest capital.
- Hapsburg: +1 at Valladolid AND +1 at Vienna (double capital benefit).
- Protestant: no capital → no winter reinforcement.
- Foreign war override: if a power has a Foreign War card active, all new regulars must go to the foreign war card (except: the 1 winter reinforcement regular **always** goes to the capital, even if foreign war is active — this is the sole exception).

**Overdue mandatory events (auto-fire without normal +2 CP):**
| Event | Latest turn |
|-------|-------------|
| `Clement VII` | Turn 2 Winter |
| `Barbary Pirates` | Turn 3 Winter |
| `Schmalkaldic League` | Turn 4 Winter |
| `Paul III` | Turn 4 Winter |
| `Society of Jesus` | Turn 6 Winter |

---

## 19. New World Subsystem

**Available to:** England, France, Hapsburg only.

**Actions (each max once per power per turn):**
- **Colonize:** place colony marker.
- **Explore:** send explorer underway; resolve in New World Phase.
- **Conquer:** send conquistador underway; resolve in New World Phase.

**Key mechanics:**
- Marker-based underway state in Action Phase.
- Resolution in New World Phase (after Winter).
- Exploration/conquest use 2d6 + explorer/conquistador modifiers and tables.
- Results: VP, discoveries, colonies, extra card draw potential, or explorer/conquistador loss.
- Riches checked in Card Draw Phase next turn.
- Hapsburg has raider units that can interfere with other powers' New World activities.

**Full tables:** see `his_ref/img/classified/action summary.jpg`.

---

## 20. Scoring and Victory

### VP Composition

**Base VP:**
- Ottoman, Hapsburg, England, France, Papacy: determined by controlled key spaces (last uncovered value on power card VP track).
  - Each key space in unrest: place an unrest marker on the VP track, covering one value box.
  - If all value boxes covered: base VP = 0.
- Protestant base VP: **2 VP per electorate that simultaneously has Protestant religious influence AND Protestant political control.**

**Protestant Spaces Track:**
- Track counts total Protestant-influenced spaces on the map (not just Protestant-controlled).
- Every space flip must update this track.
- Papacy VP and Protestant VP both reference this track (dual values per notch — see `RELIGIOUS_STRUGGLE.md`).
- England tracks Protestant influence in **English home spaces** separately: +1 VP per 2 English Protestant spaces (floor division).

**Special VP sources:**
| Power | Source | Amount |
|-------|--------|--------|
| Ottoman | Piracy VP track (0–10 cap) | 1 VP per mark |
| Hapsburg | Each electorate under Hapsburg political control without unrest (post-Schmalkaldic only) | 1 VP |
| England | Edward VI born (healthy) | 5 VP |
| England | Elizabeth born (Edward not healthy) | 2 VP |
| England | English Protestant spaces | 1 VP per 2 spaces |
| France | Each completed Chateaux (`Patron of the Arts`) | 1 VP |
| Papacy | Protestant Spaces Track (purple values) | varies |
| Papacy | St. Peter's construction track | 1 VP per notch |
| Protestant | Protestant Spaces Track (brown values) | varies |

**Bonus VP sources:**
- Burn Protestant debater in debate (by debate value).
- Disgrace Papal debater in debate (by debate value).
- Successful exploration.
- Successful conquest.
- `Copernicus` event (2 VP to triggering power).
- `Michael Servetus` event (1 VP to triggering power).
- `Julia Gonzaga` (1 VP) + subsequent successful piracy in Tyrrhenian Sea.
- War Winner VP from peace settlement.
- Master of Italy VP from Action Phase.
- Completing a full Scripture Translation track (1 VP per language zone).

**`Copernicus` / `Michael Servetus`** may be played during the Victory Determination Phase only when their VP gain would prevent another power from achieving a domination victory.

### Victory Determination Algorithm

1. Compute all VP totals.
2. **Standard victory:** any power VP ≥ 25 → highest VP wins.
3. **Domination victory** (Turn ≥ 4 only): a power is at least +5 VP ahead of **every** other power → that power wins.
4. If neither: if Turn < 9, advance turn counter and begin next turn.
5. **Time limit victory** (Turn 9 end): highest VP wins.
6. **Tie-break:** compare previous turn VP; walk backward turn-by-turn until broken.

**Engine pattern:** run incremental victory re-check after any state delta touching key-control, religious flips, war-winner VP, or New World resolution.

---

## 21. Major Power-Specific Rules

### 21.1 Ottoman

**Cavalry:** Ottoman-only land unit type; 1 CP to build; used in field battle dice but **excluded from assault dice** (neither contributing to attack dice nor eligible to be taken as assault losses in the standard formula — note cavalry **may** be taken as assault losses per §14).

**Corsairs:** Ottoman-only naval unit; build only after `Barbary Pirates` fires; 1 CP each; usable in piracy; count 1 die each in naval combat.

**Barbary Pirates event:**
- Before event fires: Algiers is off-map; no corsairs can be built.
- After event fires:
  1. Place Ottoman square control marker in Algiers.
  2. Place 2 corsairs + 2 regulars + Barbarossa in Algiers per card text.
  3. Algiers becomes the Ottoman piracy hub in the Mediterranean.
- After `Barbary Pirates`, Hapsburg home spaces Oran and Tripoli can be converted via `Pirate Haven` event.

**Pirate Haven event:**
- When played: Ottoman adds 1 regular + 2 corsairs to that space; places `Pirate Haven` marker (making it a defended space).
- Once converted, Oran/Tripoli/Algiers are treated as "Ottoman home fortified spaces" in all rule respects, with **one exception:** Ottoman can only build corsairs (not regulars) in those spaces.
- Before conversion: Oran and Tripoli are treated fully as Hapsburg home spaces.

**Foreign War cards (`Revolt in Egypt`, `War in Persia`):** see §21.7.

### 21.2 Hapsburg

**Two capitals:** Valladolid (Spain) and Vienna (HRE).

**`Holy Roman Emperor` home card special move:**
- Before spending the 5 CP on the card, Charles V may immediately teleport to any Hapsburg home space.
- `Gout` response card can block this teleport.
- Only Duke of Alva may accompany Charles on the teleport; no other land/naval units from the origin space may teleport with him.

**Double capital winter benefits:**
- Winter return: land units may return to either capital.
- Winter reinforcement: +1 regular at Valladolid AND +1 regular at Vienna (both, if each is friendly-controlled and unrest-free).
- Spring Deployment: still only **one** deployment action; the double capital does not grant a second.

**Pre-Schmalkaldic League restriction:** Hapsburg winter return may not enter or pass through electorate spaces.

### 21.3 England

**`Six Wives of Henry VIII` home card:**  
Drives the marriage/succession track. Also allows England to declare war on Scotland, France, or Hapsburg during the Action Phase (one of two cards that enables Action Phase DOW).

**Henry's Marital Status track:**
- Starts at `Catherine of Aragon`.
- From Turn 2: England can play `Six Wives` to advance the track right 1 step.
- Other ways to advance: Papacy agrees to divorce in Diplomacy (§9.1); pregnancy chart result 3.

**Pregnancy chart (rolled each time Henry advances to a new wife):**
- +1 bonus to roll if new wife is Jane Seymour.
- If result already occurred, find next unrepeated result going upward and execute it.
- Result 3: grants a bonus "when England first chooses PASS this turn, advance marriage track 1 more step."

**Cannot advance marriage track if:**
- Henry VIII no longer rules.
- Henry is in a besieged space.
- Henry is currently captured.
- Both Edward and Elizabeth have already been born.

**Marriage benefits:**
| Wife | Benefit |
|------|---------|
| Anne Boleyn | English Reformation opens next turn (3 event cards enter deck; Cranmer/Coverdale/Latimer enter) |
| Jane Seymour | Pregnancy table roll +1 |
| Anne of Cleves | If England allied with Protestant, both England and Protestant each draw 1 card after pregnancy roll |
| Kathryn Howard | England draws 1 extra card after pregnancy roll |
| Katherine Parr | No extra bonus (but guarantees both Edward and Elizabeth will be born) |

**Catherine of Aragon diplomatic consequence:**
- When Henry marries Anne Boleyn (via divorce or event advance): give `Catherine of Aragon` marker to Hapsburg.
- Hapsburg may spend it for −2 CP when declaring war on England next time.

**English succession summary:**

| Highest pregnancy result ever | Succession |
|-------------------------------|-----------|
| ≤ 3 | Mary I enters Turn 6; long reign |
| = 4 (Elizabeth) | Mary I enters Turn 6; after Mary ascends, Elizabeth enters next turn |
| = 5 (sickly Edward) | Edward VI enters Turn 6; Mary enters next turn; if Elizabeth born → Mary enters, then Elizabeth next turn |
| = 6 (healthy Edward) | Edward VI enters Turn 6; long reign |

- If result 5/6 only occurs on Turn 6 or later, and `Mary I` card still in deck/hand: playing `Mary I` is treated as `Edward VI`; England immediately ruled by Edward.
  - Sickly Edward: `Mary I` card goes to discard and re-enters deck next turn.
  - Healthy Edward: `Mary I` card permanently removed.

**Cranmer entry dependency:** Cranmer only enters if Henry has married Anne Boleyn (Anne Boleyn marriage track reached).  
**English debater entry dependency:** English debaters enter only if Cranmer is already on the map.  
**Maurice of Saxony:** placed on Turn 6; see card data for exact placement rules.

**Mary I impulse procedure:**
1. England reveals card at impulse start but does not declare "event/CP" yet.
2. If card is a mandatory event: resolve normally.
3. Otherwise: England rolls 1 die.
   - 4–6: proceed normally (player chooses event or CP).
   - 1–3: Papacy takes religious action using the card's CP value:
     - 1–2 CP: Papacy executes Burn Books in English zone.
     - 3 CP: Papacy calls Theological Debate in English zone.
     - ≥ 4 CP: Papacy executes Burn Books then calls Theological Debate in English zone.
4. England's impulse ends after Papacy action.

**Mary I overrides:**
- If all English home spaces are Catholic at impulse start: skip the d6 check; England acts normally.
- Under Mary I: Response/Combat cards played by England in Action Phase can only be used for CP; not as events or combat effects.

### 21.4 France

**`Patron of the Arts` home card:**
- Each time played as event: roll 1 die.
- Result 3–6: France gains 1 VP; Chateaux marker advances 1 step right.
- If France controls Milan: no roll needed; auto-gains 1 VP.
- Maximum 6 VP per game from this mechanism.

### 21.5 Papacy

**`Society of Jesus` mandatory event:**  
Only after this event fires can Papacy use `Found Jesuit University`. Before it fires: no Jesuit universities exist and none can be built.

**`Papal Bull` — Excommunication:**

Legal targets:
- Reformers: always a legal target.
- Rulers/monarchs: only with legal basis:
  1. That power is currently at war with Papacy.
  2. That power is currently allied with Ottoman.
  3. The monarch is Henry VIII AND at least 1 English home space is Protestant-influenced.

- "Allied with an excommunicable power" alone is **not** a basis for excommunication.
- Henry VIII's successors (Edward, Mary, Elizabeth) **cannot** be excommunicated.
- After excommunication: place `Excommunicated` marker on that power's board.
- **Cannot re-excommunicate** the same person/ruler in a later turn (France can only excommunicate Francis I or Henry II, not both).

**Effect on excommunicated reformer:**
- Reformer and their debater markers leave the map for the rest of the turn.
- Reformer's debater flipped to "committed."
- Events requiring the reformer to be "uncommitted" cannot be played for the rest of the turn.
- From next turn, reformer returns per §8.2.
- Exception: even if Luther is excommunicated, `Here I Stand` card may trigger a temporary theological debate (Luther leaves map again after debate).
- Excommunication lasts only the current turn.
- After excommunicating a reformer: Papacy may **immediately** call a theological debate in the same language zone (Cranmer=English, Calvin=French, Luther/Zwingli=German).

**Effect on excommunicated ruler:**
- Place `-1 Card` marker on that power's board.
- Marker persists until that power ends its war with Papacy OR surrenders one card draw to Papacy (§9.5).
- Ruler death does **not** remove the marker.
- While marker is active: that power draws 1 fewer card per turn.
- Papacy also selects 2 empty, Catholic-influence home spaces of that power and places unrest there.

**`Sack of Rome` conditions:**
- There must exist a single unit stack (non-Papacy troops) in an Italian-zone space.
- That stack must have more mercenaries than Papacy has regulars in Rome.
- The stack does not have to belong to the card player.
- The card player and stack owner need not be at war with Papacy.
- Rome need not currently be Papacy-controlled.
- Playing this card does **not** create any war state; **not** a basis for excommunication.

**`Sack of Rome` procedure:**
1. Move the qualifying stack entirely to Rome; record original space.
2. Resolve as field battle (Rome is fortified but battle is field-type; ignore formation caps).
   - Attacker: 1 die per unit.
   - Defender (Papacy): Papacy mercenaries and allied units in Rome are **ignored**; Papacy rolls 1 die per Papal regular + 1 defender die (even if 0 regulars present, Papacy still rolls 1 die).
   - Both sides may play Combat cards; any power may play Response cards.
3. Assign casualties:
   - Hits against Papacy must be absorbed by Papacy regulars first; excess hits go to Papacy mercenaries.
   - Hits against attacker: distributed as evenly as possible between attacker regulars and mercenaries.
4. Surviving attacker units return to their original space.
5. If Papacy wins: event ends; `Sack of Rome` goes to discard and may re-enter future turns.
6. If Papacy loses:
   - St. Peter's progress −5 CP (minimum 0).
   - Sacker draws 2 random cards from Papacy hand (Home cards excluded); keeps 1, discards 1.
   - If Papacy has only 1 drawable card, sacker keeps it.
   - `Sack of Rome` **permanently removed** from game.

**Build St. Peter's:**
- Papacy invests CP during Action Phase; 1 VP per cumulative CP notch on St. Peter's track.
- VP from St. Peter's capped at value shown on current track marker.
- `Sack of Rome` reduces cumulative progress by 5.

### 21.6 Protestant

**Pre-Schmalkaldic League restrictions:**
- Cannot build any military units.
- Cannot move military units.
- Cannot acquire mercenaries.
- Cannot gain political control of spaces.

**Restrictions on other powers (pre-Schmalkaldic):**
- Other powers cannot declare war on Protestant.
- Other powers' units cannot move or retreat into electorate spaces.

**Electorate military trigger (pre-Schmalkaldic):**
- When any electorate space flips to Protestant religious influence: Protestant may immediately place the corresponding regulars from the Electorate board into that space.

**`Schmalkaldic League` event** (earliest Turn 2; at latest fires automatically in Turn 4 Winter):

Immediate effects:
1. John Frederick enters (placed in or near Wittenberg — nearest Protestant regular stack).
2. Philip of Hesse enters (placed in or near Kassel/Mainz — nearest Protestant regular stack).
3. All current Protestant-influenced Protestant home spaces flip to Protestant **political control** (exception: spaces with a Fortress marker do not auto-flip).
4. All pre-Schmalkaldic restrictions lifted.
5. Hapsburg and Protestant enter permanent war state; Papacy and Protestant enter permanent war state. These cannot be dissolved.
6. Any Protestant regulars/leaders in Catholic-influence electorate spaces immediately transfer to the nearest Protestant-influence electorate space.

**Post-Schmalkaldic electorate military trigger:**
- Electorate flips to Protestant influence AND is also under Protestant political control → Protestant places electorate board regulars immediately.
- If electorate is Protestant-influenced but not yet Protestant political control: regulars are held on board until both conditions are met.
- To gain political control of a non-auto-flipped electorate, Protestant must capture it via siege.

### 21.7 Foreign War Cards

Cards: `Revolt in Egypt`, `Revolt in Ireland`, `War in Persia`.

**Setup:**
- After event fires: place event card in map margin near the affected power's home territory.
- That power selects the card-specified number of land units from anywhere on the map (not from besieged spaces) and places them on the event card.
- May additionally select 1 army leader from anywhere to place on the card.

**Foreign enemy strength:** indicated on the card; represented by available independent power units (supplemented by minor power units if needed).

**Resolution (each attempt costs 1 CP — `Fight Foreign War` action):**
- Field battle on the card: no defender bonus die; no retreat.
- If independent units eliminated: foreign war ends; remaining major power units return to home capital (or nearest friendly home key if capital is enemy-controlled).
- If independent units not eliminated: future impulses must continue paying 1 CP to fight.

**Maintenance constraint:**
- While foreign war is active: all newly built land units must go to the foreign war card first.
- Exception: 1 winter reinforcement regular always goes to the capital (see §18).
- Cannot place additional units beyond the card-specified count on the card.
- Major power units on the foreign war card cannot return home until the foreign war is resolved (not even in Winter).

---

## 22. Minor Powers and Independent Keys

### 22.1 Inactive Minor Powers

Four minor powers: Genoa, Hungary/Bohemia, Scotland, Venice.

**States:** inactive (default at start) or active (allied to a major).

**Inactive behavior:**
- Do not move proactively.
- Do not intercept; do not evade.
- If space has ≤ 4 land units and enemy enters: always retreat into fortification (siege).
- If space has ≥ 5 land units and enemy enters: fight field battle.
  - If they lose: do not retreat normally; keep up to 4 units (retreat into fortification); eliminate all excess units.
- Naval units remain in ports; defend in port when attacked.

**Natural alliances:**
- France-Scotland: France can intervene when England DOWs Scotland (during DOW procedure step 4).
- Papacy-Venice: Papacy can intervene when any power DOWs Venice (during DOW procedure step 5).
- Hapsburg-Hungary/Bohemia: if Hungary/Bohemia is defeated by Ottoman under specific conditions, Hapsburg **must** intervene.

### 22.2 Activation

**Activation methods:**
- France/Papacy DOW intervention; France intervention on England's `Six Wives` DOW on Scotland.
- Hungary/Bohemia defeated by Ottoman → forced Hapsburg intervention.
- `Auld Alliance` event: activates Scotland (by France).
- `Venetian Alliance` event: activates Venice (by Papacy).
- `Diplomatic Marriage`: activates any minor the playing major can activate.
- `Andrea Doria`: activates Genoa (France/Hapsburg/Papacy); uniquely usable on an already-active Genoa (transfers loyalty).

**Activation procedure:**
1. Place `Allied` marker in diplomatic matrix at intersection of major and minor powers.
2. Any power currently at war with the minor may immediately (free) declare war on the activating major power (must still satisfy always-on restrictions; if they decline, their units in the minor's spaces retreat to nearest un-besieged fortified space per §9.3 step 3).
3. Minor's currently-controlled key spaces gain the major's square control markers.
4. Minor's other controlled spaces gain the major's hex control markers.
5. Remove all `At War` markers from the minor's column in the diplomatic matrix (its wars are now managed through the major ally).

### 22.3 Active Minor Power Rules

**Active benefits:**
- Minor's land/naval forces and naval leaders act under same rules as the major's (can move, fight, retreat, evade, influence religious modifiers).
- Minor has no independent impulse or hand of cards.
- Winter: minor's land units may return to their nearest friendly-controlled home key as an additional "capital" equivalent; the major ally's own units cannot use this option.
- Major can use `Raise Regular Troop` to build majors' regulars in minor's home spaces (if unit pool has pieces).
- Genoa/Venice/Scotland: major can use `Build Naval Squadron` to build majors' naval squadrons in minor's home ports (if unit pool has pieces).

### 22.4 Deactivation

**Hungary/Bohemia is the only minor that cannot deactivate.**

**Deactivation methods:**
- England/France: use `Auld Alliance` to deactivate Scotland.
- Ottoman/Papacy: use `Venetian Alliance` to deactivate Venice.
- England/France/Hapsburg/Papacy: use `Diplomatic Marriage` to deactivate Genoa/Scotland/Venice.
- France/Hapsburg/Papacy: use `Andrea Doria` to remove Genoa from current ally and join themselves.

**Deactivation procedure:**
1. Remove `Allied` marker from diplomatic matrix.
2. Remove old major's control markers from minor's home spaces.
3. Other powers' units in those newly-uncontrolled spaces relocate:
   - Land units → nearest friendly-controlled fortified space.
   - Naval units → nearest friendly-controlled port.
4. Minor's land units return to nearest friendly-controlled home fortified space; if none, nearest friendly home unfortified; if none, eliminated.
5. Minor's naval units and naval leaders return to nearest friendly-controlled home port; if none, naval units eliminated, leaders go to Turn Track.

### 22.5 Hungary/Bohemia Defeat (Ottoman Special Trigger)

**Defeat condition:** at end of an assault or field battle, Ottoman has:
- If Hungary/Bohemia is Hapsburg-allied via `Diplomatic Marriage`: Ottoman controls ≥ 2 Hungary/Bohemia home key spaces.
- If Hungary/Bohemia is NOT Hapsburg-allied: Ottoman controls ≥ 1 Hungary/Bohemia home key space AND ≤ 4 Hungary/Bohemia regulars remain on map.

**Immediate consequences:**
1. Hapsburg **must** intervene (free); Ottoman and Hapsburg enter war state immediately (even if previously allied).
2. Hungary/Bohemia activates as Hapsburg ally (if not already allied via `Diplomatic Marriage`).
3. Hungary/Bohemia permanently cannot deactivate for the rest of the game.
4. All spaces currently with Ottoman land units: immediately convert to Ottoman control (including any spaces in active siege).
5. Besieged Hungary/Bohemia units: immediately eliminated.
6. Ottoman gains 2 VP (War Winner).

### 22.6 Independent Key Spaces

Four locations: **Metz, Milan, Florence, Tunis**.

**1517 scenario start:** Metz and Florence independent; Milan is French; Tunis is Hapsburg.  
**1532 scenario start:** all four independent.

**Rules:**
- Any major power's units may enter.
- Independent regulars do not move; only defend (same behavior as inactive minor powers).
- Independent regulars cannot be rebuilt in the normal rules (only `City State Rebels` event can restore them).
- Once captured by a major power, no longer independent; transfers normally between major powers thereafter.
- Only `City State Rebels` event can return them to independent status.

---

## 23. Recommended Engine Architecture

**Module structure:**
1. `cards/` — deck lifecycle, dealing, card type handling
2. `diplomacy/` — all 5 diplomacy segments
3. `movement_land/` — formation rules, interception, evasion
4. `combat_field/` — 12-step field battle
5. `siege/` — assault, relief, break conditions
6. `movement_naval/` — naval movement, naval combat, transport
7. `piracy/` — Ottoman piracy resolution
8. `reformation/` — all religious actions + debate
9. `winter/` — full 9-step winter sequence
10. `new_world/` — exploration, colonization, conquest
11. `scoring/` — incremental VP checks + victory algorithms
12. `major_powers/` — power-specific rules (Henry succession, Schmalkaldic, etc.)
13. `minor_powers/` — activation/deactivation/defeat triggers

**Determinism requirements:**
- Every action logs preconditions checked and state diffs.
- Every die roll recorded with seed and context key.
- Simultaneous effects flattened into explicit ordered steps.

---

## 24. Validation and Rule Precedence

**Validation order for any player action:**
1. Phase legality.
2. Power eligibility.
3. CP/card payment legality.
4. Target legality (war/alliance/space/unit state).
5. One-per-turn and once-per-impulse caps.
6. Resolve with interrupts (response/combat cards).

**Precedence:** specific card/event text overrides base subsystem rules. If two effects conflict and both are card text, use explicit timing windows and active-player order unless card text says otherwise.

---

## 25. Implementation Test Matrix (Minimum)

1. Turn-1 flow (`luther_95`, `diet_of_worms`, abbreviated diplomacy).
2. Pass legality under home/mandatory/admin constraints.
3. LOC-sensitive control and unrest removal.
4. Intercept/avoid/withdraw chains before field battle.
5. Siege establish/assault/relief/break transitions.
6. Naval move with interception and multiple sea-zone transport.
7. Piracy payout choices under empty-hand and VP-cap conditions.
8. Reformation and counter-reformation tie behavior by language zone and ruler state.
9. Winter return with attrition and enemy-controlled capital case.
10. New World resolve order and result table effects.
11. Minor power activation/deactivation and Hungary-Bohemia special case.
12. Standard/domination/time-limit victory checks and tie-break replay.
13. Mary I impulse procedure and override conditions.
14. Schmalkaldic League trigger and post-trigger electorate mechanics.
15. Sack of Rome conditions, procedure, and permanent-removal case.
16. Excommunication of reformers vs rulers (different effects).
17. Foreign war maintenance constraint and winter reinforcement exception.
18. `Holy Roman Emperor` teleport with Gout response card.
19. Pirate Haven conversion rules.
20. Diet of Worms simultaneous card reveal and resolution.

---

## 26. Scope Notes

- This document is intentionally implementation-oriented and omits flavor text.
- For exact card effects and numeric table lookups, use structured card/table data from official rulebook and scenario sheets.
- For complete Protestant Spaces Track dual VP values (0–50), see `RELIGIOUS_STRUGGLE.md`.
- For exact 1517 setup: see `SCENARIO_1517_SETUP.md`.
- The Chinese rulebook (`RULEBOOK_SECTION_NORMALIZED_ZH.md`) is the primary authoritative reference; consult it for any rule detail not covered here.

---

## 27. Two-Player Variant (Papacy vs. Protestant)

Authoritative rules + phased roadmap: **`TWO_PLAYER_PLAN.md`** (extracted from
`his_ref/Scenarios.pdf` pp. 37–40). The variant is fully additive and gated on
`state.variant === 'two_player'`; standard 3–6p play is unchanged.

**Phase 1 (implemented — religious-core MVP, offline hotseat):**
- Setup: `data/setup-1517-2p.js` (`buildTwoPlayerScenario`) — 49-card Main-Deck
  removal, single-regular stacks outside German/Italian, naval only in
  Marseille/Genoa/Naples/Venice/Rome, Hapsburg Prague + Catholic Brunn/Breslau,
  Ottoman Buda/Belgrade, Andrea Doria the only starting leader.
- Sequence of play: New World phase deleted; impulse order = Papacy → Protestant
  (`getImpulseOrder`); Action ends after 2 consecutive passes (`getPassesToEnd`).
- Diplomacy phase: `phases/phase-diplomacy-2p.js` over the `state/diplomacy-deck.js`
  subsystem — each side draws 1/turn; from Turn 2, Papacy then Protestant play 1
  (`PLAY_DIPLOMACY_CARD`). Hapsburg's Diet of Worms card is drawn from the deck top.
- Restrictions: §13 movement and §12 unrest-removal gated for the religious powers
  (`isReligiousZoneMoveBlocked`); §10 Papal spring deployment confined to DE/IT.
- Victory: 8-VP domination gap (`VICTORY.twoPlayerDominationGap`), Turn 4+.
- Tests: `src/games/his/two-player.test.js`, `e2e/games/his/two-player.spec.js`.

**Phase 2 (implemented — military core):**

- Invasion cards (#202/#206/#211/#213/#214/#216) dispatch their `DIPLOMACY_EVENT_HANDLERS`
  on play — set the war + place the army at a chosen `targetSpace` (drain `pendingCardDraw`
  to the controlling player). Setup starts with **no wars** (powers activate only via an
  invasion card / SL).
- §11 control: a religious side commands a non-player power at war with its opponent
  (`controllableInvaders`/`canControlInvaderAction`); permitted actions (move/assault/control/
  naval + combat/response on behalf, no construction) route via `actionData.forPower` through
  the CP pipeline; `playerCommandsPower` extends the response gate.
- §13 invader movement limited to DE/IT + independent/own spaces (`isInvaderMoveBlocked`).
- SL transitions (`event-actions.js` #13): Papacy/Protestant + Hapsburg/Protestant at war,
  Papacy/Hapsburg allied (permanent through Winter).
- §19 Winter: FR/HA/OT units forced to capital are removed; all their army leaders removed.
- UI: `INVASION_TARGET` landing-space selection, `forPower` invader action buttons, At-War
  status readout. Tests: `src/games/his/two-player-military.test.js`.

**Phase 2b (implemented — Remove-At-War, §9):**

- A `remove_war` stage precedes the card deal in `phases/phase-diplomacy-2p.js`. The Papacy may:
  **Papal Bull** (`applyPapalBull` — vs France/Hapsburg, ruler not yet excommunicated:
  excommunicate, end war, spend the Bull, draw a card) or **sue for peace** (`applySueForPeace2P`
  — any war except Protestant: end war, +1 War-Winner VP to Protestant, remove 2 Papal units).
- `papalBullTargets`/`sueForPeaceTargets` gate the targets; actions `PAPAL_BULL`/
  `SUE_FOR_PEACE_2P`/`END_REMOVE_WAR`; UI `_renderRemoveAtWarPanel` + `SUE_FOR_PEACE_2P` unit
  flow. Tests: `src/games/his/two-player-removewar.test.js`.
- **Deferred (2b-cards):** non-invasion diplomatic-card effects remain log-only no-ops; the
  Papal-Bull regain-space benefit, sue-for-peace reclaim, and the §11 Landsknechts/Swiss
  exclusion.
