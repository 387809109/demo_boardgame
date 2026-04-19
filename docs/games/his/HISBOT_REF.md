# HISBOT v1.1 — Technical Reference

> Restructured from Russ Brown's HISBOT v1.1 rules document.
> Original source: `his_ref/HISBOT.md` (scanned PDF conversion).
> This document preserves all rules, values, priorities, and conditions from the original with zero information loss.

---

## §1 Overview & Setup

### 1.1 Concept

HISBOT provides Bot decks for each of the six major powers in Here I Stand. Each power has 8 **Behavior Cards** that dictate actions. Bots play cards in mostly random order and are opportunistic players with no grand strategy. They provide a reasonable challenge — comparable to playing with brand new players.

Bot powers follow rules and restrictions like human players. **Any rules exceptions are noted explicitly.** If a Bot's behavior indicates an action not valid in the current game state, the Bot does not take that action.

### 1.2 New Components

#### Behavior Cards

Each Bot power has a deck of 8 Behavior Cards:
- Shuffle the deck and set **2 cards aside face-down** as **Goodwill Cards**
- **Protestant exception**: specifically remove *Preventative War* and *Die by the Sword* as Goodwill Cards (added back after Schmalkaldic League)
- The remaining 6 cards form the face-down **Behavior Card draw deck**
- One card is revealed each turn to determine priorities

#### Human Player Components
- **Offer Sheets**: each human player records proposed deals with Bot powers
- **Bad Faith Cards**: each human player has 8 cards of their own power's Behavior Cards (text ignored)

#### +1 CP Tokens
Used to carry over unspent CPs when a Bot cannot spend all CPs in an impulse. Lost at end of turn.

#### Treaty Tokens
Every major power (Bot and human) has one Treaty token, used as a reminder when another power has promised to play a card on their behalf.

### 1.3 Additional Bot Setup

For each major power played by a Bot, add **one regular land unit** in:

| Power | Space |
|-------|-------|
| Ottomans | Athens |
| Hapsburgs | Barcelona |
| England | Calais |
| France | Milan (1517) or Bordeaux (1532) |
| Papacy | Rome |
| Protestants | Brandenburg Electorate Display (1517) or Brandenburg (1532) |

---

## §2 Sequence of Play

### 2.1 Luther's 95 Theses Phase

If the Protestant power is a Bot, see §4.20 Reformation/Counterreformation Attempts.

### 2.2 Card Draw Phase

Deal cards to Bot and human powers normally. Stack Bot cards into a hidden, face-down "hand" deck with the **Home card at the bottom**.

**Papacy Bot special stacking**: Leipzig Debate is always at the bottom, Papal Bull on top of it, dealt cards on top of that.

**Optional difficulty**: Deal one additional card to each Bot power beginning with turn 4. For even more challenge, start dealing additional cards on turn 1.

### 2.3 Negotiation Segment

#### Human-to-Human Deals
Negotiate normally per rules. Complete before Bot negotiations begin.

#### Human-to-Bot Proposals
Each human player can propose deals with up to **three** Bot powers per turn. Record on Offer Sheet:
- Locate the box for the current turn
- Check the colored box matching the Bot power's color
- Write the number of each item offered and requested
- Cannot offer and request the same item to/from a specific Bot (except Treaty)
- May never propose multiple deals to the same Bot in the same turn

#### Possible Offer/Request Items

| Item | Direction | Rules |
|------|-----------|-------|
| **End War** | Request only | Powers must be at war. If Bot's Behavior Card lists the requesting power or their minor ally in the War field → deal fails automatically. |
| **Alliance** | Request only | If currently at war, must also request End War. If Bot's War field lists the requesting power → deal fails. |
| **Loan Naval Squadrons** | Both | Must also request Alliance. See §4.22 Removing Naval Units for which Bot squadrons are loaned. See §4.18 Placing Naval Units for destination. Bot powers do not send naval leaders unless they loan the last naval unit in the leader's port. |
| **Return Leader** | Both | Bot offered → recovers captive leader with highest command rating. Human requests → may choose any leader held captive by the Bot. |
| **Yield Fortified Space** | Both | Bot yields the fortified space farthest from their capital that is not a home space (may be minor ally home). Will not yield home keys or home electorates. Human chooses which to yield to Bot — must be Bot's home space or minor ally home, adjacent to a space controlled by that Bot. For each fortification yielded to a Bot, that Bot removes one land unit and places it in the reclaimed fortification (see §4.21 Removing Land Units). |
| **Card Draw** | Both | Offered to Bot → draw random card from human's hand, shuffle into Bot's hand deck (Home card stays at bottom). Requested from Bot → see §4.6 Drawing Random Cards from a Bot. |
| **Mercenaries** | Both | When Bot loans a mercenary → see §4.21 Removing Land Units. |
| **Grant Divorce** | Both | Only between Papacy and England, only when England's Marital Status marker is on Ask for Divorce. Any other situation → deal fails. |
| **Rescind Excommunication** | Both | Only offered by human Papacy to excommunicated ruler, or requested from Papacy Bot by excommunicated human ruler. |
| **Treaty** | Both | Promise to play a card on another power's behalf. If offered by human → human takes the Bot's Treaty token. If requested from Bot → human gives their Treaty token to the Bot. Transfers happen even if tokens are not currently held by original powers. Powers at war will never exchange Treaty tokens. Bots will not exchange tokens if the power or its minor ally is listed in the Bot's War field. **Papacy and Hapsburg Bots never exchange Treaty tokens with the Protestant power.** When two major powers go to war, return exchanged Treaty tokens. |

#### Revealing and Confirming Deals

Players (human and Bot) reveal agreements in impulse order. When a Bot power's turn comes to confirm:
1. Reveal a new **Behavior Card** for that Bot (see §4.24 Revealing Behavior Cards)
2. Use that card's offer/request values and War field to evaluate deals

#### Evaluating Human-Bot Deals

1. If any offers or requests (combined with previous accepted deals this turn) exceed the **maximum number** of an item → deal fails
2. If Bot doesn't have enough of the requested items → deal fails
3. Sum offer values and request values
4. If total offer < total request → deal fails
5. If total offer ≥ total request → deal succeeds, take all usual confirmation steps (rulebook 9.1)
6. If offer exceeds request by ≥ 1 point AND Bot has Goodwill Cards remaining → human may take one Goodwill Card (look at it, keep face-down)

No penalty for failed deals.

#### Goodwill Cards
A human player with a Goodwill Card from a Bot may spend it to increase the value of an offer to that Bot by 1 point. Can be done after Behavior Card is revealed and values calculated. Only one Goodwill Card per deal.

#### Bad Faith Cards
If a deal succeeds but the human doesn't have enough resources for offered items → deal fails. Human gives one Bad Faith Card to the Bot. In future negotiations, add 1 to Request value for each Bad Faith Card held by that Bot. If any deal succeeds, return all Bad Faith Cards to the player. If a Bot holds any Bad Faith Cards from a human, it will **not accept deals with that player that include End War, Alliance, or Treaty**.

#### Bot-to-Bot Deals

Some offer/request items on a Bot's Behavior Card are **color-coded** for a particular major power. If the other power is also a Bot and has matching color-coded items, they have confirmed a deal. Each Bot gives the other the items coded in that power's color:
- Each item exchanged once (one leader, one squadron, etc.) **except mercenaries** → 2 mercenaries
- Deals between Bots do not fail because some exchanges cannot be made
- Not constrained by maximum numbers on cards
- Do not count toward maximums for subsequent human deals
- A Bot giving a Treaty to another Bot takes that Bot's Treaty token

### 2.4 Peace Segment

A Bot power **sues for peace** if:
- It has lost its capital (or either capital for Hapsburgs), OR
- It has lost more home key spaces (not minor ally keys) than its enemy in the current war

**Exception**: Will NOT sue for peace with a power listed in the Bot's War field (or that power's minor ally).

When suing for peace:
1. Grant War Winner VPs
2. Give card draws to regain **all home keys** (not minor power home keys)
3. Offer card draws to reclaim the **minimum number of non-key spaces** to create a controlled path from each reclaimed fortification to another controlled home fortification
4. Will NOT reclaim leaders at this time
5. **Never offer VPs** to reclaim spaces
6. For each fortification reclaimed, remove one land unit and place it in the reclaimed fortification (see §4.21 Removing Land Units)

### 2.5 Ransom Segment

Bot ransoms a leader if:
- No remaining leaders on the map, OR
- Ruler's leader figure has been captured

Ransom the leader with the **highest command rating**.

### 2.6 Excommunication Segment

Excommunicated Bot rulers **always** grant the Papal player (Bot or human) a card to rescind excommunication. See §4.6 Drawing Random Cards from a Bot.

### 2.7 War Segment

Bot powers declare war on the power listed in the **War field** of their Behavior Card (subject to §4.28 War Limitations and rulebook 9.6).

If the Behavior Card specifies war with a **minor power** allied with a major power → declare war on that major power instead.

**Paying for war declaration**: Reveal and discard cards from the Bot's hand deck until enough CPs to pay. If mandatory events are revealed, do not count them — set aside and shuffle back into hand deck (Home card stays at bottom). Leftover CPs added to the first card the Bot plays for CPs this turn (use +1 CP tokens). Not added to cards drawn for Diet of Worms.

**England Bot exception**: If England intends to declare war on France, Hapsburgs, or Scotland this turn, it does **not** declare during the War Segment. Instead, England plays its Home card from the bottom of the hand deck during its **first impulse** to declare war.

### 2.8 Diet of Worms

Human powers involved choose and reveal cards simultaneously. For each Bot power involved:
1. Flip the top card of their hand deck
2. If it is a Mandatory event card or a 1 CP card → ignore it, shuffle back, and commit that Bot's **Home Card** instead (Papacy commits Papal Bull)

When carrying out results, see §4.8 Flipping Religious Influence.

### 2.9 Spring Deployment

#### At War (including nearby Independent Spaces)

Deploy a formation with **as many units as possible** from capital (either capital for Hapsburgs), maintaining garrison levels (see §4.10 Garrison Requirements), to:

**Destination**: the controlled space **closest to a key controlled by an enemy**, provided:
- Destination is ≤ 4 spaces (CPs of movement) from that enemy key
- Accessible across friendly (allied) or enemy spaces and a single sea zone

**Destination priorities** (in order):
1. Target captured home keys of this Bot power
2. Target minor power and independent home keys (even if controlled by enemy major power)
3. Target keys with fewest defending units
4. If multiple equidistant destinations: fortified spaces over unfortified

**Leader**: Leader with highest command rating accompanies unless their command rating isn't required and there is already a leader with equal or better battle rating at the destination.

**Unit selection**: If drawing from a mix of regulars and mercenaries, see §4.15 Mercenaries and Regular Units.

#### At Peace

Move a **single land unit** from the capital to the controlled key with the fewest land units:
- Prioritize non-home keys
- Then keys farthest from capital
- Do not move leaders
- Do not move units that would bring capital below garrison level

#### England Bot Exception

If England intends to use its Home card to declare war on its first impulse (see §2.7), assume it is at war with that power when determining Spring Deployment.

### 2.10 Action Phase

Bots don't pass during their impulse if they have cards remaining (but see §4.25 Saving Cards). During a Bot's impulse, flip the first card in the hand deck and play as follows.

#### Card Play Routing

| Card Type | Behavior |
|-----------|----------|
| **Home Card** | If Behavior Card's Home field is "Yes" → play for its effects (see §6 Home Card Criteria). Otherwise → play for CPs (see §3 Goals). |
| **Event Card** | Check §5 Event Card Criteria. If criteria met → play event. If not → play for CPs. Also check Treaty tokens (§2.10.1) and Ganging Up (§2.10.2). |
| **Mandatory Event Card** | Play event as indicated and spend any CPs (see §3 Goals). Also check §5 Event Card Criteria. |
| **Combat/Response Card** | Check §5 Event Card Criteria. If played immediately or conditions listed → play/set aside accordingly. If not listed → set aside face-up, draw next card. Set-aside cards are played when conditions apply, subject to card text. Only played if they could **change the state of the game**. |

If a Bot must draw a card and its face-down hand deck is empty (including no Home card), take a card from set-aside Combat/Response cards (in order drawn) and play for CPs. However, save these cards until following turn if able (see §4.25 Saving Cards).

#### 2.10.1 Using Treaty Tokens

If a Bot possesses another power's Treaty token:
- The **first Event card** they would play for CPs that could instead be played as an event **benefiting the Treaty token power** must be played as such
- Then the obligation is satisfied and the Treaty token is returned
- §5 Event Card Criteria indicates when a card qualifies as benefiting another power
- If Treaty description says "as the token power" → follow instructions assuming playing power is the token power

If a player still holds a Treaty token at end of Action Phase:
- Keep for next turn
- If token belongs to a human player held by Bot → Bot gives one Goodwill Card (in impulse order if multiple tokens)
- Bot powers must also play set-aside Response/Combat cards on behalf of token powers when conditions apply (this is the most powerful aspect of Treaty tokens)

If a human holds a Bot's Treaty token:
- May choose to play any card using Treaty instructions in §5 to satisfy the obligation
- Not required to do so, but for each card played for CPs that could have satisfied the obligation → give one Bad Faith Card to that token power
- If still holding at end of Action Phase → keep for next turn and give additional Bad Faith Card

#### 2.10.2 Ganging Up

When major powers are close to winning (≥ 21 VPs, or ≥ 20 in tournament scenario) and are higher than the active Bot on the VP track:

If a Bot does not play a card for its event (for itself or on behalf of a Treaty token power) → before playing for CPs, **re-evaluate** §5 Event Card Criteria assuming the Bot is at war with all such powers.

Bot powers also play set-aside Combat/Response cards as if at war with these powers.

#### 2.10.3 Final Autumn Assaults

At end of Action Phase, after all powers have passed:
- Bot powers take one **free assault action** against each fortification where they have an active siege (must meet usual requirements)
- Bot powers with active Foreign War cards take a **free assault/foreign war action** targeting each Foreign War that has at least as many friendly units as enemy units

### 2.11 Winter Phase

#### Returning Naval Units Home

Start with the closest to the capital. If choice of destination ports:

**Port priority** (in order):
1. Port with a naval leader
2. Port with fewest fleets
3. Ports with access to two sea zones
4. Key ports
5. Port closest to capital

#### Returning Land Units Home

1. Locate fortified spaces that are **not within 2 spaces** of an enemy-controlled space AND are **over garrison requirements** → return excess units to capital. Return all leaders from such spaces to capital.
2. Move all units in **unfortified spaces** to the nearest fortified space (even if it was reduced above).
3. Return any units **over capacity** (not garrison level) in fortified spaces to capital.
4. Return the leader with the **highest command rating** to the capital.
5. Bot will **not** move units if that move is optional and would cause attrition.
6. Bot powers treat activated minor power units the same as their own (do not return to minor power home key).
7. After all units returned, each Bot removes **one unrest marker** from the home space closest to their capital. *(Rule exception)*

### 2.12 New World Phase

Bot explorer choices when rolling 10 or higher:

**If total exploration bonus ≤ +1** (in order of availability):
1. Take Amazon River discovery
2. Take 1 VP discovery: St. Lawrence River → Great Lakes → Mississippi River
3. Attempt circumnavigation

**If total exploration bonus ≥ +2** (in order of availability):
1. If Pacific Strait available → take it and attempt circumnavigation
2. Take Amazon River discovery
3. Attempt circumnavigation

---

## §3 Goals (Spending CPs)

Bot powers spend CPs based on the **prioritized list of goals** on their Behavior Card. Start with the first goal; if criteria apply and enough CPs → execute. If cannot perform or not enough CPs → check next goal. Skip invalid goals (e.g., Papacy can't place Jesuit University before Society of Jesus, Protestant can't do military before Schmalkaldic League).

After completing a goal with CPs remaining → **return to top** of priority list and find the first goal completable with remaining CPs.

If CPs remain but no goals can be performed → give Bot a single **+1 CP token** (adds 1 CP to next card played for CPs this turn; lost at end of turn).

Each goal on the card has **checkboxes** indicating maximum times per turn (number or ∞ = as many as possible).

### 3.1 Garrison

If any home spaces are below garrison level (see §4.10):
- Build regular land unit (Raise Regular Troop action)
- If not enough CPs for regular → buy mercenary or raise cavalry instead
- See §4.17 Placing Land Units

If all home spaces meet garrison but minor ally home key spaces are below → build minor ally regular unit if possible.

### 3.2 Troops

Build regular land unit (Raise Regular Troop action). See §4.17 Placing Land Units. If unable due to shortage of unit markers → build minor ally regular unit instead.

### 3.3 Mercenaries

Build mercenary land unit (Buy Mercenary action). See §4.17 Placing Land Units.

### 3.4 Cavalry

Build cavalry unit (Raise Cavalry action). See §4.17 Placing Land Units.

### 3.5 Advance

Move a formation of **at least two** land units (not violating garrison requirements) to a space with LOC that is **closer to an enemy unit** than the starting location. May be a multi-space move.

**Leader**: Leader with highest command rating accompanies or joins along the way.

**If multiple moves possible**, choose:
1. Largest resulting formation
2. Formation with leader with highest command rating
3. Destination closest to enemy units

Formation can "pick up" units and leaders along the way.

### 3.6 Set Sail

Take a Naval Move action. Starting with squadrons **closest to the capital**, move each squadron to the adjacent sea zone that contains **no enemy naval units** and is highest priority:

**Sea zone priority** (in order):
1. Sea zone with one of this Bot's ports under siege, or an enemy port under siege by this Bot
2. Sea zone with enemy ships in an independent or minor power home port (even if under major power control)
3. Sea zone with enemy ships in port
4. Sea zone with at least one of this Bot's ports and one enemy-controlled port

**Movement rules**:
- A squadron **always leaves port** if no enemy squadrons in adjacent sea zone (choose highest priority if multiple)
- A squadron in a sea zone moves to adjacent sea zone if it is **higher priority**
- Moves to **same priority** sea zone only if that zone has ≥ 2 fewer of the Bot's squadrons
- Will **not** move to lower priority sea zone
- Naval leaders move with a squadron whenever possible (except pirate leaders, who always move with corsairs)

**Ottoman corsairs** (move after all Ottoman squadrons):
- Start with corsairs closest to capital. All corsairs in same sea zone/port move as a group.
- Move to adjacent sea zone with **no enemy naval squadrons** and a port controlled by at least one other major power.
- If multiple options, choose: sea zone without piracy marker → zone with Gonzaga VP marker → most enemy ports → fewest enemy ships in adjacent ports/zones.
- If current zone is equal or higher priority → do not move.
- If no adjacent zones match criteria → move to any zone without piracy marker or enemy naval squadron.

**Skip entire goal** if no squadrons or corsairs would move.

### 3.7 Naval Battle

Take a single Naval Move action to move **as many naval squadrons (not corsairs)** as possible into a sea zone or port containing **enemy naval units**.

**Condition**: resulting Bot strength ≥ enemy strength in sea zone battle, or > enemy strength in port battle.

**If multiple valid targets**, prioritize:
1. Port that this Bot has under siege
2. Sea zone where this Bot's own port is under siege
3. Battle where Bot has greatest advantage in strength

If Bot can move remaining ships to fight a **second battle** meeting criteria → do so.

**Casualty priority**: remove loaned squadrons first → minor power squadrons → own ships.

Ships not in any battle still follow Set Sail priorities during the Naval Move.

**Skip if no battle possible.**

### 3.8 Land Battle

Do one of the following (**relieving siege has priority** over fighting):

#### Relieve a Siege
Move a formation of ≥ 2 land units to relieve this Bot's key or electorate under siege, provided:
- Garrison levels at origin maintained
- Relieving power will have ≥ total units as besieger (including units already in space)
- If a leader with battle rating higher than any friendly leader at destination is available → move with formation
- All units take part in resulting land battle; survivors retreat into fortification if possible
- If multiple relief moves possible → choose largest relieving formation
- See §4.11 Growing Formations

#### Fight a Land Battle
Move a formation (not violating garrison) to an **unfortified space** with **fewer enemy land units** than the moving formation.
- Destination must have LOC
- **Limit moving formation to twice the strength** of defending units
- If multiple moves possible: largest moving formation → strongest enemy
- Leader accompanies if command rating is required
- If Bot wins and has CPs remaining → immediately take Control Unfortified Space action
- See §4.11 Growing Formations

### 3.9 Siege (or Foreign War)

Check in this order:

#### Foreign War
If Bot has an active Foreign War card with ≥ friendly units as enemy units → take Assault/Foreign War action. If multiple eligible → choose fewest enemy units remaining.

#### Assault
If Bot has a siege in progress → perform assault action. If multiple sieges → choose largest assaulting formation.

#### Initiate/Reinforce Siege
Move a formation (not violating garrison) to siege an enemy controlled fortification (may be existing siege). Along the path:
- May add units and leaders to formation (subject to command rating and garrison)
- May Take Control of Unfortified Space to take political control and/or remove unrest — **only if required to provide LOC to the siege location**

**If multiple moves possible**, choose:
1. Keys before other fortresses
2. Largest resulting formation
3. Formation with leader with highest command rating

**Requirement**: assault must also be possible at destination (valid LOC and no naval fleet support).

While units engaged in a siege, Bot will **not move them** to execute any other goal unless assault has become impossible.

### 3.10 Control

Do one of the following (**remove unrest has priority**):

#### Remove Unrest
Take Control Unfortified Space action to remove an unrest marker from a controlled space. If multiple options:
1. Prioritize home spaces
2. Then space closest to capital

If no eligible space → move a single land unit (without reducing garrison) one space (may be a pass) or across a single sea zone to create an eligible situation, then take the action. Same priorities. Choose to move units from unfortified spaces if possible.

**Protestant** removes unrest from spaces under protestant religious influence even without political control.

#### Political Control
Take Control Unfortified Space action to take political control of an eligible space. Same priorities as above (home spaces → closest to capital). If no eligible space → move single unit similarly.

If naval units must leave a port that changes control → see §4.23 Retreat.

### 3.11 Shipbuilding

Use Build Naval Squadron action. See §4.18 Placing Naval Units.

**Ottoman Bot**: builds Corsair if it has only 1 CP remaining or if current Behavior Card is *Barbary Pirates* (but only after the Barbary Corsairs mandatory event).

### 3.12 Piracy

Ottoman Bot initiates Piracy in a sea zone with corsairs, against a non-ally that controls ≥ 2 adjacent ports. Target the sea zone and power that results in the **fewest dice rolled against corsairs**. Will not initiate if target power rolls more dice than number of corsairs.

See §4.16 Piracy Rewards.

### 3.13 Explore

Bot takes Explore action if it has any explorers remaining and there are unclaimed exploration VPs.

### 3.14 Colonize

Bot takes Colonize action if it has any colonies left to place.

### 3.15 Conquer

Bot takes Conquer action if it has any conquistadores/conquest markers remaining and there are unclaimed conquests.

### 3.16 Translate

Protestant Bot takes Translate Scripture action.

**Language selection**:
- If this action can complete a full bible translation (with or without debater bonuses) → choose that language
- Otherwise, if any of Melanchthon, Tyndale, Coverdale, or Olivétan are uncommitted → commit one (in that priority order) and apply progress to their associated language
- Otherwise, translate in this priority: New Testament in German → French → English, then Full Bible in German → French → English

**Will not translate** in a language zone if:
- Full Bible translation in that language is complete
- Translation would complete French New Testament before Calvin is placed on map
- Translation would complete English New Testament before Cranmer is placed on map

### 3.17 Publish

Protestant or English Bot takes Publish a Treatise action. See §4.20 Reformation/Counterreformation Attempts.

- **Protestant** targets the German language zone unless ≤ 6 Catholic spaces remain in German zone → target French zone instead and commit Calvin if needed
- **English Bot** only targets English language zone, only after reformation has started in England

### 3.18 Debate

Bot takes Call a Theological Debate action.

**Papacy Bot**: chooses language zone with the most protestant spaces.

**Protestant Bot**: chooses language zone with the uncommitted Protestant debater with the highest rating. Tie → German → French → English.

**Defending debater selection**: Bot calling debate chooses the pool (committed or uncommitted) that includes the debater with the **lowest debate rating** (committed debaters break ties).

If a selected Protestant debater has debate value of 1 → check whether Protestant Bot plays Home card to substitute Luther (see §6).

If a German debate goes to a **second round** → Protestant Bot inserts Bullinger if he is uncommitted and all other uncommitted German debaters have debate value ≤ 2.

See §4.8 Flipping Religious Influence.

### 3.19 St. Peter's

Papacy Bot takes Build St. Peter's action if St. Peter's is incomplete.

### 3.20 Burn

Papacy Bot takes Burn Books action.
- Commit debaters in order: Cajetan → Tetzel → Caraffa
- Choose language zone with the counterreformation space where Papacy rolls the most dice
- See §4.20 Reformation/Counterreformation Attempts

### 3.21 Jesuits

Papacy Bot takes Found Jesuit University action, committing Loyola if possible. See §4.19 Placing Jesuit Universities.

---

## §4 Reference (Alphabetical)

### 4.1 Avoiding Battle

**Land**: Bot units attacked while not in a fortified space attempt to avoid battle if they have **≤ half the strength** of the attacker AND can move as a single formation. Otherwise, stand ground. If avoid battle succeeds → see §4.23 Retreat.

**Naval**: Bot units attacked in a sea zone attempt to avoid battle if they have **≤ half the strength** of the attacking fleet.

### 4.2 Besieged Bot Units

If an enemy formation moves into a fortified space occupied by Bot units:
- If Bot has **≤ 4 land units** → withdraw into the fortification
- Otherwise → fight a field battle
- If Bot loses field battle → retreat as many surviving units as possible into the fortification, including **a single leader with battle rating ≥ 1**

### 4.3 Closest Space

Evaluate based on **movement cost of land units** (passes count as 2). Assume sea movement is available across a single sea zone (regardless of naval presence).

Tie-breaking:
1. Paths without passes or naval transport
2. Paths with passes but no naval transport

Do not trace path through spaces the power cannot enter.

### 4.4 Death of a Ruler

At the beginning of the turn after a Bot power changes rulers:
1. Collect all 8 Behavior Cards (human players forfeit Goodwill Cards)
2. Shuffle and set 2 aside as Goodwill Cards
3. Remaining 6 form new Behavior Card draw deck
4. Return one Bad Faith Card to each associated human player

When Hapsburg or Ottoman Behavior Card draw deck runs out → follow same procedure as ruler replacement, but do NOT return Bad Faith Cards.

### 4.5 Displacement

If Bot has a choice of destination spaces:
1. Prioritize keys and electorates
2. Then whichever fortification is closest to capital

### 4.6 Drawing Random Cards from a Bot

When a player (Bot or human) must draw a random card from a Bot → take the card that Bot would have drawn on their next impulse (top of face-down hand deck, or first of saved Response/Combat cards if no non-Home cards left).

**Home cards cannot be drawn this way**, but mandatory cards can unless stated elsewhere.

### 4.7 Drawing Cards from the Deck

When a Bot receives a free card draw (e.g., New World Riches, French Chateau) → take top card of draw pile, place on top of hand deck (drawn next impulse).

If instructed to both draw and discard → **only draw the difference** (draw 2 discard 1 → draw 1; draw 1 discard 1 → draw 0).

**Sack of Rome special case**: victorious Bot draws one card from Papal hand (put on top of hand deck), then draws another and discards it.

### 4.8 Flipping Religious Influence

When Bot has a choice of which marker to flip (e.g., after debate):
1. Choose space closest to own capital
2. Favor own home spaces over non-home spaces
3. Then key or electorate spaces over others

### 4.9 Foreign War

When a Foreign War card is played against a Bot → see §4.21 Removing Land Units. If Brandon or Ibrahim are on the map and not in a siege → they join foreign war forces.

All land units constructed by Bot go to Foreign War cards until Bot forces equal independent forces on each card. This includes units built as part of Garrison goal.

### 4.10 Garrison Requirements

| Space Type | Base Garrison |
|------------|--------------|
| Capital | 2 land units |
| Controlled keys and electorates | 1 land unit |
| Non-key fortifications | 0 units |

**Increase each by 1** for fortified spaces within 2 spaces of an enemy land unit (including independents and units in ports across a sea zone).

### 4.11 Growing Formations

When moving land units for Advance, Land Battle, and Siege goals:
- Leaders and units above garrison requirements may be "picked up" along the way within formation size limitations
- If the same or greater formation size can be created by **buying mercenaries** instead of moving existing units → do that instead

### 4.12 Hapsburg Capitals

When rules refer to Bot capital and power is Hapsburgs → refers to **both capitals**.

Example: Spring Deployment checks both capitals for most land units above garrison level. If equal (e.g., turn 1 of 1517 with Vienna and Valladolid both having 2 spare units) → choose randomly. If a formation from one capital has no valid deployment space or the capital is already the best space → deploy from the other.

### 4.13 Independent Spaces

Independent-controlled spaces and units are treated as **enemy** by all Bot powers. Bots are considered at war for decision-making (e.g., Spring Deployment) if there is an independent-controlled fortified space within 2 spaces of one of the Bot's controlled fortified spaces.

### 4.14 Interception

Bots only intercept from **unfortified spaces** into **controlled fortified spaces** being placed under siege by an enemy. Do not intercept in any other situation.

If a moving Bot formation is intercepted → fight battle and, if victorious, continue completing goal (will not attempt to avoid battle).

**Optional rule**: allow Bots to also intercept single unit moves, checking all potential intercepting formations above garrison levels.

### 4.15 Mercenaries and Regular Units

When choosing part of a mixed stack of mercenary (or cavalry) and regular units to move → the chosen formation must include **at least an equivalent ratio of mercenaries**. Example: 3 units from stack of 2 mercenaries + 3 regulars → must be 2 mercenaries + 1 regular (not 1 + 2). If counter mix doesn't allow → get as close as possible. Ignore this if a goal or rule dictates.

When Bot must lose land units and has a choice → lose **mercenaries and cavalry before regular** land units.

### 4.16 Piracy Rewards

When a Bot power must give up rewards due to Ottoman piracy, do so in this order during each instance (looping if more rewards due):
1. Eliminate a naval squadron (see §4.22 Removing Naval Units)
2. Give up a Card Draw
3. Award 1 VP for piracy

### 4.17 Placing Land Units

When Bot places a new land unit, prioritize:
1. Capital if garrison requirements not met (see §4.10)
2. Fortified space closest to an enemy unit or enemy controlled home space that does not meet garrison
3. If all garrisons complete → space containing the leader closest to enemy land units (including independents)
4. Otherwise → capital

Subject to all rule limitations (home spaces, etc.).

### 4.18 Placing Naval Units

**Squadrons**: Place in port closest to enemy naval units → closest to enemy land units → closest to capital. Do not place in ports with 2+ squadrons unless all ports have 2+. Subject to all rule limitations (home ports, etc.).

**Ottoman corsairs**, prioritize:
1. Port containing Barbarossa or Dragut
2. Port with most corsairs
3. Algiers → Pirate Haven → Athens

### 4.19 Placing Jesuit Universities

Place in space under Catholic influence that is **adjacent to the most Protestant influence spaces** (not counting passes), but **not within 2 spaces** of an existing Jesuit university.

### 4.20 Reformation/Counterreformation Attempts

#### Reformation (Protestant or English Bot)

**Target selection**:
- If ≥ 1 space in chosen language zone with ≥ 2 attack dice (including debater bonuses) → choose within that zone
- Otherwise → choose from any language zone
- Within these limits: choose space with **greatest attack dice**
- Tie: electorates and keys over others → fewest Catholic challenge dice

**Protestant debater commitment** (commit if bonus applies and results in most attack dice):
- German: Oecolampadius → Bucer → Zwingli
- French: Cop → Farel
- English: Wishart → Knox → Latimer → Cranmer

#### Counterreformation (Papacy Bot)

**Target selection**:
- If ≥ 1 space in chosen language zone with ≥ 2 attack dice (including debater bonuses) AND current Papal ruler wins ties (Paul III, Julius III) → choose within that zone
- Otherwise → choose from any language zone
- Within these limits: choose space with **greatest attack dice**
- Tie: electorates and keys over others → fewest Protestant challenge dice

**Papacy debater commitment** (same condition): Faber → Contarini → Canisius

### 4.21 Removing Land Units

When Bot must remove a land unit (loaning mercenaries, foreign war, suing for peace):
1. Remove unit that will **not violate garrison requirements** from the space **farthest from enemy** land units (or farthest from capital if not at war)
2. Remove **mercenaries and cavalry before regulars** if there is a choice
3. If must violate garrison → remove from space farthest from enemy/capital

### 4.22 Removing Naval Units

When Bot may remove a naval squadron (loaning or piracy reward):
- **At war**: remove squadron farthest from any enemy naval unit → then farthest from enemy land units
- **At peace**: remove squadron farthest from capital

### 4.23 Retreat

- **Land units**: retreat/avoid battle → move toward the **closest friendly fortification**
- **Naval units**: retreat → move to port or sea zone **closest to capital**
- **Ottoman corsairs**: retreat toward Algiers, or Istanbul if Algiers not under Ottoman control

### 4.24 Revealing Behavior Cards

Take top card from face-down behavior deck, place on top of face-up pile. This is Bot's behavior for the turn.

- If revealed card says **"Continue"** and there is a face-up card → tuck Continue under it, use same card again
- If Continue drawn and no face-up cards → place face-up, ignore, draw again until non-Continue appears
- When no cards available → shuffle the 6 face-up cards to form new draw pile

(For Hapsburgs and Ottomans, also see §4.4 Death of a Ruler)

### 4.25 Saving Cards

If Bot has played all cards from face-down hand deck and has set-aside Combat/Response cards ≤ ruler's **Admin Rating** → pass and save those cards for next turn (leave face-up).

Still play them as responses and in combat during rest of current turn, even for Treaty powers, if conditions apply.

If any power has reached **25 VPs** (23 in tournament) → Bot powers will no longer save cards.

### 4.26 Schmalkaldic League

All pre-Schmalkaldic restrictions on Protestant actions apply to Protestant Bot. All restrictions on other powers (cannot declare war on Protestants or enter electorates) also apply.

At start of turn after Schmalkaldic League is played:
1. Shuffle all 8 Protestant Behavior Cards (human players forfeit Goodwill Cards)
2. Set 2 aside as Goodwill Cards
3. Return one Bad Faith Card to each human player

### 4.27 Ties in Bot Decisions

After applying all criteria and priorities, if multiple equivalent choices remain → **choose randomly**.

### 4.28 War Limitations

Bots declare war as indicated on Behavior Cards, subject to:

| Power | Limitations |
|-------|-------------|
| **England** | Only declares war if NOT at war with France or Hapsburgs. But always declares war on Scotland. |
| **France** | Declares war if NOT at war with England, Hapsburgs, or Papacy. |
| **Hapsburgs** | Will not declare war on France and England at the same time. Never declares war on Papacy. |
| **Papacy** | Will not declare war on France and Ottomans at the same time. Never declares war on Hapsburgs. |
| **Protestants** | Never declare war. |
| **Ottomans** | Always declare war. |

**France and Papacy** will always intervene with their natural allies, regardless of these restrictions.

### 4.29 Maurice of Saxony

When Maurice enters play on turn 6, Protestant Bot places him in the **electorate closest to enemy land units**.

### 4.30 Electorates

After Schmalkaldic League is played, Hapsburg and Protestant Bots treat electorate spaces as **key spaces** for purposes of Spring Deployment, Garrison Requirements, Advance, and Siege.

### 4.31 Mercenaries Demand Pay

When this card is played against a Bot:
- Draw a random card to pay (see §4.6), but ignore Mandatory cards (reshuffle into hand deck)
- If drawn card has more than enough CPs → give Bot a +1 CP token

### 4.32 Military Unit Counter Limitations

If Bot cannot execute a goal due to insufficient unit markers of the required type (even after "making change") → skip that goal.

If a unit cannot be placed as part of a non-goal activity (event or outside action phase) → place as many as possible.

### 4.33 Minor Powers

- France and Papacy Bots will always intervene with natural allies, regardless of other wars
- When a minor power is activated, any Bot powers at war with that minor power declare war on the major power (rulebook 22.2) if declaration does not violate §4.28 War Limitations
- Bot major powers will not build naval squadrons or land units belonging to minor power allies unless they have no remaining counters of their own (but see §3.1 Garrison)

### 4.34 Phony War Markers

Bot powers **never take** Phony War -1 VP marker.

### 4.35 Placing Unrest

When placing an unrest marker:
- Choose space controlled by an **enemy major power** if possible, closest to that enemy's capital
- If placed as part of a Treaty event → treat token power's enemies as enemies
- If Bot has no major power enemies → place in home spaces of the non-allied major power that **leads on the VP track**

### 4.36 Protecting Henry VIII

While England Bot is still eligible to advance the Marital Status Marker:
- If rules indicate Henry VIII should move with a formation → use **Brandon** instead if possible (same space, sufficient command rating)
- Always return Henry and Brandon to London if possible during Winter Phase

### 4.37 Protestant Capital

For Bot decision-making:
- Protestant capital is **Augsburg**
- If Augsburg is in unrest → closest electorate to Augsburg
- After Schmalkaldic League → capital must also be under Protestant political control

---

## §5 Event Card Criteria

The table below indicates when Bot powers play event cards for their event effects rather than CPs. "Treaty" conditions describe when a card satisfies a Treaty obligation.

| Card Name | Bot Criteria | Treaty |
|-----------|-------------|--------|
| A Mighty Fortress | Always played by Protestant. | Token power is Protestant. |
| Affair of the Placards | Played by Protestant if possible. | Token power is Protestant. |
| Akinji Raiders | Played by Ottoman if possible. | Token power is Ottoman. |
| Anabaptists | Played by Papacy if at least two spaces can be converted. | As token power. |
| Andrea Doria | (Text before OR) Played by France if Genoa is not an ally; by Hapsburgs or Papacy if Genoa is not ally of either. | — |
| Augsburg Confession | Played by Protestant. If played by Bot, effects last until end of **following** turn. | Token power is Protestant. |
| Auld Alliance | Always played by France to activate Scotland, or add 3 regulars to Edinburgh, or deactivate Scotland if aligned with England. Played by England to deactivate Scotland if Scotland allied with France and England at war with France. | — |
| Book of Common Prayer | Played by Protestant. | Token power is Protestant. |
| Calvin Expelled | Played by Papacy. If played by Bot, effects last until end of **following** turn. | Token power is Papacy. |
| Calvin's Institutes | Played by Protestant. | Token power is Protestant. |
| Charles Bourbon | Play if at war with France, placing mercenaries in eligible space adjacent to Lyon farthest from Paris. Otherwise played by any power at war. | — |
| City State Rebels | Play if this power's home key, minor ally's home key, or independent key adjacent to a controlled space has been captured. Choose the captured key with fewest defending units (land or naval). | — |
| Cloth Prices Fluctuate | England and Hapsburgs play (text before OR) if not at war with each other. Otherwise played (text after OR) if at war with power controlling Antwerp. | — |
| Colonial Governor / Native Uprising | If this power has a colony → move green/governor marker to own colonies. Otherwise, if enemy has colony → move red/uprising marker to enemy's colonies. | As token power. |
| Copernicus | Always play immediately for VPs. | — |
| Council of Trent | Bot powers choose available debaters with highest ratings. Papacy selects Pole if uncommitted. | — |
| Diplomatic Marriage | Play to activate ally with key closest to a key controlled by this power. Otherwise, play to deactivate ally of enemy. | Deactivate ally of enemy of token power. |
| Diplomatic Overture | Never played by Bot powers. | Draw one card for token power and another for playing power. |
| Dissolution of the Monasteries | English and Protestant always play. Never played by Papacy. | Token power is England or Protestant. |
| Erasmus | Played by Protestant on turns 1-2. Played by Papacy on turn 3+. | Turn 1-2: token power is Protestant. Turn 3+: token power is Papacy. |
| Foreign Recruits | Play if at war. Build two regulars. See §4.17 (units can be placed in non-home spaces). | — |
| Foul Weather | Play as response against enemy taking any listed action. | As token power. |
| Fountain of Youth | Play if applicable against enemy's exploration. | As token power. |
| Frederick the Wise | Protestant plays if ≥ 1 space would be converted and The Wartburg is in discard pile. | Token power is Protestant. |
| Fuggers | Played by Bot powers if at war. | — |
| Gabelle Revolt | Play if at war with France. | Token power is at war with France. |
| Galleons | Played by England, France, or Hapsburgs to place galleon next to own colonies. | As token power. |
| Gout | Play as response against enemy formation moving to assault fortification controlled by this power. | As token power. |
| Halley's Comet | Play option (a) immediately against enemy power. | As token power. |
| Henry II | Henry placed in same space as Francis, or in Paris if Francis not on map. | — |
| Huguenot Raiders | Played by England, France, or Protestant to place own raider token if Hapsburgs have colonies or conquests. Hapsburgs will never play this card. | Place token power raider token if Hapsburgs have colonies/conquests. |
| Indulgence Vendor | Always played by Papacy if St. Peter's incomplete. | Token power is Papacy and St. Peter's incomplete. |
| Janissaries Rebel | Played if at war with Ottomans. | As token power. |
| Jesuit Education | Always played by Papacy. | Token power is Papacy. |
| John Zapolya | Play if in control of Buda. | Token power controls Buda. |
| Julia Gonzaga | Played by Ottomans if ≥ 2 corsairs. Place Gonzaga VP marker in Tyrrhenian Sea. If played by Bot, effects last until end of **following** turn. | As token power. |
| Katherine Bora | Protestant plays if possible. | Token power is Protestant. |
| Knights of St. John | Papacy always plays (text before OR) if St. Peter's incomplete. Hapsburgs play (text after OR) if after Barbary Pirates and can place Knights and fortress at Palma. Never played by Ottomans. | As token power (Papacy or Hapsburgs). |
| Lady Jane Grey | Papacy and Protestant always play and give themselves both cards. | Token power is Papacy or Protestant → play to give them card from draw deck. |
| Landsknechts | Hapsburgs always play immediately. Ottomans play if at war to eliminate enemy mercenaries closest to Ottoman units. Other powers play if at war to place mercenaries. | — |
| Machiavelli: The Prince | Never played as an event. | — |
| Marburg Colloquy | Protestant plays if possible, using debaters with highest debate rating. | Token power is Protestant. |
| Mary Defies Council | Papacy always plays. | Token power is Papacy. |
| Maurice of Saxony | Played by Hapsburgs or Protestant if Maurice would switch to their side. | As token power. |
| Mercator's Map | Hapsburgs, England, France play to explore. If Bot already has exploration underway → add Mercator bonus for free, play card for CPs. | As token power if they have no exploration underway. |
| Mercenaries Bribed | Play as Combat card if ≥ 1 mercenary would switch sides. | — |
| Mercenaries Demand Pay | Play against enemy with most mercenary units and ≥ 3. See §4.31. | As token power. |
| Mercenaries Grow Restless | Play as Combat card if ≥ 2 mercenaries would be removed. | — |
| Michael Servetus | Always play for 1 VP if possible. | — |
| Michelangelo | Papacy always plays if St. Peter's incomplete. | Token power is Papacy. |
| Papal Inquisition | Papacy plays if possible and initiates debate. | Token power is Papacy (Papacy chooses to initiate debate). |
| Peasant's War | Play to generate unrest in ≥ 3 enemy home spaces under enemy control. | As token power. |
| Philip of Hesse's Bigamy | Played if at war with Protestants. Protestant Bot chooses to remove Philip. | As token power. |
| Pilgrimage of Grace | Played by Papacy if Mary I does not rule England. Played by any power at war with England. | Token power at war with England. |
| Pirate Haven | Ottoman plays if possible, choosing Oran if available. | Token power is Ottoman. |
| Plantations | Played by England, France, Hapsburgs to add plantations to their colonies. | As token power. |
| Potosi Silver Mines | England, France, Hapsburgs play to place as their colony. | As token power. |
| Printing Press | Always played by Protestant. If played by Bot, effects last **one additional turn**. | Token power is Protestant. |
| Professional Rowers | Protestant Bot plays for CPs. Other powers save for effect after OR if any enemy naval units survive a naval battle. | Token power is in a naval battle. |
| Ransom | Play to ransom own leader if applicable. Ransom leader with highest command rating, place in capital. | As token power. |
| Revolt in Egypt | Play if at war with Ottomans. | As token power. |
| Revolt in Ireland | Play if at war with England. If played by France or Hapsburgs → add one mercenary from capital if not reducing below garrison. | Token power at war with England (no troops added). |
| Revolt of Communeros | Play if generates unrest in ≥ 2 enemy home spaces. | As token power. |
| Rough Wooing | Played by England if it has ≥ land units as France in Scotland. | Token power is England. |
| Roxelana | Played by Ottoman Bot to take a free assault action, regardless of Behavior Card goals. Bot powers at war with Ottomans spend 2 CP to send Suleiman to Istanbul if not captured. | Token power at war with Ottomans → spend 2 CP to send Suleiman to Istanbul if not captured. |
| Sale of Moluccas | Played by power that has completed circumnavigation. | Token power has completed circumnavigation. |
| Sack of Rome | Played by Protestant or any power at war with Papacy if it will take effect. | Token power is Protestant or any power at war with Papacy and card will take effect. |
| Scots Raid | France Bot spends 6 CPs based on its goals, subject to card limitations. France Bot does NOT move a leader to Scotland. Points that cannot be spent based on France's goals → build Scottish regulars or lost. | — |
| Search for Cibola | Play to cancel enemy power's Voyage of Exploration or Conquest. | As token power. |
| Sebastian Cabot | Always played by Hapsburgs, England, France. | — |
| Siege Artillery | Play if Bot is making an assault and enemy units survive. | Token power is making an assault. |
| Shipbuilding | Play if possible. Ottoman Bot chooses 1 squadron + 2 corsairs if possible. | — |
| Smallpox | Always play if possible. If Bot has conquest underway → add smallpox marker, play card for CPs. | — |
| Spanish Inquisition | Hapsburg and Papacy always play. Hapsburg Bot chooses to discard top card from Protestant hand. | Token power is Hapsburg or Papacy. |
| Spring Preparations | Never played by Bot powers. | — |
| Swiss Mercenaries | Played for CPs by Protestants before Schmalkaldic League and Ottomans. Otherwise played immediately. | Played by Ottoman if token power is France. |
| Tercios | Played when conditions apply. | — |
| The Wartburg | Protestant saves as response to cancel play of Papal Bull or Leipzig Debate as events. Other powers play for CPs. | — |
| Thomas Cromwell | Played immediately by Papacy to excommunicate Cranmer. Saved as Response by all other Bot powers not already excommunicated to cancel a Papal Bull excommunicating their leader. | Effect after first OR if token power is England and Dissolution of the Monasteries is in discard pile. |
| Thomas More | (Effect after OR only) Played by Papacy if they have uncommitted debater with rating ≥ 2, or if they can call debate in English language zone. | Token power is Papacy. |
| Threat to Power | Play to target enemy leader. If played by Bot, remove leader for **one additional turn**. | As token power. |
| Trace Italienne | Play if at war with a major power. Place fortress in controlled space closest to enemy capital. | As token power. |
| Treachery | Play against space besieged by this power. | As token power. |
| Unpaid Mercenaries | Play to remove most enemy mercenaries, only if ≥ 3. | As token power. |
| Unsanitary Camp | Play if would remove ≥ 1 enemy regular or ≥ 2 enemy mercenaries. Play against space where most enemy units would be removed. | As token power. |
| Venetian Alliance | Played by Papacy to activate Venice as ally, or by Papacy/Ottomans to deactivate Venice if allied with enemy. | By Papacy/Ottomans to deactivate Venice if allied with enemy of token power. |
| Venetian Informant | Never played by Bots. | — |
| War in Persia | Play if at war with Ottomans. | As token power. |
| Zwingli Dons Armor | Papacy and Hapsburgs play. | Token power is Papacy. |

---

## §6 Home Card Criteria

| Power | Home Card | Bot Behavior |
|-------|-----------|-------------|
| **Ottomans** | Ottoman Home Card | If the Ottoman Bot is in any land or sea battle where any enemy units survive and the Ottoman would lose → play from bottom of hand pile to add extra dice. If drawn from hand deck → play to build regulars if < 12 land units in Istanbul (see §4.17). |
| **Hapsburgs** | Hapsburg Home Card | If Charles V is not in the German language zone or Hungary home spaces AND Hapsburgs are at war with Ottomans or Protestants → locate space in German zone or Hungary with most Hapsburg/minor ally land units (≥ 2 units) → use event to move Charles V there. Duke of Alva will NOT follow. |
| **England** | English Home Card | If England intends to declare war on France, Hapsburgs, or Scotland → do NOT declare during War Segment; instead play Home card in first impulse to declare war. If not used for war → play when revealed to advance Marital Status marker (not allowed until Turn 2). |
| **France** | French Home Card | Play event as indicated, but NOT if Chateau Table die roll modifier will be -3 or less. |
| **Papacy** | Papal Bull | If Turn 2+ and grounds for excommunicating a ruler exist → proceed with ruler excommunication. Otherwise (even Turn 1) → excommunicate Luther or Calvin (in that order). Do NOT return excommunicated debater until end of **following** turn. Papacy calls debate after debater excommunication if ≥ 2 uncommitted debaters with debate value ≥ 2. |
| **Papacy** | Leipzig Debate | Only play if ≥ 2 uncommitted Catholic debaters have debate value ≥ 2. If Gardiner is uncommitted → choose him, choose English language zone. Otherwise if Eck is uncommitted → choose him. Otherwise → choose uncommitted Catholic debater with highest debate value. See §3.18 Debate for further details. |
| **Protestants** | Protestant Home Card | Play from bottom of hand pile during a debate in the German language zone to substitute Luther if the chosen Protestant debater has debate value of 1. |

---

## §7 Behavior Card Data

Each power has 5 unique Behavior Cards + 3 Continue cards. Data format:
- **Home**: whether to play Home card for its event (Yes/No)
- **War**: which power to declare war on (— = none)
- **Negotiations**: offer value (OFR) / request value (REQ) / max exchanges (#) for each item. NA = not applicable.
- **Goals**: ordered priority list, each with max executions per turn (∞ = unlimited)

Continue cards: if this is the only face-up card, ignore it and draw another.

### 7.0 Color-Coded Negotiation Items (Bot-to-Bot)

These mappings were extracted from the row text colors on Behavior Cards (pages 20-25).
Only listed rows are color-coded; unlisted negotiation rows on that card are not color-coded for Bot-to-Bot auto-deals.

#### Ottoman

| Card | Color-Coded Negotiation Items |
|------|--------------------------------|
| SPOILS OF WAR | End War -> England; Alliance -> England; Return Leader -> Papacy; Card Draw -> England; Treaty -> Papacy |
| MASTERS OF THE SEA | End War -> Hapsburg; Alliance -> Hapsburg; Return Leader -> Hapsburg; Card Draw -> Protestant; Treaty -> Hapsburg |
| SPREAD THIN | End War -> England; Alliance -> England; Return Leader -> Hapsburg; Card Draw -> England |
| THE WISE SULTAN | End War -> France; Alliance -> France; Loan Squadron -> France; Card Draw -> Protestant; Treaty -> France |
| BARBARY PIRATES | End War -> France; Alliance -> France; Loan Squadron -> France; Return Leader -> France; Card Draw -> Protestant; Treaty -> Protestant |

#### Hapsburg

| Card | Color-Coded Negotiation Items |
|------|--------------------------------|
| HOLY ROMAN EMPIRE | End War -> Ottoman; Return Leader -> Ottoman; Card Draw -> England; Treaty -> Ottoman |
| SEA POWER | End War -> England; Alliance -> England; Return Leader -> Protestant; Card Draw -> England; Treaty -> England |
| CONSOLIDATION | Return Leader -> France; Yield Fortified -> Protestant; Treaty -> France |
| CHOSEN OF GOD | Return Leader -> Ottoman; Card Draw -> Papacy; Treaty -> Papacy |
| NEW SPAIN | End War -> France; Yield Fortified -> France; Card Draw -> Papacy; Treaty -> Papacy |

#### England

| Card | Color-Coded Negotiation Items |
|------|--------------------------------|
| EXPEDITION | End War -> Hapsburg; Alliance -> Hapsburg; Loan Squadron -> Hapsburg; Card Draw -> Protestant; Mercenaries -> Hapsburg; Treaty -> Protestant |
| RULE BRITANNIA | End War -> France; Alliance -> Ottoman; Return Leader -> France; Mercenaries -> France; Treaty -> Ottoman |
| ISLAND FORTRESS | End War -> Hapsburg; Yield Fortified -> Hapsburg; Card Draw -> Papacy; Mercenaries -> Papacy; Treaty -> Hapsburg |
| DEFENDER OF THE FAITH | Alliance -> Ottoman; Card Draw -> Protestant; Mercenaries -> Protestant; Treaty -> Ottoman |
| NEW ENGLAND | End War -> France; Alliance -> France; Return Leader -> France; Card Draw -> Papacy; Mercenaries -> France; Treaty -> France |

#### France

| Card | Color-Coded Negotiation Items |
|------|--------------------------------|
| THE KNIGHT KING | End War -> Papacy; Alliance -> Papacy; Loan Squadron -> Papacy; Return Leader -> Papacy; Card Draw -> Ottoman |
| FIELD OF CLOTH AND GOLD | End War -> England; Return Leader -> Protestant; Yield Fortified -> Protestant; Card Draw -> England; Mercenaries -> Protestant; Treaty -> Protestant |
| ITALIAN WARS | End War -> England; Alliance -> England; Loan Squadron -> England; Return Leader -> Protestant; Yield Fortified -> Protestant; Mercenaries -> Protestant; Treaty -> England |
| MACHIAVELLIAN | End War -> Hapsburg; Alliance -> Hapsburg; Loan Squadron -> Hapsburg; Return Leader -> Ottoman; Card Draw -> Ottoman; Mercenaries -> Hapsburg; Treaty -> Hapsburg |
| THE EMPIRE | End War -> Papacy; Return Leader -> Papacy; Yield Fortified -> Hapsburg; Card Draw -> Hapsburg; Treaty -> Papacy |

#### Papacy

| Card | Color-Coded Negotiation Items |
|------|--------------------------------|
| REBUILDING | End War -> France; Alliance -> Hapsburg; Loan Squadron -> Hapsburg; Mercenaries -> Hapsburg; Rescind Excomm -> France |
| EXSURGE DOMINE | End War -> Ottoman; Return Leader -> Ottoman; Grant Divorce -> England; Rescind Excomm -> England; Treaty -> Ottoman |
| WARRIOR POPE | Alliance -> Hapsburg; Loan Squadron -> Hapsburg; Grant Divorce -> England; Rescind Excomm -> England; Treaty -> Hapsburg |
| GREAT DEBATE | End War -> France; Return Leader -> Protestant; Rescind Excomm -> France; Treaty -> France |
| WORLDLY THINGS | Return Leader -> Protestant; Grant Divorce -> England; Rescind Excomm -> England |

#### Protestant

| Card | Color-Coded Negotiation Items |
|------|--------------------------------|
| PREVENTATIVE WAR | End War -> Ottoman; Alliance -> Ottoman; Return Leader -> Papacy; Treaty -> Ottoman |
| DIE BY THE SWORD * | End War -> France; Return Leader -> Hapsburg; Yield Fortified -> France; Card Draw -> France |
| ORATORY | End War -> France; Alliance -> France; Yield Fortified -> France; Treaty -> France |
| SOLA SCRIPTURA | End War -> England; Alliance -> England; Yield Fortified -> Hapsburg; Mercenaries -> England; Treaty -> England |
| DISPUTATIONS | End War -> Ottoman; Alliance -> Ottoman; Return Leader -> Papacy |

### 7.1 Ottoman Behavior Cards

#### SPOILS OF WAR
- **Home**: Yes | **War**: Hapsburgs

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 1 | 1 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 3 | 2 |
| Mercenaries | — | — | — |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Set Sail | 2 |
| 3 | Naval Battle | 1 |
| 4 | Land Battle | 1 |
| 5 | Advance | 1 |
| 6 | Cavalry | 1 |
| 7 | Control | 2 |
| 8 | Piracy | 1 |
| 9 | Troops | ∞ |

#### MASTERS OF THE SEA
- **Home**: Yes | **War**: Venice

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 5 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 2 | 3 | 2 |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | — | — | — |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Piracy | 2 |
| 3 | Set Sail | 3 |
| 4 | Shipbuilding | 1 |
| 5 | Garrison | 2 |
| 6 | Siege | ∞ |
| 7 | Control | 2 |
| 8 | Land Battle | 2 |
| 9 | Shipbuilding | ∞ |

#### SPREAD THIN
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 5 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 0 | 1 | 2 |
| Return Leader | 2 | 1 | 1 |
| Yield Fortified | 5 | 7 | 1 |
| Card Draw | 2 | 3 | 2 |
| Mercenaries | — | — | — |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Garrison | 1 |
| 2 | Siege | 3 |
| 3 | Land Battle | 1 |
| 4 | Control | 2 |
| 5 | Shipbuilding | 1 |
| 6 | Piracy | 2 |
| 7 | Cavalry | 2 |
| 8 | Set Sail | 2 |
| 9 | Siege | ∞ |
| 10 | Troops | ∞ |

#### THE WISE SULTAN
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 0 | 1 | 2 |
| Return Leader | 2 | 2 | 2 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 2 | 3 | 2 |
| Mercenaries | — | — | — |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | 2 |
| 2 | Land Battle | 1 |
| 3 | Set Sail | 2 |
| 4 | Garrison | 2 |
| 5 | Control | ∞ |
| 6 | Piracy | 1 |
| 7 | Shipbuilding | 1 |
| 8 | Advance | 2 |
| 9 | Siege | ∞ |
| 10 | Troops | ∞ |

#### BARBARY PIRATES
- **Home**: No | **War**: Papacy

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 5 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 2 | 2 | 1 |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 3 | 3 | 2 |
| Mercenaries | — | — | — |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Set Sail | 1 |
| 3 | Piracy | 3 |
| 4 | Siege | ∞ |
| 5 | Land Battle | 2 |
| 6 | Set Sail | 3 |
| 7 | Troops | 1 |
| 8 | Control | 2 |
| 9 | Shipbuilding | ∞ |

---

### 7.2 Hapsburg Behavior Cards

#### HOLY ROMAN EMPIRE
- **Home**: Yes | **War**: France

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 5 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 0 | 1 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 7 | 1 |
| Card Draw | 2 | 3 | 1 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Land Battle | 2 |
| 3 | Naval Battle | 2 |
| 4 | Set Sail | 2 |
| 5 | Advance | 2 |
| 6 | Shipbuilding | 1 |
| 7 | Explore | 1 |
| 8 | Conquer | 1 |
| 9 | Control | ∞ |
| 10 | Mercenaries | ∞ |

#### SEA POWER
- **Home**: Yes | **War**: Ottomans

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 2 | 3 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 3 | 2 | 2 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 3 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Set Sail | 2 |
| 3 | Explore | 1 |
| 4 | Control | 2 |
| 5 | Land Battle | 1 |
| 6 | Troops | 1 |
| 7 | Siege | 3 |
| 8 | Shipbuilding | ∞ |
| 9 | Mercenaries | ∞ |

#### CONSOLIDATION
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 0 | 1 | 2 |
| Return Leader | 2 | 2 | 2 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Control | 2 |
| 2 | Troops | 2 |
| 3 | Naval Battle | 2 |
| 4 | Set Sail | 1 |
| 5 | Shipbuilding | 2 |
| 6 | Siege | ∞ |
| 7 | Explore | 1 |
| 8 | Colonize | 1 |
| 9 | Land Battle | 2 |
| 10 | Mercenaries | ∞ |

#### CHOSEN OF GOD
- **Home**: Yes | **War**: England

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 6 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 2 | 2 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 1 | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Siege | ∞ |
| 3 | Land Battle | 2 |
| 4 | Shipbuilding | 1 |
| 5 | Advance | 1 |
| 6 | Control | ∞ |
| 7 | Set Sail | 2 |
| 8 | Explore | 1 |
| 9 | Colonize | 1 |
| 10 | Troops | ∞ |

#### NEW SPAIN
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 6 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 2 | 2 | 2 |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 3 | 2 |
| Mercenaries | 0 | 0 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 1 | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Set Sail | 1 |
| 3 | Explore | 1 |
| 4 | Colonize | 1 |
| 5 | Troops | 2 |
| 6 | Conquer | 1 |
| 7 | Siege | ∞ |
| 8 | Land Battle | 2 |
| 9 | Shipbuilding | ∞ |
| 10 | Troops | ∞ |

---

### 7.3 England Behavior Cards

#### EXPEDITION
- **Home**: Yes | **War**: France

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 2 | 2 | 1 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 7 | 7 | 1 |
| Card Draw | 2 | 3 | 1 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | 4 | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Set Sail | 2 |
| 3 | Siege | ∞ |
| 4 | Control | 2 |
| 5 | Land Battle | ∞ |
| 6 | Advance | 1 |
| 7 | Shipbuilding | 1 |
| 8 | Explore | 1 |
| 9 | Mercenaries | ∞ |

#### RULE BRITANNIA
- **Home**: Yes | **War**: Scotland

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 2 | 3 | 2 |
| Return Leader | 1 | 1 | 2 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 3 | 2 | 1 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | 3 | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 3 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | ∞ |
| 2 | Set Sail | 2 |
| 3 | Shipbuilding | 1 |
| 4 | Siege | ∞ |
| 5 | Land Battle | 2 |
| 6 | Explore | 1 |
| 7 | Colonize | 1 |
| 8 | Control | 2 |
| 9 | Shipbuilding | ∞ |
| 10 | Mercenaries | ∞ |

#### ISLAND FORTRESS
- **Home**: Yes | **War**: Scotland

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 2 | 2 | 1 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 3 | 3 | 2 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | 4 | — | — |
| Rescind Excomm | 1 | — | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | 2 |
| 2 | Land Battle | 2 |
| 3 | Set Sail | 2 |
| 4 | Shipbuilding | 1 |
| 5 | Control | 2 |
| 6 | Naval Battle | ∞ |
| 7 | Siege | ∞ |
| 8 | Troops | 2 |
| 9 | Mercenaries | ∞ |

#### DEFENDER OF THE FAITH
- **Home**: Yes | **War**: Scotland

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 1 | 2 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 3 | 2 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | 4 | — | — |
| Rescind Excomm | 3 | — | — |
| Treaty | 2 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Land Battle | 2 |
| 2 | Naval Battle | 3 |
| 3 | Set Sail | 2 |
| 4 | Shipbuilding | 1 |
| 5 | Publish | 2 |
| 6 | Siege | ∞ |
| 7 | Advance | 1 |
| 8 | Control | ∞ |
| 9 | Troops | ∞ |

#### NEW ENGLAND
- **Home**: Yes | **War**: Hapsburgs

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 5 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 2 | 2 | 1 |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | 3 | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 3 |
| 2 | Set Sail | 2 |
| 3 | Explore | 1 |
| 4 | Siege | ∞ |
| 5 | Control | 2 |
| 6 | Land Battle | 2 |
| 7 | Colonize | 1 |
| 8 | Mercenaries | 2 |
| 9 | Shipbuilding | ∞ |
| 10 | Troops | ∞ |

---

### 7.4 France Behavior Cards

#### THE KNIGHT KING
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 0 | 1 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 7 | 7 | 1 |
| Card Draw | 2 | 2 | 1 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 3 | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Land Battle | 2 |
| 3 | Naval Battle | 1 |
| 4 | Set Sail | 1 |
| 5 | Control | 2 |
| 6 | Advance | 1 |
| 7 | Conquer | 1 |
| 8 | Shipbuilding | 1 |
| 9 | Troops | ∞ |

#### FIELD OF CLOTH AND GOLD
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 1 | 1 | 2 |
| Return Leader | 1 | 1 | 2 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Set Sail | 1 |
| 2 | Garrison | ∞ |
| 3 | Land Battle | 1 |
| 4 | Control | 2 |
| 5 | Siege | ∞ |
| 6 | Explore | 1 |
| 7 | Advance | 1 |
| 8 | Shipbuilding | 1 |
| 9 | Troops | ∞ |

#### ITALIAN WARS
- **Home**: Yes | **War**: Genoa

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 1 | 1 | 1 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 5 | 7 | 1 |
| Card Draw | 3 | 3 | 2 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Set Sail | 2 |
| 2 | Siege | ∞ |
| 3 | Land Battle | ∞ |
| 4 | Troops | 1 |
| 5 | Control | ∞ |
| 6 | Explore | 1 |
| 7 | Shipbuilding | 2 |
| 8 | Advance | 1 |
| 9 | Mercenaries | ∞ |

#### MACHIAVELLIAN
- **Home**: Yes | **War**: Papacy

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 1 | 2 | 2 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 3 | 2 | 1 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 1 | — | — |
| Treaty | 3 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Control | 2 |
| 3 | Land Battle | ∞ |
| 4 | Naval Battle | 1 |
| 5 | Explore | 1 |
| 6 | Advance | 1 |
| 7 | Set Sail | 2 |
| 8 | Conquer | 1 |
| 9 | Shipbuilding | 1 |
| 10 | Mercenaries | ∞ |

#### THE EMPIRE
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 2 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 2 | 2 | 1 |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | 2 | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Naval Battle | 2 |
| 2 | Set Sail | 2 |
| 3 | Colonize | 1 |
| 4 | Siege | ∞ |
| 5 | Land Battle | 2 |
| 6 | Troops | 1 |
| 7 | Control | ∞ |
| 8 | Explore | 1 |
| 9 | Shipbuilding | ∞ |

---

### 7.5 Papacy Behavior Cards

#### REBUILDING
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 1 | 1 | 1 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 1 | 1 | 1 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | — | 3 | — |
| Rescind Excomm | — | 2 | — |
| Treaty | 1 | 1 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Set Sail | 1 |
| 2 | Mercenaries | 2 |
| 3 | Shipbuilding | 1 |
| 4 | Siege | 3 |
| 5 | Burn | 1 |
| 6 | Control | 2 |
| 7 | Land Battle | ∞ |
| 8 | Troops | 2 |
| 9 | St. Peter's | ∞ |

#### EXSURGE DOMINE
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 1 | 1 | 1 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 3 | 3 | 1 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | — | 5 | — |
| Rescind Excomm | — | 3 | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Set Sail | 1 |
| 2 | Jesuits | 1 |
| 3 | Garrison | 2 |
| 4 | Control | 2 |
| 5 | Land Battle | ∞ |
| 6 | Siege | ∞ |
| 7 | Jesuits | 1 |
| 8 | Burn | ∞ |
| 9 | St. Peter's | ∞ |

#### WARRIOR POPE
- **Home**: No | **War**: France

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 2 | — |
| Loan Squadron | 0 | 1 | 1 |
| Return Leader | 1 | 2 | 1 |
| Yield Fortified | 5 | 6 | 1 |
| Card Draw | 2 | 2 | 2 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | — | 3 | — |
| Rescind Excomm | — | 2 | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Land Battle | ∞ |
| 3 | Set Sail | 2 |
| 4 | Shipbuilding | 2 |
| 5 | Control | 2 |
| 6 | Troops | 1 |
| 7 | Burn | 2 |
| 8 | Advance | 1 |
| 9 | Naval Battle | 1 |
| 10 | Mercenaries | ∞ |

#### GREAT DEBATE
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 4 | — |
| Alliance | — | 1 | — |
| Loan Squadron | 1 | 2 | 1 |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 2 | 2 | 1 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | — | 5 | — |
| Rescind Excomm | — | 3 | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Set Sail | 1 |
| 2 | Debate | 1 |
| 3 | Mercenaries | 2 |
| 4 | Shipbuilding | 1 |
| 5 | Control | 1 |
| 6 | Burn | 2 |
| 7 | Siege | 3 |
| 8 | Land Battle | ∞ |
| 9 | Naval Battle | 2 |
| 10 | St. Peter's | ∞ |

#### WORLDLY THINGS
- **Home**: No | **War**: Genoa

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 3 | — |
| Alliance | — | 0 | — |
| Loan Squadron | 1 | 2 | 1 |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 3 | 3 | 2 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | 2 | — |
| Rescind Excomm | — | 2 | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | 3 |
| 2 | Land Battle | ∞ |
| 3 | Naval Battle | 1 |
| 4 | Set Sail | 1 |
| 5 | Control | 2 |
| 6 | Advance | 1 |
| 7 | Shipbuilding | 2 |
| 8 | Troops | ∞ |
| 9 | St. Peter's | ∞ |

---

### 7.6 Protestant Behavior Cards

**Special**: *Preventative War* and *Die by the Sword* are specifically removed as Goodwill Cards at setup. They are added back into the deck after Schmalkaldic League.

#### PREVENTATIVE WAR
- **Home**: No | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 1 | — |
| Alliance | — | 0 | — |
| Loan Squadron | — | — | — |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 2 | 2 | 1 |
| Mercenaries | 1 | 2 | 3 |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Land Battle | 2 |
| 3 | Control | ∞ |
| 4 | Mercenaries | 2 |
| 5 | Advance | 1 |
| 6 | Translate | 2 |
| 7 | Troops | 2 |
| 8 | Publish | ∞ |
| 9 | Mercenaries | ∞ |

#### DIE BY THE SWORD
- **Home**: No | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 1 | — |
| Alliance | — | 1 | — |
| Loan Squadron | — | — | — |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 6 | 6 | 1 |
| Card Draw | 3 | 3 | 1 |
| Mercenaries | 1 | 2 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Siege | ∞ |
| 2 | Land Battle | ∞ |
| 3 | Advance | 1 |
| 4 | Troops | 1 |
| 5 | Publish | 1 |
| 6 | Translate | 2 |
| 7 | Control | ∞ |
| 8 | Mercenaries | ∞ |

#### ORATORY
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 0 | — |
| Alliance | — | 1 | — |
| Loan Squadron | — | — | — |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 3 | 3 | 2 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 3 | 3 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Debate | 1 |
| 2 | Garrison | 2 |
| 3 | Translate | 2 |
| 4 | Land Battle | 2 |
| 5 | Control | 2 |
| 6 | Troops | 1 |
| 7 | Publish | ∞ |
| 8 | Translate | 2 |
| 9 | Mercenaries | ∞ |

#### SOLA SCRIPTURA
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 0 | — |
| Alliance | — | 1 | — |
| Loan Squadron | — | — | — |
| Return Leader | 2 | 2 | 1 |
| Yield Fortified | 5 | 5 | 1 |
| Card Draw | 2 | 2 | 1 |
| Mercenaries | 0 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Garrison | 2 |
| 2 | Translate | 3 |
| 3 | Troops | 1 |
| 4 | Control | 2 |
| 5 | Siege | ∞ |
| 6 | Land Battle | 1 |
| 7 | Publish | 2 |
| 8 | Translate | ∞ |
| 9 | Mercenaries | ∞ |

#### DISPUTATIONS
- **Home**: Yes | **War**: —

| Negotiation Item | OFR | REQ | # |
|------------------|-----|-----|---|
| End War | — | 1 | — |
| Alliance | — | 0 | — |
| Loan Squadron | — | — | — |
| Return Leader | 1 | 1 | 1 |
| Yield Fortified | 4 | 5 | 1 |
| Card Draw | 2 | 2 | 1 |
| Mercenaries | 1 | 1 | 2 |
| Grant Divorce | — | — | — |
| Rescind Excomm | — | — | — |
| Treaty | 2 | 2 | — |

| Priority | Goal | Max |
|----------|------|-----|
| 1 | Garrison | 2 |
| 2 | Publish | 2 |
| 3 | Translate | 3 |
| 4 | Control | 2 |
| 5 | Land Battle | 1 |
| 6 | Siege | ∞ |
| 7 | Publish | ∞ |
| 8 | Mercenaries | ∞ |

---

## §8 Bot Rule Exceptions

These are rules that Bots break compared to human players:

| Exception | Reason |
|-----------|--------|
| Each Bot gets **one extra regular unit** at start (see §1.3) | Shore up vulnerable spaces |
| Bots can carry **+1 CP** from one card to the next via tokens (lost at end of turn) | Cannot always spend all CPs efficiently in one impulse |
| **Free assaults** at end of Action Phase on all active sieges and foreign wars (see §2.10.3) | Bots don't track whether they have enough cards to complete a siege and may not prioritize foreign wars highly enough |
| Certain event effects **last until end of following turn** instead of current turn (Augsburg Confession, Calvin Expelled, Julia Gonzaga, Printing Press) | Bots might play them very late in a turn |
| Remove **one unrest marker for free** each turn during Winter (see §2.11) | Too easy to mess Bots up with unrest |
| When gaining control of a fortress through **negotiations or suing for peace**, Bot moves a land unit to that fortification | Compensates for lack of strategic planning |
| Excommunicated debaters not returned until **end of following turn** (see §6, Papal Bull) | Extended effect for Bot timing |
| **Threat to Power**: leader removed for **one additional turn** when played by Bot | Extended effect for Bot timing |
| Bot powers **never take Phony War -1 VP marker** (see §4.34) | Simplification |

---

## §8.5 实现偏离记录 (Implementation Deviations)

> 以下条目是本项目在实现 HISBOT 时，对原始规范做出的受控偏离。每条记录形式、动机、触发条件和范围，便于后续回归或移除。

### 8.5.1 Papacy 防御目标压力覆写

**位置**：[`frontend/src/games/his/ai/bot-goals.js` — `dispatchGoalAction`](../../../frontend/src/games/his/ai/bot-goals.js)

**偏离内容**：当 `state.protestantSpaces >= 25` 时，教廷 Bot 本次 `dispatchGoalAction` 调用内将行为卡 `goals` 列表中 `BURN` 与 `DEBATE` 两类目标临时提升至最前，其他目标按原顺序依次在其后。仅影响遍历顺序，不修改 `max` 次数、不增加目标、不修改底层行为卡数据。

**原 HISBOT 行为**：§3 规定目标严格按行为卡列出的顺序依次尝试。部分教廷卡（如 Rebuilding）的 `BURN` 位于 `SET_SAIL / MERCENARIES / SHIPBUILDING` 之后，在低 CP 卡上会被这些早位目标吃光 CP。

**动机**：全 Bot 回归测试（T1-T9）中，教廷 40 次出牌仅出现 1 次 `BURN_BOOKS`、0 次 `CALL_DEBATE`、0 次 `EXCOMMUNICATE`，而新教地点增至 50 导致 T9 宗教胜利。原规范假定"每张卡上 BURN 偶尔能轮到"，但实际按卡顺序 BURN 系统性被挤掉。

**触发范围**：

- 仅限 `power === 'papacy'`
- 仅当 `protestantSpaces >= 25`（距离宗教胜利 50 地点约一半，已处于危险区间）
- 仅当当前行为卡的 `goals` 中存在 `BURN` 或 `DEBATE`（即 `Worldly Things` 等无防御目标的卡仍按原顺序运行）

**副作用**：

- 教廷在新教改革推进到危险阈值后，会优先反改革而非造舰/征佣兵
- 不影响其他五势力
- 不影响教廷在新教地点 < 25 时的行为

**回归方式**：

- 单元测试：`src/games/his/ai/bot-goals.test.js` 的 108 个测试全部通过，包括 Papacy 相关 dispatch 测试
- 回归测试：应使用全 Bot Playwright 引擎测试（详见 `docs/games/his/test/TEST_REQUIREMENTS.md`）观察新教胜率变化

**移除方式**：若未来希望完全贴合原规范，删除 `dispatchGoalAction` 中 `// Papacy defensive override` 代码块即可，`goalsToIterate` 回退为 `card.goals`。

---

## §9 Gameplay Notes

### Spring Deployment Considerations

- Before Schmalkaldic League, Hapsburg units can Spring Deploy from Vienna to Antwerp, Brussels, or Besançon
- France may NOT Spring Deploy to Milan across passes
- Aegean Sea ports are 2 spaces from Rhodes (enemy, impacts Ottoman garrison requirements)
- Ottomans may NOT Spring Deploy to Adriatic Sea ports across passes
- England may only Spring Deploy 5 units to Calais, and only if no other power has a squadron in a North Sea port
- North Sea is a priority for English Bot Set Sail while there is a Scottish squadron in Edinburgh
