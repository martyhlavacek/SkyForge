import { z } from 'zod';
import { EnemySchema, type EnemyDef } from '../../schemas/enemySchema';
import { WeaponSchema, type WeaponDef } from '../../schemas/weaponSchema';
import {
  ProjectilePatternSchema,
  type ProjectilePatternDef,
} from '../../schemas/projectilePatternSchema';
import { MovementSchema, type MovementDef } from '../../schemas/movementSchema';
import { FormationSchema, type FormationDef } from '../../schemas/formationSchema';
import { PickupSchema, type PickupDef } from '../../schemas/pickupSchema';
import { EncounterSchema, type EncounterDef } from '../../schemas/encounterSchema';
import { LevelSchema, type LevelDef } from '../../schemas/levelSchema';
import { BossSchema, type BossDef } from '../../schemas/bossSchema';
import { DifficultySchema, type DifficultyDef } from '../../schemas/difficultySchema';
import { MusicCueSchema, type MusicCueDef } from '../../schemas/musicSchema';
import { EquipmentSchema, type EquipmentDef } from '../../schemas/equipmentSchema';
import type { ValidationError } from '../../schemas/validation';
import {
  BiomeSchema,
  LevelPackageSchema,
  RouteSetSchema,
  TerrainCollisionSchema,
  TerrainMapSchema,
  TerrainObjectSetSchema,
  type BiomeDef,
  type LevelPackageDef,
  type RouteSetDef,
  type TerrainCollisionDef,
  type TerrainMapDef,
  type TerrainObjectSetDef,
} from '../../schemas/terrainSchema';

/**
 * ContentRegistry (Sprint 3.1).
 * Eagerly loads every JSON file under src/content/, validates it against
 * the schema for its folder, and cross-checks references. The game must
 * fail LOUDLY: errors are collected and rendered on-screen in dev
 * (GameScene error panel) rather than silently crashing.
 */
class ContentRegistry {
  readonly enemies = new Map<string, EnemyDef>();
  readonly weapons = new Map<string, WeaponDef>();
  readonly projectilePatterns = new Map<string, ProjectilePatternDef>();
  readonly movement = new Map<string, MovementDef>();
  readonly formations = new Map<string, FormationDef>();
  readonly pickups = new Map<string, PickupDef>();
  readonly encounters = new Map<string, EncounterDef>();
  readonly levels = new Map<string, LevelDef>();
  readonly bosses = new Map<string, BossDef>();
  readonly music = new Map<string, MusicCueDef>();
  readonly equipment = new Map<string, EquipmentDef>();
  readonly terrainMaps = new Map<string, TerrainMapDef>();
  readonly terrainCollisions = new Map<string, TerrainCollisionDef>();
  readonly routeSets = new Map<string, RouteSetDef>();
  readonly terrainObjects = new Map<string, TerrainObjectSetDef>();
  readonly biomes = new Map<string, BiomeDef>();
  readonly levelPackages = new Map<string, LevelPackageDef>();
  difficulty: DifficultyDef | null = null;
  readonly errors: ValidationError[] = [];

  load(): void {
    const modules = import.meta.glob('/src/content/**/*.json', { eager: true }) as Record<
      string,
      { default: unknown }
    >;

    for (const [path, mod] of Object.entries(modules)) {
      const rest = path.split('/content/')[1] ?? '';
      const parts = rest.split('/');
      const folder = parts.length > 1 ? parts[0] : '';
      const data = mod.default;

      // Top-level singletons (no folder).
      if (folder === '') {
        if (parts[0] === 'difficulty.json') {
          const result = DifficultySchema.safeParse(data);
          if (result.success) this.difficulty = result.data;
          else
            result.error.issues.forEach((i) =>
              this.errors.push({
                file: path,
                message: `${i.path.join('.')}: ${i.message}`,
              }),
            );
        }
        continue;
      }

      switch (folder) {
        case 'enemies':
          this.parseInto(path, data, EnemySchema, this.enemies);
          break;
        case 'weapons':
          this.parseInto(path, data, WeaponSchema, this.weapons);
          break;
        case 'projectiles':
          this.parseInto(path, data, ProjectilePatternSchema, this.projectilePatterns);
          break;
        case 'movement':
          this.parseInto(path, data, MovementSchema, this.movement);
          break;
        case 'formations':
          this.parseInto(path, data, FormationSchema, this.formations);
          break;
        case 'pickups':
          this.parseInto(path, data, PickupSchema, this.pickups);
          break;
        case 'encounters':
          this.parseInto(path, data, EncounterSchema, this.encounters);
          break;
        case 'levels':
          this.parseInto(path, data, LevelSchema, this.levels);
          break;
        case 'bosses':
          this.parseInto(path, data, BossSchema, this.bosses);
          break;
        case 'music':
          this.parseInto(path, data, MusicCueSchema, this.music);
          break;
        case 'equipment':
          this.parseInto(path, data, EquipmentSchema, this.equipment);
          break;
        case 'maps':
          this.parseInto(path, data, TerrainMapSchema, this.terrainMaps);
          break;
        case 'collision':
          this.parseInto(path, data, TerrainCollisionSchema, this.terrainCollisions);
          break;
        case 'routes':
          this.parseInto(path, data, RouteSetSchema, this.routeSets);
          break;
        case 'terrainObjects':
          this.parseInto(path, data, TerrainObjectSetSchema, this.terrainObjects);
          break;
        case 'biomes':
          this.parseInto(path, data, BiomeSchema, this.biomes);
          break;
        case 'levelPackages':
          this.parseInto(path, data, LevelPackageSchema, this.levelPackages);
          break;
        default:
          this.errors.push({ file: path, message: `unknown content folder "${folder}"` });
          break;
      }
    }

    this.checkReferences();
  }

  private parseInto<T extends { id: string }>(
    file: string,
    data: unknown,
    schema: z.ZodType<T>,
    target: Map<string, T>,
  ): void {
    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        this.errors.push({
          file,
          message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        });
      }
      return;
    }
    const def = result.data;
    const expectedId = file.split('/').pop()?.replace('.json', '');
    if (def.id !== expectedId) {
      this.errors.push({
        file,
        message: `id "${def.id}" must match filename "${expectedId}"`,
      });
    }
    if (target.has(def.id)) {
      this.errors.push({ file, message: `duplicate id "${def.id}"` });
      return;
    }
    target.set(def.id, def);
  }

  /** Cross-file reference checking (PDR §33; extended per-folder in S4.1). */
  private checkReferences(): void {
    for (const [id, enemy] of this.enemies) {
      if (!this.movement.has(enemy.movementPattern)) {
        this.errors.push({
          file: `enemies/${id}.json`,
          message: `movementPattern "${enemy.movementPattern}" not found`,
        });
      }
      if (enemy.weaponPattern !== null) {
        const ids = Array.isArray(enemy.weaponPattern)
          ? enemy.weaponPattern
          : [enemy.weaponPattern];
        for (const pid of ids) {
          if (!this.projectilePatterns.has(pid)) {
            this.errors.push({
              file: `enemies/${id}.json`,
              message: `weaponPattern "${pid}" not found`,
            });
          }
        }
      }
      for (const drop of enemy.drops) {
        if (!this.pickups.has(drop.pickup)) {
          this.errors.push({
            file: `enemies/${id}.json`,
            message: `drop pickup "${drop.pickup}" not found`,
          });
        }
      }
    }

    // Formations (Sprint 4.1): member enemy + movement ids must exist.
    for (const [id, f] of this.formations) {
      if (!this.movement.has(f.movement)) {
        this.errors.push({
          file: `formations/${id}.json`,
          message: `movement "${f.movement}" not found`,
        });
      }
      f.members.forEach((m, i) => {
        if (!this.enemies.has(m.enemy)) {
          this.errors.push({
            file: `formations/${id}.json`,
            message: `members[${i}].enemy "${m.enemy}" not found`,
          });
        }
        if (m.movementOverride && !this.movement.has(m.movementOverride)) {
          this.errors.push({
            file: `formations/${id}.json`,
            message: `members[${i}].movementOverride "${m.movementOverride}" not found`,
          });
        }
      });
    }

    // Encounters (Sprint 4.3): event references must exist.
    for (const [id, enc] of this.encounters) {
      enc.events.forEach((ev, i) => {
        if (ev.type === 'spawnFormation' && !this.formations.has(ev.formation)) {
          this.errors.push({
            file: `encounters/${id}.json`,
            message: `events[${i}].formation "${ev.formation}" not found`,
          });
        }
        if (ev.type === 'spawnEnemy' && !this.enemies.has(ev.enemy)) {
          this.errors.push({
            file: `encounters/${id}.json`,
            message: `events[${i}].enemy "${ev.enemy}" not found`,
          });
        }
        if (ev.type === 'spawnPickup' && !this.pickups.has(ev.pickup)) {
          this.errors.push({
            file: `encounters/${id}.json`,
            message: `events[${i}].pickup "${ev.pickup}" not found`,
          });
        }
      });
      if (enc.completion.type === 'flag' && !enc.completion.flag) {
        this.errors.push({
          file: `encounters/${id}.json`,
          message: `completion.type "flag" requires a flag name`,
        });
      }
    }

    // Bosses (Sprint 6.1): phase movement + all weapon/part patterns exist.
    for (const [id, boss] of this.bosses) {
      boss.phases.forEach((ph, pi) => {
        if (!this.movement.has(ph.movement)) {
          this.errors.push({
            file: `bosses/${id}.json`,
            message: `phases[${pi}].movement "${ph.movement}" not found`,
          });
        }
        ph.weaponPatterns.forEach((wp, wi) => {
          if (!this.projectilePatterns.has(wp)) {
            this.errors.push({
              file: `bosses/${id}.json`,
              message: `phases[${pi}].weaponPatterns[${wi}] "${wp}" not found`,
            });
          }
        });
        ph.parts.forEach((part, pti) => {
          if (part.weaponPattern && !this.projectilePatterns.has(part.weaponPattern)) {
            this.errors.push({
              file: `bosses/${id}.json`,
              message: `phases[${pi}].parts[${pti}].weaponPattern "${part.weaponPattern}" not found`,
            });
          }
        });
      });
    }

    // Equipment: combat weapon definitions and unlock references must exist.
    for (const [id, item] of this.equipment) {
      if (item.category === 'primaryWeapon' || item.category === 'secondaryWeapon') {
        if (!this.weapons.has(item.weaponDefId)) {
          this.errors.push({
            file: `equipment/${id}.json`,
            message: `weaponDefId "${item.weaponDefId}" not found`,
          });
        }
      }
      if (
        item.unlockRequirement?.type === 'bossDefeated' &&
        !this.bosses.has(item.unlockRequirement.bossId)
      ) {
        this.errors.push({
          file: `equipment/${id}.json`,
          message: `unlock boss "${item.unlockRequirement.bossId}" not found`,
        });
      }
      if (
        item.unlockRequirement?.type === 'missionComplete' &&
        !this.levels.has(item.unlockRequirement.missionId)
      ) {
        this.errors.push({
          file: `equipment/${id}.json`,
          message: `unlock mission "${item.unlockRequirement.missionId}" not found`,
        });
      }
    }

    // Levels: encounter and music refs + unique ground ids.
    for (const [id, level] of this.levels) {
      if (!this.music.has(level.music)) {
        this.errors.push({
          file: `levels/${id}.json`,
          message: `music cue "${level.music}" not found`,
        });
      }
      level.events.forEach((ev, i) => {
        if ('encounter' in ev && !this.encounters.has(ev.encounter)) {
          this.errors.push({
            file: `levels/${id}.json`,
            message: `events[${i}].encounter "${ev.encounter}" not found`,
          });
        }
        if ('type' in ev && ev.type === 'terrainState') {
          const pkg = level.levelPackage
            ? this.levelPackages.get(level.levelPackage)
            : undefined;
          const objectSet = pkg ? this.terrainObjects.get(pkg.objectSetId) : undefined;
          if (!objectSet?.objects.some((object) => object.id === ev.target)) {
            this.errors.push({
              file: `levels/${id}.json`,
              message: `events[${i}].target "${ev.target}" not found in level terrain objects`,
            });
          }
        }
      });
      if (level.levelPackage && !this.levelPackages.has(level.levelPackage)) {
        this.errors.push({
          file: `levels/${id}.json`,
          message: `levelPackage "${level.levelPackage}" not found`,
        });
      }
      const seen = new Set<string>();
      for (const g of level.groundObjects) {
        if (seen.has(g.id)) {
          this.errors.push({
            file: `levels/${id}.json`,
            message: `duplicate groundObject id "${g.id}"`,
          });
        }
        seen.add(g.id);
      }
    }

    for (const [id, pkg] of this.levelPackages) {
      const file = `levelPackages/${id}.json`;
      if (!this.levels.has(pkg.levelId))
        this.errors.push({ file, message: `levelId "${pkg.levelId}" not found` });
      if (!this.terrainMaps.has(pkg.mapId))
        this.errors.push({ file, message: `mapId "${pkg.mapId}" not found` });
      if (!this.terrainCollisions.has(pkg.collisionId))
        this.errors.push({ file, message: `collisionId "${pkg.collisionId}" not found` });
      if (!this.routeSets.has(pkg.routeSetId))
        this.errors.push({ file, message: `routeSetId "${pkg.routeSetId}" not found` });
      if (!this.terrainObjects.has(pkg.objectSetId))
        this.errors.push({ file, message: `objectSetId "${pkg.objectSetId}" not found` });
      if (!this.biomes.has(pkg.biomeId))
        this.errors.push({ file, message: `biomeId "${pkg.biomeId}" not found` });
      const map = this.terrainMaps.get(pkg.mapId);
      const collision = this.terrainCollisions.get(pkg.collisionId);
      const routes = this.routeSets.get(pkg.routeSetId);
      const objects = this.terrainObjects.get(pkg.objectSetId);
      const biome = this.biomes.get(pkg.biomeId);
      if (map && biome) {
        const tiles = new Set(biome.materials.map((material) => material.tile));
        map.layers.forEach((layer, layerIndex) => {
          layer.cells.forEach((cell, cellIndex) => {
            if (!tiles.has(cell.tile)) {
              this.errors.push({
                file,
                message: `map layer ${layerIndex} cell ${cellIndex} references unknown tile ${cell.tile}`,
              });
            }
          });
        });
      }
      if (map && map.biomeId !== pkg.biomeId)
        this.errors.push({
          file,
          message: `map biomeId "${map.biomeId}" differs from package biomeId`,
        });
      if (collision && collision.mapId !== pkg.mapId)
        this.errors.push({
          file,
          message: `collision mapId "${collision.mapId}" differs from package mapId`,
        });
      if (routes && routes.mapId !== pkg.mapId)
        this.errors.push({
          file,
          message: `route set mapId "${routes.mapId}" differs from package mapId`,
        });
      if (objects && objects.mapId !== pkg.mapId)
        this.errors.push({
          file,
          message: `object set mapId "${objects.mapId}" differs from package mapId`,
        });
    }
  }
}

/** Singleton, loaded once at first import (BootScene guarantees ordering). */
export const contentRegistry = new ContentRegistry();
contentRegistry.load();
