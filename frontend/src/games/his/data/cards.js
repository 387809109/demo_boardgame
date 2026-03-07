/**
 * Here I Stand — Card Definitions
 *
 * Auto-generated from his_ref/img/processed/all_cards_classified.json
 * Total: 135 cards
 */

/**
 * Card deck/timing values:
 *   home           — Home cards (always in hand)
 *   1517_only      — In starting deck, removed Turn 3+
 *   1517_and_turn3 — In deck Turns 1–3+
 *   turn3–turn7    — Added to deck at that turn
 *   special        — Special timing (conditional entry)
 *   diplomacy      — Diplomacy cards (Turn 1+)
 *   diplomacy_sl   — Diplomacy cards (after Schmalkaldic League)
 *   main           — Always in main deck
 */
export const CARDS = [
  {
    number: 1,
    cp: 5,
    title: "Janissaries",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Ottoman Home Card. Gain 5 extra dice in a field battle or 4 extra dice in a naval combat. Play after seeing both sides' rolls. - OR - Add 4 new regulars to any combination of controlled Ottoman home spaces and/or foreign war cards (but not in Algiers or a pirate haven)."
  },
  {
    number: 2,
    cp: 5,
    title: "Holy Roman Emperor",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Hapsburg Home Card. If Charles V is not captured or under siege, move Charles V to any controlled Hapsburg home space not in unrest and not occupied by enemy units; then conduct 5 CP of actions. Duke of Alva may accompany Charles if he began the impulse in the same space as Charles."
  },
  {
    number: 3,
    cp: 5,
    title: "Six Wives of Henry VIII",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "English Home Card. Declare war on France, Hapsburgs, or Scotland during the Action Phase and then conduct 5 CP. If declaration is against Scotland, France may intervene without playing a card. In this case, England and France are at war and Scotland is activated as a French ally. - OR - If Turn 2 or later and Henry is alive, not captured, and not under siege, advance Marital Status marker one space to right and resolve using procedure in 21.3 (rolling on Pregnancy Table if Henry remarries)."
  },
  {
    number: 4,
    cp: 5,
    title: "Patron of the Arts",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "French Home Card. If Francis I is ruler and not captured or under siege, make a roll on the Chateaux Table to attempt to earn VP and/or additional cards."
  },
  {
    number: 5,
    cp: 4,
    title: "Papal Bull",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Papal Home Card. Excommunicate a Protestant reformer. You may also call a Theological Debate in the same language zone as the excommunication. - OR - If grounds for excommunication exist (see 21.5), excommunicate the ruler of England, France, or Hapsburgs. Place Unrest markers on up to 2 of that power's unoccupied home spaces which are under Catholic religious influence."
  },
  {
    number: 6,
    cp: 3,
    title: "Leipzig Debate",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Papal Home Card. Call a Theological Debate. You can either specify your own debater or specify that one Protestant debater is not available during any one round of this debate."
  },
  {
    number: 7,
    cp: 5,
    title: "Here I Stand",
    deck: "home",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Protestant Home Card. If Luther is alive, Protestant may use this card to retrieve any card in the discard pile, playing or holding that card. - OR - If Luther is alive, Protestant may substitute Luther (even if committed) for any debater during any round of a debate in the German language zone and then draw a new card. Replaced debater becomes committed (if he wasn't already); Luther returns off-map after debate if he was excommunicated when debate was called."
  },
  {
    number: 8,
    cp: null,
    title: "Luther's 95 Theses",
    deck: "special",
    availableTurn: null,
    category: 'MANDATORY',
    removeAfterPlay: true,
    description: "Add Luther at Wittenberg. Convert Wittenberg to Protestant religious influence (2 regulars are moved there from the Electorate Display). Protestant player makes 5 Reformation attempts targeting the German language zone. Protestant rolls one extra die in each attempt. Bucer may be committed for his debater bonus during this event if desired."
  },
  {
    number: 9,
    cp: 2,
    title: "Barbary Pirates",
    deck: "1517_only",
    availableTurn: 1,
    category: 'MANDATORY',
    removeAfterPlay: true,
    dueByTurn: 3,
    description: "Algiers space is now in play. Add an Ottoman square control marker, 2 Ottoman regulars, 2 corsairs, and Barbarossa to that space. Ottomans may now build corsairs and initiate piracy."
  },
  {
    number: 10,
    cp: 2,
    title: "Clement VII",
    deck: "main",
    availableTurn: 1,
    category: 'MANDATORY',
    removeAfterPlay: false,
    dueByTurn: 2,
    description: "Leo X dies. Clement VII replaces Leo as the ruler of the Papacy. Place this card in the ruler space of the Papal power card. Admin Rating: Save 1 card. Card Bonus: No extra cards."
  },
  {
    number: 11,
    cp: 2,
    title: "Defender of the Faith",
    deck: "1517_only",
    availableTurn: 1,
    category: 'MANDATORY',
    removeAfterPlay: true,
    description: "Papal player makes 3 Counter Reformation attempts targeting all language zones. If played by England, English player draws 1 extra card after the Counter Reformation attempts."
  },
  {
    number: 12,
    cp: 2,
    title: "Master of Italy",
    deck: "main",
    availableTurn: 1,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "If a power controls 3 or more of the following 5 keys: Genoa, Milan, Venice, Florence and Naples, that power gains bonus VP. Gain 1 VP for 3 keys controlled; 2 VP for 4 or 5 keys controlled. Any power controlling exactly 2 of these keys draws a card."
  },
  {
    number: 13,
    cp: 2,
    title: "Schmalkaldic League",
    deck: "1517_only",
    availableTurn: 1,
    category: 'MANDATORY',
    removeAfterPlay: true,
    dueByTurn: 4,
    description: "If it is Turn 2 or later and 12 or more spaces are currently under Protestant religious influence OR this is the Winter Phase of Turn 4, the Protestant defense league is formed as specified in 21.6. Protestant spaces in unrest count towards the total of 12."
  },
  {
    number: 14,
    cp: 2,
    title: "Paul III",
    deck: "turn3",
    availableTurn: 3,
    category: 'MANDATORY',
    removeAfterPlay: false,
    dueByTurn: 4,
    description: "Clement VII dies; remove his card from game. Place this card in the ruler space of the Papal power card. Papacy now wins ties during Counter Reformation attempts. Admin Rating: Save 1 card. Card Bonus: 1 extra card."
  },
  {
    number: 15,
    cp: 2,
    title: "Society of Jesus",
    deck: "turn5",
    availableTurn: 5,
    category: 'MANDATORY',
    removeAfterPlay: true,
    dueByTurn: 6,
    description: "Papal player may choose 2 spaces under Catholic religious influence anywhere on the map and place a Jesuit University in each space. The Papal player may now found Jesuit universities."
  },
  {
    number: 16,
    cp: 2,
    title: "Calvin",
    deck: "turn6",
    availableTurn: 6,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Luther dies; remove the Luther reformer and debater. Calvin replaces Luther as the ruler of this power. Place this card in the ruler space of the Protestant power card. Admin Rating: Save 1 card. Card Bonus: No extra cards."
  },
  {
    number: 17,
    cp: 2,
    title: "Council of Trent",
    deck: "turn6",
    availableTurn: 6,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Papacy chooses up to 4 uncommitted debaters, then Protestant chooses up to 2 (from any language zone). Commit them all. These powers then roll a number of dice equal to their debaters' total debate value. Each roll of 5 or 6 scores 1 hit. The power with more hits converts a number of spaces equal to the difference in hits to their religious influence. Spaces chosen must be eligible for a Ref/Cntr Ref attempt by that religion."
  },
  {
    number: 18,
    cp: 2,
    title: "Dragut",
    deck: "turn6",
    availableTurn: 6,
    category: 'MANDATORY',
    removeAfterPlay: true,
    description: "Barbarossa dies. Place Dragut in the same port or sea zone as Barbarossa, then remove Barbarossa from the game."
  },
  {
    number: 19,
    cp: 2,
    title: "Edward VI",
    deck: "special",
    availableTurn: null,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Henry VIII dies. Edward VI replaces Henry as ruler of England; place this card in the ruler space of the English power card. The English player places Dudley in London or the same space as Henry, then removes Henry from the game. English armies are Protestant. Admin Rating: Save 1 card. Card Bonus: No extra cards."
  },
  {
    number: 20,
    cp: 2,
    title: "Henry II",
    deck: "turn6",
    availableTurn: 6,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Francis I dies. Henry II replaces Francis as ruler of France; place this card in the ruler space of the French power card. The French player places Henry in Paris or the same space as Francis, then removes Francis from the game. Admin Rating: Save 1 card. Card Bonus: No extra cards."
  },
  {
    number: 21,
    cp: 2,
    title: "Mary I",
    deck: "special",
    availableTurn: null,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Current ruler of England dies and is replaced by Mary. If Henry dies, The English player places Dudley in London or the same space as Henry, then removes Henry from the game. 50% chance each English card play will be used by the Papacy to Burn Books and call Theological Debates in England. English armies are Catholic. Admin Rating: Save 1 card. Card Bonus: No extra cards."
  },
  {
    number: 22,
    cp: 2,
    title: "Julius III",
    deck: "turn7",
    availableTurn: 7,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Paul III dies; remove his card from game. Place this card in the ruler space of the Papal power card. Papacy wins ties during Counter Reformation attempts. Admin Rating: No cards saved. Card Bonus: 1 extra card."
  },
  {
    number: 23,
    cp: 2,
    title: "Elizabeth I",
    deck: "special",
    availableTurn: null,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Mary I dies. Elizabeth replaces Mary as ruler of England; place this card in the ruler space of the English power card. No chance that English cards can be used by Papacy. English armies are Protestant. Admin Rating: Save 2 cards. Card Bonus: 1 extra card."
  },
  {
    number: 24,
    cp: 1,
    title: "Arquebusiers",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "Gain 2 extra dice in a field battle or naval combat (but not assault or piracy). Must be declared before either side rolls."
  },
  {
    number: 25,
    cp: 1,
    title: "Field Artillery",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "Gain 2 extra dice in a field battle (French or Ottoman player gains 3 dice instead of 2). Must be declared before either side rolls."
  },
  {
    number: 26,
    cp: 3,
    title: "Mercenaries Bribed",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "One-half (rounded up) of your opponent's mercenaries in the current field battle switch sides prior to combat resolution. Remove these mercenaries from the enemy stack and add the same number of mercenaries from your power's counter mix. Not playable by the Ottomans or if the enemy is the Ottomans."
  },
  {
    number: 27,
    cp: 2,
    title: "Mercenaries Grow Restless",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "Play just before an enemy formation rolls to assault one of your fortified spaces. All mercenaries in that enemy formation are removed from play. If the enemy no longer meets the requirements to besiege this space, the siege is broken and the enemy stack must retreat."
  },
  {
    number: 28,
    cp: 1,
    title: "Siege Mining",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "Gain 3 extra dice in an assault if you are the attacker. Must be declared before either side rolls."
  },
  {
    number: 29,
    cp: 2,
    title: "Surprise Attack",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "Roll your battle dice in this field battle first. Apply all losses before computing the number of dice that your opponent can roll; opponent does not receive any rolls if no units survive the initial attack. Can be played if attacking or defending."
  },
  {
    number: 30,
    cp: 2,
    title: "Tercios",
    deck: "main",
    availableTurn: 1,
    category: 'COMBAT',
    removeAfterPlay: false,
    description: "Hapsburg player can play to gain 3 extra dice in a field battle. These 3 dice hit on a roll of 4, 5, or 6. - OR - Can be played by a player involved in a field battle against at least 3 Hapsburg regulars. Hapsburg player rolls 3 dice less than normal in this combat. In both cases, must be declared before either side rolls."
  },
  {
    number: 31,
    cp: 2,
    title: "Foul Weather",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "Play during another power's impulse just after they have announced they are spending CP to move, assault, initiate piracy, conduct a naval move, or start a naval transport. 1 CP is lost. For the rest of the impulse, no land unit of that power may move more than 1 space; assault, piracy, naval moves, and naval transport are prohibited. All effects last only during this power's impulse. May not be used to stop Treachery! event."
  },
  {
    number: 32,
    cp: 2,
    title: "Gout",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "Play during another power's impulse just after they have announced they are spending CP to move or assault with a formation that includes an army leader. 1 CP is lost. That leader may not move or assault during this impulse. If Charles V is the targeted leader, it stops any transfer he has just announced with the Holy Roman Emperor card (though a CP is not lost in this case)."
  },
  {
    number: 33,
    cp: 1,
    title: "Landsknechts",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "If played by Hapsburgs, place 4 new Hapsburg mercenaries. If played by Ottomans, eliminate 2 mercenaries anywhere on map. If played by any other power, place 2 new mercenaries. Mercenaries are placed in any combination of spaces already containing friendly land units (even just before a field battle or assault), but not in a stack under siege. May also be used as an event card to add mercenaries in a player's own impulse."
  },
  {
    number: 34,
    cp: 2,
    title: "Professional Rowers",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "Modify a naval intercept or avoid battle roll by +2 or -2 after the dice are rolled - OR - Grant any player 3 extra dice in a naval combat (not in Piracy). Play after seeing both sides' rolls."
  },
  {
    number: 35,
    cp: 1,
    title: "Siege Artillery",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "Grant attacker in an assault 2 extra dice. Play after seeing both sides' rolls. These dice score hits on a roll of 3, 4, 5, or 6. Only playable in assaults with a line of communication of 4 or fewer land spaces to a fortified home space of the major power initiating the assault."
  },
  {
    number: 36,
    cp: 1,
    title: "Swiss Mercenaries",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "If played by France or Ottomans, the French player places 4 new French mercenaries. If played by any other power, place 2 new mercenaries. Mercenaries are placed in any combination of spaces already containing friendly land units (even just before a field battle or assault), but not in a stack under siege. May also be used as an event card to add mercenaries in a player's own impulse."
  },
  {
    number: 37,
    cp: 2,
    title: "The Wartburg",
    deck: "main",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: false,
    description: "Only playable by Protestant, and Luther must be alive. Protestant cancels the play of a card as an event. Must be played after event is declared but before it is resolved. Can not be used to cancel Mandatory Events, Combat cards, Response cards, or non-Papal Home cards (Papal Bull and Leipzig Debate may be canceled). Discard the event; this player's impulse is over. Protestant may not initiate debates for rest of turn. Commit Luther (if not already); he can not be added into debates with Here I Stand until next turn."
  },
  {
    number: 38,
    cp: 2,
    title: "Halley's Comet",
    deck: "1517_and_turn3",
    availableTurn: 1,
    category: 'RESPONSE',
    removeAfterPlay: true,
    description: "You may either: (a) discard a card at random from another power's hand, OR: (b) force any power to skip their next impulse (NOTE: this does not count as a 'pass' towards ending the turn). Either a or b may also be played as an event in the player's own impulse to count as the player's activity for that round."
  },
  {
    number: 39,
    cp: 4,
    title: "Augsburg Confession",
    deck: "1517_and_turn3",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "If Melanchthon is uncommitted, apply a -1 modifier to all Papal rolls during Counter Reformation attempts for the rest of the turn. Papacy also rolls one less die than normal when initiating theological debates for the rest of the turn. Commit Melanchthon and place Augsburg Confession Active marker on the Turn Track."
  },
  {
    number: 40,
    cp: 3,
    title: "Machiavelli: The Prince",
    deck: "turn3",
    availableTurn: 3,
    category: null,
    removeAfterPlay: false,
    description: "Declare war on one other major power during this impulse at no CP cost (see 9.6 for restrictions). Then take 2 CP of actions."
  },
  {
    number: 41,
    cp: 5,
    title: "Marburg Colloquy",
    deck: "1517_and_turn3",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "If either Luther or Melanchthon is uncommitted AND either Zwingli or Oekolampadius is uncommitted, Protestant player commits 1 debater from each pair. The Protestant player then makes a number of Reformation attempts equal to the total of their debate value, targeting all language zones."
  },
  {
    number: 42,
    cp: 4,
    title: "Roxelana",
    deck: "turn3",
    availableTurn: 3,
    category: null,
    removeAfterPlay: false,
    description: "May be played by any player as 4 CPs. If played by Ottoman, formation with Suleiman gets one free assault (no CP cost), even on a fortress not under siege at the start of the impulse. If played by another power, they may spend 2 of the CP to send the Suleiman leader to Istanbul."
  },
  {
    number: 43,
    cp: 3,
    title: "Zwingli Dons Armor",
    deck: "1517_and_turn3",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "Protestant player eliminates one Catholic land unit within 3 spaces of Zurich. The Zwingli reformer and debater are then removed from the game (even if there was no such Catholic army to eliminate)."
  },
  {
    number: 44,
    cp: 2,
    title: "Affair of the Placards",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "If Cop is uncommitted, Protestant player makes 4 Reformation attempts targeting the French language zone. Commit Cop."
  },
  {
    number: 45,
    cp: 1,
    title: "Calvin Expelled",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "Remove the Calvin reformer and debater from the map for the rest of the turn. Both return to play at the start of the next turn (replace the reformer in Geneva). Commit Calvin."
  },
  {
    number: 46,
    cp: 5,
    title: "Calvin's Institutes",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "If Calvin is uncommitted, Protestant player makes 5 Reformation attempts targeting the French language zone. Add a +1 die roll modifier to each Protestant roll in the target language zone (i.e. against a French-speaking space). Commit Calvin."
  },
  {
    number: 47,
    cp: 6,
    title: "Copernicus",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "If half or more of your power's home spaces are under Protestant religious influence, gain 2 VP. Otherwise gain 1 VP and either draw a card from the deck or force the Protestant to discard one card at random."
  },
  {
    number: 48,
    cp: 2,
    title: "Galleons",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: false,
    description: "Place a 'Galleons' marker next to the colonies of England, France, or the Hapsburgs. All 'Galleons' results for that power on the New World Riches Table now result in a bonus card. Improves Hapsburg defense against Huguenot Raiders."
  },
  {
    number: 49,
    cp: 2,
    title: "Huguenot Raiders",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: false,
    description: "Playable on behalf of England, France, or Protestant if they have at least one home port under Protestant religious influence and no Raider currently in play. Add a Raider marker of the appropriate power next to the Hapsburg colonies. Hapsburg New World Riches now have a chance to be intercepted by this power (see 20.4)."
  },
  {
    number: 50,
    cp: 2,
    title: "Mercator's Map",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: false,
    description: "Launch a Voyage of Exploration for England, France or the Hapsburgs at no additional CP cost. Place the \"+2 Mercator\" marker next to the \"Exploration Underway\" marker for this power and place both in the \"Crossing Atlantic\" box. Add this modifier when resolving the voyage during the New World Phase."
  },
  {
    number: 51,
    cp: 4,
    title: "Michael Servetus",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "Gain 1 VP when played. Discard one card at random from Protestant hand."
  },
  {
    number: 52,
    cp: 4,
    title: "Michelangelo",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "The Papal player rolls 2 dice. The total roll is the number of CP that are immediately added to the Papal fund for St. Peter's construction."
  },
  {
    number: 53,
    cp: 2,
    title: "Plantations",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: false,
    description: "Place a 'Plantations +1' marker next to the colonies of England, France, or the Hapsburgs. That power adds 1 to all rolls on the Potosi and Colony columns of the New World Riches Table for the rest of the game."
  },
  {
    number: 54,
    cp: 3,
    title: "Potosi Silver Mines",
    deck: "turn4",
    availableTurn: 4,
    category: null,
    removeAfterPlay: true,
    description: "Add the Potosi marker directly to an open colony box for either England, France or the Hapsburgs. That power then removes one of their colony markers from play for the rest of the game."
  },
  {
    number: 55,
    cp: 3,
    title: "Jesuit Education",
    deck: "turn5",
    availableTurn: 5,
    category: null,
    removeAfterPlay: false,
    description: "If the Society of Jesus event has been played, Papal player chooses 2 spaces under Catholic religious influence anywhere on the map and places a Jesuit university in each space."
  },
  {
    number: 56,
    cp: 5,
    title: "Papal Inquisition",
    deck: "turn5",
    availableTurn: 5,
    category: null,
    removeAfterPlay: false,
    description: "If Caraffa is uncommitted, convert 2 Protestant spaces in the Italian language zone back to Catholic religious influence. Papal player targets either England or Protestant and secretly reviews the cards in that power's hand. Papacy can choose to either draw a card at random from this hand, retrieve any card from the discard pile, or initiate a debate in any zone with two extra dice. Card drawn must be held for a later impulse. Commit Caraffa."
  },
  {
    number: 57,
    cp: 2,
    title: "Philip of Hesse's Bigamy",
    deck: "turn5",
    availableTurn: 5,
    category: null,
    removeAfterPlay: true,
    description: "Protestant player must either remove Philip of Hesse from the game or discard one card (chosen at random)."
  },
  {
    number: 58,
    cp: 5,
    title: "Spanish Inquisition",
    deck: "turn5",
    availableTurn: 5,
    category: null,
    removeAfterPlay: false,
    description: "Convert 2 Protestant spaces in the Spanish language zone back to the Catholic side. Hapsburg player secretly reviews the cards in the English and Protestant hands and selects a card from one of these powers to be discarded. Hapsburg player draws a card from the deck. Papal player calls a Theological Debate (in any language zone)."
  },
  {
    number: 59,
    cp: 3,
    title: "Lady Jane Grey",
    deck: "turn6",
    availableTurn: 6,
    category: null,
    removeAfterPlay: true,
    description: "If England has changed rulers this turn and has a non-home card remaining in their hand, draw one card from the English hand and one from the deck. Choose 1 card to keep and 1 card to award to either the Protestant or Papal player."
  },
  {
    number: 60,
    cp: 4,
    title: "Maurice of Saxony",
    deck: "turn6",
    availableTurn: 6,
    category: null,
    removeAfterPlay: false,
    description: "Playable by Hapsburg or Protestant. Maurice of Saxony switches sides (changing from a Protestant leader to Hapsburg or vice versa). If he is on the board, the mercenaries in his stack also switch: replace with Protestant or Hapsburg mercenaries as appropriate. Move Maurice and these mercenaries to the nearest unoccupied space under friendly control. If he is captured, he switches sides to the other power. Place in a fortified space controlled by this power."
  },
  {
    number: 61,
    cp: 1,
    title: "Mary Defies Council",
    deck: "turn7",
    availableTurn: 7,
    category: null,
    removeAfterPlay: false,
    description: "Papal player makes 3 Counter Reformation attempts targeting the English language zone."
  },
  {
    number: 62,
    cp: 2,
    title: "Book of Common Prayer",
    deck: "special",
    availableTurn: null,
    category: null,
    removeAfterPlay: false,
    description: "If Cranmer is uncommitted, Protestant player makes 4 Reformation attempts in English home spaces (including Calais). Commit Cranmer. After attempts are complete, roll 1 die. On a 1 or 2, there is no further effect. On a 3 or 4, add Unrest to 1 Catholic English home space. On a 5, add Unrest to 2 such spaces. On a 6, add Unrest to all such spaces. Spaces going into unrest may be occupied; spaces are chosen by power playing event."
  },
  {
    number: 63,
    cp: 4,
    title: "Dissolution of the Monasteries",
    deck: "special",
    availableTurn: null,
    category: null,
    removeAfterPlay: true,
    description: "English player draws 2 cards from deck. Protestant player then makes 3 Reformation attempts targeting the English language zone."
  },
  {
    number: 64,
    cp: 3,
    title: "Pilgrimage of Grace",
    deck: "special",
    availableTurn: null,
    category: null,
    removeAfterPlay: true,
    description: "Place Unrest markers on up to 5 unoccupied English home spaces."
  },
  {
    number: 65,
    cp: 4,
    title: "A Mighty Fortress",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If Luther is uncommitted, Protestant player makes 6 Reformation attempts targeting the German language zone. Commit Luther."
  },
  {
    number: 66,
    cp: 3,
    title: "Akinji Raiders",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Playable as event if Ottoman is at war with a power and Ottoman cavalry is within 2 spaces of a space controlled by that same target power. Any intervening space must be controlled by Ottoman. Ottoman draws a card at random from the target power and keeps it in his hand."
  },
  {
    number: 67,
    cp: 3,
    title: "Anabaptists",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Papal player converts two non-electorate and unoccupied spaces under Protestant religious influence back to Catholic religious influence. Spaces converted need not be eligible for Counter Reformation attempts (i.e. they need not be adjacent to a Catholic space)."
  },
  {
    number: 68,
    cp: 5,
    title: "Andrea Doria",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Playable by France, Hapsburgs, or Papacy to deactivate Genoa from their current ally and then immediately activate Genoa as an ally of the power playing this card - OR - Playable if power controlling Andrea Doria is at war with Ottomans and Doria is in sea zone adjacent to 2 Ottoman-controlled ports. Power playing card and power controlling Doria each draw 1 card from deck. Then roll 3 dice. Each hit of 5 or 6 reduces Ottoman piracy VP by 1 (but not below 0)."
  },
  {
    number: 69,
    cp: 3,
    title: "Auld Alliance",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Playable by France to activate Scotland if unaligned. Playable by England or France to deactivate Scotland if aligned. Also playable by France when Scotland is already a French ally or as payment for intervening after a declaration of war on Scotland. In these last two cases add up to 3 new French regulars in any Scottish home space under French control that is not under siege."
  },
  {
    number: 70,
    cp: 4,
    title: "Charles Bourbon",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Add Renegade Leader and 3 mercenaries (or 3 cavalry if Ottoman plays event) to any space you control that is not under siege. If at war with France, these forces can be added to any unoccupied space adjacent to Lyon; take immediate control of that space. Leader is removed from map at the end of the turn."
  },
  {
    number: 71,
    cp: 4,
    title: "City State Rebels",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Pick a captured key (an independent key controlled by a major power, or a home key controlled by a major power that is not allied to the space's home power) that is not currently under siege as the target. Rebels roll 5 dice. Each hit scored forces the power controlling the key to eliminate an army or fleet from the space. If no land or naval units remain after the revolt, do the following: leaders are captured by the power playing the card; remove the control marker and place one from home power (or that power's current major power ally); add 1 regular of the home power in the space."
  },
  {
    number: 72,
    cp: 3,
    title: "Cloth Prices Fluctuate",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If England controls Calais and Hapsburgs control Antwerp, both powers draw a card from the deck; the power playing this card adds 2 mercenaries (2 cavalry for the Ottoman) in a friendly home space not under siege. - OR - Power controlling Antwerp discards a card at random. Add unrest on up to 2 unoccupied spaces from this list: Antwerp, Brussels, Amsterdam, all German and Italian-speaking Hapsburg home spaces."
  },
  {
    number: 73,
    cp: 5,
    title: "Diplomatic Marriage",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Not playable by Ottomans or Protestant. Activate or deactivate a minor power if permitted by Section 22.1 - OR - Play when suing for peace to restore all home spaces and captured leaders taken by 1 enemy power without giving up any cards. War winner still earns 1 VP (2 if Ottoman)."
  },
  {
    number: 74,
    cp: 5,
    title: "Diplomatic Overture",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Draw 2 new cards from the deck. Then give any one card (other than your Home card or a Mandatory Event) to another power. If no such card is in your hand you may in that one case give up a Mandatory Event."
  },
  {
    number: 75,
    cp: 3,
    title: "Erasmus",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If played on Turn 1 or 2, Protestant player makes 4 Reformation attempts targeting all language zones. If played on Turn 3 or later, Papal player makes 4 Counter Reformation attempts targeting all language zones."
  },
  {
    number: 76,
    cp: 4,
    title: "Foreign Recruits",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Spend 4 CP on building new military units. These units may be built in any space you control that is not under siege. The spaces need not be home spaces like usual. This card also allows the Ottoman to construct units other than corsairs in Algiers or pirate havens."
  },
  {
    number: 77,
    cp: 2,
    title: "Fountain of Youth",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Cancel a Voyage of Exploration that is underway. Remove the Exploration Underway marker for the targeted power and place it on the Turn Track to re-enter play next turn. Then roll a die. On a roll of 4, 5, or 6, one of the targeted power's explorers (chosen at random) is removed from the game."
  },
  {
    number: 78,
    cp: 3,
    title: "Frederick the Wise",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "Convert the two German-speaking and Catholic spaces nearest to Wittenberg to Protestant religious influence. Protestant player chooses between equidistant spaces. Protestant may then pick up Wartburg and add it to his hand if that card is in the discard pile."
  },
  {
    number: 79,
    cp: 3,
    title: "Fuggers",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Draw 2 cards from deck. You draw 1 less card next turn. Place a '-1 Card' marker on the appropriate power card until next turn as a reminder."
  },
  {
    number: 80,
    cp: 1,
    title: "Gabelle Revolt",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Place Unrest markers on up to 2 unoccupied French home spaces."
  },
  {
    number: 81,
    cp: 3,
    title: "Indulgence Vendor",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Draw a card at random from the Protestant hand. Add the CP value of the drawn card to the Papal fund for St. Peter's construction. Card is then discarded."
  },
  {
    number: 82,
    cp: 2,
    title: "Janissaries Rebel",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Place Unrest markers on up to 2 unoccupied Ottoman home spaces. Increase number of spaces to 4 if Ottoman is not at war with a major power."
  },
  {
    number: 83,
    cp: 3,
    title: "John Zapolya",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "If the Buda space is not under siege, add 4 regulars of the power that controls Buda to that space. If Hungary still controls Buda, add Hungarian regulars to that space (up to the limit of the counter mix)."
  },
  {
    number: 84,
    cp: 1,
    title: "Julia Gonzaga",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "If Barbary Pirates has been played, award the Julia Gonzaga marker (1 bonus VP) to the Ottoman player if Piracy scores a hit in the Tyrrhenian Sea later in this turn."
  },
  {
    number: 85,
    cp: 3,
    title: "Katherina Bora",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "If Luther is uncommitted, Protestant player makes 5 Reformation attempts targeting all language zones. Commit Luther."
  },
  {
    number: 86,
    cp: 2,
    title: "Knights of St. John",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If Knights of St. John are on map, not under siege, and connected by 1 sea zone to an Ottoman-controlled port, draw 1 card at random from Ottoman and contribute CP value to St. Peter's construction. - OR - If Knights are off-map, Hapsburg adds them to a Hapsburg-controlled home port; the port space then switches to independent political control and a fortress is added to the space (if not already fortified)."
  },
  {
    number: 87,
    cp: 2,
    title: "Mercenaries Demand Pay",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Target power loses all mercenaries unless they discard a card immediately. (Home cards may be used; mandatory events may not). Value of card determines number of mercenaries kept (target power chooses which are kept): 1 CP = 2 units; 2 CP = 4 units; 3 CP = 6 units; 4 CP = 10 units; 5 or 6 CP = all units retained."
  },
  {
    number: 88,
    cp: 3,
    title: "Peasants' War",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "Place Unrest markers on up to 5 unoccupied German-speaking spaces."
  },
  {
    number: 89,
    cp: 3,
    title: "Pirate Haven",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If Barbary Pirates has been played, Ottoman targets either Oran or Tripoli. Target space must be unoccupied, controlled by a power at war with Ottomans, and must border a sea zone adjacent to a fortified space under Ottoman control. The following items are added to the target space: 1 Ottoman regular, 2 corsairs, and a Pirate Haven marker (if not present). The Ottoman player may now build corsairs in this space when it is under Ottoman control."
  },
  {
    number: 90,
    cp: 5,
    title: "Printing Press",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "The attacker rolls 1 extra die during Reformation attempts for the rest of the turn. Place Printing Press Active marker on the Turn Track. Protestant player immediately makes 3 Reformation attempts targeting all language zones."
  },
  {
    number: 91,
    cp: 3,
    title: "Ransom",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Immediately return any captured leader (even if from another power) to one of his home fortified spaces. Owning player chooses which fortified space."
  },
  {
    number: 92,
    cp: 3,
    title: "Revolt in Egypt",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Ottoman player must remove 3 land units from the map and place them (along with any leaders desired) on this Foreign War card. Egyptians start with 3 land units. If Ottoman strength drops below 3 land units, all new Ottoman land unit builds must be placed on card until total of 3 is restored. Award 1 War Winner VP to Ottoman when war ends. Add a -1 Card marker on Ottoman until war ends."
  },
  {
    number: 93,
    cp: 3,
    title: "Revolt in Ireland",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "English player must remove 4 land units from the map and place them (along with any leaders desired) on this Foreign War card. Irish start with 3 land units. If English strength drops below 4 land units, all new English land unit builds must be placed on card until total of 4 is restored. If played by France or Hapsburgs, they may remove 1 of their land units from the map to increase the strength of the Irish to 4 land units. Award 1 War Winner VP to England when war ends. Add a -1 Card marker on England until war ends."
  },
  {
    number: 94,
    cp: 2,
    title: "Revolt of the Communeros",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Place Unrest markers on up to 3 unoccupied Spanish-speaking spaces."
  },
  {
    number: 95,
    cp: 5,
    title: "Sack of Rome",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "If there are more non-Papal mercenaries in 1 Italian-speaking space than Papal regulars in Rome, the stack with the mercs fights a field battle against the regulars in Rome. If Papacy loses: deduct 5 CP from St. Peter's track, draw 2 cards from Papal hand. Owner of mercenaries keeps one card; discards other. See Section 21.5 for full procedure."
  },
  {
    number: 96,
    cp: 3,
    title: "Sale of Moluccas",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "Power who has completed the circumnavigation exploration draws 2 cards from deck."
  },
  {
    number: 97,
    cp: 2,
    title: "Scots Raid",
    deck: "turn3",
    availableTurn: 3,
    category: 'MANDATORY',
    removeAfterPlay: false,
    description: "Ignore event unless Scotland is allied to France. If Stirling is not under French control, switch Stirling to French control and displace any units that are not French or Scottish from this space. Then France gains up to 6 CP that must be spent (as permitted by current war status) on building units, moving, controlling spaces or assaulting in Scottish home spaces, Berwick, Carlisle, or York. Assaults on these spaces can be conducted even on a fortified space not under siege at the start of the impulse. France has the option to transfer a French leader to a Scottish home space before taking these actions but in this case gets only 3 CP to spend."
  },
  {
    number: 98,
    cp: 2,
    title: "Search for Cibola",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Cancel a Voyage of Exploration or Conquest that is underway. Remove the Exploration Underway, Conquest Underway or Conquest marker for the targeted power and place it on the Turn Track to re-enter play next turn, and to serve as a reminder that this power may not launch another voyage of this type until next turn."
  },
  {
    number: 99,
    cp: 1,
    title: "Sebastian Cabot",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "Playable by England, France, Hapsburg (but only once during the game for each power). Cabot (a 1 explorer) is launched on a Voyage of Exploration for the player's power. That power's \"Exploration Underway\" marker is not flipped after resolving the expedition, nor does the expedition suffer a -1 modifier if that marker is on the \"Uncharted\" side. Remove that power's Cabot marker from the game after resolving the exploration."
  },
  {
    number: 100,
    cp: 2,
    title: "Shipbuilding",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Not playable by Protestant. Add 2 new squadrons in any controlled home port (or 1 squadron in each of two home ports). Ottoman may choose to substitute 2 corsairs for each naval squadron (but still may not construct squadrons in Algiers or a pirate haven)."
  },
  {
    number: 101,
    cp: 4,
    title: "Smallpox",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Playable by England, France, Hapsburgs. Launch a Voyage of Conquest at no additional CP cost. Place the '+2 Smallpox' marker next to the Conquest Underway or Conquest marker for this power. Add this modifier when resolving the voyage during the New World Phase."
  },
  {
    number: 102,
    cp: 3,
    title: "Spring Preparations",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Not playable by Protestant or any power that doesn't control its own capital. Play during Spring Deployment Phase. Add 1 regular to capital (add 1 to each if Hapsburg). Formation moving during spring deployment may cross passes, move more than 5 units by sea, and cross sea zones where other powers have fleets."
  },
  {
    number: 103,
    cp: 3,
    title: "Threat to Power",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Target one minor army leader (Charles Brandon, Duke of Alva, Montmorency, or Ibrahim Pasha) who is not currently captured. Roll a die. On a 1, 2 or 3, remove from play for the rest of the current turn. On a 4, 5 or 6, remove from play for the rest of the game. Returning leaders are placed in their capital if possible. If not, place them in a friendly home key."
  },
  {
    number: 104,
    cp: 3,
    title: "Trace Italienne",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Add a fortress to any unfortified space (even if under Unrest or controlled by another power). Unless space is independent or in unrest, add 1 regular to that space from the counter mix of the power which controls the space."
  },
  {
    number: 105,
    cp: 5,
    title: "Treachery!",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Play against any fortified space that is currently under siege, even a space where a besieging power does not meet the requirements for assault (either because of a lack of a LOC or because of the presence of naval units). Immediately initiate an assault by a besieging power on the units within the fortifications. After the assault, if the besieging units still outnumber the units within, apply these results: all defending units are eliminated; defending leaders are captured; space becomes controlled by besieging power."
  },
  {
    number: 106,
    cp: 3,
    title: "Unpaid Mercenaries",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "All mercenaries in a single space are removed from play. If multiple major powers have mercenaries in a single space, only one of the major powers can be affected by this event."
  },
  {
    number: 107,
    cp: 2,
    title: "Unsanitary Camp",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "A single stack of land units is stricken by disease. One-third (rounded up) of the units are removed from play (as chosen by their owner). At least half of the losses must be from regular troops (if possible). If multiple major powers have units in a single space, only one of the major powers can be affected by this event. Allied minor power units are considered to be a part of the stack with the major power that controls them."
  },
  {
    number: 108,
    cp: 4,
    title: "Venetian Alliance",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Playable by Papacy to activate Venice if unaligned. Playable by Ottoman or Papacy to deactivate Venice if aligned. Also playable by Papacy when Venice is already a Papal ally, or in Diplomacy Phase by Papacy to intervene after a declaration of war on Venice. In these last two cases add up to 1 Venetian regular and 2 Venetian fleets (subject to counter mix) in any Papal-controlled port not under siege."
  },
  {
    number: 109,
    cp: 1,
    title: "Venetian Informant",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Play during Spring Deployment Phase, before any powers have deployed units. The cards in one power's hand are reviewed in secret by you or by a power designated by you."
  },
  {
    number: 110,
    cp: 4,
    title: "War in Persia",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Ottoman player must remove 5 land units from the map and place them (along with any leaders desired) on this Foreign War card. Persians start with 4 land units. If Ottoman strength drops below 5 land units, all new Ottoman land unit builds must be placed on card until total of 5 is restored. Award 1 War Winner VP to Ottoman when war ends. Add a -1 Card marker on Ottoman until war ends."
  },
  {
    number: 111,
    cp: 2,
    title: "Colonial Governor/Native Uprising",
    deck: "main",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "May be played by any power to move this marker to a new position on either side on the colony display. During the Card Draw phase of subsequent turns, No Effect results from any colony of the chosen player are converted to Card (if marker on Colonial Governor side) or Elim (if marker on Native Uprising side). Marker is removed from display at the end of the Card Draw phase in which a No Effect result is altered (though it can return if this card is played in a future turn)."
  },
  {
    number: 112,
    cp: 3,
    title: "Thomas More",
    deck: "1517_only",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If played by England or Protestant, More is executed. Place Thomas More marker on Turn Track to indicate there are no debates in England this turn. England draws 1 card from deck and then discards any 1 card they choose from their hand. Remove from deck. - OR - If played by any other power, Papacy gets to call a debate and roll 1 extra attack die each round (3 extra dice if debate is in England). Remove from deck if Henry has married Anne Boleyn."
  },
  {
    number: 113,
    cp: 2,
    title: "Imperial Coronation",
    deck: "1517_and_turn3",
    availableTurn: 1,
    category: 'MANDATORY',
    removeAfterPlay: true,
    description: "If Charles V is in the Italian language zone, Hapsburgs and power playing this card draw 1 card from the deck."
  },
  {
    number: 114,
    cp: 2,
    title: "La For锚t's Embassy in Istanbul",
    deck: "turn3",
    availableTurn: 3,
    category: 'MANDATORY',
    removeAfterPlay: true,
    description: "If France and the Ottoman are allied, both powers draw and keep 1 card."
  },
  {
    number: 115,
    cp: 3,
    title: "Thomas Cromwell",
    deck: "turn4",
    availableTurn: 4,
    category: 'RESPONSE',
    removeAfterPlay: true,
    description: "Playable as a response to cancel play of Papal Bull to excommunicate Cranmer. - OR - Playable as event to retrieve Dissolution of the Monasteries from discard pile and award that card to England. - OR - Playable as event to publish a treatise in England. All English treatises cost only 2 CP this turn."
  },
  {
    number: 116,
    cp: 3,
    title: "Rough Wooing",
    deck: "turn5",
    availableTurn: 5,
    category: null,
    removeAfterPlay: false,
    description: "Playable if Edward VI has been born, is still alive, and Scotland is allied with France. England and France each roll a die and add the number of land and naval units under their control in Scottish home spaces to their total. If the English number exceeds the French number by 2, deactivate Scotland from France and then immediately activate Scotland as an English ally. All Scottish home spaces come under English control and displace any units that are not English or Scottish from these spaces."
  },
  {
    number: 201,
    cp: null,
    title: "Andrea Doria",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Playable by Papacy to deactivate Genoa from their current ally and then immediately activate Genoa as a Papal ally. Playable by Protestant to deactivate Genoa and then immediately activate Genoa as a French ally. If Genoa already controlled by the power listed above, add 4 CP of Genoese units to a Genoese home space under that power's control."
  },
  {
    number: 202,
    cp: null,
    title: "French Constable Invades",
    deck: "diplomacy",
    availableTurn: 1,
    category: 'Invasion',
    removeAfterPlay: false,
    description: "France and the Papacy are now at war. Protestants place Montmorency, 2 French regulars, and 2 French mercenaries in a French-controlled space. Protestant draws 1 card from the Main Deck. Protestant then either places 1 French squadron in a French home port or adds 2 more French mercenaries to the same French-controlled space."
  },
  {
    number: 203,
    cp: null,
    title: "Corsair Raid",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Roll four dice, scoring hits on the other player on a 5 or 6. For each hit, the enemy player must discard a card or eliminate a naval squadron. Hits on the Papacy eliminate Papal squadrons or squadrons from active Papal minor allies. Hits on the Protestant are taken from French or Ottoman squadrons (or Hapsburg squadrons if the Hapsburgs are at war with the Papacy)."
  },
  {
    number: 204,
    cp: null,
    title: "Diplomatic Marriage",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Activate or deactivate a minor power if permitted by Section 22.1. In addition, Protestant may now use the card to deactivate a minor power or activate either Genoa or Venice as a Hapsburg ally."
  },
  {
    number: 205,
    cp: null,
    title: "Diplomatic Pressure",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Look at your opponent's Diplomatic cards. If the Papacy, choose which one the Protestant will play this turn. If the Protestant, you have the choice to either force your opponent to discard the card in his hand (and draw a new one) OR swap your one Diplomatic card with his remaining card."
  },
  {
    number: 206,
    cp: null,
    title: "French Invasion",
    deck: "diplomacy",
    availableTurn: 1,
    category: 'Invasion',
    removeAfterPlay: false,
    description: "France and the Papacy are now at war. Protestants place Francis (or Henry if Francis has died), 3 French regulars, and 3 French mercenaries in a French-controlled space. Protestant draws 1 card from the Main Deck. Protestant then either places 1 French squadron in a French home port or adds 2 more French mercenaries to the same French-controlled space."
  },
  {
    number: 207,
    cp: null,
    title: "Henry Petitions for Divorce",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: true,
    description: "Papal player chooses either: a) Divorce Granted: Papacy draws 1 card from Main Deck. Protestant adds 4 Hapsburg mercenaries to a Hapsburg-controlled space in the Italian language zone. The Papacy immediately initiates a Theological Debate in any language zone. Campeggio is automatically the Papal debater if still in the game. b) Divorce Refused: Papacy adds 3 Hapsburg regulars to any combination of Hapsburg-controlled spaces. Play of this card has no impact on the timing of the entry of the reformers, debaters and rulers in England."
  },
  {
    number: 208,
    cp: null,
    title: "Knights of St. John",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Draw a card from the Main Deck. The CP value of that card is contributed to construction of St. Peter's."
  },
  {
    number: 209,
    cp: null,
    title: "Plague",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Remove 3 land or naval units from the map, no more than 1 per space. Units must be removed from spaces with more than 1 unit present. Then randomly draw one card from opponent's hand and discard it (Diplomatic cards and Home cards may not be drawn)."
  },
  {
    number: 210,
    cp: null,
    title: "Shipbuilding",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "Papacy builds up to 2 naval squadrons (either Papal fleets or of a Papal minor power ally). Protestant may also build up to 2 naval squadrons with this card in Marseille (use French units), Naples (use Hapsburg units), and/or in any Ottoman home port (use Ottoman units)."
  },
  {
    number: 211,
    cp: null,
    title: "Spanish Invasion",
    deck: "diplomacy",
    availableTurn: 1,
    category: 'Invasion',
    removeAfterPlay: false,
    description: "If prior to Schmalkaldic League, Hapsburgs and Papacy are now at war and the Protestant controls this invasion force. Otherwise the Papacy controls the invaders. The controlling power places Duke of Alva, 2 Hapsburg regulars, and 2 Hapsburg mercenaries in a Hapsburg-controlled space. The controlling power draws 1 card from the Main Deck. Place either 1 Hapsburg squadron in a Hapsburg home port or add 2 more Hapsburg mercenaries to the same Hapsburg-controlled space."
  },
  {
    number: 212,
    cp: null,
    title: "Venetian Alliance",
    deck: "diplomacy",
    availableTurn: 1,
    category: null,
    removeAfterPlay: false,
    description: "If Venice is unaligned, activate Venice as Papal ally. If Venice is Hapsburg ally, deactivate Venice. If Venice is already a Papal ally, add 1 Venetian regular and 2 Venetian fleets (subject to counter mix) in any Papal-controlled port not under siege."
  },
  {
    number: 213,
    cp: null,
    title: "Austrian Invasion",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: 'Invasion',
    removeAfterPlay: false,
    description: "Papacy places Ferdinand, 2 Hapsburg regulars, and 4 Hapsburg mercenaries in a Hapsburg-controlled space. Papacy draws 1 card from the Main Deck."
  },
  {
    number: 214,
    cp: null,
    title: "Imperial Invasion",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: 'Invasion',
    removeAfterPlay: false,
    description: "Papacy places Charles, 3 Hapsburg regulars, and 5 Hapsburg mercenaries in a Hapsburg-controlled space. Papacy draws 1 card from the Main Deck."
  },
  {
    number: 215,
    cp: null,
    title: "Machiavelli",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: null,
    removeAfterPlay: false,
    description: "The player trailing in VP (or the player playing the card if there is a tie) chooses any invasion card currently in the Diplomatic Deck or its discard pile (but not played earlier this turn). Play that card and then reshuffle the Diplomatic Deck (including its discard pile, the Machiavelli card, and the invasion card in the reshuffle)."
  },
  {
    number: 216,
    cp: null,
    title: "Ottoman Invasion",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: 'Invasion',
    removeAfterPlay: false,
    description: "Ottomans and the Papacy are now at war. Protestants place Suleiman, 5 Ottoman regulars, and 4 Ottoman naval squadrons in an Ottoman-controlled space. Protestant draws 1 card from the Main Deck."
  },
  {
    number: 217,
    cp: null,
    title: "Secret Protestant Circle",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: null,
    removeAfterPlay: false,
    description: "Roll a die. On a 1-3, flip one space in the Italian language zone to Protestant religious influence. On a 4-6, flip one space in both the Italian and Spanish language zones to Protestant religious influence."
  },
  {
    number: 218,
    cp: null,
    title: "Siege of Vienna",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: null,
    removeAfterPlay: false,
    description: "Remove 2 Hapsburg or Hungarian land units within 2 spaces of Vienna. No Hapsburg/Hungarian units that start the turn within 2 spaces of Vienna may undertake Move actions this turn."
  },
  {
    number: 219,
    cp: null,
    title: "Spanish Inquisition",
    deck: "diplomacy_sl",
    availableTurn: null,
    category: null,
    removeAfterPlay: false,
    description: "If played by Papacy, look at Protestant's Diplomatic cards. The Papacy picks one of these events; the Protestant must discard it immediately. Protestant must play the other this turn, just after drawing an extra event (to still end the turn with one card in hand). If played by Protestant, he must reveal his hand of cards from the Main Deck immediately."
  },
];

/** Lookup card by number */
export const CARD_BY_NUMBER = Object.fromEntries(
  CARDS.map(c => [c.number, c])
);

