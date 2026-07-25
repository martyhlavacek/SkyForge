export interface ShipEnergySnapshot {
  current: number;
  maximum: number;
  regenerationPerSecond: number;
}

export class ShipEnergySystem {
  private value: number;

  constructor(
    readonly maximum: number,
    readonly regenerationPerSecond: number,
    initial = maximum,
  ) {
    this.value = Math.max(0, Math.min(maximum, initial));
  }

  get current(): number {
    return this.value;
  }

  get fraction(): number {
    return this.maximum > 0 ? this.value / this.maximum : 0;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.value = Math.min(this.maximum, this.value + this.regenerationPerSecond * dt);
  }

  canSpend(amount: number): boolean {
    return amount <= 0 || this.value + 1e-9 >= amount;
  }

  spend(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) return true;
    if (!this.canSpend(amount)) return false;
    this.value = Math.max(0, this.value - amount);
    return true;
  }

  restore(amount: number): number {
    const before = this.value;
    this.value = Math.min(this.maximum, this.value + Math.max(0, amount));
    return this.value - before;
  }

  setCurrent(value: number): void {
    this.value = Math.max(0, Math.min(this.maximum, value));
  }

  snapshot(): ShipEnergySnapshot {
    return {
      current: this.value,
      maximum: this.maximum,
      regenerationPerSecond: this.regenerationPerSecond,
    };
  }
}
