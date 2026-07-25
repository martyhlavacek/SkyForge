import { describe, expect, it, vi } from 'vitest';
import { MultiplierSystem } from './MultiplierSystem';

function make() {
  const bonus = vi.fn();
  const onChange = vi.fn();
  return { m: new MultiplierSystem(onChange, bonus), bonus };
}

describe('MultiplierSystem', () => {
  it('starts at tier 1', () => {
    const { m } = make();
    expect(m.tier).toBe(1);
  });

  it('advances a tier after 5 kills (meterPerKill 0.2)', () => {
    const { m } = make();
    for (let i = 0; i < 5; i++) m.registerKill(100);
    expect(m.tier).toBe(2);
  });

  it('multiplies score by the current tier', () => {
    const { m } = make();
    for (let i = 0; i < 5; i++) m.registerKill(100); // now tier 2
    expect(m.registerKill(100)).toBe(200);
  });

  it('drops a tier and clears meter on damage', () => {
    const { m } = make();
    for (let i = 0; i < 7; i++) m.registerKill(100); // tier 2, some meter
    m.registerDamage();
    expect(m.tier).toBe(1);
  });

  it('decays after the delay and drops tier at empty', () => {
    const { m } = make();
    for (let i = 0; i < 6; i++) m.registerKill(100); // tier 2
    // Advance past decayDelay (2.5s) then drain a full tier (meter/0.35).
    for (let i = 0; i < 400; i++) m.update(0.05);
    expect(m.tier).toBe(1);
  });

  it('restores the nearest visible tier for Studio transport', () => {
    const { m } = make();
    m.restoreTier(4);
    expect(m.tier).toBe(4);
    m.restoreTier(999);
    expect(m.tier).toBe(5);
    m.restoreTier(Number.NaN);
    expect(m.tier).toBe(1);
  });

  it('fires the group bonus on 3 kills within the window', () => {
    const { m, bonus } = make();
    m.registerKill(100);
    m.update(0.1);
    m.registerKill(100);
    m.update(0.1);
    m.registerKill(100); // 3 within 0.6s
    expect(bonus).toHaveBeenCalledWith(50); // tier 1 × 50
  });

  it('does NOT fire the group bonus when kills are spread out', () => {
    const { m, bonus } = make();
    m.registerKill(100);
    m.update(0.5);
    m.registerKill(100);
    m.update(0.5);
    m.registerKill(100); // > 0.6s apart
    expect(bonus).not.toHaveBeenCalled();
  });
});
