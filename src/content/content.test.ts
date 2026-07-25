import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnemySchema } from '../schemas/enemySchema';
import { WeaponSchema } from '../schemas/weaponSchema';
import { ProjectilePatternSchema } from '../schemas/projectilePatternSchema';
import { MovementSchema } from '../schemas/movementSchema';
import { FormationSchema } from '../schemas/formationSchema';
import { PickupSchema } from '../schemas/pickupSchema';
import { EncounterSchema } from '../schemas/encounterSchema';
import { LevelSchema } from '../schemas/levelSchema';
import { BossSchema } from '../schemas/bossSchema';
import { DifficultySchema } from '../schemas/difficultySchema';
import { MusicCueSchema } from '../schemas/musicSchema';
import { EquipmentSchema } from '../schemas/equipmentSchema';
import type { z } from 'zod';

const CONTENT = dirname(fileURLToPath(import.meta.url));

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  enemies: EnemySchema,
  weapons: WeaponSchema,
  projectiles: ProjectilePatternSchema,
  movement: MovementSchema,
  formations: FormationSchema,
  pickups: PickupSchema,
  encounters: EncounterSchema,
  levels: LevelSchema,
  bosses: BossSchema,
  music: MusicCueSchema,
  equipment: EquipmentSchema,
};

/**
 * Content sanity test (CI guard). Every JSON file under src/content/ must
 * validate against the schema for its folder and its id must match its
 * filename. This is the headless version of the in-game error panel.
 */
describe('content validation', () => {
  for (const [folder, schema] of Object.entries(SCHEMAS)) {
    const dir = join(CONTENT, folder);
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f: string) => f.endsWith('.json'));
    } catch {
      // folder may not exist yet
    }
    for (const file of files) {
      it(`${folder}/${file} is valid`, () => {
        const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        const result = schema.safeParse(data);
        if (!result.success) {
          throw new Error(
            result.error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; '),
          );
        }
        expect(data.id).toBe(file.replace('.json', ''));
      });
    }
  }

  it('difficulty.json is valid', () => {
    const data = JSON.parse(readFileSync(join(CONTENT, 'difficulty.json'), 'utf8'));
    const result = DifficultySchema.safeParse(data);
    if (!result.success) {
      throw new Error(
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    expect(data.id).toBe('difficulty');
  });
});
