import type { TuningStudioPackage } from '../../schemas/studioPackageSchema';

export type TunableCategory =
  'enemy' | 'difficulty' | 'projectile' | 'movement' | 'weapon' | 'boss' | 'encounter';

export interface TunableParameterDefinition {
  id: string;
  category: TunableCategory;
  ownerId: string;
  label: string;
  path: string;
  minimum: number;
  maximum: number;
  step: number;
  unit?: string;
  hotReloadable: boolean;
  value: number;
}

function numeric(
  category: TunableCategory,
  ownerId: string,
  label: string,
  path: string,
  value: number,
  minimum: number,
  maximum: number,
  step: number,
  unit?: string,
): TunableParameterDefinition {
  return {
    id: `${category}:${ownerId}:${path}`,
    category,
    ownerId,
    label,
    path,
    minimum,
    maximum,
    step,
    unit,
    hotReloadable: true,
    value,
  };
}

export function buildTunableParameterCatalog(
  pkg: TuningStudioPackage,
): TunableParameterDefinition[] {
  const result: TunableParameterDefinition[] = [];
  pkg.payload.enemies.forEach((enemy, index) => {
    const base = `/payload/enemies/${index}`;
    result.push(
      numeric(
        'enemy',
        enemy.id,
        'Health',
        `${base}/health`,
        enemy.health,
        1,
        5000,
        1,
        'HP',
      ),
      numeric(
        'enemy',
        enemy.id,
        'Collision damage',
        `${base}/collisionDamage`,
        enemy.collisionDamage,
        0,
        100,
        1,
        'damage',
      ),
      numeric(
        'enemy',
        enemy.id,
        'Score reward',
        `${base}/scoreValue`,
        enemy.scoreValue,
        0,
        100000,
        10,
        'score',
      ),
      numeric(
        'enemy',
        enemy.id,
        'Credit reward',
        `${base}/creditValue`,
        enemy.creditValue,
        0,
        10000,
        1,
        'credits',
      ),
      numeric(
        'enemy',
        enemy.id,
        'Hitbox radius',
        `${base}/hitbox/radius`,
        enemy.hitbox.radius,
        2,
        100,
        1,
        'px',
      ),
    );
  });
  (['easy', 'normal', 'hard'] as const).forEach((name) => {
    const modifiers = pkg.payload.difficulty.levels[name];
    const base = `/payload/difficulty/levels/${name}`;
    result.push(
      numeric(
        'difficulty',
        name,
        'Enemy health multiplier',
        `${base}/enemyHealthMultiplier`,
        modifiers.enemyHealthMultiplier,
        0.1,
        5,
        0.05,
        '×',
      ),
      numeric(
        'difficulty',
        name,
        'Projectile speed multiplier',
        `${base}/projectileSpeedMultiplier`,
        modifiers.projectileSpeedMultiplier,
        0.1,
        5,
        0.05,
        '×',
      ),
      numeric(
        'difficulty',
        name,
        'Spawn delay multiplier',
        `${base}/spawnDelayMultiplier`,
        modifiers.spawnDelayMultiplier,
        0.1,
        5,
        0.05,
        '×',
      ),
    );
  });
  pkg.payload.projectilePatterns.forEach((pattern, index) => {
    const base = `/payload/projectilePatterns/${index}`;
    result.push(
      numeric(
        'projectile',
        pattern.id,
        'Projectile speed',
        `${base}/speed`,
        pattern.speed,
        0,
        1200,
        5,
        'px/s',
      ),
      numeric(
        'projectile',
        pattern.id,
        'Cooldown',
        `${base}/cooldown`,
        pattern.cooldown,
        0.03,
        10,
        0.01,
        's',
      ),
      numeric(
        'projectile',
        pattern.id,
        'First-shot delay',
        `${base}/firstShotDelay`,
        pattern.firstShotDelay,
        0,
        10,
        0.05,
        's',
      ),
      numeric(
        'projectile',
        pattern.id,
        'Damage',
        `${base}/damage`,
        pattern.damage,
        0,
        100,
        1,
        'damage',
      ),
      numeric(
        'projectile',
        pattern.id,
        'Lifetime',
        `${base}/lifetime`,
        pattern.lifetime,
        0.1,
        30,
        0.1,
        's',
      ),
    );
  });
  pkg.payload.movementPatterns.forEach((movement, index) => {
    const base = `/payload/movementPatterns/${index}`;
    const push = (
      label: string,
      field: string,
      value: number,
      min: number,
      max: number,
      step: number,
      unit?: string,
    ) =>
      result.push(
        numeric(
          'movement',
          movement.id,
          label,
          `${base}/${field}`,
          value,
          min,
          max,
          step,
          unit,
        ),
      );
    switch (movement.type) {
      case 'straight':
        push('Speed', 'speed', movement.speed, 0, 800, 5, 'px/s');
        break;
      case 'sine':
        push(
          'Vertical speed',
          'verticalSpeed',
          movement.verticalSpeed,
          -800,
          800,
          5,
          'px/s',
        );
        push(
          'Amplitude',
          'horizontalAmplitude',
          movement.horizontalAmplitude,
          0,
          400,
          2,
          'px',
        );
        push('Frequency', 'frequency', movement.frequency, 0.05, 8, 0.05, 'Hz');
        break;
      case 'sweep':
        push('Speed', 'speed', movement.speed, 1, 900, 5, 'px/s');
        break;
      case 'patrol':
        push(
          'Horizontal speed',
          'horizontalSpeed',
          movement.horizontalSpeed,
          1,
          900,
          5,
          'px/s',
        );
        push('Entry speed', 'entrySpeed', movement.entrySpeed, 1, 900, 5, 'px/s');
        break;
      case 'bezier':
        push('Duration', 'duration', movement.duration, 0.1, 30, 0.1, 's');
        break;
      case 'dive_retreat':
        push('Dive speed', 'diveSpeed', movement.diveSpeed, 1, 1200, 5, 'px/s');
        push('Pause duration', 'pauseDuration', movement.pauseDuration, 0, 10, 0.05, 's');
        push('Retreat speed', 'retreatSpeed', movement.retreatSpeed, 1, 1200, 5, 'px/s');
        break;
      case 'stop_and_fire':
        push('Entry speed', 'entrySpeed', movement.entrySpeed, 1, 900, 5, 'px/s');
        push('Hold duration', 'holdDuration', movement.holdDuration, 0.1, 30, 0.1, 's');
        push('Exit speed', 'exitSpeed', movement.exitSpeed, 1, 1200, 5, 'px/s');
        push(
          'Hold fire multiplier',
          'holdFireRateMultiplier',
          movement.holdFireRateMultiplier,
          0.05,
          3,
          0.05,
          '×',
        );
        break;
      case 'enter_attack_exit':
        push('Entry speed', 'enter/speed', movement.enter.speed, 1, 1200, 5, 'px/s');
        push('Hold duration', 'holdDuration', movement.holdDuration, 0.1, 30, 0.1, 's');
        push('Exit speed', 'exit/speed', movement.exit.speed, 1, 1200, 5, 'px/s');
        break;
    }
  });
  pkg.payload.weapons.forEach((weapon, weaponIndex) => {
    weapon.levels.forEach((level, levelIndex) => {
      const owner = `${weapon.id}:L${levelIndex + 1}`;
      const base = `/payload/weapons/${weaponIndex}/levels/${levelIndex}`;
      result.push(
        numeric(
          'weapon',
          owner,
          'Damage',
          `${base}/damage`,
          level.damage,
          0,
          1000,
          1,
          'damage',
        ),
        numeric(
          'weapon',
          owner,
          'Fire interval',
          `${base}/fireInterval`,
          level.fireInterval,
          0.02,
          5,
          0.01,
          's',
        ),
        numeric(
          'weapon',
          owner,
          'Projectile speed',
          `${base}/projectileSpeed`,
          level.projectileSpeed,
          1,
          2000,
          5,
          'px/s',
        ),
      );
    });
  });
  pkg.payload.bosses.forEach((boss, index) => {
    const base = `/payload/bosses/${index}`;
    result.push(
      numeric(
        'boss',
        boss.id,
        'Total health',
        `${base}/totalHealth`,
        boss.totalHealth,
        1,
        100000,
        10,
        'HP',
      ),
      numeric(
        'boss',
        boss.id,
        'Credit reward',
        `${base}/creditValue`,
        boss.creditValue,
        0,
        100000,
        10,
        'credits',
      ),
      numeric(
        'boss',
        boss.id,
        'Hitbox radius',
        `${base}/hitboxRadius`,
        boss.hitboxRadius,
        4,
        250,
        1,
        'px',
      ),
    );
  });
  pkg.payload.encounters.forEach((encounter, index) => {
    const base = `/payload/encounters/${index}`;
    result.push(
      numeric(
        'encounter',
        encounter.id,
        'Estimated duration',
        `${base}/estimatedDuration`,
        encounter.estimatedDuration,
        0.1,
        300,
        0.5,
        's',
      ),
      numeric(
        'encounter',
        encounter.id,
        'Difficulty',
        `${base}/difficulty`,
        encounter.difficulty,
        1,
        5,
        1,
        'tier',
      ),
    );
  });
  return result;
}

function parsePath(path: string): (string | number)[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function setTunableValue(
  pkg: TuningStudioPackage,
  path: string,
  value: number,
): TuningStudioPackage {
  const next = structuredClone(pkg) as unknown as Record<string, unknown>;
  const segments = parsePath(path);
  let current: unknown = next;
  for (let index = 0; index < segments.length - 1; index++) {
    const key = segments[index];
    if (typeof current !== 'object' || current === null)
      throw new Error(`invalid tuning path ${path}`);
    current = (current as Record<string | number, unknown>)[key];
  }
  const last = segments.at(-1);
  if (last === undefined || typeof current !== 'object' || current === null)
    throw new Error(`invalid tuning path ${path}`);
  (current as Record<string | number, unknown>)[last] = value;
  (next as unknown as TuningStudioPackage).manifest.updatedAt = new Date().toISOString();
  return next as unknown as TuningStudioPackage;
}
