import { test, expect } from '@playwright/test';
import { startHisGame } from '../../utils.js';

/**
 * Reload continuity — a Vite HMR full reload (or a manual refresh) re-inits the
 * app, and an in-progress offline game should be offered for resume from its
 * sessionStorage auto-save (auto-saves only live within the same tab, i.e.
 * exactly the reload case). Needs a real browser: sessionStorage + a full
 * navigation reload aren't reproducible in jsdom.
 */
test.describe('HIS reload continuity (HMR / refresh)', () => {
  test('an in-progress offline game resumes after a full page reload', async ({ page }) => {
    await startHisGame(page);

    // Mark the live state and force an auto-save (what every move does). The
    // marker rides on state, so it survives the export/import round-trip.
    await page.evaluate(() => {
      const g = window.app.currentGame;
      g.state._e2eMarker = 'reload-continuity';
      g._performAutoSave();
    });

    await page.reload();
    await page.waitForFunction(() => !!window.app);

    // The startup resume prompt renders over the lobby — choose to continue.
    await page.getByRole('button', { name: '继续', exact: true }).click();

    // The restored game carries our marker (state actually round-tripped).
    await page.waitForFunction(
      () => window.app.currentGame?.state?._e2eMarker === 'reload-continuity',
      null,
      { timeout: 20_000 }
    );
    const gameId = await page.evaluate(() => window.app.currentGame?.config?.gameType);
    expect(gameId).toBe('his');
    await expect(page.locator('.his-game-ui')).toBeVisible();
  });

  test('declining the prompt clears the auto-save and stays in the lobby', async ({ page }) => {
    await startHisGame(page);
    await page.evaluate(() => window.app.currentGame._performAutoSave());

    await page.reload();
    await page.waitForFunction(() => !!window.app);
    await page.getByRole('button', { name: '返回大厅', exact: true }).click();

    const result = await page.evaluate(() => ({
      hasGame: !!window.app.currentGame,
      autosave: sessionStorage.getItem('boardgame_autosave_his'),
    }));
    expect(result.hasGame).toBe(false);
    expect(result.autosave).toBeNull();
  });
});
