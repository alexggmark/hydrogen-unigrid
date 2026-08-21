import {expect, test} from '@playwright/test';

// the container queries key off .u-frame, not the viewport, so these widths are
// chosen to land inside each band rather than near its edge
const BANDS = [
  {name: 'a', width: 1440},
  {name: 'b', width: 800},
  {name: 'c', width: 420},
] as const;

test.describe('grid renders the same composition per band', () => {
  for (const band of BANDS) {
    test(`band ${band.name}`, async ({page}) => {
      await page.setViewportSize({width: band.width, height: 1200});
      await page.goto('/grid');
      await page.waitForLoadState('networkidle');
      // the dev hud is instrumentation and moves with unrelated changes
      await page.addStyleTag({content: '.u-hud, .u-overlay {display: none !important}'});
      await expect(page).toHaveScreenshot(`grid-band-${band.name}.png`, {
        fullPage: true,
      });
    });
  }
});

test('a block never renders past the grid it belongs to', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1200});
  await page.goto('/grid');
  const frame = await page.locator('.u-frame').boundingBox();
  const blocks = await page.locator('.u-block').all();
  expect(blocks.length).toBeGreaterThan(0);

  for (const block of blocks) {
    const box = await block.boundingBox();
    if (!box || !frame) continue;
    expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
  }
});
