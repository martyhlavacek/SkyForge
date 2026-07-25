import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';

const pages = ['index.html', 'editor.html', 'studio.html'];
for (const page of pages) {
  const html = readFileSync(`dist/${page}`, 'utf8');
  if (!html.includes('/skyforge/assets/')) {
    throw new Error(`${page} does not use the expected /skyforge/ base`);
  }
}

const requiredMusicAssets = [
  'mission_01_drums.ogg',
  'mission_01_bass.ogg',
  'mission_01_harmony.ogg',
  'mission_01_lead.ogg',
  'mission_01_full.ogg',
];
for (const asset of requiredMusicAssets) {
  if (!existsSync(`dist/audio/music/mission_01/${asset}`)) {
    throw new Error(`music asset was not copied into the base-path build: ${asset}`);
  }
}

const requiredStudioAssets = ['demo_fighter_sheet.png', 'demo_fighter_shadow.png'];
for (const asset of requiredStudioAssets) {
  if (!existsSync(`dist/assets/studio/${asset}`)) {
    throw new Error(`Studio asset was not copied into the base-path build: ${asset}`);
  }
}

const requiredTerrainAssets = [
  'skyforge_canyon_terrain.png',
  'skyforge_canyon_props.png',
  'skyforge_canyon_tileset.json',
];
for (const asset of requiredTerrainAssets) {
  if (!existsSync(`dist/assets/terrain/${asset}`)) {
    throw new Error(`terrain asset was not copied into the base-path build: ${asset}`);
  }
}

const assets = await readdir('dist/assets');
for (const prefix of ['editor-', 'studio-']) {
  const bundle = assets.find((file) => file.startsWith(prefix) && file.endsWith('.js'));
  if (!bundle) throw new Error(`${prefix.replace('-', '')} bundle not found`);
  const js = readFileSync(`dist/assets/${bundle}`, 'utf8');
  if (!js.includes('/skyforge/')) {
    throw new Error(`${bundle} does not contain the configured base path`);
  }
}
console.log(
  'Verified /skyforge/ game, Level Studio, Game Design Studio, music, and Asset Studio resources.',
);
