import type { ShipEnergySystem } from './ShipEnergySystem';

export interface ShipDefenseConfig {
  maxArmor: number;
  maxShield: number;
  shieldRechargeDelay: number;
  shieldRechargeRate: number;
  shieldRechargeEnergyPerPoint: number;
}

export interface DamageResult {
  shieldDamage: number;
  armorDamage: number;
  destroyed: boolean;
}

export interface ShipDefenseSnapshot {
  armor: number;
  maxArmor: number;
  shield: number;
  maxShield: number;
  rechargeDelayRemaining: number;
}

export class ShipDefenseSystem {
  private armorValue: number;
  private shieldValue: number;
  private rechargeDelayRemaining = 0;

  constructor(private readonly config: ShipDefenseConfig) {
    this.armorValue = config.maxArmor;
    this.shieldValue = config.maxShield;
  }

  get armor(): number { return this.armorValue; }
  get shield(): number { return this.shieldValue; }
  get maxArmor(): number { return this.config.maxArmor; }
  get maxShield(): number { return this.config.maxShield; }

  setArmor(value: number): void {
    this.armorValue = Math.max(0, Math.min(this.maxArmor, value));
  }

  takeDamage(amount: number): DamageResult {
    const clean = Math.max(0, Number.isFinite(amount) ? amount : 0);
    this.rechargeDelayRemaining = this.config.shieldRechargeDelay;
    const shieldDamage = Math.min(this.shieldValue, clean);
    this.shieldValue -= shieldDamage;
    const armorDamage = Math.min(this.armorValue, clean - shieldDamage);
    this.armorValue -= armorDamage;
    return { shieldDamage, armorDamage, destroyed: this.armorValue <= 0 };
  }

  update(dt: number, energy: ShipEnergySystem): number {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    const rechargeDt =
      this.rechargeDelayRemaining > 0
        ? Math.max(0, dt - this.rechargeDelayRemaining)
        : dt;
    this.rechargeDelayRemaining = Math.max(0, this.rechargeDelayRemaining - dt);
    if (
      rechargeDt <= 0 ||
      this.shieldValue >= this.maxShield ||
      this.config.shieldRechargeRate <= 0
    ) return 0;
    const desired = Math.min(
      this.maxShield - this.shieldValue,
      this.config.shieldRechargeRate * rechargeDt,
    );
    const costPerPoint = this.config.shieldRechargeEnergyPerPoint;
    const affordable = costPerPoint > 0 ? Math.min(desired, energy.current / costPerPoint) : desired;
    if (affordable <= 0) return 0;
    if (!energy.spend(affordable * costPerPoint)) return 0;
    this.shieldValue = Math.min(this.maxShield, this.shieldValue + affordable);
    return affordable;
  }

  restoreShield(amount: number): number {
    const before = this.shieldValue;
    this.shieldValue = Math.min(this.maxShield, this.shieldValue + Math.max(0, amount));
    return this.shieldValue - before;
  }

  repairArmor(amount: number): number {
    const before = this.armorValue;
    this.armorValue = Math.min(this.maxArmor, this.armorValue + Math.max(0, amount));
    return this.armorValue - before;
  }

  restore(snapshot: Pick<ShipDefenseSnapshot, 'armor' | 'shield' | 'rechargeDelayRemaining'>): void {
    this.armorValue = Math.max(0, Math.min(this.maxArmor, snapshot.armor));
    this.shieldValue = Math.max(0, Math.min(this.maxShield, snapshot.shield));
    this.rechargeDelayRemaining = Math.max(0, snapshot.rechargeDelayRemaining);
  }

  snapshot(): ShipDefenseSnapshot {
    return {
      armor: this.armorValue,
      maxArmor: this.maxArmor,
      shield: this.shieldValue,
      maxShield: this.maxShield,
      rechargeDelayRemaining: this.rechargeDelayRemaining,
    };
  }
}
