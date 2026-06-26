import { test, expect } from '@playwright/test';
import { startHisTwoPlayerGame } from '../../utils.js';

/**
 * HIS two-player variant (Phase 1, hotseat) — browser smoke. Confirms the
 * lobby → engine → UI path actually mounts the 2P game with the variant setup
 * applied, and that the status bar reflects the variant. Engine rules and the
 * Diplomatic-Deck phase logic are covered exhaustively by the vitest suite
 * (src/games/his/two-player.test.js).
 */
test.describe('HIS two-player variant', () => {
  test('starts a 2P hotseat game with the variant board + status indicator', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startHisTwoPlayerGame(page);

    // The SVG map drew its land spaces.
    await expect(page.locator('svg.his-map')).toBeVisible();
    expect(await page.locator('.his-map .his-space[data-name]').count())
      .toBeGreaterThan(100);

    // Engine state reflects the two-player variant + its Diplomatic Deck.
    const summary = await page.evaluate(() => {
      const st = window.app.currentGame.state;
      const leaders = [];
      for (const sp of Object.values(st.spaces)) {
        for (const u of sp.units || []) leaders.push(...(u.leaders || []));
      }
      return {
        variant: st.variant,
        diplomacyDeck: st.diplomacyDeck?.length ?? null,
        leaders
      };
    });
    expect(summary.variant).toBe('two_player');
    expect(summary.diplomacyDeck).toBe(12);
    // §Setup: only Andrea Doria starts on the map.
    expect(summary.leaders).toEqual(['andrea_doria']);

    // The status bar shows the two-player indicator.
    await expect(page.locator('.his-status-bar')).toContainText('两人局');
  });

  test('Phase 2: an invasion card places an army + shows the war; §11 invader actions render', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startHisTwoPlayerGame(page);

    // Force a Turn-2 Diplomacy phase with French Invasion (#206) in Papacy's hand.
    await page.evaluate(() => {
      const s = window.app.currentGame.state;
      s.turn = 2; s.phase = 'diplomacy'; s.activePower = null;
      s.diplomacyHands.papacy = [206];
      s.diplomacyHands.protestant = [201];
      s.diplomacy2P = { pendingPlayers: ['papacy', 'protestant'] };
      window.app.currentGame.emit('stateUpdated', s);
    });

    // The diplomacy panel shows the invasion card, marked with the ⚔ glyph.
    await expect(page.locator('.his-action-panel')).toContainText('French Invasion');
    await expect(page.locator('.his-action-panel')).toContainText('⚔');

    // Play the invasion (with a landing space) through the real move pipeline.
    const result = await page.evaluate(() => {
      const g = window.app.currentGame;
      const r = g.executeMove({
        actionType: 'PLAY_DIPLOMACY_CARD', playerId: window.app.playerId,
        actionData: { cardNumber: 206, targetSpace: 'Milan' }
      });
      return {
        success: r.success,
        war: g.state.wars.some((w) =>
          (w.a === 'france' && w.b === 'papacy') || (w.a === 'papacy' && w.b === 'france')),
        french: (g.state.spaces.Milan.units || []).some(
          (u) => u.owner === 'france' && u.regulars > 0)
      };
    });
    expect(result.success).toBe(true);
    expect(result.war).toBe(true);
    expect(result.french).toBe(true);

    // The status bar now shows a war involving a non-player power.
    await expect(page.locator('.his-status-bar')).toContainText('⚔');

    // §11: a CP-mode Action phase with a commandable invader shows invader actions.
    await page.evaluate(() => {
      const g = window.app.currentGame;
      const s = g.state;
      s.phase = 'action'; s.activePower = 'papacy';
      s.cpRemaining = 4; s.activeCardNumber = 999;
      if (!s.wars.some((w) =>
        (w.a === 'hapsburg' && w.b === 'protestant') ||
        (w.a === 'protestant' && w.b === 'hapsburg'))) {
        s.wars.push({ a: 'hapsburg', b: 'protestant' });
      }
      g.emit('stateUpdated', s);
    });
    await expect(page.locator('.his-action-panel')).toContainText('代理');
  });
});
