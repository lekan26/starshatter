// Starshatter — the game itself: state, physics, scoring, the boss.
// One class owns the whole loop: title, serve, play, upgrade choice,
// pause, game over, victory. Rendering lives in render.js; sound in
// audio.js; input in input.js. Nothing here draws or listens.

import {
  VIEW_W, VIEW_H, FLOOR_Y, PADDLE_Y, PADDLE_H, TUNING, CRYSTAL_POINTS, UPGRADES,
} from './config.js';
import { LEVELS, GRID, countCrystals } from './levels.js';

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class StarshatterGame {
  constructor(rng, sound) {
    this.rng = rng;
    this.sound = sound;
    this.reset();
  }

  reset() {
    this.state = 'title'; // title | serve | play | upgrade | pause | over | win
    this.prevState = 'play';
    this.levelIndex = 0;
    this.lives = TUNING.livesStart;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.crystalsShattered = 0;
    this.playTime = 0;
    this.now = 0;
    this.paddle = { x: VIEW_W / 2, w: TUNING.paddleWidthStart };
    this.paddleWidthBonus = 0;
    this.paddleSpeedBonus = 0;
    this.hammerDamage = 1;
    this.dropBonus = 0;
    this.balls = [];
    this.bricks = [];
    this.boss = null;
    this.powerups = [];
    this.lanceBolts = [];
    this.bossBolts = [];
    this.particles = [];
    this.floaters = [];
    this.slowUntil = 0;
    this.slowActive = false;
    this.wideUntil = 0;
    this.lanceUntil = 0;
    this.lanceTimer = 0;
    this.bossBoltTimer = 0;
    this.penaltyUntil = 0;
    this.boltPenalty = 0; // stacked pinches from void bolts that reached the floor
    this.shake = 0;
    this.upgradeChoices = [];
    this.levelBonus = 0;
    this.servedAt = 0;
    this.bricksBrokenThisLevel = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  get crystalsLeft() {
    let n = 0;
    for (const b of this.bricks) if (b.alive) n += 1;
    return n;
  }

  get paddleSpeed() {
    return TUNING.paddleSpeed * (1 + this.paddleSpeedBonus);
  }

  // The anvil's width right now: narrower each constellation, wider with
  // forge upgrades, briefly pinched when a void bolt reaches the floor.
  paddleWidth() {
    const base = TUNING.paddleWidthStart - TUNING.paddleShrinkPerLevel * this.levelIndex;
    // A bolt that reaches the floor pinches the anvil, and the pinches
    // stack: ignore the bolts and the anvil ends up a sliver. The forge
    // recovers once twelve quiet seconds pass.
    const penalised = this.now < this.penaltyUntil
      ? Math.pow(TUNING.bossBoltPenalty, this.boltPenalty)
      : 1;
    const wide = this.now < this.wideUntil ? 1.3 : 1;
    return Math.max(
      TUNING.paddleWidthMin,
      base * (1 + this.paddleWidthBonus) * penalised * wide,
    );
  }

  ballSpeed() {
    const base = TUNING.ballSpeedBase[this.levelIndex];
    const bonus = Math.min(TUNING.ballSpeedBonusCap, this.bricksBrokenThisLevel * TUNING.ballSpeedPerBrick);
    return base + bonus;
  }

  startGame() {
    this.reset();
    this.levelIndex = 0;
    this.buildLevel();
    this.state = 'serve';
    this.servedAt = this.now;
    this.sound.click();
  }

  buildLevel() {
    const def = this.level;
    this.bricks = [];
    this.bricksBrokenThisLevel = 0;
    this.powerups = [];
    this.lanceBolts = [];
    this.bossBolts = [];
    this.boss = null;
    this.bossBoltTimer = 1.2;
    def.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c += 1) {
        const ch = row[c];
        if (ch === '.') continue;
        const hp = ch === '2' ? 2 : ch === '3' ? 3 : 1;
        const kind = ch === '2' ? 'armored' : ch === '3' ? 'heavy' : ch === 'm' ? 'moving' : ch === 'e' ? 'ember' : 'crystal';
        this.bricks.push({
          x: GRID.originX + c * (GRID.brickW + GRID.gapX),
          y: GRID.originY + r * (GRID.brickH + GRID.gapY),
          baseX: GRID.originX + c * (GRID.brickW + GRID.gapX),
          w: GRID.brickW,
          h: GRID.brickH,
          hp,
          maxHp: hp,
          kind,
          phase: this.rng.range(0, TAU),
          alive: true,
        });
      }
    });
    if (def.boss) {
      this.boss = {
        x: VIEW_W / 2,
        y: 168,
        w: def.boss.w,
        h: def.boss.h,
        hp: def.boss.hp,
        maxHp: def.boss.hp,
        sway: 0,
      };
    }
    this.placeServeBall();
  }

  placeServeBall() {
    this.balls = [{
      x: this.paddle.x,
      y: PADDLE_Y - TUNING.ballRadius - 1,
      vx: 0,
      vy: 0,
      r: TUNING.ballRadius,
      stuck: true,
    }];
  }

  launchBall() {
    if (this.state !== 'serve') return;
    const ball = this.balls[0];
    const speed = this.ballSpeed();
    const a = this.rng.range(-TUNING.ballServeAngle, TUNING.ballServeAngle) * Math.PI / 180;
    ball.vx = Math.sin(a) * speed;
    ball.vy = -Math.cos(a) * speed;
    ball.stuck = false;
    this.state = 'play';
    this.sound.paddle();
  }

  // ---- per-frame update -------------------------------------------------

  update(dt, input) {
    this.now += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    this.shakeX = this.shake > 0 ? this.rng.range(-1, 1) * this.shake * 7 : 0;
    this.shakeY = this.shake > 0 ? this.rng.range(-1, 1) * this.shake * 7 : 0;

    if (this.now >= this.penaltyUntil && this.boltPenalty > 0) this.boltPenalty = 0;
    if (this.state === 'title' || this.state === 'over' || this.state === 'win') {
      this.updateParticles(dt);
      return;
    }
    if (this.state === 'upgrade' || this.state === 'pause') return;

    this.movePaddle(dt, input);
    if (this.state === 'serve') {
      const ball = this.balls[0];
      ball.x = this.paddle.x;
      ball.y = PADDLE_Y - TUNING.ballRadius - 1;
      return;
    }
    if (this.state !== 'play') return;

    this.playTime += dt;
    this.updateSlow();
    this.updateBalls(dt);
    this.updatePowerups(dt);
    this.updateLance(dt);
    this.updateBoss(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);
  }

  movePaddle(dt, input) {
    const w = this.paddleWidth();
    this.paddle.w = w;
    const half = w / 2;
    let target = null;
    let speed = this.paddleSpeed;

    const auto = input.autopilotTarget(this.now, this.trackedBall(), this.paddle.x, this.paddleSpeed);
    if (auto) {
      target = auto.x;
      speed = auto.speed;
    } else if (input.mouseActive && input.pointerX !== null && input.autopilot === 'off') {
      // The mouse leads: the anvil follows the pointer at once.
      target = input.pointerX;
      speed = Infinity;
    } else if (input.left || input.right) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.paddle.x = clamp(this.paddle.x + dir * speed * dt, half, VIEW_W - half);
      return;
    }
    if (target !== null) {
      const dx = target - this.paddle.x;
      const step = speed * dt;
      if (Math.abs(dx) <= step || speed === Infinity) {
        this.paddle.x = clamp(target, half, VIEW_W - half);
      } else {
        this.paddle.x = clamp(this.paddle.x + Math.sign(dx) * step, half, VIEW_W - half);
      }
    }
  }

  // The ball the autopilot should track: the lowest live one.
  trackedBall() {
    let best = null;
    for (const b of this.balls) {
      if (b.stuck) continue;
      if (!best || b.y > best.y) best = b;
    }
    return best;
  }

  updateSlow() {
    const shouldSlow = this.now < this.slowUntil;
    if (shouldSlow !== this.slowActive) {
      const f = shouldSlow ? TUNING.slowFactor : 1 / TUNING.slowFactor;
      for (const b of this.balls) {
        b.vx *= f;
        b.vy *= f;
      }
      this.slowActive = shouldSlow;
    }
  }

  // ---- balls ------------------------------------------------------------

  updateBalls(dt) {
    // Substep so a fast hammer never tunnels through a crystal.
    const steps = 3;
    for (let s = 0; s < steps; s += 1) {
      for (const ball of this.balls.slice()) {
        this.stepBall(ball, dt / steps);
      }
    }
    // Drop any ball that fell past the floor.
    for (const ball of this.balls.slice()) {
      if (ball.y - ball.r > FLOOR_Y) this.loseBall(ball);
    }
    if (this.balls.length === 0 && this.state === 'play') this.loseLife();
  }

  stepBall(ball, dt) {
    if (ball.stuck) return;
    const px = ball.x;
    const py = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Side walls and ceiling.
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r > VIEW_W) {
      ball.x = VIEW_W - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }

    // The anvil: angle follows where the hammer lands on it.
    const half = this.paddle.w / 2;
    if (ball.vy > 0
      && py + ball.r <= PADDLE_Y + 2
      && ball.y + ball.r >= PADDLE_Y
      && ball.x >= this.paddle.x - half - ball.r
      && ball.x <= this.paddle.x + half + ball.r) {
      const offset = clamp((ball.x - this.paddle.x) / half, -1, 1);
      const speed = Math.hypot(ball.vx, ball.vy);
      // Steep angles (up to 68 degrees) keep the hammer sweeping the
      // field instead of bouncing in one groove; a whisper of jitter
      // stops any rally repeating forever. And a rally is never allowed
      // to go straight up and down: a near-vertical bounce is pushed to
      // at least 8 degrees off the vertical, so the hammer always roams.
      let angle = offset * (Math.PI * 68 / 180) + this.rng.range(-0.035, 0.035);
      const minAngle = 0.14;
      if (Math.abs(angle) < minAngle) {
        const dir = ball.vx !== 0 ? Math.sign(ball.vx) : (this.rng.chance(0.5) ? 1 : -1);
        angle = dir * minAngle;
      }
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.y = PADDLE_Y - ball.r - 0.5;
      this.combo = 0;
      this.sound.paddle();
      return;
    }

    // The Void Heart, when it lives.
    if (this.boss && this.boss.hp > 0) {
      const b = this.boss;
      const bx = b.x + Math.sin(this.now * 0.5) * 55;
      if (ball.x + ball.r > bx - b.w / 2 && ball.x - ball.r < bx + b.w / 2
        && ball.y + ball.r > b.y - b.h / 2 && ball.y - ball.r < b.y + b.h / 2) {
        const fromTop = py + ball.r <= b.y - b.h / 2 + 2;
        const fromBottom = py - ball.r >= b.y + b.h / 2 - 2;
        if (fromTop) ball.vy = -Math.abs(ball.vy);
        else if (fromBottom) ball.vy = Math.abs(ball.vy);
        else ball.vx = ball.x < bx ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        this.damageBoss(this.hammerDamage, ball.x, ball.y);
        return;
      }
    }

    // Crystals: first overlap wins, resolved by the side the ball came from.
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      const bx = this.brickX(brick);
      if (ball.x + ball.r < bx || ball.x - ball.r > bx + brick.w
        || ball.y + ball.r < brick.y || ball.y - ball.r > brick.y + brick.h) continue;
      const fromTop = py + ball.r <= brick.y + 2;
      const fromBottom = py - ball.r >= brick.y + brick.h - 2;
      if (fromTop) ball.vy = -Math.abs(ball.vy);
      else if (fromBottom) ball.vy = Math.abs(ball.vy);
      else if (px < bx + brick.w / 2) ball.vx = -Math.abs(ball.vx);
      else ball.vx = Math.abs(ball.vx);
      this.damageBrick(brick, this.hammerDamage, ball.x, ball.y);
      return;
    }
  }

  brickX(brick) {
    if (brick.kind === 'moving') {
      return brick.baseX + Math.sin(this.now * 0.9 + brick.phase) * 26;
    }
    return brick.x;
  }

  damageBrick(brick, dmg, hx, hy) {
    brick.hp -= dmg;
    if (brick.hp > 0) {
      this.sound.armored();
      this.burst(hx, hy, '#b388ff', 5);
      return;
    }
    brick.alive = false;
    this.crystalsShattered += 1;
    this.bricksBrokenThisLevel += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + Math.min(TUNING.comboMax - 1, Math.floor(this.combo / TUNING.comboStep));
    const base = brick.kind === 'ember' ? CRYSTAL_POINTS.ember : CRYSTAL_POINTS[Math.min(3, brick.maxHp)];
    const pts = base * mult;
    this.score += pts;
    this.floaters.push({ x: hx, y: hy, text: `+${pts}`, life: 0.8, color: brick.kind === 'ember' ? '#ffb347' : '#e8ecff' });
    this.burst(hx, hy, this.crystalColor(brick), 12);
    this.shake = Math.min(0.5, this.shake + 0.12);
    this.sound.brick(this.combo);
    this.maybeDrop(brick);
    this.speedUpBalls();
    if (this.crystalsLeft === 0 && !this.boss) this.levelCleared();
  }

  crystalColor(brick) {
    if (brick.kind === 'armored') return '#b388ff';
    if (brick.kind === 'heavy') return '#ff7ad9';
    if (brick.kind === 'ember') return '#ffb347';
    if (brick.kind === 'moving') return '#6dffa8';
    return '#7fe7ff';
  }

  speedUpBalls() {
    const target = this.ballSpeed() * (this.slowActive ? TUNING.slowFactor : 1);
    for (const b of this.balls) {
      if (b.stuck) continue;
      const cur = Math.hypot(b.vx, b.vy);
      if (cur > 0 && target > cur) {
        b.vx *= target / cur;
        b.vy *= target / cur;
      }
    }
  }

  maybeDrop(brick) {
    const chance = TUNING.powerDropChance + this.dropBonus;
    if (!this.rng.chance(chance)) return;
    const type = this.rng.chance(TUNING.lifeDropChance / chance)
      ? 'life'
      : this.rng.pick(['wide', 'multi', 'slow', 'lance']);
    this.powerups.push({ x: this.brickX(brick) + brick.w / 2, y: brick.y + brick.h, vy: TUNING.powerFallSpeed, type });
  }

  damageBoss(dmg, hx, hy) {
    const boss = this.boss;
    boss.hp -= dmg;
    this.burst(hx, hy, '#ff4d6d', 10);
    this.shake = Math.min(0.6, this.shake + 0.2);
    this.sound.armored();
    if (boss.hp <= 0) {
      this.burst(boss.x, boss.y, '#ff4d6d', 60);
      this.burst(boss.x, boss.y, '#fff3b0', 40);
      this.shake = 1;
      this.score += 1000 + this.lives * 500;
      this.winGame();
    }
  }

  // ---- losing and winning ------------------------------------------------

  loseBall(ball) {
    const i = this.balls.indexOf(ball);
    if (i !== -1) this.balls.splice(i, 1);
  }

  loseLife() {
    this.lives -= 1;
    this.combo = 0;
    this.sound.lose();
    this.shake = 0.8;
    if (this.lives <= 0) {
      this.state = 'over';
      this.sound.over();
      return;
    }
    this.powerups = [];
    this.lanceBolts = [];
    this.bossBolts = [];
    this.lanceUntil = 0;
    this.slowUntil = 0;
    this.placeServeBall();
    this.state = 'serve';
    this.servedAt = this.now;
  }

  levelCleared() {
    this.levelBonus = 250 * (this.levelIndex + 1) + this.lives * 100;
    this.score += this.levelBonus;
    this.sound.clear();
    this.upgradeChoices = this.rng.shuffled(UPGRADES).slice(0, 3);
    this.state = 'upgrade';
  }

  applyUpgrade(id) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return;
    up.apply(this);
    this.sound.power();
    this.levelIndex += 1;
    this.buildLevel();
    this.state = 'serve';
    this.servedAt = this.now;
  }

  winGame() {
    this.state = 'win';
    this.sound.win();
  }

  // ---- power-ups, lance, boss --------------------------------------------

  updatePowerups(dt) {
    for (const p of this.powerups.slice()) {
      p.y += p.vy * dt;
      const half = this.paddle.w / 2;
      if (p.y >= PADDLE_Y - 4 && p.y <= PADDLE_Y + PADDLE_H + 8
        && p.x >= this.paddle.x - half && p.x <= this.paddle.x + half) {
        this.applyPower(p.type);
        this.powerups.splice(this.powerups.indexOf(p), 1);
        continue;
      }
      if (p.y > FLOOR_Y + 20) this.powerups.splice(this.powerups.indexOf(p), 1);
    }
  }

  applyPower(type) {
    this.sound.power();
    if (type === 'wide') {
      this.wideUntil = this.now + TUNING.wideDuration;
    } else if (type === 'multi') {
      const src = this.trackedBall() || this.balls[0];
      if (src && !src.stuck) {
        const speed = Math.hypot(src.vx, src.vy);
        for (const a of [-0.45, 0.45]) {
          const ang = Math.atan2(src.vy, src.vx) + a;
          this.balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: TUNING.ballRadius, stuck: false });
        }
      }
    } else if (type === 'slow') {
      this.slowUntil = this.now + TUNING.slowDuration;
    } else if (type === 'lance') {
      this.lanceUntil = this.now + TUNING.lanceDuration;
    } else if (type === 'life') {
      this.lives = Math.min(TUNING.livesMax, this.lives + 1);
    }
  }

  updateLance(dt) {
    if (this.now >= this.lanceUntil) return;
    this.lanceTimer -= dt;
    if (this.lanceTimer > 0) return;
    this.lanceTimer = TUNING.lanceInterval;
    this.lanceBolts.push({ x: this.paddle.x, y: PADDLE_Y - 8, vy: -920 });
    this.sound.lance();
    for (const bolt of this.lanceBolts.slice()) {
      bolt.y += bolt.vy * dt;
      if (bolt.y < 0) {
        this.lanceBolts.splice(this.lanceBolts.indexOf(bolt), 1);
        continue;
      }
      if (this.boss && this.boss.hp > 0) {
        const b = this.boss;
        const bx = b.x + Math.sin(this.now * 0.5) * 55;
        if (bolt.x > bx - b.w / 2 && bolt.x < bx + b.w / 2
          && bolt.y > b.y - b.h / 2 && bolt.y < b.y + b.h / 2) {
          this.lanceBolts.splice(this.lanceBolts.indexOf(bolt), 1);
          this.damageBoss(this.hammerDamage, bolt.x, bolt.y);
          continue;
        }
      }
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        const bx = this.brickX(brick);
        if (bolt.x >= bx && bolt.x <= bx + brick.w && bolt.y >= brick.y && bolt.y <= brick.y + brick.h) {
          this.lanceBolts.splice(this.lanceBolts.indexOf(bolt), 1);
          this.damageBrick(brick, 1, bolt.x, bolt.y);
          break;
        }
      }
    }
  }

  updateBoss(dt) {
    if (!this.boss || this.boss.hp <= 0 || this.state !== 'play') return;
    const enraged = this.boss.hp <= 10;
    const interval = TUNING.bossBoltInterval * (enraged ? 0.55 : 1);
    this.bossBoltTimer -= dt;
    if (this.bossBoltTimer <= 0) {
      this.bossBoltTimer = interval;
      const bx = this.boss.x + Math.sin(this.now * 0.5) * 55;
      const dx = this.paddle.x - bx + this.rng.range(-90, 90);
      const dy = PADDLE_Y - this.boss.y;
      const len = Math.hypot(dx, dy) || 1;
      const sp = TUNING.bossBoltSpeed;
      this.bossBolts.push({ x: bx, y: this.boss.y + this.boss.h / 2, vx: (dx / len) * sp, vy: (dy / len) * sp });
    }
    for (const bolt of this.bossBolts.slice()) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      const half = this.paddle.w / 2;
      if (bolt.y >= PADDLE_Y - 4 && bolt.y <= PADDLE_Y + PADDLE_H + 6
        && bolt.x >= this.paddle.x - half && bolt.x <= this.paddle.x + half) {
        this.bossBolts.splice(this.bossBolts.indexOf(bolt), 1);
        this.score += 25;
        this.sound.boltBlock();
        continue;
      }
      // A bolt that kisses a ball knocks it off course.
      for (const ball of this.balls) {
        if (ball.stuck) continue;
        const d = Math.hypot(ball.x - bolt.x, ball.y - bolt.y);
        if (d < ball.r + 8) {
          ball.vy = -Math.abs(ball.vy);
          ball.vx += this.rng.range(-60, 60);
          this.bossBolts.splice(this.bossBolts.indexOf(bolt), 1);
          break;
        }
      }
      if (bolt.y > FLOOR_Y) {
        this.bossBolts.splice(this.bossBolts.indexOf(bolt), 1);
        this.boltPenalty = Math.min(TUNING.bossBoltPenaltyMax, this.boltPenalty + 1);
        this.penaltyUntil = this.now + TUNING.bossBoltPenaltyTime;
        this.shake = Math.min(0.6, this.shake + 0.25);
        this.sound.armored();
      }
    }
  }

  // ---- particles and floating text ---------------------------------------

  burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng.range(0, TAU);
      const sp = this.rng.range(60, 320);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: this.rng.range(0.3, 0.7),
        maxLife: 0.7,
        color,
        size: this.rng.range(2, 5),
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles.slice()) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) this.particles.splice(this.particles.indexOf(p), 1);
    }
  }

  updateFloaters(dt) {
    for (const f of this.floaters.slice()) {
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) this.floaters.splice(this.floaters.indexOf(f), 1);
    }
  }

  // ---- a plain snapshot for the HUD and the test driver -------------------

  snapshot() {
    return {
      state: this.state,
      level: this.levelIndex + 1,
      levelName: this.level.name,
      score: this.score,
      lives: this.lives,
      combo: this.combo,
      maxCombo: this.maxCombo,
      crystalsLeft: this.crystalsLeft,
      crystalsTotal: countCrystals(this.level.rows),
      crystalsShattered: this.crystalsShattered,
      bossHp: this.boss ? Math.max(0, this.boss.hp) : null,
      bossMaxHp: this.boss ? this.boss.maxHp : null,
      balls: this.balls.length,
      playTimeMs: Math.round(this.playTime * 1000),
      paddleWidth: Math.round(this.paddle.w),
      upgradeChoices: this.upgradeChoices.map((u) => u.id),
    };
  }
}
