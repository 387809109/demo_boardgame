# 1517 Scenario - 6-Player Starting Setup

> Source: Here I Stand Scenario Book, 500th Anniversary Edition, Pages 2-4

## Overview

- **Description**: The lengthiest version, covering the first 39 years of the Reformation
- **Game Length**: 9 Turns — Turn 1 (1517) to Turn 9 (1555)
- **Special Rules**: None

## Setup Guidelines

### Abbreviations

| Abbreviation | Meaning |
|---|---|
| SCM | Square Control Marker (power's own territory) |
| HCM | Hexagonal Control Marker (Catholic side) |
| hcm | Hexagonal Control Marker (Protestant side) |
| merc | Mercenary unit |

### General Rules

- Units not listed on the map go into each power's **Force Pool** (available for construction during play)
- Unused minor power and neutral units go in a separate pile
- Turn marker starts in the **Turn 1** box
- All 9 New World VP markers (6 exploration, 3 conquest) are placed on the New World display

---

## Power Setup

### Ottoman (VP: 8)

| Space | Units |
|---|---|
| Istanbul | Suleiman, Ibrahim Pasha, 7 regulars, 1 cavalry, 1 naval squadron, SCM |
| Edirne | 1 regular, SCM |
| Salonika | 1 regular, 1 naval squadron, SCM |
| Athens | 1 regular, 1 naval squadron, SCM |

- **SCM on Power Card**: 7
- **VP for Piracy**: 0

### Hapsburg (VP: 9)

| Space | Units |
|---|---|
| Valladolid | Charles V, Duke of Alva, 4 regulars, SCM |
| Seville | 1 regular, 1 naval squadron, SCM |
| Barcelona | 1 regular, 1 naval squadron, SCM |
| Navarre | 1 regular, SCM |
| Tunis | 1 regular, SCM |
| Naples | 2 regulars, 1 naval squadron, SCM |
| Besançon | 1 regular |
| Brussels | 1 regular |
| Vienna | Ferdinand, 4 regulars, SCM |
| Antwerp | 3 regulars, SCM |

- **SCM on Power Card**: 6
- **All 21 Protestant home spaces**: HCM (one each)
- **Crossing Atlantic Box**: Hapsburg Conquest Underway marker + Exploration Underway marker (on "-1: Uncharted" side) both start here

### England (VP: 9)

| Space | Units |
|---|---|
| London | Henry VIII, Charles Brandon, 3 regulars, 1 naval squadron, SCM |
| Portsmouth | 1 naval squadron |
| Calais | 2 regulars, SCM |
| York | 1 regular, SCM |
| Bristol | 1 regular, SCM |

- **SCM on Power Card**: 5
- **Henry's Marital Status**: Catherine of Aragon
- Place all 6 wife counters in the appropriate boxes (Catherine of Aragon in same box as Anne Boleyn)

### France (VP: 12)

| Space | Units |
|---|---|
| Paris | Francis I, Montmorency, 4 regulars, SCM |
| Rouen | 1 regular, 1 naval squadron, SCM |
| Bordeaux | 2 regulars, SCM |
| Lyon | 1 regular, SCM |
| Marseille | 1 regular, 1 naval squadron, SCM |
| Turin | HCM |
| Milan | 2 regulars, SCM |

- **SCM on Power Card**: 5
- **VP for Chateaux**: 0

### Papacy (VP: 19)

| Space | Units |
|---|---|
| Rome | 1 regular, 1 naval squadron, SCM |
| Ravenna | 1 regular, SCM |

- **SCM on Power Card**: 5
- **Papal Debaters**: Eck, Campeggio, Aleander, Tetzel, Cajetan
- **Excommunicated**: None
- **Saint Peter's Construction**: 0 CP, 0 VP

### Protestant (VP: 0)

| Space | Units |
|---|---|
| Wittenberg (Electorate) | 2 regulars |
| Augsburg (Electorate) | 2 regulars |
| Cologne (Electorate) | 1 regular |
| Trier (Electorate) | 1 regular |
| Mainz (Electorate) | 1 regular |
| Brandenburg (Electorate) | 1 regular |

- **German Debaters**: Luther, Melanchthon, Bucer, Carlstadt
- **All Translations**: Not started
- **Protestant Spaces**: 0
- **English Home Spaces**: 0

---

## Minor Powers & Independents

### Venice

| Space | Units |
|---|---|
| Venice | 2 regulars, 3 naval squadrons |
| Corfu | 1 regular |
| Candia | 1 regular |

### Genoa

| Space | Units |
|---|---|
| Genoa | Andrea Doria, 2 regulars, 1 naval squadron |

### Hungary-Bohemia

| Space | Units |
|---|---|
| Belgrade | 1 regular |
| Buda | 5 regulars |
| Prague | 1 regular |

### Scotland

| Space | Units |
|---|---|
| Edinburgh | 3 regulars, 1 naval squadron |
| Stirling | fortress (500th Anniversary Upgrade Kit only) |

### Independents

| Space | Units |
|---|---|
| Rhodes | Knights of St. John (1 regular) |
| Metz | 1 regular |
| Florence | 1 regular |

---

## Diplomatic Status

| Power A | Power B | Status |
|---|---|---|
| Hapsburg | France | **At War** |
| France | Papacy | **At War** |
| Ottoman | Hungary-Bohemia | **At War** |

All other relationships: Neutral (no marker).

---

## Cards In Play

- All cards in the deck may become available during this scenario
- **41 cards** have a turn number (or "Variable") in the upper-right corner; not added until Turn 3 or later
- **Cards NOT in starting deck**: #14–#23, #38–#64, #113–#116
- **Starting deck**: all other cards (i.e., #1–#13, #24–#37, #65–#112, #117+)

---

## Initial VP Summary

| Power | VP |
|---|---|
| Ottoman | 8 |
| Hapsburg | 9 |
| England | 9 |
| France | 12 |
| Papacy | 19 |
| Protestant | 0 |

---

## Related Documents

| Document | Content |
|---|---|
| [POWER_CARDS.md](POWER_CARDS.md) | Action costs, ruler attributes, VP tracks, power-specific mechanics |
| [RELIGIOUS_STRUGGLE.md](RELIGIOUS_STRUGGLE.md) | Protestant Spaces Track values, all debater stats and bonuses |
| [SEQUENCE_OF_PLAY.md](SEQUENCE_OF_PLAY.md) | Turn-by-turn debater/card/event schedule, phase structure |
| [RULEBOOK_FOR_DEVELOPMENT.md](RULEBOOK_FOR_DEVELOPMENT.md) | Implementation spec with state model (EN) |
| [RULEBOOK_FOR_DEVELOPMENT_ZH.md](RULEBOOK_FOR_DEVELOPMENT_ZH.md) | Implementation spec with state model (ZH) |

## Extracted Game Data

| File | Content |
|---|---|
| `his_ref/img/processed/all_cards_classified.json` | All 135 cards: deck/timing classification, CP cost, card text, category |
| `his_ref/img/processed/leaders_and_explorers.json` | 38 leaders/explorers: ArmyLeader(15), NavalLeader(3), Conquistador(5), Explorer(15) |
| `his_ref/img/processed/his_vmod_map_data.json` | Base map topology from VASSAL module (pre-correction) |
| `his_ref/img/processed/his_vmod_map_data.corrected.json` | Finalized map data: 134 land spaces, 15 sea zones, 223 land edges, 17 sea edges |
| `his_ref/img/processed/manual_review/` | Manual review workflow: visual review tool, override CSVs, correction scripts |

## Deferred Extraction References

- **Action Summary card** (`his_ref/img/classified/action summary.jpg`): Combat tables (Field Battle / Assault / Naval dice), Exploration / Circumnavigation / Conquests tables. Extract when implementing combat and New World modules.
- **2-Player Sequence of Play** (`his_ref/img/classified/sequence of play for 2 player.jpg`): 2-player variant turn structure. Extract when implementing 2-player mode.
- **Scenarios.pdf** (`his_ref/Scenarios.pdf`): Pages 4–6 contain 1532 and Tournament scenario setups; pages 6–7 contain 3–5 player configurations; pages 37–40 contain 2-player variant rules. Extract when implementing additional scenarios.
