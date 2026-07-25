import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function waitForScene(page: Page, scene: string): Promise<void> {
  await page.waitForFunction(
    (key) => window.__skyforge?.activeScenes().includes(key),
    scene,
    { timeout: 15000 },
  );
}

test('game loads to a validated menu without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.__skyforge !== 'undefined', null, {
    timeout: 15000,
  });
  await waitForScene(page, 'MenuScene');
  expect(await page.evaluate(() => window.__skyforge!.contentErrorCount())).toBe(0);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('keyboard enters the hangar, launches, unlocks music, and moves the player', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await waitForScene(page, 'MenuScene');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'HangarScene');
  await page.keyboard.press('l');
  await waitForScene(page, 'GameScene');

  const before = await page.evaluate(() => window.__skyforge!.playerPos());
  expect(before).not.toBeNull();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowRight');
  const after = await page.evaluate(() => window.__skyforge!.playerPos());
  expect(after!.x).toBeGreaterThan(before!.x);

  await page.waitForFunction(
    () => window.__skyforge?.musicState().cueId === 'coastal_assault',
    null,
    { timeout: 15000 },
  );
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('Pause → Settings → Pause preserves the active run', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await waitForScene(page, 'MenuScene');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'HangarScene');
  await page.keyboard.press('l');
  await waitForScene(page, 'GameScene');
  await page.waitForTimeout(500);

  await page.keyboard.press('Escape');
  await waitForScene(page, 'PauseScene');
  const paused = await page.evaluate(() => ({
    pos: window.__skyforge!.playerPos(),
    level: window.__skyforge!.levelSnapshot(),
    status: window.__skyforge!.sceneStatus('GameScene'),
  }));
  expect(paused.status).toBe('paused');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'SettingsScene');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await waitForScene(page, 'PauseScene');

  const returned = await page.evaluate(() => ({
    pos: window.__skyforge!.playerPos(),
    level: window.__skyforge!.levelSnapshot(),
    status: window.__skyforge!.sceneStatus('GameScene'),
  }));
  expect(returned.status).toBe('paused');
  expect(returned.pos).toEqual(paused.pos);
  expect(returned.level!.levelTime).toBeCloseTo(paused.level!.levelTime, 1);

  await page.keyboard.press('Escape');
  await waitForScene(page, 'GameScene');
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('runs thirty simulated seconds without runtime errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await waitForScene(page, 'MenuScene');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'HangarScene');
  await page.keyboard.press('l');
  await waitForScene(page, 'GameScene');
  await page.evaluate(() => {
    window.__skyforge!.setInvulnerable(true);
    window.__skyforge!.setTimeScale(4);
  });
  await page.waitForFunction(
    () => (window.__skyforge?.levelSnapshot()?.levelTime ?? 0) >= 30,
    null,
    { timeout: 15000 },
  );
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the editor and preview use the configured application base', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/editor.html');
  await expect(page.locator('.toolbar h1')).toHaveText('SKYFORGE LEVEL COMPOSER', {
    timeout: 15000,
  });
  await expect(page.getByRole('link', { name: '← game' })).toHaveAttribute(
    'href',
    '/index.html',
  );
  await expect(page.getByRole('link', { name: 'studio' })).toHaveAttribute(
    'href',
    '/studio.html',
  );
  await expect(page.locator('canvas.map-canvas')).toBeVisible();
  await expect(page.locator('.workspace-tabs button')).toHaveCount(3);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('Level Studio loads the default image-backed canyon tileset', async ({ page }) => {
  const errors = collectErrors(page);
  const atlasResponse = page.waitForResponse((response) =>
    response.url().endsWith('/assets/terrain/skyforge_canyon_terrain.png'),
  );
  await page.goto('/editor.html');
  const response = await atlasResponse;
  expect(response.ok()).toBe(true);
  await page.getByRole('button', { name: 'Materials' }).click();
  await expect(page.getByText('Skyforge Canyon Default')).toBeVisible();
  const swatch = page.locator('.material-swatch.image-backed').first();
  await expect(swatch).toBeVisible();
  expect(await swatch.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(
    'skyforge_canyon_terrain.png',
  );
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('default canyon remains visual-only through former gate timings', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await waitForScene(page, 'MenuScene');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'HangarScene');
  await page.keyboard.press('l');
  await waitForScene(page, 'GameScene');
  await page.evaluate(() => {
    window.__skyforge!.setInvulnerable(true);
    window.__skyforge!.setTimeScale(4);
  });
  await page.waitForFunction(
    () => (window.__skyforge?.levelSnapshot()?.levelTime ?? 0) >= 66,
    null,
    { timeout: 25000 },
  );
  expect(await page.evaluate(() => window.__skyforge!.terrainState())).toEqual({});
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('Game Design Studio loads four package workspaces and compiles built-in content', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/studio.html');
  await expect(page.locator('.studio-toolbar h1')).toHaveText(
    'SKYFORGE GAME DESIGN STUDIO',
    {
      timeout: 15000,
    },
  );
  await expect(page.locator('.studio-tabs button')).toHaveCount(5);
  await expect(page.locator('.level-studio-frame')).toBeVisible();
  await page.getByRole('button', { name: 'Build' }).click();
  await expect(page.locator('.studio-footer .ok')).toContainText('Compile OK');
  await expect(page.locator('.package-grid article')).toHaveCount(4);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});



test('Level Studio map canvas paints with click and drag while embedded', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/studio.html');
  const editor = page.frameLocator('iframe[title="Skyforge Level Studio"]');
  await editor.getByTitle('Paint (B)').click();
  const canvas = editor.getByLabel('Level map painting canvas');
  await expect(canvas).toBeVisible({ timeout: 15000 });
  const undo = editor.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeDisabled();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({ position: { x: box!.width * 0.52, y: box!.height * 0.55 } });
  await expect(undo).toBeEnabled();
  await canvas.hover({ position: { x: box!.width * 0.45, y: box!.height * 0.5 } });
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await expect(editor.getByText(/one drag = one Undo/i)).toBeVisible();
  await expect(editor.getByLabel('Level minimap')).toBeVisible();
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('Simulation dock controls and preview remain within the dock', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/studio.html');
  const sizes = await page.locator('.runtime-dock').evaluate((dock) => ({
    clientWidth: dock.clientWidth,
    scrollWidth: dock.scrollWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 2);
  await expect(page.getByRole('button', { name: 'Expand' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pop Out' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand' }).click();
  await expect(page.getByRole('button', { name: 'Restore Studio' })).toBeVisible();
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('Studio tuning arena exposes live transport, snapshots, and telemetry', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/studio.html');
  await expect(page.locator('.studio-toolbar h1')).toHaveText(
    'SKYFORGE GAME DESIGN STUDIO',
    {
      timeout: 15000,
    },
  );
  await page.getByRole('button', { name: 'Tuning' }).click();
  await page.getByLabel('Scope').selectOption('enemy');
  await page.getByRole('button', { name: 'Start' }).click();

  const runtime = page.frameLocator('iframe[title="Skyforge shared runtime"]');
  await expect(runtime.locator('canvas')).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelector('.runtime-status')?.textContent?.includes('GameScene'),
    null,
    { timeout: 15000 },
  );
  await expect(page.getByLabel('Snapshot interval')).toHaveValue('5');
  await expect(page.locator('.timeline-marker').first()).toBeAttached();
  await page.getByLabel('Snapshot interval').selectOption('2');
  await page.waitForTimeout(2500);
  await expect(page.locator('.timeline-title')).toContainText('2s');
  await expect(page.locator('.runtime-heatmap .heatmap-bar').first()).toBeAttached();
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('Asset Studio previews built-in art and exposes production workflows', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/studio.html');
  await expect(page.locator('.studio-toolbar h1')).toHaveText(
    'SKYFORGE GAME DESIGN STUDIO',
    { timeout: 15000 },
  );
  await page.getByRole('button', { name: 'Assets' }).click();
  await expect(page.getByRole('heading', { name: 'Asset Studio' })).toBeVisible();
  await expect(page.locator('.studio-tabs button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Music' })).toHaveCount(0);
  await expect(page.locator('.asset-subtabs button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /Demo Fighter/ })).toBeVisible();
  await expect(page.locator('.asset-stage-panel canvas')).toBeVisible();

  await page.getByRole('button', { name: 'tilesets' }).click();
  await expect(page.getByRole('heading', { name: 'Tilesets' })).toBeVisible();
  await page.getByRole('button', { name: 'atlases' }).click();
  await expect(
    page.getByRole('heading', { name: 'Deterministic atlases' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'references' }).click();
  await expect(page.getByRole('heading', { name: 'Reference health' })).toBeVisible();

  await page.getByRole('button', { name: 'assets' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  const runtime = page.frameLocator('iframe[title="Skyforge shared runtime"]');
  await expect(runtime.locator('canvas')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Preview in Runtime' }).click();
  await page.waitForTimeout(500);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
