/**
 * Bot — two-player Diplomacy decisions (§9). Covers the card-selection heuristic
 * (play a self-beneficial Invasion; avoid one that helps the opponent) and the
 * Remove-At-War choice. The full-bot run-to-completion is in bot-fullgame.test.js.
 */

import { describe, it, expect } from 'vitest';
import { buildInitialState } from '../state/state-init.js';
import { decideDiplomacy2P } from './bot-diplomacy-2p.js';

const PLAYERS = [{ id: 'p1', nickname: 'Host', isHost: true }];
const make2p = () => buildInitialState(PLAYERS, { variant: 'two_player', rngSeed: 1 });

/** Set the diplomacy play stage with `side` to act holding `hand`. */
function playStage(st, side, hand) {
  st.diplomacyHands[side] = [...hand];
  st.diplomacy2P = { stage: 'play', pendingPlayers: [side] };
}

describe('decideDiplomacy2P — card selection (§9)', () => {
  it('Protestant plays a self-beneficial Invasion (#206 French → attacks the Papacy)', () => {
    const st = make2p();
    playStage(st, 'protestant', [201, 206]); // 201 non-invasion, 206 invasion (helps Protestant)
    const move = decideDiplomacy2P(st, 'protestant');
    expect(move.actionType).toBe('PLAY_DIPLOMACY_CARD');
    expect(move.actionData.cardNumber).toBe(206);
    expect(move.actionData.targetSpace).toBeTruthy(); // an invasion gets a landing space
  });

  it('Papacy avoids the self-harming Invasion (#206 helps the Protestant) and plays the other card', () => {
    const st = make2p();
    playStage(st, 'papacy', [206, 201]); // 206 would help the opponent → pick 201 instead
    const move = decideDiplomacy2P(st, 'papacy');
    expect(move.actionData.cardNumber).toBe(201);
  });

  it('post-SL, the Papacy plays an Imperial Invasion (#214 → commanded against the Protestant)', () => {
    const st = make2p();
    st.schmalkaldicLeague = true;
    playStage(st, 'papacy', [201, 214]);
    const move = decideDiplomacy2P(st, 'papacy');
    expect(move.actionData.cardNumber).toBe(214);
  });

  it('honors a #205 forced-play constraint over the heuristic', () => {
    const st = make2p();
    playStage(st, 'protestant', [206, 201]);
    st.diplomacyForcedPlay = { side: 'protestant', card: 201 };
    const move = decideDiplomacy2P(st, 'protestant');
    expect(move.actionData.cardNumber).toBe(201);
  });
});

describe('decideDiplomacy2P — Remove-At-War (§9)', () => {
  it('the Papacy plays Papal Bull when a France/Hapsburg war can be ended', () => {
    const st = make2p();
    st.wars.push({ a: 'papacy', b: 'france' });
    st.diplomacy2P = { stage: 'remove_war', pendingPlayers: [] };
    const move = decideDiplomacy2P(st, 'papacy');
    expect(move.actionType).toBe('PAPAL_BULL');
    expect(move.actionData.targetPower).toBe('france');
  });

  it('ends the Remove-At-War step when no war can be removed', () => {
    const st = make2p();
    st.diplomacy2P = { stage: 'remove_war', pendingPlayers: [] };
    const move = decideDiplomacy2P(st, 'papacy');
    expect(move.actionType).toBe('END_REMOVE_WAR');
  });
});
