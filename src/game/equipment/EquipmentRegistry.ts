import { contentRegistry } from '../systems/ContentRegistry';
import type { EquipmentCategory, EquipmentDef } from '../../schemas/equipmentSchema';

/** Read-only facade so profile/economy code does not depend on registry internals. */
export class EquipmentRegistry {
  get(id: string): EquipmentDef | undefined {
    return contentRegistry.equipment.get(id);
  }

  all(): EquipmentDef[] {
    return [...contentRegistry.equipment.values()].sort((a, b) =>
      a.category.localeCompare(b.category) || a.tier - b.tier || a.displayName.localeCompare(b.displayName),
    );
  }

  byCategory(category: EquipmentCategory): EquipmentDef[] {
    return this.all().filter((item) => item.category === category);
  }
}

export const equipmentRegistry = new EquipmentRegistry();
