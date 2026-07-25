export const MULTIPLIER_EVENTS = {
  CHANGED: 'multiplier:changed', // (tier: number, meter: number, decaying: boolean)
} as const;

const CONFIG = {
  meterPerKill: 0.2, // meter fill per kill (0..1 within a tier)
  decayDelay: 2.5, // s of no kills before the meter drains
  decayRate: 0.35, // meter/s drain once decaying
  tiers: [1, 2, 3, 4, 5], // multiplier per tier
  groupWindow: 0.6, // s window for the rapid-group bonus
  groupThreshold: 3, // kills within the window to trigger the bonus
} as const;

/**
 * Score multiplier (Sprint 5.5), PDR §18.
 * A meter 0..1 fills with kills; full advances a tier, empty drops a tier.
 * Taking damage clears the meter and drops one tier. Inactivity past
 * decayDelay drains the meter. All kill score is multiplied by the current
 * tier value. Rapid group destruction (3+ kills in 0.6s) grants a flat
 * bonus reported via onGroupBonus.
 */
export class MultiplierSystem {
  private tierIndex = 0; // 0-based into CONFIG.tiers
  private meter = 0; // 0..1 within current tier
  private sinceKill = 0;
  private killTimes: number[] = [];
  private clock = 0;

  constructor(
    /** Emit (tier, meter, decaying) for the HUD. */
    private readonly onChange: (tier: number, meter: number, decaying: boolean) => void,
    private readonly onGroupBonus: (bonus: number) => void,
  ) {}

  get tier(): number {
    return CONFIG.tiers[this.tierIndex];
  }

  reset(): void {
    this.tierIndex = 0;
    this.meter = 0;
    this.sinceKill = 0;
    this.killTimes = [];
    this.clock = 0;
    this.emit(false);
  }

  /** Studio/checkpoint reconstruction of the visible multiplier tier. */
  restoreTier(tier: number): void {
    const target = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1;
    let nearest = 0;
    for (let i = 0; i < CONFIG.tiers.length; i++) {
      if (Math.abs(CONFIG.tiers[i] - target) < Math.abs(CONFIG.tiers[nearest] - target))
        nearest = i;
    }
    this.tierIndex = nearest;
    this.meter = 0;
    this.sinceKill = 0;
    this.killTimes = [];
    this.emit(false);
  }

  /** Register a kill; returns the score to award (base × current tier). */
  registerKill(baseScore: number): number {
    this.sinceKill = 0;

    this.meter += CONFIG.meterPerKill;
    if (this.meter >= 1 && this.tierIndex < CONFIG.tiers.length - 1) {
      this.meter -= 1;
      this.tierIndex++;
    } else if (this.meter >= 1) {
      this.meter = 1; // capped at top tier
    }

    // Rapid-group bonus (PDR "bonus for rapid group destruction").
    this.killTimes.push(this.clock);
    this.killTimes = this.killTimes.filter((t) => this.clock - t <= CONFIG.groupWindow);
    if (this.killTimes.length === CONFIG.groupThreshold) {
      this.onGroupBonus(this.tier * 50);
    }

    this.emit(false);
    return baseScore * this.tier;
  }

  /** Taking damage clears the meter and drops one tier. */
  registerDamage(): void {
    this.meter = 0;
    if (this.tierIndex > 0) this.tierIndex--;
    this.emit(false);
  }

  update(dt: number): void {
    this.clock += dt;
    this.sinceKill += dt;

    if (this.sinceKill > CONFIG.decayDelay && (this.meter > 0 || this.tierIndex > 0)) {
      this.meter -= CONFIG.decayRate * dt;
      if (this.meter < 0) {
        if (this.tierIndex > 0) {
          this.tierIndex--;
          this.meter = 1 + this.meter; // carry the negative remainder down
        } else {
          this.meter = 0;
        }
      }
      this.emit(true);
    }
  }

  private emit(decaying: boolean): void {
    this.onChange(this.tier, this.meter, decaying);
  }
}
