// Starshatter — shared tuning and palette.
// One place for every number the game balances on, so the difficulty curve
// lives here and nowhere else.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// The floor the ball must never touch, and the anvil that guards it.
export const FLOOR_Y = 706;
export const PADDLE_Y = 676;
export const PADDLE_H = 16;

export const TUNING = {
  livesStart: 3,
  livesMax: 5,
  paddleWidthStart: 148,
  paddleWidthMin: 84,
  paddleSpeed: 640, // px per second, keyboard
  paddleShrinkPerLevel: 8, // narrower anvil every constellation
  ballRadius: 9,
  ballSpeedBase: [470, 525, 580, 660, 720], // per level, px per second
  ballSpeedPerBrick: 8, // the hammer quickens as crystals fall
  ballSpeedBonusCap: 150,
  ballServeAngle: 62, // degrees either side of straight up
  comboStep: 5, // every 5 unbroken hits raises the multiplier
  comboMax: 4,
  powerDropChance: 0.18,
  lifeDropChance: 0.03,
  powerFallSpeed: 185,
  lanceInterval: 0.45, // seconds between lance bolts
  lanceDuration: 10,
  wideDuration: 12,
  slowDuration: 8,
  slowFactor: 0.6,
  bossBoltInterval: 2.0, // seconds between Void Heart bolts
  bossBoltSpeed: 300,
  bossBoltPenalty: 0.88, // each bolt that reaches the floor pinches the anvil this much
  bossBoltPenaltyMax: 4, // ...stacking, until the forge recovers
  bossBoltPenaltyTime: 12, // seconds before the anvil recovers its width
};

export const PALETTE = {
  skyTop: '#0a0d2b',
  skyMid: '#141a4a',
  skyBottom: '#05060f',
  star: '#dfe6ff',
  crystal: '#7fe7ff', // 1-hit void crystal
  crystalArmored: '#b388ff', // 2-hit
  crystalHeavy: '#ff7ad9', // 3-hit
  crystalEmber: '#ffb347', // ember: worth triple
  crystalMoving: '#6dffa8', // drifting crystal
  heart: '#ff4d6d', // the Void Heart
  anvil: '#e8ecff',
  anvilTrim: '#8f9bff',
  ball: '#fff3b0',
  bolt: '#ffe9a8',
  voidBolt: '#c77dff',
  hud: '#e8ecff',
  hudDim: '#9aa3c7',
  danger: '#ff5d73',
  gold: '#ffd166',
};

// Points per crystal by its hits, before the combo multiplier.
export const CRYSTAL_POINTS = { 1: 10, 2: 25, 3: 50, ember: 30 };

// The forge upgrades offered between constellations. Three are drawn each time.
export const UPGRADES = [
  {
    id: 'broad',
    name: 'Broad Anvil',
    blurb: 'The anvil grows 14% wider. Room to breathe.',
    apply: (g) => { g.paddleWidthBonus += 0.14; },
  },
  {
    id: 'heavy',
    name: 'Heavy Hammer',
    blurb: 'The hammer hits +1 harder on armoured crystal and the Heart.',
    apply: (g) => { g.hammerDamage += 1; },
  },
  {
    id: 'wind',
    name: 'Second Wind',
    blurb: 'Stoke the forge: +1 life, up to 5.',
    apply: (g) => { g.lives = Math.min(TUNING.livesMax, g.lives + 1); },
  },
  {
    id: 'swift',
    name: 'Swift Hands',
    blurb: 'The anvil slides 12% faster.',
    apply: (g) => { g.paddleSpeedBonus += 0.12; },
  },
  {
    id: 'lucky',
    name: 'Lucky Forge',
    blurb: 'Crystals drop power-ups 10% more often.',
    apply: (g) => { g.dropBonus += 0.10; },
  },
];
