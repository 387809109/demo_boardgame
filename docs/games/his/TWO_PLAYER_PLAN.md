# Here I Stand — Two-Player Variant: Plan & Authoritative Rules

> Source of truth for the official 2-player variant, extracted from
> `his_ref/Scenarios.pdf` pp. 37–40 (Two-Player Variant; design: Ed Beach).
> This doc exists so later phases are not blocked on re-reading the PDF.

## 0. Premise

The 2-player variant pits **Protestant vs. Papacy**. The other four major powers
(Ottoman, Hapsburg, England, France) are **not played** — their actions are handled
indirectly through a **Diplomatic Deck**. One scenario only, starting 1517 / Turn 1.
"If a section is not listed below, the standard rules apply unchanged."

## 1. Authoritative rule summary (pp. 37–40)

- **§2.2 Political control:** only **Metz, Liège, and all German + Italian** language-zone
  spaces may change political control. Everything else is fixed all game.
- **§3 Powers:** only Papacy & Protestant participate fully. The other four are **not** dealt
  cards and do **not** take part in Card Draw / Diplomacy / Spring Deployment / Victory
  Determination. They participate in **Action** and **Winter** phases **only while At War**
  with a player (via an Invasion diplomatic event, or via the Schmalkaldic League).
- **§6.2 Decks:**
  - **Main Deck:** remove the cards listed in §Setup below. Add cards on Turns 3–7 (Mary/
    Elizabeth on T8/9 per England rules). Dealt to Papacy & Protestant only.
  - **Diplomatic Deck:** 12 base cards; +9 "post-Schmalkaldic-League" cards added at the
    start of the first turn after SL forms (reshuffle discard + new cards in then). **Not**
    shuffled each turn — only on SL addition or immediately after Machiavelli (#215). Each
    player holds a separate hand of 1–2 diplomatic cards.
- **§7 Sequence of play:** **New World phase deleted** (and New-World-Riches rolls). The
  Diplomacy phase is replaced by the Diplomatic-Deck procedure.
- **§9 Diplomacy:** **T1** — each player draws 1 diplomatic card, plays **none** (wait for
  T2). **T2–9** — each draws 1, then **Papacy plays 1, then Protestant plays 1**. You must
  always play a card, even if it benefits your opponent (then the opponent resolves it).
  Wartburg cannot cancel a diplomatic event.
- **Gaining At War:** after SL, Papacy & Protestant are always at war, as are Hapsburg &
  Protestant. Other powers go At War only via an Invasion diplomatic event.
- **Gaining Allied:** after SL, Papacy & Hapsburg are allied for the rest of the game (the
  only allowed alliance in this variant); lets the Papacy spring-deploy through Hapsburg
  spaces.
- **Removing At War (Papacy only, vs France/Hapsburg):** at the start of the Diplomacy phase,
  either play **Papal Bull** (excommunicate that ruler, end the war, regain a home space or
  draw a card) or **sue for peace** (remove 2 own units, award Protestant War-Winner VP, may
  reclaim home spaces for more VP). Never peace with Protestant after SL.
- **§10 Spring deployment:** **only the Papacy** may spring-deploy, and **never** outside the
  German/Italian zones.
- **§11 Action phase:** Papal & Protestant act normally. When the **opponent** is At War with
  a major power, a player may play cards to act **on behalf of** that at-war power, limited to:
  move formation in clear, move over pass, naval move (Papal naval may also move), assault,
  control unfortified space, and combat/response cards (except Landsknechts & Swiss
  Mercenaries). **No unit construction** on behalf of others.
- **§12 Control & Unrest:** Protestant may remove unrest from any space under Protestant
  religious influence; Papacy from any under Catholic influence — **no unit-adjacency
  requirement**.
- **§13 Movement:** Papal & Protestant units may never move/intercept/retreat/avoid-battle
  outside German + Italian zones. French/Hapsburg/Ottoman units may move throughout those two
  zones and to independent / own-controlled spaces elsewhere. Minor units follow their ally.
- **§14 Construction:** Papacy builds only Papacy + minor-ally units; Protestant builds only
  Protestant **land** units — even while controlling an invader (includes Foreign Recruits /
  Landsknechts / Swiss Mercenaries).
- **§18 Diet of Worms:** the Hapsburg card is drawn from the **top of the deck** (if a
  Mandatory Event is drawn, ignore the event — treat as a 2 CP card).
- **§19 Winter:** French/Hapsburg/Ottoman units move to fortified spaces as normal (controlled
  by whoever ran them in the Action phase); if forced to a capital they are **removed** instead;
  all French/Hapsburg/Ottoman **army leaders are removed** (re-enter on a later invasion).
  Added Mandatory Events: **Edward VI** (Winter T7), **Mary I** (Winter T8). Barbary Pirates
  is no longer auto-triggered at end of T3 (not in the deck).
- **§19 Victory — Domination:** if a power's VP < 25 but is **≥ 8 VP greater** than the other,
  they win — Turn 4+ only (never T1–3). (Standard / religious / time-limit victories unchanged.)
- **§21.3 England:** Henry & Anne Boleyn marry T4; Cranmer/Latimer/Coverdale enter T5; Edward &
  Elizabeth born before T6 (Edward enters deck Card-Draw T6); Edward VI / Mary I required in
  Winter T7 / T8 if not yet played. **Mary I as ruler:** after each Protestant impulse (skip if
  all English home spaces are Catholic), Papal player rolls d6; 1–4 → continue to Papal impulse;
  5–6 → Papal power draws a card and acts vs the English zone (1–2 CP Burn Books; 3 CP debate;
  4+ Burn Books then debate).
- **Modified cards:** Papal Bull, Schmalkaldic League (now allies Hapsburg+Papacy), Dissolution
  of the Monasteries, Charles Bourbon, City State Rebels, Sack of Rome (see PDF for exact text).

### Cards removed from the Main Deck (49 cards)

`1, 2, 3, 4, 9, 18, 30, 34, 40, 42, 48, 49, 50, 53, 54, 58, 59, 66, 68, 69, 72, 73, 74, 77,
80, 82, 83, 84, 86, 87, 89, 92, 93, 94, 96, 97, 98, 99, 100, 101, 103, 108, 110, 111, 112,
113, 114, 115, 116`

### Setup deltas (vs. 1517 scenario)

- All land stacks **outside** German/Italian zones → exactly **1 regular**, no other land units.
- Naval units only in **Marseille, Genoa, Naples, Venice, Rome**.
- **Prague** = Hapsburg controlled (SCM); **Brunn & Breslau** = Hapsburg HCM (Catholic).
  **Hungary** = Hapsburg ally; other Hungary spaces Ottoman-controlled; **Buda & Belgrade** =
  1 Ottoman regular each.
- Only leader on the map at start: **Andrea Doria** (Genoa).

## 2. Phased implementation roadmap

This project ships the **3–6 player** game; the 2-player variant is additive and fully gated
on `state.variant === 'two_player'` (standard play must be byte-unchanged).

### Phase 1 — Religious-core MVP, offline hotseat ✅ *(shipped)*
2P setup data, deck removal, 2P sequence of play (delete New World, Papacy→Protestant impulse
order), Diplomatic-Deck phase **wired structurally** (draw / play→discard / reshuffle / SL-add),
religious-struggle restrictions (movement/construction/unrest, §12–14), 2P domination victory
(8 VP gap), and a hotseat UI (diplomacy-hand panel + seat indicator).

**MVP honesty boundary:** the Diplomatic Deck is wired *structurally*. Played diplomatic cards
are logged (with title + invasion flag) and cycled to the discard, but their **effects are not
executed** — the `DIPLOMACY_EVENT_HANDLERS` (#201–219) place invasion armies / set wars / pend
choices that require the Phase-2 invasion-control system, so dispatching them in the MVP could
strand half-resolved `pending*` state. The **religious struggle itself is fully functional**
(reformation, debate, burn-books, St. Peter's, conclave). This is a documented limitation, not
a silent gap.

### Phase 2 — Military / invasion system (military core) ✅ *(shipped)*
Invasion cards (#202/#206/#211/#213/#214/#216) now **dispatch** their `DIPLOMACY_EVENT_HANDLERS`
on play (set the war + place the army at a player-chosen `targetSpace`); §11 player control of an
At-War invader in the Action phase via `actionData.forPower` routed through the CP pipeline
(move/assault/control/naval + combat/response on behalf — no construction); §13 invader movement
limited to DE/IT + independent/own spaces; SL war/ally transitions (Papacy/Protestant +
Hapsburg/Protestant at war, Papacy/Hapsburg allied); §19 Winter removal of FR/HA/OT units forced
to capital + all their army leaders; compact At-War/Ally status readout. The 2P setup now starts
with **no wars** (non-player powers activate only via an invasion card / SL). Key code:
`state-helpers.controllableInvaders/canControlInvaderAction/invaderController/playerCommandsPower/
isInvaderMoveBlocked`, `phases/phase-diplomacy-2p.js` (dispatch + `pendingCardDraw` drain),
`phases/phase-winter.js`, `actions/event-actions.js` #13, UI `INVASION_TARGET` selection +
`forPower` invader buttons. Tests: `src/games/his/two-player-military.test.js` (9),
`e2e/games/his/two-player.spec.js` (invasion flow).

**Deferred to Phase 2b:** the bespoke non-invasion diplomatic-card effects (#201/#203/#204/#205/
#207/#208/#209/#210/#212/#215/#217/#218/#219 + their target UIs) — still log-only no-ops;
Remove-At-War (Papal Bull excommunicate / sue for peace, Diplomacy phase); the §11
Landsknechts/Swiss combat-card exclusion; `getVisibleState` opponent diplomacy-hand masking
(online 2p only).

### Phase 3 — England automation & modified cards
Henry's wives schedule, succession, Mary-I impulse procedure (§21.3); the 6 modified cards.

### Phase 4 — Modes
Online 2-player (transport lockstep already verified; assignment `[[protestant],[papacy]]`)
and offline-vs-AI (a new 2P automa — the largest AI effort).

## 3. Reused existing assets
- `frontend/src/games/his/state/diplomacy-deck.js` — the full deck subsystem (init/shuffle/
  deal/play/discard/reshuffle/swap, `addSchmalkaldicDiplomacyCards`, `isInvasionCard`,
  `trailingDiplomacySide`). 26 passing tests.
- `frontend/src/games/his/actions/event-actions-diplomacy.js` — `DIPLOMACY_EVENT_HANDLERS`
  (#201–219), ready for Phase 2 to dispatch.
- 2P sequence-of-play reference: `his_ref/img/_vmod_docs/sequence_twoplayer.html`.
