// Starshatter — everything the player sees.
// Canvas 2D, drawn fresh every frame from the game's state: the starfield,
// the crystals and the Void Heart, the anvil and the hammer, the HUD, and
// the title, upgrade, pause, game-over and victory screens. No images, no
// fonts fetched over the network — shapes, gradients and system fonts only.

import { VIEW_W, VIEW_H, FLOOR_Y, PADDLE_Y, PADDLE_H, PALETTE, TUNING } from './config.js';
import { GRID } from './levels.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class Renderer {
  constructor(canvas, rng) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    for (let i = 0; i < 130; i += 1) {
      this.stars.push({
        x: rng.range(0, VIEW_W),
        y: rng.range(0, VIEW_H),
        r: rng.range(0.6, 2.2),
        tw: rng.range(0, Math.PI * 2),
        sp: rng.range(0.4, 1.6),
      });
    }
  }

  draw(game, now) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(game.shakeX, game.shakeY);
    this.drawSky(ctx, now);
    if (game.state === 'title') {
      this.drawTitle(ctx, game, now);
    } else {
      this.drawField(ctx, game, now);
      this.drawHud(ctx, game);
      if (game.state === 'upgrade') this.drawUpgrade(ctx, game, now);
      else if (game.state === 'pause') this.drawPause(ctx, game);
      else if (game.state === 'over') this.drawEnd(ctx, game, false);
      else if (game.state === 'win') this.drawEnd(ctx, game, true);
      else if (game.state === 'serve') this.drawServeHint(ctx, game, now);
    }
    ctx.restore();
  }

  drawSky(ctx, now) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(now * s.sp + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- the play field ----------------------------------------------------

  drawField(ctx, game, now) {
    for (const brick of game.bricks) {
      if (!brick.alive) continue;
      this.drawCrystal(ctx, game, brick, now);
    }
    if (game.boss && game.boss.hp > 0) this.drawHeart(ctx, game, now);
    for (const p of game.powerups) this.drawPowerup(ctx, p, now);
    for (const b of game.lanceBolts) {
      ctx.fillStyle = PALETTE.bolt;
      ctx.fillRect(b.x - 2, b.y - 14, 4, 14);
    }
    for (const b of game.bossBolts) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
      ctx.fillStyle = PALETTE.voidBolt;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    this.drawPaddle(ctx, game, now);
    for (const ball of game.balls) this.drawBall(ctx, ball);
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of game.floaters) {
      ctx.globalAlpha = clamp(f.life / 0.8, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  crystalFill(brick) {
    if (brick.kind === 'armored') return PALETTE.crystalArmored;
    if (brick.kind === 'heavy') return PALETTE.crystalHeavy;
    if (brick.kind === 'ember') return PALETTE.crystalEmber;
    if (brick.kind === 'moving') return PALETTE.crystalMoving;
    return PALETTE.crystal;
  }

  drawCrystal(ctx, game, brick, now) {
    const x = game.brickX(brick);
    const y = brick.y;
    const w = brick.w;
    const h = brick.h;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const fill = this.crystalFill(brick);
    // A faceted diamond: bright core, darker rim, a glint.
    ctx.save();
    ctx.shadowColor = fill;
    ctx.shadowBlur = brick.kind === 'ember' ? 16 : 9;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, y + 3);
    ctx.lineTo(x + w - 4, cy);
    ctx.lineTo(cx, y + h - 3);
    ctx.lineTo(x + 4, cy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, y + 7);
    ctx.lineTo(x + w - 12, cy - 2);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(x + 12, cy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    if (brick.maxHp > 1) {
      // Hairline cracks show how much punishment is left.
      ctx.strokeStyle = 'rgba(10,10,30,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 14, y + 8);
      ctx.lineTo(cx + 2, cy);
      ctx.lineTo(cx - 8, y + h - 8);
      ctx.stroke();
      if (brick.hp >= 2 && brick.maxHp === 3) {
        ctx.beginPath();
        ctx.moveTo(cx + 16, y + 6);
        ctx.lineTo(cx - 2, cy + 2);
        ctx.stroke();
      }
    }
    if (brick.kind === 'moving') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('~', cx, cy + 5);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    void now;
  }

  drawHeart(ctx, game, now) {
    const b = game.boss;
    const bx = b.x + Math.sin(now * 0.5) * 55;
    const by = b.y;
    const pulse = 1 + Math.sin(now * 3) * 0.04;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = PALETTE.heart;
    ctx.shadowBlur = 26;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, b.w / 2);
    g.addColorStop(0, '#ff8fa3');
    g.addColorStop(0.55, PALETTE.heart);
    g.addColorStop(1, '#7a1030');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -b.h / 2);
    ctx.lineTo(b.w / 2, 0);
    ctx.lineTo(0, b.h / 2);
    ctx.lineTo(-b.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // The dark core.
    ctx.fillStyle = '#2b0213';
    ctx.beginPath();
    ctx.arc(0, 0, 15 + Math.sin(now * 3) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(-4, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Health bar under the heart.
    const bw = 240;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - bw / 2, by + b.h / 2 + 12, bw, 10);
    ctx.fillStyle = PALETTE.heart;
    ctx.fillRect(bx - bw / 2 + 1, by + b.h / 2 + 13, (bw - 2) * (b.hp / b.maxHp), 8);
  }

  drawPowerup(ctx, p, now) {
    const bob = Math.sin(now * 5 + p.x) * 2;
    const y = p.y + bob;
    ctx.save();
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.type === 'life' ? '#ff6b81' : '#ffd166';
    ctx.beginPath();
    ctx.arc(p.x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#241a00';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = { wide: 'W', multi: 'M', slow: 'S', lance: 'L', life: '+' }[p.type] || '?';
    ctx.fillText(label, p.x, y + 5);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  drawPaddle(ctx, game, now) {
    const w = game.paddle.w;
    const x = game.paddle.x - w / 2;
    const y = PADDLE_Y;
    const lanceOn = now < game.lanceUntil;
    const wideOn = now < game.wideUntil;
    ctx.save();
    ctx.shadowColor = PALETTE.anvilTrim;
    ctx.shadowBlur = 10;
    const g = ctx.createLinearGradient(x, y, x, y + PADDLE_H);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, PALETTE.anvil);
    g.addColorStop(1, '#7d86c9');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, PADDLE_H, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.anvilTrim;
    ctx.fillRect(x + 6, y + 5, w - 12, 3);
    if (lanceOn) {
      ctx.fillStyle = PALETTE.bolt;
      ctx.beginPath();
      ctx.moveTo(game.paddle.x - 5, y - 2);
      ctx.lineTo(game.paddle.x + 5, y - 2);
      ctx.lineTo(game.paddle.x, y - 14);
      ctx.closePath();
      ctx.fill();
    }
    if (wideOn) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 3, y - 3, w + 6, PADDLE_H + 6, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBall(ctx, ball) {
    ctx.save();
    ctx.shadowColor = PALETTE.ball;
    ctx.shadowBlur = 14;
    const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.r + 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, PALETTE.ball);
    g.addColorStop(1, '#ff9d00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- HUD ---------------------------------------------------------------

  drawHud(ctx, game) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,15,0.45)';
    ctx.fillRect(0, 0, VIEW_W, 52);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hud;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${game.score.toLocaleString('en-US')}`, 20, 34);
    if (game.combo >= 5) {
      ctx.fillStyle = PALETTE.gold;
      const mult = 1 + Math.min(TUNING.comboMax - 1, Math.floor(game.combo / TUNING.comboStep));
      ctx.fillText(`COMBO x${mult} (${game.combo})`, 250, 34);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hud;
    ctx.fillText(`${game.levelIndex + 1} · ${game.level.name}`, VIEW_W / 2, 34);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText(game.level.sub, VIEW_W / 2, 52 - 4);
    ctx.textAlign = 'right';
    let hearts = '';
    for (let i = 0; i < game.lives; i += 1) hearts += '♥';
    ctx.fillStyle = game.lives === 1 ? PALETTE.danger : '#ff6b81';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(hearts || '—', VIEW_W - 20, 34);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    const left = game.boss ? `HEART ${Math.max(0, game.boss.hp)}/${game.boss.maxHp}` : `CRYSTALS ${game.crystalsLeft}`;
    ctx.fillText(left, VIEW_W - 20, 52 - 4);
    ctx.restore();
    // The floor: a thin warning line the hammer must never cross.
    ctx.fillStyle = 'rgba(255,93,115,0.35)';
    ctx.fillRect(0, FLOOR_Y, VIEW_W, 2);
  }

  drawServeHint(ctx, game, now) {
    const pulse = 0.6 + 0.4 * Math.sin(now * 4);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE or CLICK to launch the hammer', VIEW_W / 2, 600);
    ctx.restore();
  }

  // ---- screens -------------------------------------------------------------

  dim(ctx) {
    ctx.fillStyle = 'rgba(4,5,14,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawTitle(ctx, game, now) {
    this.drawSky(ctx, now);
    // A few hero crystals behind the title.
    const hero = [
      { x: 300, y: 180, c: '#7fe7ff' },
      { x: 980, y: 150, c: '#b388ff' },
      { x: 880, y: 540, c: '#ffb347' },
      { x: 380, y: 560, c: '#6dffa8' },
    ];
    for (const h of hero) {
      ctx.save();
      ctx.translate(h.x, h.y + Math.sin(now * 1.2 + h.x) * 8);
      ctx.rotate(Math.sin(now * 0.8 + h.x) * 0.2);
      ctx.shadowColor = h.c;
      ctx.shadowBlur = 18;
      ctx.fillStyle = h.c;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(22, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-22, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px Georgia, "Times New Roman", serif';
    ctx.shadowColor = '#8f9bff';
    ctx.shadowBlur = 30;
    ctx.fillText('STARSHATTER', VIEW_W / 2, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillText('Break the void crystals. Relight the constellations.', VIEW_W / 2, 348);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Five constellations stand between you and the dawn. The last one has a heart.', VIEW_W / 2, 396);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Move:  ← →  or  A / D  or  mouse      Launch:  SPACE or click', VIEW_W / 2, 452);
    ctx.fillText('Catch falling runes for power-ups  ·  P pauses  ·  M mutes  ·  R restarts', VIEW_W / 2, 482);
    const pulse = 0.6 + 0.4 * Math.sin(now * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('— press ENTER or click to begin —', VIEW_W / 2, 560);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawUpgrade(ctx, game, now) {
    this.dim(ctx);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(`${game.level.name} relit!`, VIEW_W / 2, 150);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(`Level bonus +${game.levelBonus.toLocaleString('en-US')} — the forge offers you a gift. Choose one:`, VIEW_W / 2, 192);
    const cardW = 300;
    const cardH = 210;
    const gap = 36;
    const total = cardW * 3 + gap * 2;
    const x0 = (VIEW_W - total) / 2;
    const y0 = 250;
    game.upgradeChoices.forEach((up, i) => {
      const x = x0 + i * (cardW + gap);
      const hover = game.hoverCard === i;
      ctx.save();
      ctx.fillStyle = hover ? '#232c66' : '#161b40';
      ctx.strokeStyle = hover ? PALETTE.gold : '#3a4480';
      ctx.lineWidth = hover ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y0, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y0 + 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Georgia, serif';
      ctx.fillText(up.name, x + cardW / 2, y0 + 84);
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '17px system-ui, sans-serif';
      this.wrapText(ctx, up.blurb, x + cardW / 2, y0 + 122, cardW - 40, 24);
      ctx.restore();
    });
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Click a card, or press 1, 2 or 3.', VIEW_W / 2, 520);
    ctx.textAlign = 'left';
    void now;
  }

  wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  drawPause(ctx, game) {
    this.dim(ctx);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText('Paused', VIEW_W / 2, 330);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('P or ESC to carry on  ·  R to restart from the beginning', VIEW_W / 2, 380);
    ctx.textAlign = 'left';
  }

  drawEnd(ctx, game, won) {
    this.dim(ctx);
    ctx.textAlign = 'center';
    if (won) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 72px Georgia, serif';
      ctx.fillText('DAWN BREAKS', VIEW_W / 2, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 26px Georgia, serif';
      ctx.fillText('The Void Heart shatters. Every constellation burns bright again.', VIEW_W / 2, 300);
    } else {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 72px Georgia, serif';
      ctx.fillText('THE LIGHT FADES', VIEW_W / 2, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 26px Georgia, serif';
      ctx.fillText('The anvil stands empty, and the dark keeps its stars.', VIEW_W / 2, 300);
    }
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`FINAL SCORE  ${game.score.toLocaleString('en-US')}`, VIEW_W / 2, 380);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    const mins = Math.floor(game.playTime / 60);
    const secs = Math.floor(game.playTime % 60).toString().padStart(2, '0');
    ctx.fillText(
      `${game.crystalsShattered} crystals shattered  ·  best combo x${1 + Math.min(TUNING.comboMax - 1, Math.floor(game.maxCombo / TUNING.comboStep))} (${game.maxCombo} hits)  ·  time ${mins}:${secs}`,
      VIEW_W / 2, 424,
    );
    const pulse = 0.6 + 0.4 * Math.sin(game.now * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Press R or click to play again', VIEW_W / 2, 500);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
