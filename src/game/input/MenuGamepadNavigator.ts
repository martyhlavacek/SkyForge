import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';

export interface MenuNavFrame {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  cancel: boolean;
  pause: boolean;
}

const EMPTY: MenuNavFrame = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  cancel: false,
  pause: false,
};

/** Edge-triggered controller navigation shared by all non-gameplay scenes. */
export class MenuGamepadNavigator {
  private previous = {
    up: false,
    down: false,
    left: false,
    right: false,
    confirm: false,
    cancel: false,
    pause: false,
  };

  read(scene: Phaser.Scene): MenuNavFrame {
    const pad = scene.input.gamepad?.pad1;
    if (!pad?.connected) {
      this.previous = { ...EMPTY };
      return { ...EMPTY };
    }

    const current = {
      up: pad.up || pad.leftStick.y < -0.55,
      down: pad.down || pad.leftStick.y > 0.55,
      left: pad.left || pad.leftStick.x < -0.55,
      right: pad.right || pad.leftStick.x > 0.55,
      confirm: pad.A || (pad.buttons[0]?.pressed ?? false),
      cancel: pad.B || (pad.buttons[1]?.pressed ?? false),
      pause: pad.buttons[9]?.pressed ?? false,
    };
    const frame: MenuNavFrame = {
      up: current.up && !this.previous.up,
      down: current.down && !this.previous.down,
      left: current.left && !this.previous.left,
      right: current.right && !this.previous.right,
      confirm: current.confirm && !this.previous.confirm,
      cancel: current.cancel && !this.previous.cancel,
      pause: current.pause && !this.previous.pause,
    };
    this.previous = current;
    if (Object.values(frame).some(Boolean)) void audio.unlock();
    return frame;
  }
}
