/**
 * Shared E2E helpers. Not a test file (no .spec/.test suffix) so the runner
 * ignores it.
 */

/**
 * Load the app and start a single-player (vs AI) HIS game, then wait for the
 * board to mount. Uses the app's programmatic start hook so the test does not
 * depend on the lobby flow, and passes an rngSeed for deterministic dealing.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ rngSeed?: number }} [options]
 */
export async function startHisGame(page, options = { rngSeed: 12345 }) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.app);
  await page.evaluate((opts) => {
    const players = [
      { id: 'p1', nickname: 'You', isHost: true },
      { id: 'p2', nickname: 'AI2' }, { id: 'p3', nickname: 'AI3' },
      { id: 'p4', nickname: 'AI4' }, { id: 'p5', nickname: 'AI5' },
      { id: 'p6', nickname: 'AI6' },
    ];
    window.app._startGame('his', players, 'offline', opts);
  }, options);
  // _startGame lazy-loads the HIS bundle, so wait for the UI to actually mount.
  await page.waitForSelector('.his-game-ui', { timeout: 20_000 });
  await page.waitForSelector('.his-map svg, svg.his-map', { timeout: 20_000 });
}

/**
 * Load the app and start a two-player (hotseat) HIS game — one local seat
 * controls both Papacy and Protestant; the other four powers are non-player.
 * Waits for the board to mount.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ rngSeed?: number }} [options]
 */
export async function startHisTwoPlayerGame(page, options = { rngSeed: 12345 }) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.app);
  await page.evaluate((opts) => {
    // Use the app's own player id so UI-dispatched moves (which use
    // window.app.playerId) are accepted — matches the real lobby start path.
    const players = [{ id: window.app.playerId, nickname: 'Host', isHost: true }];
    window.app._startGame('his', players, 'offline', {
      ...opts,
      variant: 'two_player',
      powerAssignment: [['papacy', 'protestant']]
    });
  }, options);
  await page.waitForSelector('.his-game-ui', { timeout: 20_000 });
  await page.waitForSelector('.his-map svg, svg.his-map', { timeout: 20_000 });
}

/** Name of the first land space on the rendered map that currently has no units. */
export async function firstEmptyLandSpace(page) {
  return page.evaluate(() => {
    const spaces = window.app.currentGame.state.spaces;
    for (const el of document.querySelectorAll('.his-map .his-space[data-name]')) {
      const name = el.getAttribute('data-name');
      const sp = spaces[name];
      if (sp && (!sp.units || sp.units.length === 0)) return name;
    }
    return null;
  });
}
