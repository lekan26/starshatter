// Starshatter — keyboard, mouse and touch, plus the test autopilot.
// The game plays with arrows or A/D, the mouse, or a finger. The autopilot
// is a testing hook the maker drives from the browser console or a query
// string (?autopilot=good|weak|idle): it never plays by itself in a normal
// visit, and it never changes the rules — it only moves the anvil.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last poll
    this.mouseX = null;
    this.mouseActive = false;
    this.touchX = null;
    this.autopilot = 'off'; // off | idle | weak | good
    this.autoTarget = null;
    this.autoTargetAt = 0;
    this.autoServeAt = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseActive = true;
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      this.touchX = ((t.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseActive = true;
    }, { passive: false });
    canvas.addEventListener('touchstart', (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      this.touchX = ((t.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseActive = true;
      this.pressed.add('TouchTap');
    }, { passive: true });
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Call once per frame, after the game has read the presses.
  endFrame() {
    this.pressed.clear();
  }

  get left() {
    return this.keys.has('ArrowLeft') || this.keys.has('KeyA');
  }

  get right() {
    return this.keys.has('ArrowRight') || this.keys.has('KeyD');
  }

  get serve() {
    return this.wasPressed('Space') || this.wasPressed('Enter') || this.wasPressed('TouchTap');
  }

  get pointerX() {
    if (this.touchX !== null) return this.touchX;
    return this.mouseX;
  }

  // Where the autopilot wants the anvil to be, or null to leave it alone.
  // now is the game's clock in seconds; ball is the ball to track (or null).
  autopilotTarget(now, ball, paddleX, paddleSpeed) {
    if (this.autopilot === 'off' || this.autopilot === 'idle') return null;
    if (!ball) return null;
    if (this.autopilot === 'weak') {
      // A slow, laggy player: retargets rarely and crawls.
      if (now - this.autoTargetAt > 0.15) {
        this.autoTarget = ball.x;
        this.autoTargetAt = now;
      }
      return { x: this.autoTarget, speed: 300 };
    }
    // 'good': predict where the ball crosses the anvil's line, one wall
    // bounce ahead, and glide there at full speed. The aim point wanders
    // widely on purpose: a paddle that always meets the ball dead centre
    // sends it straight up and down, and a straight rally clears nothing
    // — the hammer has to land well off-centre to sweep the field, and
    // every steep angle is a gamble the anvil must then chase down.
    const target = predictCrossing(ball, paddleSpeed);
    const wander = (Math.random() * 2 - 1) * 70;
    return { x: target + wander, speed: paddleSpeed };
  }
}

// Predict the x where a moving ball will cross y = PADDLE_Y, allowing one
// bounce off a side wall. Falls back to the ball's current x.
import { VIEW_W, PADDLE_Y } from './config.js';

export function predictCrossing(ball, _paddleSpeed) {
  const vy = ball.vy;
  if (vy <= 0) return ball.x;
  const t = (PADDLE_Y - ball.y) / vy;
  if (t < 0 || t > 3) return ball.x;
  let x = ball.x + ball.vx * t;
  if (x < 0) x = -x;
  if (x > VIEW_W) x = 2 * VIEW_W - x;
  return Math.max(0, Math.min(VIEW_W, x));
}
