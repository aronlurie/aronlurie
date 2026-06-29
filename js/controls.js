// Handles user input (arrow buttons + keyboard) and the screen-relative
// 45-degree rotation animation of the dodecahedron's orientation quaternion.
import { quat } from "./math.js";

const QUARTER_TURN = Math.PI / 4; // 45 degrees
const DURATION = 200; // ms, "fast"

// Screen-relative axes: because the camera/view only translates (no rotation),
// world X is the screen's horizontal axis and world Y is the vertical axis.
// Up/Down rotate about the horizontal (X) axis; Left/Right about the vertical (Y) axis.
const DIRECTIONS = {
  up:    { axis: [1, 0, 0], angle: -QUARTER_TURN },
  down:  { axis: [1, 0, 0], angle: QUARTER_TURN },
  left:  { axis: [0, 1, 0], angle: -QUARTER_TURN },
  right: { axis: [0, 1, 0], angle: QUARTER_TURN },
};

const KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Smooth ease-in-out (quadratic).
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export class Controls {
  constructor(root) {
    // Start in a view so several faces are visible
    const turn = quat.fromAxisAngle(0, 1, 0, Math.PI / 2);
    const tilt = quat.fromAxisAngle(1, 0, 0, Math.PI / 3);
    this.orientation = quat.normalize(quat.multiply(tilt, turn));
    this.from = null;
    this.to = null;
    this.startTime = 0;
    this.animating = false;

    // Arrow buttons.
    root.querySelectorAll(".arrow").forEach((btn) => {
      btn.addEventListener("click", () => this.rotate(btn.dataset.dir));
    });

    // Keyboard mirrors the on-screen arrows.
    window.addEventListener("keydown", (e) => {
      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        this.rotate(dir);
      }
    });
  }

  // Begin a rotation. Clicks are ignored while an animation is in progress.
  rotate(dir) {
    if (this.animating) return;
    const move = DIRECTIONS[dir];
    if (!move) return;

    const delta = quat.fromAxisAngle(move.axis[0], move.axis[1], move.axis[2], move.angle);
    // Pre-multiply so the rotation happens about the fixed screen axis,
    // regardless of the cube's current orientation.
    this.from = this.orientation;
    this.to = quat.normalize(quat.multiply(delta, this.orientation));
    this.startTime = performance.now();
    this.animating = true;
  }

  // Advance the animation. Returns the current orientation quaternion.
  update(now) {
    if (!this.animating) return this.orientation;

    const elapsed = now - this.startTime;
    const t = Math.min(elapsed / DURATION, 1);
    this.orientation = quat.slerp(this.from, this.to, easeInOut(t));

    if (t >= 1) {
      this.orientation = this.to;
      this.animating = false;
    }
    return this.orientation;
  }
}

