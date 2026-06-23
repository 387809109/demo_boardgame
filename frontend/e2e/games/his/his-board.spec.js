import { test, expect } from '@playwright/test';
import { startHisGame, firstEmptyLandSpace } from '../../utils.js';

/**
 * HIS board E2E — only the things jsdom/node can't verify: the SVG map actually
 * renders, real pointer hit-testing on a space polygon, and the responsive
 * layout reflow. Engine logic and pure render contracts live in the vitest
 * suite.
 */
test.describe('HIS board', () => {
  test('renders the SVG map and sidebar side-by-side on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startHisGame(page);

    await expect(page.locator('svg.his-map')).toBeVisible();
    await expect(page.locator('.his-sidebar')).toBeVisible();
    // Map nodes were actually drawn (134 land spaces) — not an empty SVG.
    expect(await page.locator('.his-map .his-space[data-name]').count())
      .toBeGreaterThan(100);

    const dir = await page.locator('.his-main-area')
      .evaluate((el) => getComputedStyle(el).flexDirection);
    expect(dir).toBe('row');
  });

  test('clicking a space polygon selects it (real SVG pointer hit-test)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startHisGame(page);

    // An empty space so the unit overlay can't intercept the click.
    const name = await firstEmptyLandSpace(page);
    expect(name).toBeTruthy();

    const space = page.locator(`.his-map .his-space[data-name="${name}"]`).first();
    await space.click({ force: true });

    // selectSpace() marks the clicked node, and the detail panel opens for it.
    await expect(space).toHaveClass(/his-space-selected/);
    await expect(page.locator('.his-space-detail')).toContainText(name);
  });

  test('responsive: map stacks above a full-width sidebar on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startHisGame(page);

    const dir = await page.locator('.his-main-area')
      .evaluate((el) => getComputedStyle(el).flexDirection);
    expect(dir).toBe('column');

    const map = await page.locator('.his-map-container').boundingBox();
    const sidebar = await page.locator('.his-sidebar').boundingBox();
    expect(map).not.toBeNull();
    expect(sidebar).not.toBeNull();
    // Sidebar sits below the map (not beside it) and spans ~full width.
    expect(sidebar.y).toBeGreaterThanOrEqual(map.y + map.height - 2);
    expect(sidebar.width).toBeGreaterThan(map.width * 0.9);
  });
});
