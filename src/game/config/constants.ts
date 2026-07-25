/**
 * Global game constants (roadmap "Global conventions" table).
 * Logical resolution is portrait 540x960, scaled with FIT + CENTER_BOTH.
 */
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

/** Rendering depth layers. Everything must use these — no ad-hoc depths. */
export const DEPTHS = {
  BG_FAR: 0,
  BG_MID: 3,
  BG_NEAR: 5,
  GROUND: 10,
  PICKUPS: 20,
  ENEMIES: 30,
  PLAYER: 40,
  PLAYER_MARKER: 41,
  PROJECTILES: 50,
  FX: 60,
  HUD: 100,
  DEBUG: 200,
} as const;

/** Collision category bitmasks (roadmap conventions / src/game/config/collision.ts merged here for Sprint 0). */
export const COLLISION = {
  PLAYER: 1,
  PLAYER_BULLET: 2,
  ENEMY: 4,
  ENEMY_BULLET: 8,
  PICKUP: 16,
  HAZARD: 32,
} as const;

/** Registry keys — typed string constants so scenes never disagree on names. */
export const REGISTRY = {
  DEBUG_MODE: 'debugMode',
  AUDIO_UNLOCKED: 'audioUnlocked',
  DEBUG_INVULNERABLE: 'debugInvulnerable',
  DIFFICULTY: 'difficulty',
} as const;

/** Placeholder texture keys generated in PreloadScene (Sprint 0.3). */
export const TEX = {
  PLAYER: 'tex_player',
  PLAYER_SHADOW: 'tex_player_shadow',
  BULLET_PLAYER: 'tex_bullet_player',
  BULLET_ENEMY: 'tex_bullet_enemy',
  ENEMY_LIGHT: 'tex_enemy_light',
  ENEMY_HEAVY: 'tex_enemy_heavy',
  ENEMY_INTERCEPTOR: 'tex_enemy_interceptor',
  TURRET: 'tex_turret',
  PICKUP: 'tex_pickup',
  PICKUP_SPREAD: 'tex_pickup_spread',
  PICKUP_SHIELD: 'tex_pickup_shield',
  PICKUP_CREDIT: 'tex_pickup_credit',
  PICKUP_CREDIT_LARGE: 'tex_pickup_credit_large',
  PICKUP_REPAIR: 'tex_pickup_repair',
  ENEMY_BOMBER: 'tex_enemy_bomber',
  MINE: 'tex_mine',
  MISSILE: 'tex_missile',
  BOSS_MINI: 'tex_boss_mini',
  BOSS_ALPHA: 'tex_boss_alpha',
  PARTICLE: 'tex_particle',
  BG_FAR: 'tex_bg_far',
  BG_MID: 'tex_bg_mid',
  BG_NEAR: 'tex_bg_near',
} as const;

/** Scene keys. */
export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  GAME_OVER: 'GameOverScene',
  RESULTS: 'ResultsScene',
  HELP: 'HelpScene',
  SETTINGS: 'SettingsScene',
  PAUSE: 'PauseScene',
  HANGAR: 'HangarScene',
} as const;
