import Phaser from 'phaser';
import { GAME_WIDTH, REGISTRY, SCENES } from '../config/constants';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';
import { saveData } from '../systems/SaveData';
import { audio } from '../systems/AudioManager';
import { equipmentRegistry } from '../equipment/EquipmentRegistry';
import { loadoutValidator } from '../equipment/LoadoutValidator';
import { shipStatCalculator, type DerivedShipStats } from '../equipment/ShipStatCalculator';
import { activeLoadout } from '../equipment/RuntimeLoadoutSnapshot';
import { EconomyService } from '../economy/EconomyService';
import type { EquipmentCategory, EquipmentDef } from '../../schemas/equipmentSchema';
import type { ShipLoadout } from '../../schemas/profileSchema';

const CATEGORIES: { id: EquipmentCategory; label: string }[] = [
  { id: 'hull', label: 'HULL' },
  { id: 'primaryWeapon', label: 'PRIMARY' },
  { id: 'secondaryWeapon', label: 'SECONDARY' },
  { id: 'propulsion', label: 'DRIVE' },
  { id: 'generator', label: 'CORE' },
  { id: 'shield', label: 'SHIELD' },
  { id: 'armor', label: 'ARMOR' },
  { id: 'utility', label: 'UTILITY' },
];

export class HangarScene extends Phaser.Scene {
  private categoryIndex = 0;
  private itemIndex = 0;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private categoryText!: Phaser.GameObjects.Text;
  private creditsText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() { super(SCENES.HANGAR); }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 34, 'SKYFORGE HANGAR', { fontFamily: 'monospace', fontSize: '28px', color: '#e8f0ff' }).setOrigin(0.5);
    this.creditsText = this.add.text(GAME_WIDTH - 18, 18, '', { fontFamily: 'monospace', fontSize: '16px', color: '#66dd99' }).setOrigin(1, 0);
    this.categoryText = this.add.text(cx, 86, '', { fontFamily: 'monospace', fontSize: '17px', color: '#ffdd55' }).setOrigin(0.5);
    this.add.text(54, 86, '[ ◀ ]', { fontFamily: 'monospace', fontSize: '18px', color: '#7ab0ff' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.moveCategory(-1));
    this.add.text(GAME_WIDTH - 54, 86, '[ ▶ ]', { fontFamily: 'monospace', fontSize: '18px', color: '#7ab0ff' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.moveCategory(1));
    this.add.rectangle(cx, 245, GAME_WIDTH - 32, 270, 0x111827, 0.92).setStrokeStyle(1, 0x334466);
    this.detailText = this.add.text(28, 385, '', { fontFamily: 'monospace', fontSize: '13px', color: '#d9e3ff', wordWrap: { width: GAME_WIDTH - 56 } });
    this.add.rectangle(cx, 625, GAME_WIDTH - 32, 250, 0x0d1422, 0.95).setStrokeStyle(1, 0x334466);
    this.statsText = this.add.text(28, 512, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9db4e6', lineSpacing: 3 });
    this.statusText = this.add.text(cx, 770, '', { fontFamily: 'monospace', fontSize: '13px', color: '#ffcc66', align: 'center', wordWrap: { width: GAME_WIDTH - 48 } }).setOrigin(0.5);
    this.actionText = this.add.text(cx, 825, '', { fontFamily: 'monospace', fontSize: '14px', color: '#7ab0ff', align: 'center' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.primaryAction());

    const launch = this.add.text(cx - 120, 900, '[ LAUNCH ]', { fontFamily: 'monospace', fontSize: '17px', color: '#66dd99' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.launch());
    const back = this.add.text(cx + 120, 900, '[ MENU ]', { fontFamily: 'monospace', fontSize: '17px', color: '#7ab0ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start(SCENES.MENU));
    void launch; void back;

    const kb = this.input.keyboard;
    kb?.on('keydown-UP', () => this.moveItem(-1));
    kb?.on('keydown-DOWN', () => this.moveItem(1));
    kb?.on('keydown-W', () => this.moveItem(-1));
    kb?.on('keydown-S', () => this.moveItem(1));
    kb?.on('keydown-LEFT', () => this.moveCategory(-1));
    kb?.on('keydown-RIGHT', () => this.moveCategory(1));
    kb?.on('keydown-A', () => this.moveCategory(-1));
    kb?.on('keydown-D', () => this.moveCategory(1));
    kb?.on('keydown-ENTER', () => this.primaryAction());
    kb?.on('keydown-SPACE', () => this.primaryAction());
    kb?.on('keydown-U', () => this.upgradeSelected());
    kb?.on('keydown-X', () => this.sellSelected());
    kb?.on('keydown-L', () => this.launch());
    kb?.on('keydown-G', () => this.debugGrant());
    kb?.on('keydown-ESC', () => this.scene.start(SCENES.MENU));
    this.refresh();
  }

  update(): void {
    const nav = this.gamepadNav.read(this);
    if (nav.up) this.moveItem(-1);
    if (nav.down) this.moveItem(1);
    if (nav.left) this.moveCategory(-1);
    if (nav.right) this.moveCategory(1);
    if (nav.confirm) this.primaryAction();
    if (nav.cancel) this.scene.start(SCENES.MENU);
  }

  private get category(): EquipmentCategory { return CATEGORIES[this.categoryIndex].id; }
  private get items(): EquipmentDef[] { return equipmentRegistry.byCategory(this.category); }
  private get selected(): EquipmentDef | undefined { return this.items[this.itemIndex]; }

  private moveCategory(delta: number): void {
    this.categoryIndex = Phaser.Math.Wrap(this.categoryIndex + delta, 0, CATEGORIES.length);
    this.itemIndex = 0;
    audio.play('uiMove');
    this.refresh();
  }

  private moveItem(delta: number): void {
    const count = this.items.length;
    if (!count) return;
    this.itemIndex = Phaser.Math.Wrap(this.itemIndex + delta, 0, count);
    audio.play('uiMove');
    this.refresh();
  }

  private refresh(message = ''): void {
    const profile = saveData.profile;
    const loadout = activeLoadout(profile);
    const selected = this.selected;
    this.creditsText.setText(`CREDITS ${profile.bankedCredits.toString().padStart(6, '0')}`);
    this.categoryText.setText(`◀  ${CATEGORIES[this.categoryIndex].label}  ▶`);
    this.itemTexts.forEach((text) => text.destroy());
    this.itemTexts = this.items.map((item, index) => {
      const owned = Boolean(profile.inventory.owned[item.id]);
      const equipped = this.isEquipped(loadout, item.id);
      const locked = !profile.unlockedEquipment.includes(item.id);
      const marker = index === this.itemIndex ? '▶' : ' ';
      const state = equipped ? '[EQUIPPED]' : owned ? '[OWNED]' : locked ? '[LOCKED]' : `${item.purchaseCost} CR`;
      return this.add.text(36, 130 + index * 48, `${marker} ${item.displayName.padEnd(23)} ${state}`, {
        fontFamily: 'monospace', fontSize: '14px', color: index === this.itemIndex ? '#ffffff' : locked ? '#566078' : '#9db4e6',
      }).setInteractive({ useHandCursor: true }).on('pointerover', () => { this.itemIndex = index; this.refresh(); }).on('pointerdown', () => { this.itemIndex = index; this.primaryAction(); });
    });

    if (!selected) return;
    const owned = profile.inventory.owned[selected.id];
    const upgrade = owned ? selected.upgradeLevels[owned.upgradeLevel] : undefined;
    const unlocked = profile.unlockedEquipment.includes(selected.id);
    this.detailText.setText([
      `${selected.displayName.toUpperCase()}  TIER ${selected.tier}`,
      selected.description,
      `Mass ${selected.mass.toFixed(1)}   Passive draw ${selected.passivePowerDraw.toFixed(1)}`,
      `Role: ${selected.roleTags.join(', ') || 'general'}`,
      owned ? `Upgrade level ${owned.upgradeLevel}/${selected.upgradeLevels.length}${upgrade ? ` — next ${upgrade.cost} CR` : ''}` : unlocked ? `Purchase ${selected.purchaseCost} CR` : 'Unlock by campaign progress',
    ].join('\n\n'));

    const currentStats = shipStatCalculator.calculate(loadout, profile);
    const candidateLoadout = this.withCandidate(loadout, selected);
    const structural = loadoutValidator.validate(candidateLoadout);
    const candidateStats: DerivedShipStats | null = (() => {
      try { return shipStatCalculator.calculate(candidateLoadout, profile); } catch { return null; }
    })();
    this.statsText.setText(this.formatComparison(currentStats, candidateStats, structural.errors.map((e) => e.message)));
    const equipped = this.isEquipped(loadout, selected.id);
    if (!unlocked) this.actionText.setText('LOCKED   |   L LAUNCH   ESC MENU');
    else if (!owned) this.actionText.setText('ENTER BUY   |   U UPGRADE   X SELL   L LAUNCH');
    else if (!equipped) this.actionText.setText('ENTER EQUIP   |   U UPGRADE   X SELL   L LAUNCH');
    else this.actionText.setText('EQUIPPED   |   U UPGRADE   X SELL   L LAUNCH');
    this.statusText.setText(message || (structural.valid ? 'LOADOUT READY' : structural.errors[0]?.message ?? 'INVALID LOADOUT'));
    this.statusText.setColor(structural.valid ? '#66dd99' : '#ff7766');
  }

  private primaryAction(): void {
    const item = this.selected;
    if (!item) return;
    const service = new EconomyService(saveData.profile);
    let result;
    if (!saveData.profile.inventory.owned[item.id]) {
      result = service.purchase(item.id);
      if (result.success) saveData.replaceProfile(result.profile);
      this.refresh(result.success ? `Purchased ${item.displayName}` : result.error?.message);
      audio.play(result.success ? 'purchase' : 'error');
      return;
    }
    result = service.equip(item.category, item.id, 0);
    if (result.success) saveData.replaceProfile(result.profile);
    this.refresh(result.success ? `Equipped ${item.displayName}` : result.error?.message);
    audio.play(result.success ? 'uiConfirm' : 'error');
  }

  private upgradeSelected(): void {
    const item = this.selected;
    if (!item) return;
    const service = new EconomyService(saveData.profile);
    const result = service.upgrade(item.id);
    if (result.success) saveData.replaceProfile(result.profile);
    this.refresh(result.success ? `Upgraded ${item.displayName}` : result.error?.message);
    audio.play(result.success ? 'upgrade' : 'error');
  }

  private sellSelected(): void {
    const item = this.selected;
    if (!item) return;
    const service = new EconomyService(saveData.profile);
    const result = service.sell(item.id);
    if (result.success) saveData.replaceProfile(result.profile);
    this.refresh(result.success ? `Sold ${item.displayName}` : result.error?.message);
    audio.play(result.success ? 'purchase' : 'error');
  }

  private launch(): void {
    const profile = saveData.profile;
    const validation = loadoutValidator.validate(activeLoadout(profile), profile);
    if (!validation.valid) { this.refresh(validation.errors[0]?.message); audio.play('error'); return; }
    const service = new EconomyService(profile);
    saveData.replaceProfile(service.markActiveLoadoutUsed());
    audio.play('uiConfirm');
    this.scene.start(SCENES.GAME);
  }


  private debugGrant(): void {
    if (!this.registry.get(REGISTRY.DEBUG_MODE)) return;
    const profile = saveData.profile;
    profile.bankedCredits += 10000;
    profile.unlockedEquipment = equipmentRegistry.all().map((item) => item.id).sort();
    saveData.replaceProfile(profile);
    audio.play('credit');
    this.refresh('DEBUG: granted 10,000 credits and unlocked all equipment');
  }

  private withCandidate(loadout: ShipLoadout, item: EquipmentDef): ShipLoadout {
    const next = structuredClone(loadout);
    switch (item.category) {
      case 'hull': next.hullId = item.id; break;
      case 'primaryWeapon': next.primaryWeaponId = item.id; break;
      case 'secondaryWeapon': next.secondaryWeaponId = item.id; break;
      case 'propulsion': next.propulsionId = item.id; break;
      case 'generator': next.generatorId = item.id; break;
      case 'shield': next.shieldId = item.id; break;
      case 'armor': next.armorId = item.id; break;
      case 'utility': next.utilityIds = [item.id]; break;
    }
    return next;
  }

  private isEquipped(loadout: ShipLoadout, id: string): boolean {
    return [loadout.hullId, loadout.primaryWeaponId, loadout.secondaryWeaponId, loadout.propulsionId, loadout.generatorId, loadout.shieldId, loadout.armorId, ...loadout.utilityIds].includes(id);
  }

  private formatComparison(current: DerivedShipStats, candidate: DerivedShipStats | null, errors: string[]): string {
    const rows: [string, number, number | undefined][] = [
      ['Armor', current.maxArmor, candidate?.maxArmor],
      ['Shield', current.maxShield, candidate?.maxShield],
      ['Shield regen', current.shieldRechargeRate, candidate?.shieldRechargeRate],
      ['Energy', current.maxEnergy, candidate?.maxEnergy],
      ['Energy regen', current.energyRegenPerSecond, candidate?.energyRegenPerSecond],
      ['Max speed', current.maxSpeed, candidate?.maxSpeed],
      ['Acceleration', current.acceleration, candidate?.acceleration],
      ['Mass', current.totalMass, candidate?.totalMass],
      ['Passive power', current.passivePowerDraw, candidate?.passivePowerDraw],
      ['Min corridor', current.minimumCorridorWidth, candidate?.minimumCorridorWidth],
    ];
    const lines = ['SHIP COMPARISON          CURRENT   CANDIDATE'];
    for (const [label, a, b] of rows) {
      const delta = b === undefined ? '' : b > a + .05 ? '▲' : b < a - .05 ? '▼' : '—';
      lines.push(`${label.padEnd(20)} ${a.toFixed(1).padStart(7)}   ${(b ?? 0).toFixed(1).padStart(7)} ${delta}`);
    }
    if (errors.length) lines.push('', `INVALID: ${errors[0]}`);
    return lines.join('\n');
  }
}
