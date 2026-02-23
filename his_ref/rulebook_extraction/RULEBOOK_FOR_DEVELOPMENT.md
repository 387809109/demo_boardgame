# Here I Stand - Developer Rules Specification

Source basis:
- `his_ref/HIS-Rules-2010.pdf`
- `his_ref/rulebook_extraction/RULEBOOK_SECTION_NORMALIZED.md`

Purpose:
- This is an implementation-first rules document for building a game engine.
- It rewrites rule text into deterministic data and resolution rules.
- Card-specific text effects are not fully reprinted; they should be implemented from card data.

## 1. Game Summary

- Players: 2-6 (major powers may be shared in low player counts).
- Major powers: Ottoman, Hapsburg, England, France, Papacy, Protestant.
- Minor powers: Genoa, Hungary/Bohemia, Scotland, Venice.
- Turn limit: up to 9 turns.
- Immediate wins:
1. Military victory: non-Protestant reaches Auto Win key threshold during Action Phase with no required key in unrest.
2. Religious victory: Protestant reaches 50 Protestant-influence spaces (spaces in unrest do not count).
- End-of-turn wins:
1. Standard victory: at least 25 VP and highest total.
2. Domination victory: Turn >= 4, VP < 25, and at least +5 VP ahead of every other power.
3. Time limit victory: highest VP after Turn 9.

## 2. Core State Model

```ts
export type MajorPower =
  | 'ottoman'
  | 'hapsburg'
  | 'england'
  | 'france'
  | 'papacy'
  | 'protestant';

export type MinorPower =
  | 'genoa'
  | 'hungary_bohemia'
  | 'scotland'
  | 'venice';

export type Religion = 'catholic' | 'protestant' | 'other';
export type SpaceType = 'key' | 'electorate' | 'fortress' | 'unfortified';

export interface SpaceState {
  id: string;
  type: SpaceType;
  homePower: MajorPower | MinorPower | 'independent';
  politicalControl: MajorPower | MinorPower | 'independent';
  religion: Religion;
  unrest: boolean;
  isPort: boolean;
  besiegedBy: MajorPower[]; // can contain 0,1,2 allied powers
  occupiedBy: UnitStack[];
}

export interface UnitStack {
  owner: MajorPower | MinorPower;
  regulars: number;
  mercenaries: number;
  cavalry: number; // Ottoman only
  squadrons: number;
  corsairs: number; // Ottoman only
  armyLeaders: string[];
  navalLeaders: string[];
}

export interface RulerState {
  power: MajorPower;
  rulerId: string;
  adminRating: number;
  cardBonus: number;
}

export type CardType =
  | 'home'
  | 'mandatory_event'
  | 'event'
  | 'response'
  | 'combat';

export interface CardState {
  id: string;
  type: CardType;
  cp: number;
  ownerPower?: MajorPower;
  removeIfEvent: boolean;
  mandatoryDueTurn?: number;
}

export interface DiplomaticState {
  atWar: Record<MajorPower, Record<MajorPower | MinorPower, boolean>>;
  alliedMajor: Record<MajorPower, Record<MajorPower, boolean>>; // one-turn alliances
  alliedMinor: Record<MinorPower, MajorPower | null>;
  loanedSquadrons: Array<{ from: MajorPower; to: MajorPower; count: number }>;
}

export interface GameState {
  turn: number;
  phase:
    | 'luther_95'
    | 'card_draw'
    | 'diplomacy'
    | 'diet_of_worms'
    | 'spring_deployment'
    | 'action'
    | 'winter'
    | 'new_world'
    | 'victory_determination';
  impulseOrder: MajorPower[]; // fixed order below
  activePower: MajorPower | null;
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
  markers: Record<string, unknown>; // reformers, debaters, piracy, translation tracks, etc.
}
```

## 3. Constants and Ordering

- Impulse order is fixed:
1. Ottoman
2. Hapsburg
3. England
4. France
5. Papacy
6. Protestant
- Hit rule for most combats: each die `>= 5` is a hit.
- Tie rule in combats: defender wins (except where specific religious tie rules override).

## 4. Turn and Phase Engine

Each turn executes these phases in order:
1. `luther_95` (Turn 1 only)
2. `card_draw`
3. `diplomacy` (abbreviated on Turn 1)
4. `diet_of_worms` (Turn 1 only)
5. `spring_deployment`
6. `action` (impulse loop until 6 consecutive passes)
7. `winter`
8. `new_world`
9. `victory_determination`

Action phase loop:
- On a power's impulse, choose exactly one:
1. Play card for CP.
2. Play card as event.
3. Pass.
- Cannot pass if:
1. Home card still in hand.
2. Any mandatory event still in hand.
3. Hand size exceeds current ruler admin rating.
- Phase ends after 6 consecutive passes.

## 5. Card System

Card types:
- Home: starts in owner hand each turn; cannot be randomly stolen/drawn; when used place on power card, not discard.
- Mandatory event: must be played in Action Phase of draw turn; event resolves first, then grant 2 CP; usually removed after resolution.
- Event: normal event with optional CP usage.
- Response: may interrupt impulses/combat/event windows.
- Combat: playable as event only during field battle/assault/naval combat where owner participates; otherwise CP usage allowed.

Deck lifecycle:
1. At Card Draw Phase, add turn-gated and variable cards if conditions are met.
2. Shuffle shared deck.
3. Deal base cards + ruler card bonus.
4. Hand = dealt cards + unspent carryover + home card(s).
5. Discard pile is recycled next turn.

Base card draw:
- Non-Protestant: from key-control track on power card (reduced by unrest markers on key boxes; min 1 base card).
- Protestant: 5 cards if >=4 electorates under Protestant political control, else 4.

## 6. Rulers and Admin

- Rulers define:
1. `adminRating` = max cards retained between turns.
2. `cardBonus` = extra cards dealt.
- Ottoman and Hapsburg rulers remain constant in this edition (Suleiman / Charles V).
- Other powers receive ruler changes through mandatory events.
- Some rulers alter religious subsystem behavior.

## 7. Units and Formations

Land unit types:
- Regulars (all powers)
- Mercenaries (all major except Ottoman)
- Cavalry (Ottoman only)

Naval unit types:
- Squadrons (all except Protestant and Hungary/Bohemia)
- Corsairs (Ottoman only)

Formation rules (land):
- No leader: max 4 land units.
- One leader: max = command rating.
- Two+ leaders: max = sum of top two command ratings.
- Army leaders are not counted as units toward cap.

## 8. Diplomacy Phase (Sections 9.1-9.6)

Segments execute in this order:
1. Negotiations
2. Alliances
3. Suing for Peace
4. Ransom of Leaders
5. Remove Excommunication
6. Declarations of War

Negotiation-legal state changes:
- End war by mutual agreement (white peace).
- Form one-turn alliance.
- Loan naval squadrons and naval leaders within alliance.
- Return captured army leaders.
- Transfer political control of spaces.
- Transfer cards by agreement.
- Papacy may grant Henry divorce.

Alliances:
- Duration: one turn (removed in Winter).
- Effects: allied spaces count friendly; one-way loaned squadrons possible; no two-way swap in same turn.
- Hard restrictions include Papacy-Ottoman never allied.

Suing for peace:
- Requires qualifying loss state (captured leader/home space).
- Process includes winner VP, territory return/control changes, unit relocation, war termination.
- Protestant vs Hapsburg/Papacy has special non-peace constraints tied to Schmalkaldic League.

Declarations of war:
- Pay CP by diplomatic matrix.
- Apply all target legality restrictions.
- Set diplomatic state to at-war.
- Resolve minor-power interventions and alliance interactions.

## 9. Spring Deployment (Phase 5)

- Free move for one formation from capital to friendly-controlled destination.
- Resolved in impulse order.
- Path constraints:
1. Friendly-controlled path.
2. No unrest along path.
3. Optional one sea-zone crossing with strict conditions.
4. No pass crossing (unless overridden by event).
- Hapsburg can deploy from either capital (not both simultaneously for one deployment action).
- Protestant has no capital and cannot use spring deployment.

## 10. Action Catalog (Section 11.1)

Actions consume CP immediately and resolve fully before next action in same impulse.
- Typical action families:
1. Land movement / pass movement.
2. Naval movement.
3. Build units.
4. Assault / foreign war.
5. Control unfortified space and remove unrest.
6. Religious actions (publish treatise, translate scripture, call theological debate, burn books, found Jesuit university, build St. Peter's).
7. New World actions (explore, colonize, conquer).

Important limits:
- `explore`, `colonize`, `conquer` each max once per power per turn.
- CP does not carry between impulses.

## 11. Control, LOC, and Unrest (Section 12)

Line of Communication (LOC):
- Required for control change actions and assault.
- Trace from friendly controlled fortified home space (major or allied minor home as allowed).
- Path must be friendly-controlled and free of unrest.
- LOC restrictions differ from Winter return path (enemy units matter for LOC, not for Winter return).

Control unfortified space:
- Cost: 1 CP.
- Requires qualifying adjacency/occupation and no illegal enemy occupation state.
- Can also remove unrest under special conditions.

Unrest effects:
- Blocks LOC tracing through space.
- Blocks movement options and construction in that space.
- Affects VP/key/card accounting and some piracy defense effects.

## 12. Land Movement and Reaction (Section 13)

Move actions:
- Move formation in clear: 1 CP.
- Move over pass: 2 CP.

Core checks:
1. Formation legality.
2. Destination legality by war/alliance/control state.
3. Enemy intercept opportunities.
4. Defender may avoid battle or withdraw into fortifications.
5. If opposing stacks remain in same unfortified space -> field battle.

Interception:
- Triggered by adjacent enemy eligible stacks.
- Resolve by impulse order when multiple powers can intercept.
- First successful intercept blocks others.

## 13. Field Battle (Section 14)

Dice pool:
- Attacker: 1 die per land unit + highest leader battle rating.
- Defender: same +1 defender die.

Resolution:
1. Both sides may play combat cards (attacker then defender).
2. Roll, count hits.
3. Apply losses.
4. If a side is eliminated, capture leaders.
5. Losing side retreats (or withdraws into fortification if legal).
6. If fortified-space battle and attacker wins, check siege condition.

Retreat constraints:
- No retreat into unrest, enemy-occupied, illegal-controlled, or sea zone spaces.
- If no legal retreat, units eliminated and leaders captured.

## 14. Siege, Assault, Relief (Section 15)

Siege state begins when:
- Defenders withdraw into fortification and besieger land count exceeds units inside.

Assault action:
- Cost: 1 CP.
- Cannot assault in same impulse siege was established (except specific event override).
- Requires LOC and naval-blockade conditions.
- Resolve assault combat with assault-specific dice formulas.
- Success if defenders removed and attacker survives.

Relief force:
- Friendly force enters besieged fortification space and fights field battle.
- Possible outcomes: break siege, partial relief, or failed relief with retreat/capture.

Breaking siege:
- If besieger no longer has strictly more land units than defenders in fortification, siege breaks and besieger retreats or is eliminated if no legal retreat.

## 15. Naval Subsystem (Section 16)

Naval movement action:
- Cost: 1 CP.
- Moves all eligible naval stacks of active power in that action.
- Resolve movement, response windows, interception, avoid battle, then naval combats.

Naval combat:
- Squadrons contribute 2 dice each.
- Corsairs contribute 1 die each.
- Highest naval leader battle rating adds dice.
- Defender gets +1 die in port combat.
- Casualty rules differ for Ottoman corsairs vs squadrons.
- Retreat rules depend on sea vs port battle location.

Naval transport:
- Uses Move Formation in Clear semantics with naval path.
- Costs 1 CP per leg.
- Formation cap 5 land units + leaders for transport.
- Must end in port before impulse ends.
- If losing arrival field battle, transported units eliminated.

Piracy:
- Ottoman-only, cost 2 CP, once per sea zone per turn.
- Target power selected by Ottoman.
- Target rolls anti-piracy dice first.
- Remaining corsairs roll piracy hits.
- Per hit target chooses one cost: lose squadron, give random card, or give Ottoman piracy VP.

## 16. Unit Construction (Section 17)

General:
- Build only in friendly home spaces/ports unless event exception.
- Cannot build in unrest.
- Counter availability is a hard cap.

Land build costs:
- Regular: 2 CP.
- Mercenary: 1 CP (non-Ottoman major powers).
- Cavalry: 1 CP (Ottoman only).

Naval build costs:
- Squadron: 2 CP (all except Protestant).
- Corsair: 1 CP (Ottoman only, only after Barbary Pirates event; specific port rules apply).

## 17. Reformation Subsystem (Section 18)

Religious actions are a dedicated combat-like system with adjacency modifiers.

Main entry points:
- Luther's 95 Theses (Turn 1 mandatory setup action).
- Diet of Worms (Turn 1 religious contest).
- Publish Treatise.
- Translate Scripture.
- Call Theological Debate.
- Burn Books.
- Event-driven reform/counter-reform attempts.

Reformation attempt algorithm:
1. Select legal Catholic target space.
2. Compute Protestant dice from adjacency/reformer/units + bonuses.
3. Roll Protestant dice, track highest modified result.
4. Check automatic success conditions.
5. Compute and roll Papal defense dice.
6. Compare highest results with language-zone tie rule.
7. Flip religion if successful; apply electorate and special side effects.

Counter Reformation algorithm mirrors the above with Catholic initiative and its own auto-success/tie modifiers.

Theological debate:
- Random/selected debater picks per rules.
- Roll debate dice (attacker then defender).
- Two-round handling for ties in first round.
- Convert spaces by hit differential.
- Burn/disgrace debaters if margin exceeds debate value.
- Award VP for burned/disgraced debaters.

## 18. Winter Phase (Section 19)

Execute globally in order:
1. Remove loan markers.
2. Remove temporary renegade leader.
3. Return naval units/leaders to ports.
4. Return land units/leaders to legal fortified destinations, applying attrition where path constraints fail.
5. Remove major-power alliance markers.
6. Add 1 regular to each friendly controlled non-unrest capital (Hapsburg can gain in both capitals; Protestant none).
7. Remove piracy markers.
8. Uncommit all debaters.
9. Auto-trigger overdue mandatory events.

## 19. New World Subsystem (Section 20)

Actions:
- Colonize
- Explore
- Conquer

Key points:
- English/French/Hapsburg only.
- Marker-based underway state in Action Phase.
- Resolution happens in New World Phase.
- Exploration/conquest use 2d6 + explorer/conquistador modifiers and tables.
- Results can grant VP, discoveries, colonies, extra card draw potential, or losses of explorers/conquistadors.
- Riches are checked in Card Draw Phase.

## 20. Major Power-Specific Rules (Section 21)

Ottoman:
- Unique cavalry and corsair systems.
- Piracy and pirate-haven logic.
- Foreign war card handling.

Hapsburg:
- Two capitals.
- Distinct return/spring-deployment behavior.

England:
- Henry VIII wives/heirs track.
- Succession effects.
- Special restrictions/effects under Mary I.

France:
- Patron of the Arts / chateaux VP engine.

Papacy:
- Jesuit unlock.
- Excommunication system.
- Sack of Rome process.
- St. Peter's VP construction engine.

Protestant:
- Pre-Schmalkaldic restrictions.
- Electorate military/religious interactions.
- Transition to full military participation after trigger.

## 21. Minor Powers and Independent Keys (Section 22)

Minor power states:
- `inactive`
- `active(allied_to_major)`

Activation/deactivation:
- Triggered by diplomacy intervention and specific events.
- Active minors act as military extensions of allied major power.
- Hungary/Bohemia has special permanent-activation path after Ottoman defeat condition.

Independent keys:
- Capturable and then persist under major control unless specific event reverts them.

## 22. Scoring and Victory (Section 23)

VP composition:
- Base VP from controlled keys/electorates per power card rules.
- Special VP tracks (including Protestant spaces and power-specific tracks).
- Bonus VP markers from events/debates/new world/war etc.

Victory-determination algorithm:
1. Check immediate military/religious wins during Action Phase continuously.
2. In Victory Determination phase, compute all VP totals.
3. Check Standard victory.
4. Check Domination victory (Turn >= 4 only).
5. If Turn 9 ended without winner, Time Limit victory.
6. Tie-break by previous turn VP totals (walk backward turn-by-turn).

## 23. Recommended Engine Architecture

Use rule modules:
1. `cards/`
2. `diplomacy/`
3. `movement_land/`
4. `combat_field/`
5. `siege/`
6. `movement_naval/`
7. `piracy/`
8. `reformation/`
9. `winter/`
10. `new_world/`
11. `scoring/`

Determinism requirements:
- Every action logs preconditions checked and state diffs.
- Every die roll should be recorded with seed and context key.
- Simultaneous effects should be flattened into explicit ordered steps.

## 24. Validation and Rule Precedence

Validation order for any player action:
1. Phase legality.
2. Power eligibility.
3. CP/card payment legality.
4. Target legality (war/alliance/space/unit state).
5. One-per-turn and once-per-impulse caps.
6. Resolve with interrupts (response/combat cards).

Precedence principle:
- Specific card/event text overrides base subsystem rules.
- If two effects conflict and both are card text, use explicit timing windows and active-player order unless card text says otherwise.

## 25. Implementation Test Matrix (Minimum)

Required integration suites:
1. Turn-1 flow (`luther_95`, `diet_of_worms`, abbreviated diplomacy).
2. Pass legality under home/mandatory/admin constraints.
3. LOC-sensitive control and unrest removal.
4. Intercept/avoid/withdraw chains before field battle.
5. Siege establish/assault/relief/break transitions.
6. Naval move with interception and multiple sea-zone transport.
7. Piracy payout choices under empty-hand and VP-cap conditions.
8. Reformation and counter-reformation tie behavior by language and ruler state.
9. Winter return with attrition and enemy-controlled capital case.
10. New World resolve order and result table effects.
11. Minor power activation/deactivation and Hungary-Bohemia special case.
12. Standard/domination/time-limit victory checks and tie-break replay.

## 26. Scope Notes

- This document is intentionally implementation-oriented and omits flavor text.
- For exact card effects and numeric table lookups, use structured card/table data sourced from the official rulebook and scenario sheets.
- Where OCR extraction was ambiguous, prefer the official printed text as authoritative.
