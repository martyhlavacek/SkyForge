import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

interface MusicProbe {
  plays: number;
  element: HTMLAudioElement | null;
  rejection: string | null;
}

async function installMusicProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as { __musicProbe: MusicProbe };
    target.__musicProbe = { plays: 0, element: null, rejection: null };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function playWithProbe() {
      const probe = (window as unknown as { __musicProbe: MusicProbe }).__musicProbe;
      probe.plays += 1;
      probe.element = this as HTMLAudioElement;
      const result = original.call(this);
      void result.catch((error: unknown) => {
        probe.rejection = error instanceof Error ? error.message : String(error);
      });
      return result;
    };
  });
}

test('imports, persists, previews, offsets, and stops a real MP3', async ({ page }) => {
  await installMusicProbe(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/studio.html');
  const panel = page.locator('.level-music-panel');
  await expect(panel).toBeVisible({ timeout: 15000 });
  await panel.locator('input[type="file"]').setInputFiles(
    path.join(process.cwd(), 'e2e/fixtures/level-music-test.mp3'),
  );
  await expect(panel.locator('p[role="status"]')).toContainText(
    'Imported level-music-test.mp3',
  );

  const track = panel.locator('select').first();
  await expect(track).toHaveValue(/^music-[a-f0-9]{24}$/);
  await panel.locator('input[type="range"]').fill('0.4');
  await panel.locator('input[type="number"]').first().fill('0.5');
  await panel.getByRole('button', { name: 'Preview' }).click();

  await page.waitForFunction(
    () => {
      const probe = (window as unknown as { __musicProbe?: MusicProbe }).__musicProbe;
      return Boolean(
        probe?.plays &&
          probe.element &&
          Number.isFinite(probe.element.duration) &&
          probe.element.currentTime >= 0.45,
      );
    },
    null,
    { timeout: 15000 },
  );
  expect(
    await page.evaluate(() => {
      const probe = (window as unknown as { __musicProbe: MusicProbe }).__musicProbe;
      return {
        plays: probe.plays,
        paused: probe.element?.paused,
        volume: probe.element?.volume,
        rejection: probe.rejection,
      };
    }),
  ).toEqual({ plays: 1, paused: false, volume: 0.4, rejection: null });

  await panel.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const probe = (window as unknown as { __musicProbe: MusicProbe }).__musicProbe;
        return {
          paused: probe.element?.paused,
          sourceCleared: !probe.element?.getAttribute('src'),
        };
      }),
    )
    .toEqual({ paused: true, sourceCleared: true });

  const selectedId = await track.inputValue();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const runtime = page.frameLocator('iframe[title="Skyforge shared runtime"]');
  const runtimeCanvas = runtime.locator('canvas');
  await expect(runtimeCanvas).toBeVisible({ timeout: 15000 });
  await expect
    .poll(
      () =>
        runtime
          .locator('body')
          .evaluate(() => window.__skyforge?.activeScenes() ?? []),
      { timeout: 15000 },
    )
    .toContain('GameScene');
  await expect
    .poll(
      () =>
        runtime
          .locator('body')
          .evaluate(
            () =>
              (
                window.__skyforge?.musicState() as
                  | { pendingCueId?: string | null }
                  | undefined
              )?.pendingCueId ?? null,
          ),
      { timeout: 15000 },
    )
    .toBe(selectedId);
  await runtimeCanvas.click();
  await expect
    .poll(
      () =>
        runtime
          .locator('body')
          .evaluate(
            () =>
              (
                window.__skyforge?.musicState() as
                  | { cueId?: string | null; contextState?: string }
                  | undefined
              ) ?? null,
          ),
      { timeout: 20000 },
    )
    .toMatchObject({ cueId: selectedId, contextState: 'running' });

  await page.reload();
  await expect(
    page.locator('.level-music-panel select').first(),
  ).toHaveValue(selectedId);
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
