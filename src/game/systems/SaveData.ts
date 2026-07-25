import { z } from 'zod';
import type { DifficultyName } from '../../schemas/difficultySchema';
import { CampaignProfileSchema, type CampaignProfile } from '../../schemas/profileSchema';
import { createStarterProfile } from '../profile/StarterProfile';

const SAVE_KEY_V2 = 'skyforge_save_v2';
const LEGACY_SAVE_KEY = 'skyforge_save_v1';
const VERSION = 2;

export const SettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1),
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  screenShake: z.number().min(0).max(1),
  flashIntensity: z.number().min(0).max(1),
  reducedParticles: z.boolean(),
  touchSensitivity: z.number().min(0.5).max(3),
  difficulty: z.enum(['easy', 'normal', 'hard']),
});

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: number;
  flashIntensity: number;
  reducedParticles: boolean;
  touchSensitivity: number;
  difficulty: DifficultyName;
}

export interface SaveBlob {
  version: 2;
  settings: Settings;
  highScore: number;
  bestTimeSeconds: number;
  highestMultiplier: number;
  tutorialSeen: boolean;
  profile: CampaignProfile;
}

export interface RecordRunResult {
  newHighScore: boolean;
  newBestTime: boolean;
  newHighestMultiplier: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  screenShake: 1,
  flashIntensity: 1,
  reducedParticles: false,
  touchSensitivity: 1.4,
  difficulty: 'normal',
};

function defaults(): SaveBlob {
  return {
    version: VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    highScore: 0,
    bestTimeSeconds: 0,
    highestMultiplier: 1,
    tutorialSeen: false,
    profile: createStarterProfile(),
  };
}

const finiteNonnegative = z.number().finite().nonnegative();
const positiveMultiplier = z.number().finite().min(1);

function sanitizeField<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}

function sanitizeSettings(raw: unknown): Settings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    masterVolume: sanitizeField(z.number().min(0).max(1), source.masterVolume, DEFAULT_SETTINGS.masterVolume),
    musicVolume: sanitizeField(z.number().min(0).max(1), source.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: sanitizeField(z.number().min(0).max(1), source.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    screenShake: sanitizeField(z.number().min(0).max(1), source.screenShake, DEFAULT_SETTINGS.screenShake),
    flashIntensity: sanitizeField(z.number().min(0).max(1), source.flashIntensity, DEFAULT_SETTINGS.flashIntensity),
    reducedParticles: sanitizeField(z.boolean(), source.reducedParticles, DEFAULT_SETTINGS.reducedParticles),
    touchSensitivity: sanitizeField(z.number().min(0.5).max(3), source.touchSensitivity, DEFAULT_SETTINGS.touchSensitivity),
    difficulty: sanitizeField(z.enum(['easy', 'normal', 'hard']), source.difficulty, DEFAULT_SETTINGS.difficulty),
  };
}

function sanitizeProfile(raw: unknown): CampaignProfile {
  const parsed = CampaignProfileSchema.safeParse(raw);
  if (!parsed.success) return createStarterProfile();
  const profile = parsed.data;
  const hasActive = profile.loadouts.some((loadout) => loadout.id === profile.activeLoadoutId);
  if (!hasActive) profile.activeLoadoutId = profile.loadouts[0].id;
  return profile;
}

/** V1 records/settings migrate into a new legal campaign profile. Idempotent for V2. */
export function migrateSave(raw: unknown): SaveBlob {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const blob = raw as Record<string, unknown>;
  return {
    version: VERSION,
    settings: sanitizeSettings(blob.settings),
    highScore: sanitizeField(finiteNonnegative, blob.highScore, base.highScore),
    bestTimeSeconds: sanitizeField(finiteNonnegative, blob.bestTimeSeconds, base.bestTimeSeconds),
    highestMultiplier: sanitizeField(positiveMultiplier, blob.highestMultiplier, base.highestMultiplier),
    tutorialSeen: sanitizeField(z.boolean(), blob.tutorialSeen, base.tutorialSeen),
    profile: sanitizeProfile(blob.profile),
  };
}

class SaveDataManager {
  private data: SaveBlob = defaults();

  load(): SaveBlob {
    this.data = defaults();
    try {
      const current = localStorage.getItem(SAVE_KEY_V2);
      const legacy = current ? null : localStorage.getItem(LEGACY_SAVE_KEY);
      if (current || legacy) this.data = migrateSave(JSON.parse(current ?? legacy ?? '{}'));
      this.persist();
    } catch {
      this.data = defaults();
      this.persist();
    }
    return this.get();
  }

  get(): SaveBlob {
    return structuredClone(this.data);
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get profile(): CampaignProfile {
    return structuredClone(this.data.profile);
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = sanitizeSettings({ ...this.data.settings, ...patch });
    this.persist();
  }

  replaceProfile(profile: CampaignProfile): void {
    this.data.profile = sanitizeProfile(profile);
    this.persist();
  }

  updateProfile(update: (profile: CampaignProfile) => CampaignProfile): CampaignProfile {
    this.replaceProfile(update(this.profile));
    return this.profile;
  }

  resetCampaign(): CampaignProfile {
    this.data.profile = createStarterProfile();
    this.persist();
    return this.profile;
  }

  recordRun(score: number, timeSeconds: number, maxMultiplier: number): RecordRunResult {
    const cleanScore = sanitizeField(finiteNonnegative, score, 0);
    const cleanTime = sanitizeField(finiteNonnegative, timeSeconds, 0);
    const cleanMultiplier = sanitizeField(positiveMultiplier, maxMultiplier, 1);
    const result: RecordRunResult = {
      newHighScore: cleanScore > this.data.highScore,
      newBestTime: cleanTime > 0 && (this.data.bestTimeSeconds === 0 || cleanTime < this.data.bestTimeSeconds),
      newHighestMultiplier: cleanMultiplier > this.data.highestMultiplier,
    };
    if (result.newHighScore) this.data.highScore = cleanScore;
    if (result.newBestTime) this.data.bestTimeSeconds = cleanTime;
    if (result.newHighestMultiplier) this.data.highestMultiplier = cleanMultiplier;
    this.persist();
    return result;
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY_V2, JSON.stringify(this.data));
    } catch {
      /* storage disabled */
    }
  }
}

export const saveData = new SaveDataManager();
