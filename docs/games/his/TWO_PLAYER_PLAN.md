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

### Phase 2b — Remove-At-War ✅ *(shipped)*
The Papacy can now end an invasion war at the **start of the Diplomacy phase** (§9): a new
`remove_war` stage precedes the card deal. **Papal Bull** (vs France/Hapsburg, ruler not yet
excommunicated) excommunicates the ruler, ends the war, spends the Bull for the turn, and draws
an extra Main-Deck card; **sue for peace** (any war except Protestant post-SL) ends the war,
awards the Protestant 1 War-Winner VP, and removes 2 Papal units of the Papacy's choice. Code:
`phases/phase-diplomacy-2p.js` (`papalBullTargets`/`sueForPeaceTargets`/`applyPapalBull`/
`applySueForPeace2P` + the stage machine, reusing `war-helpers`, `excommunicatedRulers`,
`bonusVp`); action types `PAPAL_BULL`/`SUE_FOR_PEACE_2P`/`END_REMOVE_WAR` wired in `index.js`; UI
`_renderRemoveAtWarPanel` + the `SUE_FOR_PEACE_2P` unit-selection flow. Tests:
`src/games/his/two-player-removewar.test.js` (7) + e2e + live-verified.

### Phase 2b-cards — Non-invasion diplomatic-card dispatch ✅ *(shipped)*
Every diplomatic card now dispatches its `DIPLOMACY_EVENT_HANDLERS` effect in the 2P play-loop
(Phase 2 dispatched only Invasions): minor-power activation (#201/#204/#212), board removals /
placements (#209/#210/#218), religion flips (#217), Henry's divorce (#207), Knights / Corsair
(#208/#203), and the deck-meta cards #205 Diplomatic Pressure + #215 Machiavelli (which run on the
real `diplomacy-deck` subsystem). A per-card **input UI** gathers each card's actionData — inline
choice buttons (minor power / mode / granted-vs-refused / force-discard-vs-swap / Machiavelli
target) and map-selection flows (`DIPLO_PLAGUE`/`DIPLO_SHIPBUILD`/`DIPLO_SIEGE_VIENNA`/
`DIPLO_PLACE_HAPSBURG`/`DIPLO_VENICE`/`DIPLO_SECRET_CIRCLE`) — and `normalizeDiplomacyActionData`
bridges the flat collected keys (r0/r1/p0/space/targetSpace) into each handler's shape. Also
shipped: **#205 forced-play** enforcement (the Papacy can bind the Protestant to one card),
**Papal Bull "regain a home space"** benefit (the `PAPAL_BULL_REGAIN` flow), the **§11
Landsknechts/Swiss (#33/#36) exclusion** when responding on behalf of an invader, and
`getVisibleState` **opponent diplomacy-hand masking** (online 2p). Key code:
`phases/phase-diplomacy-2p.js` (`normalizeDiplomacyActionData`, `clearInformationalDiplomacyMarkers`,
forced-play guard), `ui/action-panel.js` (`_renderDiploCardInput` + choice/card-pick sub-panels),
`ui/selection-manager.js` (the new flows), `index.js` (§11 response gate),
`state/state-visible.js`. Tests: `src/games/his/two-player-cards.test.js` (16) + e2e panel
click-through; full suite 3547 green, build clean.

**Fidelity residual — closed (2026-06-29):** the three cross-subsystem effects now run for real:
**#208** draws a card and spends its CP on St. Peter's (`stPetersProgress`/`stPetersVp`); **#203**
makes the diplomacy opponent discard a card per hit (a squadron once out of cards); **#207 granted**
runs a real theological debate via `debate-actions.js runDebateToCompletion` — a **synchronous**
initiate → resolve → auto-flip that leaves no pending state (the 2P diplomacy phase can't host an
interactive debate). Tests in `event-actions-diplomacy.test.js` + `two-player-cards.test.js`. The new
Papacy counter-reform / St. Peter's strength nudged the bot matchup, so the v2 publish threshold was
re-centered 32 → 34 (back to ~even: 20-seed 11–9, VP ≈ 11.1 vs 11.0). Still deferred: #219
force-discard / hand-reveal; sue-for-peace **space-reclaim** and #217's optional **Spanish-zone**
flip (supported via `actionData`, no UI step); the Mary-I 3+CP debate (now unblockable via
`runDebateToCompletion`).

### Phase 3 — England automation (§21.3): succession + Mary-I ✅ *(shipped)*
England is a non-player power, so its Reformation trajectory unfolds automatically. New module
`phases/england-succession-2p.js` (all `isTwoPlayer`-gated):
- `scheduleEnglandSuccession2P` (called from `phase-card-draw.js`): **T4** Henry marries Anne Boleyn
  (advances `henryMaritalStatus`, which opens the conditional English debaters); **T5** Cranmer /
  Latimer / Coverdale enter the Protestant debater pool; **T6** Edward VI (#19) enters the Main Deck.
- `forceEnglandSuccession2P` (called from `phase-winter.js` Step 9): **Winter T7** fires Edward VI
  (#19) if Henry still rules → England Protestant; **Winter T8** fires Mary I (#21) if Edward still
  rules → England Catholic. Reuses `EVENT_HANDLERS[19/21]` + `replaceRuler`; consumes the card.
- `maybeMaryIImpulse2P` (hooked into `index.js` `_handleEndImpulse` + `_handlePass`, fires after each
  **Protestant** impulse): under Mary I (and not already all-Catholic) the Papacy rolls d6 → 1–4
  continue to the Papal impulse; 5–6 draw a Main-Deck card and set up an English-zone
  counter-reformation (`pendingReformation`, mirroring `_isMaryIHijack`). The d6 is injectable for
  tests. Tests: `src/games/his/two-player-england.test.js` (13).

### Phase 3-C — The 6 modified cards ✅ *(shipped)*
Each is an `isTwoPlayer`-gated delta on the existing handler (Scenarios.pdf "Modified Cards", p. 40):
- **Papal Bull (#5)** — `EVENT_HANDLERS[5].validate` rejects the standard event in 2P (only the §9
  Remove-At-War use is allowed).
- **Schmalkaldic League (#13)** — records `state.lockedHapsburgControl` (Rome/Ravenna if
  Hapsburg-held at SL); `validateControlUnfortified` blocks re-controlling a locked space.
- **Dissolution (#63)** — 2P: the Protestant removes one random card from the Papal hand to the
  discard, then the 3 English-zone Reformation attempts (no English card draw).
- **Charles Bourbon (#70)** — 2P `validate` + execute guard restrict placement to the German/Italian
  zones.
- **City State Rebels (#71)** — 2P logs a `hapsburgElectorate` target after SL (widened eligibility).
- **Sack of Rome (#95)** — 2P: a French/Hapsburg (non-player) sacker receives no Papal card — both
  drawn cards are discarded. (Added an `attackerDice`/`defenderDice` injection seam for tests.)

Tests: `src/games/his/two-player-modified-cards.test.js` (8).

**Residual (documented):** the #13 Rome/Ravenna lock is enforced only on the `CONTROL_UNFORTIFIED`
path (no central §2.2 control-change gate exists, so the combat-capture path is unguarded); the base
#71 rebellion *effect* is log-only in the current engine (pre-existing, not 2P-specific); the Mary-I
3+ CP *debate* step is logged but not run (matches `_isMaryIHijack`).

### Phase 4a — Online 2-player ✅ *(shipped)*
Two humans play the variant remotely (one Papacy, one Protestant), reusing the verified online
transport + lockstep relay and the per-player `getVisibleState` masking (already wired at
`app-online-room-methods.js`; Phase 2b-cards added diplomacy-hand masking). Changes:
- **Engine** (`state/state-init.js` `twoPlayerAssignment`): a 2-player power-assignment default
  (none in `DEFAULT_POWER_ASSIGNMENTS`) — 1 seat → `[['papacy','protestant']]` (hotseat), 2 seats →
  `[['protestant'],['papacy']]` (seat order).
- **Lobby** (`app/app-online-room-methods.js`): the create-room modal offers a **"2 — 两人局（教廷 vs
  新教）"** player-count option for games with a `two_player` variant; the host-start derives
  `settings.variant = 'two_player'` from `maxPlayers === 2` so it builds the variant initial state and
  broadcasts it. The joiner receives the variant via the broadcast `initialState`.
- **Config** (`config.json`): variant description notes online is via the 2-player room.

Tests: `src/games/his/two-player-online.test.js` (5: assignment default + per-player diplomacy-hand
masking); verified live in-browser (bundled engine assignment/masking + the create-room option gate).
Full suite 3573 green, build clean. **Final live step (reusable):** a full two-client lockstep run
over a backend uses the standard-HIS two-client harness (the transport is unchanged).

### Phase 4b — Offline vs-AI (MVP) ✅ *(shipped)*
One human plays the computer as Papacy or Protestant. The offline model is a single local game
instance: **one human seat** plus the opposing side as a **bot power** (`botPowers`), driven by the
existing HISBOT loop — not a second player row (that's the online mode, 4a). The 3–6p bot already
covers the Action/religious phases; the new work was the 2P Diplomacy phase + emergent 2P-correctness
fixes surfaced by an all-bot run-to-completion.

- **Bot 2P-Diplomacy** (`ai/bot-diplomacy-2p.js` `decideDiplomacy2P` + `bot-controller.js`):
  `getNextActingBotPower` now returns the `getDiplomacy2PActor` for the 2P diplomacy phase, and
  `decideBotAction` plays a diplomatic card (Invasion → a DE/IT landing space; others via the engine
  normalizer; honors #205 forced-play) or runs Remove-At-War (Papal Bull vs France/Hapsburg, else
  END_REMOVE_WAR).
- **2P card-draw (§6.2) fix** (`phases/phase-card-draw.js`): non-player powers are no longer dealt
  Main-Deck cards or home cards — they hold no hand (this also fixed a latent stall where a non-player
  power was pulled into a mercenary response window no one could drive).
- **§13 bot move filter** (`ai/bot-goals.js`): `dispatchGoalAction` skips a goal whose
  move/control target is outside the German/Italian zones for a religious power (centralized chokepoint
  — cut the bot's illegal proposals ~10×). #5 Papal Bull is routed as CP, never as its (2P-disabled)
  event (`ai/bot-card-play.js`).
- **Offline seating** (`main.js` `_startOfflineGame` + `components/game-settings-modal.js`): a
  "两人局对手" selector — 热座 (hotseat) / 对战 AI·你执教廷 / 对战 AI·你执新教 — maps to
  `powerAssignment: [[humanSide]]` + `botPowers: [otherSide]`; the offline bot loop auto-kicks.

Tests: `ai/bot-fullgame.test.js` adds an all-bot 2P run-to-completion (3 seeds: ended, 0 chain-broken,
winner ∈ {Papacy, Protestant}). Full suite 3576 green, build clean; live-verified in-browser (correct
vs-AI seating + the Papacy bot autonomously playing a diplomacy card).

### Phase 4b strong-AI tuning v1 ✅ *(shipped)*
Hardened the offline-vs-AI bot beyond the MVP:
- **`stuck` → 0**: `findControlTarget` (`ai/bot-goals.js`) skipped only `controller === power`, not
  *ally*-controlled spaces — post-SL the bot proposed taking a Papacy↔Hapsburg space (engine rejects
  "friendly-controlled"). Now filters the full `friendlyPowers` set (correct in 3–6p too). The full-bot
  2P test is tightened from `stuck ≤ 8` to **`stuck === 0`** (the 3–6p bar).
- **§11 invader command**: the bot now *uses* the invaders its invasion cards activate. A new
  `decideInvaderCommand` (hooked at the top of `dispatchGoalAction`, capped per impulse) drives each
  `controllableInvaders` power to relieve/assault or advance on the opponent — reusing
  `executeAdvance`/`executeLandBattle(state, invader, cp)`, filtered by `isInvaderMoveBlocked`,
  restricted to `INVADER_ACTION_TYPES`, and tagged `forPower` through the §11 CP pipeline. The all-bot
  2P regression now asserts invaders actually act (64 commanded moves across the seeds); live-verified
  in-browser (`MOVE_FORMATION forPower: france`).
- **Surfaced + fixed two latent 2P bugs**: the bot played **Charles Bourbon (#70)** as an event with no
  (DE/IT) target → now routes it as CP in 2P (`bot-event-criteria.js`); and **non-player powers could
  "win"** once §11 invaders captured key spaces — 2P victory is now restricted to the Papacy/Protestant
  in both immediate-win paths (`state/victory-checks.js` military auto-win + `phase-manager.js`
  standard/domination, and `index.js checkGameEnd`).
- **Diplomacy-card selection**: `decideDiplomacy2P` no longer plays `hand[0]` blindly — `scoreDiplomacyCard`
  ranks the hand so the bot plays a self-beneficial Invasion (one whose activated invader, via §11,
  attacks the *opponent* — `invasionBeneficiary` classifies #202/#206/#216 → Protestant, #213/#214 →
  Papacy, #211 by the Schmalkaldic League) over a neutral non-invasion, and avoids playing an Invasion
  that would help the opponent. Still honors the #205 forced-play. Tests: `ai/bot-diplomacy-2p.test.js`.

### Phase 4b strong-AI tuning v2 — matchup balance (measurement-driven) ✅ *(shipped)*
A new **analytics harness** (`ai/bot-2p-analytics.test.js`) runs a 12-seed all-bot 2P sweep and reports
the win split / VP / reformation profile (and asserts every game ends, `stuck === 0`, and neither side
sweeps — a robustness + balance regression guard). The baseline exposed a **19–0 Papacy walkover**: the
Protestant's only VP track is the Protestant-Spaces track, while the Papacy also banks key + St. Peter's
VP, and the Protestant under-reformed (~25 of 50 spaces). Fix: a 2P-gated, Protestant-only **publish
priority** in `dispatchGoalAction` — publish treatises (the Protestant's reformation = VP) ahead of the
generic goals, capped 2/impulse and **only while `protestantSpaces < 34`** (32 originally; raised to 34
when the 2b-cards fidelity work added Papacy counter-reform/St.-Peter's strength — the threshold tuned against
the harness so it neither under- nor over-reforms). Result: **~even** (12-seed 6–6 / 20-seed 10–10, avg
VP ≈ 10.4 vs 10.7). All `isTwoPlayer` + Protestant gated; the 3–6p bot is untouched.

**Deferred:** smarter invasion *landing* (reverted — perturbs the bot's trajectory enough to surface
unrelated latent quirks for marginal engagement gain); remove-at-war timing nuance / sue-for-peace
(measured **moot** — the Papacy doesn't struggle); §11 invader-vs-keys (the publish lever balanced the
matchup without it); deeper behavior-card retuning; a host side-pick beyond the seat-order/selector
default.

## 3. Reused existing assets
- `frontend/src/games/his/state/diplomacy-deck.js` — the full deck subsystem (init/shuffle/
  deal/play/discard/reshuffle/swap, `addSchmalkaldicDiplomacyCards`, `isInvasionCard`,
  `trailingDiplomacySide`). 26 passing tests.
- `frontend/src/games/his/actions/event-actions-diplomacy.js` — `DIPLOMACY_EVENT_HANDLERS`
  (#201–219), ready for Phase 2 to dispatch.
- 2P sequence-of-play reference: `his_ref/img/_vmod_docs/sequence_twoplayer.html`.
