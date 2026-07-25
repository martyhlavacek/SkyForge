/**
 * Player tuning values (Sprint 1.1 / 1.2).
 * All player feel lives here — never inline these in entity code.
 */
export const PLAYER = {
  maxSpeed: 320, // px/s
  focusedSpeed: 160, // px/s while focus (Shift) held
  accel: 2400, // px/s^2 — high for crisp arcade feel
  drag: 2000, // px/s^2 deceleration when input released
  boundsPadding: 16, // min distance from screen edge
  hitboxRadius: 5, // Sprint 2.3 — much smaller than the 32px sprite
  maxHull: 3,
  invulnDuration: 1.0, // seconds of i-frames after damage
  blinkHz: 10, // i-frame blink rate
  shadowOffsetX: 10,
  shadowOffsetY: 14,
  shadowScaleX: 0.96,
  shadowScaleY: 0.64,
  shadowOpacity: 0.34,
} as const;
