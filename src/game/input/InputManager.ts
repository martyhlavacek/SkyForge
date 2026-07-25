import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

export interface InputState {
  moveX: number;
  moveY: number;
  firePrimary: boolean;
  fireSecondary: boolean;
  special: boolean;
  focus: boolean;
  pause: boolean;
}

const NEUTRAL: InputState = {
  moveX: 0,
  moveY: 0,
  firePrimary: false,
  fireSecondary: false,
  special: false,
  focus: false,
  pause: false,
};

const GAMEPAD_DEADZONE = 0.15;

export interface TouchTuning {
  sensitivity: number;
}

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

export interface TouchExclusionCircle {
  x: number;
  y: number;
  r: number;
}

/**
 * Keyboard, gamepad, and relative-touch input merged into one snapshot.
 * Touch HUD exclusion zones prevent button presses from also becoming the
 * movement anchor. All global pointer listeners are removed on shutdown.
 */
export class InputManager {
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly scene: Phaser.Scene;
  private touch: TouchTuning = { sensitivity: 1.4 };
  private touchExclusions: TouchExclusionCircle[] = [];

  private touchEnabled = false;
  private movePointerId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private touchMove = { x: 0, y: 0 };
  private touchFiring = false;
  private secondaryHeld = false;
  private pausePressed = false;
  private prevPauseButton = false;
  private prevSpecialButton = false;
  private activeDevice: InputDevice = 'keyboard';
  private lastPadAxis = { x: 0, y: 0 };
  private readonly onKeyboardActivity = () => {
    this.activeDevice = 'keyboard';
  };
  private readonly onGamepadActivity = () => {
    this.activeDevice = 'gamepad';
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      kb.on('keydown', this.onKeyboardActivity);
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        up: kb.addKey(K.UP),
        down: kb.addKey(K.DOWN),
        left: kb.addKey(K.LEFT),
        right: kb.addKey(K.RIGHT),
        w: kb.addKey(K.W),
        a: kb.addKey(K.A),
        s: kb.addKey(K.S),
        d: kb.addKey(K.D),
        fire: kb.addKey(K.SPACE),
        secondary: kb.addKey(K.X),
        special: kb.addKey(K.C),
        focus: kb.addKey(K.SHIFT),
        pause: kb.addKey(K.ESC),
      };
    }
    scene.input.gamepad?.on('down', this.onGamepadActivity);
  }

  setTouchSensitivity(v: number): void {
    this.touch.sensitivity = Phaser.Math.Clamp(v, 0.5, 3);
  }

  enableTouch(exclusions: TouchExclusionCircle[] = []): void {
    if (this.touchEnabled) return;
    this.touchEnabled = true;
    this.touchExclusions = exclusions.map((zone) => ({ ...zone }));
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    input.on('pointerupoutside', this.onPointerUp, this);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.input.keyboard?.off('keydown', this.onKeyboardActivity);
    this.scene.input.gamepad?.off('down', this.onGamepadActivity);
    this.movePointerId = null;
    this.touchFiring = false;
    this.secondaryHeld = false;
    this.touchMove = { x: 0, y: 0 };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.isExcluded(p.x, p.y)) return;
    if (this.movePointerId === null) {
      this.activeDevice = 'touch';
      this.movePointerId = p.id;
      this.lastTouchX = p.x;
      this.lastTouchY = p.y;
      this.touchFiring = true;
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.movePointerId) return;
    this.activeDevice = 'touch';
    this.touchMove.x += (p.x - this.lastTouchX) * this.touch.sensitivity;
    this.touchMove.y += (p.y - this.lastTouchY) * this.touch.sensitivity;
    this.lastTouchX = p.x;
    this.lastTouchY = p.y;
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.movePointerId) {
      this.movePointerId = null;
      this.touchFiring = false;
    }
  }

  private isExcluded(x: number, y: number): boolean {
    return this.touchExclusions.some(
      (zone) => Phaser.Math.Distance.Between(x, y, zone.x, zone.y) <= zone.r,
    );
  }

  consumeTouchDelta(): { x: number; y: number } {
    const d = { x: this.touchMove.x, y: this.touchMove.y };
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    return d;
  }

  setSecondaryButton(held: boolean): void {
    this.activeDevice = 'touch';
    this.secondaryHeld = held;
  }

  pressPauseButton(): void {
    this.activeDevice = 'touch';
    this.pausePressed = true;
  }

  getState(): InputState {
    const kb = this.readKeyboard();
    const gp = this.readGamepad();
    const touch: InputState = {
      ...NEUTRAL,
      firePrimary: this.touchFiring,
      fireSecondary: this.secondaryHeld,
      pause: this.consumePause(),
    };

    switch (this.activeDevice) {
      case 'gamepad':
        return gp;
      case 'touch':
        return touch;
      case 'keyboard':
      default:
        return kb;
    }
  }

  resetTransientState(): void {
    this.movePointerId = null;
    this.touchFiring = false;
    this.secondaryHeld = false;
    this.pausePressed = false;
    this.touchMove = { x: 0, y: 0 };
  }

  get activeInputDevice(): InputDevice {
    return this.activeDevice;
  }

  private consumePause(): boolean {
    if (!this.pausePressed) return false;
    this.pausePressed = false;
    return true;
  }

  private readKeyboard(): InputState {
    if (!this.keys) return { ...NEUTRAL };
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.left.isDown || k.a.isDown) x -= 1;
    if (k.right.isDown || k.d.isDown) x += 1;
    if (k.up.isDown || k.w.isDown) y -= 1;
    if (k.down.isDown || k.s.isDown) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return {
      moveX: x,
      moveY: y,
      firePrimary: k.fire.isDown,
      fireSecondary: k.secondary.isDown,
      special: Phaser.Input.Keyboard.JustDown(k.special),
      focus: k.focus.isDown,
      pause: Phaser.Input.Keyboard.JustDown(k.pause),
    };
  }

  private readGamepad(): InputState {
    const pad = this.scene.input.gamepad?.pad1;
    if (!pad || !pad.connected) return { ...NEUTRAL };

    let x = pad.leftStick.x;
    let y = pad.leftStick.y;
    if (Math.abs(x) < GAMEPAD_DEADZONE) x = 0;
    if (Math.abs(y) < GAMEPAD_DEADZONE) y = 0;
    if (pad.left) x = -1;
    if (pad.right) x = 1;
    if (pad.up) y = -1;
    if (pad.down) y = 1;
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    if (
      Math.abs(x - this.lastPadAxis.x) > 0.05 ||
      Math.abs(y - this.lastPadAxis.y) > 0.05
    ) {
      if (Math.hypot(x, y) > GAMEPAD_DEADZONE) this.activeDevice = 'gamepad';
      this.lastPadAxis = { x, y };
    }

    const startDown = pad.buttons[9]?.pressed ?? false;
    const pausePressed = startDown && !this.prevPauseButton;
    this.prevPauseButton = startDown;
    const specialDown = pad.B || (pad.buttons[1]?.pressed ?? false);
    const specialPressed = specialDown && !this.prevSpecialButton;
    this.prevSpecialButton = specialDown;

    return {
      moveX: x,
      moveY: y,
      firePrimary: pad.A || (pad.buttons[0]?.pressed ?? false),
      fireSecondary: pad.X || (pad.buttons[2]?.pressed ?? false),
      special: specialPressed,
      focus: pad.buttons[5]?.pressed ?? false,
      pause: pausePressed,
    };
  }

  get isTouchActive(): boolean {
    return this.touchEnabled && this.movePointerId !== null;
  }
}

export function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    !window.matchMedia('(pointer: fine)').matches
  );
}

export const TOUCH_LAYOUT = {
  secondaryButton: { x: GAME_WIDTH - 60, y: GAME_HEIGHT - 60, r: 40 },
  pauseButton: { x: GAME_WIDTH - 34, y: 34, r: 22 },
};
