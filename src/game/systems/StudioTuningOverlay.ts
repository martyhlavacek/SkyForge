import {
  TuningStudioPackageSchema,
  type TuningStudioPackage,
} from '../../schemas/studioPackageSchema';
import { contentRegistry } from './ContentRegistry';

interface RegistrySnapshot {
  enemies: TuningStudioPackage['payload']['enemies'];
  weapons: TuningStudioPackage['payload']['weapons'];
  projectilePatterns: TuningStudioPackage['payload']['projectilePatterns'];
  movementPatterns: TuningStudioPackage['payload']['movementPatterns'];
  formations: TuningStudioPackage['payload']['formations'];
  encounters: TuningStudioPackage['payload']['encounters'];
  bosses: TuningStudioPackage['payload']['bosses'];
  pickups: TuningStudioPackage['payload']['pickups'];
  equipment: TuningStudioPackage['payload']['equipment'];
  difficulty: TuningStudioPackage['payload']['difficulty'];
}

function snapshotRegistry(): RegistrySnapshot {
  if (!contentRegistry.difficulty) throw new Error('difficulty content is not loaded');
  return {
    enemies: [...contentRegistry.enemies.values()].map((value) => structuredClone(value)),
    weapons: [...contentRegistry.weapons.values()].map((value) => structuredClone(value)),
    projectilePatterns: [...contentRegistry.projectilePatterns.values()].map((value) => structuredClone(value)),
    movementPatterns: [...contentRegistry.movement.values()].map((value) => structuredClone(value)),
    formations: [...contentRegistry.formations.values()].map((value) => structuredClone(value)),
    encounters: [...contentRegistry.encounters.values()].map((value) => structuredClone(value)),
    bosses: [...contentRegistry.bosses.values()].map((value) => structuredClone(value)),
    pickups: [...contentRegistry.pickups.values()].map((value) => structuredClone(value)),
    equipment: [...contentRegistry.equipment.values()].map((value) => structuredClone(value)),
    difficulty: structuredClone(contentRegistry.difficulty),
  };
}

function replaceMap<T extends { id: string }>(target: Map<string, T>, values: T[]): void {
  target.clear();
  values.forEach((value) => target.set(value.id, structuredClone(value)));
}

/**
 * Transient, iframe-local tuning overlay for Studio simulation. Canonical
 * imported content remains untouched outside the embedded runtime process.
 */
class StudioTuningOverlay {
  private baseline: RegistrySnapshot | null = null;
  private activeFingerprint = 'built-in';

  get fingerprint(): string {
    return this.activeFingerprint;
  }

  apply(input: unknown): TuningStudioPackage {
    const pkg = TuningStudioPackageSchema.parse(input);
    if (!this.baseline) this.baseline = snapshotRegistry();
    this.applySnapshot({
      enemies: pkg.payload.enemies,
      weapons: pkg.payload.weapons,
      projectilePatterns: pkg.payload.projectilePatterns,
      movementPatterns: pkg.payload.movementPatterns,
      formations: pkg.payload.formations,
      encounters: pkg.payload.encounters,
      bosses: pkg.payload.bosses,
      pickups: pkg.payload.pickups,
      equipment: pkg.payload.equipment,
      difficulty: pkg.payload.difficulty,
    });
    this.activeFingerprint = `${pkg.manifest.id}@${pkg.manifest.version}:${pkg.manifest.updatedAt}`;
    return pkg;
  }

  restore(): void {
    if (!this.baseline) return;
    this.applySnapshot(this.baseline);
    this.activeFingerprint = 'built-in';
  }

  private applySnapshot(snapshot: RegistrySnapshot): void {
    replaceMap(contentRegistry.enemies, snapshot.enemies);
    replaceMap(contentRegistry.weapons, snapshot.weapons);
    replaceMap(contentRegistry.projectilePatterns, snapshot.projectilePatterns);
    replaceMap(contentRegistry.movement, snapshot.movementPatterns);
    replaceMap(contentRegistry.formations, snapshot.formations);
    replaceMap(contentRegistry.encounters, snapshot.encounters);
    replaceMap(contentRegistry.bosses, snapshot.bosses);
    replaceMap(contentRegistry.pickups, snapshot.pickups);
    replaceMap(contentRegistry.equipment, snapshot.equipment);
    contentRegistry.difficulty = structuredClone(snapshot.difficulty);
  }
}

export const studioTuningOverlay = new StudioTuningOverlay();
