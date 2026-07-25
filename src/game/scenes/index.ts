import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { GameOverScene } from './GameOverScene';
import { ResultsScene } from './ResultsScene';
import { HelpScene } from './HelpScene';
import { SettingsScene } from './SettingsScene';
import { PauseScene } from './PauseScene';
import { HangarScene } from './HangarScene';

/** Scene array in boot order (first entry auto-starts). */
export const scenes = [
  BootScene,
  PreloadScene,
  MenuScene,
  HelpScene,
  SettingsScene,
  HangarScene,
  GameScene,
  PauseScene,
  GameOverScene,
  ResultsScene,
];
