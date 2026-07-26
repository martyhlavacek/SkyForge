import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('mobile game viewport fits, accepts touch entry, and maintains frame progress', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.__skyforge !== 'undefined');
  await page.waitForFunction(() =>
    window.__skyforge?.activeScenes().includes('MenuScene'),
  );
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  await canvas.tap({
    position: { x: box!.width * 0.5, y: box!.height * 0.54 },
  });
  await page.waitForFunction(() =>
    window.__skyforge?.activeScenes().includes('HangarScene'),
  );

  const frames = await page.evaluate(async () => {
    let count = 0;
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        count += 1;
        if (performance.now() - start >= 1000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return count;
  });
  expect(frames).toBeGreaterThan(20);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('mobile Game Design Studio remains usable without horizontal page overflow', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/studio.html');
  await expect(page.locator('.studio-toolbar h1')).toContainText('SKYFORGE');
  await page.getByRole('button', { name: 'Build' }).click();
  await expect(page.locator('.studio-footer .ok')).toContainText('Compile OK');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
  await expect(
    page.getByRole('button', { name: 'Export Dependency Lock' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Production Compile' })).toBeVisible();
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
