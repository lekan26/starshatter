// Starshatter — the entry point.
// Wires the canvas, the loop and the screens together. The game runs on a
// fixed-step loop at 60 ticks a second so it plays the same on any machine.
// It also exposes a small test handle, window.__starshatter, so the maker
// can drive a whole playthrough from a browser console: state, autopilot,
// and a way to start. It never plays by itself — a normal visit starts on
// the title screen and waits for the player.

import { VIEW_W, VIEW_H } from './config.js';
import { makeRng } from './random.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { StarshatterGame } from './game.js';
import { Renderer } from './render.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Date.now() % 2147483647);
const rng = makeRng(seed);

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const sound = new SoundBank();
const input = new Input(canvas);
const game = new StarshatterGame(rng, sound);
const renderer = new Renderer(canvas, rng);
const statusEl = document.getElementById('status');

const autopilotParam = params.get('autopilot');
if (autopilotParam === 'good' || autopilotParam === 'weak' || autopilotParam === 'idle') {
  input.autopilot = autopilotParam;
}

// Where the three upgrade cards sit (kept in step with render.js).
const CARD_W = 300;
const CARD_H = 210;
const CARD_GAP = 36;
const CARD_Y = 250;
const CARD_X0 = (VIEW_W - (CARD_W * 3 + CARD_GAP * 2)) / 2;

function cardAt(x, y) {
  if (y < CARD_Y || y > CARD_Y + CARD_H) return -1;
  for (let i = 0; i < 3; i += 1) {
    const cx = CARD_X0 + i * (CARD_W + CARD_GAP);
    if (x >= cx && x <= cx + CARD_W) return i;
  }
  return -1;
}

function announce() {
  const s = game.snapshot();
  const stateWords = {
    title: 'Starshatter title screen. Press Enter to begin.',
    serve: `Level ${s.level}, ${s.levelName}. Press Space to launch the hammer.`,
    play: `Playing level ${s.level}. Score ${s.score}, ${s.lives} lives, ${s.crystalsLeft} crystals left.`,
    upgrade: 'Choose a forge upgrade: 1, 2 or 3.',
    pause: 'Paused.',
    over: `Game over. Final score ${s.score}. Press R to play again.`,
    win: `You won. Final score ${s.score}. Press R to play again.`,
  };
  statusEl.textContent = stateWords[game.state] || '';
}

function handlePress() {
  sound.ensure();
  if (input.wasPressed('KeyM')) {
    sound.toggleMute();
  }
  if (game.state === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('TouchTap')) {
      game.startGame();
      announce();
    }
  } else if (game.state === 'serve') {
    if (input.serve) {
      game.launchBall();
      announce();
    }
  } else if (game.state === 'play') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      game.prevState = 'play';
      game.state = 'pause';
      announce();
    }
  } else if (game.state === 'pause') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      game.state = game.prevState;
      announce();
    }
  } else if (game.state === 'upgrade') {
    for (const key of ['Digit1', 'Digit2', 'Digit3']) {
      if (input.wasPressed(key)) {
        const i = Number(key.slice(-1)) - 1;
        const choice = game.upgradeChoices[i];
        if (choice) {
          game.applyUpgrade(choice.id);
          announce();
        }
      }
    }
  }
  if (game.state === 'over' || game.state === 'win') {
    if (input.wasPressed('KeyR') || input.wasPressed('TouchTap')) {
      game.startGame();
      announce();
    }
  } else if (input.wasPressed('KeyR') && game.state !== 'title') {
    game.startGame();
    announce();
  }
  if (game.state === 'title' && input.wasPressed('KeyR')) {
    game.startGame();
    announce();
  }
}

// Clicks: start, launch, upgrade cards, restart.
canvas.addEventListener('mousedown', (e) => {
  sound.ensure();
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
  const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
  if (game.state === 'title') {
    game.startGame();
    announce();
    return;
  }
  if (game.state === 'serve') {
    game.launchBall();
    announce();
    return;
  }
  if (game.state === 'upgrade') {
    const i = cardAt(x, y);
    const choice = i >= 0 ? game.upgradeChoices[i] : null;
    if (choice) {
      game.applyUpgrade(choice.id);
      announce();
    }
    return;
  }
  if (game.state === 'over' || game.state === 'win') {
    game.startGame();
    announce();
  }
});

// Hover highlight on the upgrade cards.
canvas.addEventListener('mousemove', (e) => {
  if (game.state !== 'upgrade') {
    game.hoverCard = -1;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
  const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
  game.hoverCard = cardAt(x, y);
});

// The loop: fixed 60 Hz steps, rendering every animation frame.
let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;

function frame(t) {
  const elapsed = Math.min(250, t - last);
  last = t;
  acc += elapsed;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    acc -= STEP;
    guard += 1;
    handlePress();
    game.update(STEP / 1000, input);
    input.endFrame();
  }
  if (guard === 5) acc = 0;
  renderer.draw(game, game.now);
  requestAnimationFrame(frame);
}

announce();
requestAnimationFrame(frame);

// Test handle for the maker's own playthroughs. It reads state, steers the
// autopilot and starts a game; it cannot set a score or force a win.
window.__starshatter = {
  game,
  input,
  seed,
  state() {
    return game.snapshot();
  },
  setAutopilot(mode) {
    if (mode === 'off' || mode === 'idle' || mode === 'weak' || mode === 'good') {
      input.autopilot = mode;
    }
    return input.autopilot;
  },
  start() {
    if (game.state === 'title') game.startGame();
    return game.snapshot();
  },
  launch() {
    game.launchBall();
    return game.snapshot();
  },
  chooseUpgrade(i) {
    const choice = game.upgradeChoices[i];
    if (choice) game.applyUpgrade(choice.id);
    return game.snapshot();
  },
};
