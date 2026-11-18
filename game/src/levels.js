// Starshatter — the five constellations.
// Each level is a picture drawn in characters: '.' is empty space, '1' a
// one-hit void crystal, '2' armoured (two hits), '3' heavy (three hits),
// 'm' a drifting crystal that slides side to side, 'e' an ember crystal
// worth triple points. Twelve columns wide; the grid is centred on the
// canvas. The fifth level is a boss: the Void Heart itself, ringed by
// crystals, shooting void bolts at the anvil.

export const GRID = {
  cols: 12,
  brickW: 92,
  brickH: 30,
  gapX: 6,
  gapY: 10,
  originX: 55,
  originY: 96,
};

export const LEVELS = [
  {
    name: 'LYRA',
    sub: 'the Harp — first light',
    rows: [
      '.1...11...1.',
      '.11..11..11.',
      '.111.11.111.',
      '.1111111111.',
    ],
  },
  {
    name: 'DRACO',
    sub: 'the Dragon — armoured spine',
    rows: [
      '..22222222..',
      '.2........2.',
      '.22.1111.22.',
      '..2.1111.2..',
      '.2..1111..2.',
      '..22222222..',
    ],
  },
  {
    name: 'ORION',
    sub: 'the Hunter — a drifting belt',
    rows: [
      '.2222222222.',
      '.2111111112.',
      '.2mmmmmmmm2.',
      '.2111111112.',
      '.2222222222.',
    ],
  },
  {
    name: 'PHOENIX',
    sub: 'the Firebird — fast and restless',
    rows: [
      '..3..e..3...',
      '.3m......m3.',
      '..e..33..e..',
      '.3m..33..m3.',
      '..3..e..3...',
      '............',
    ],
  },
  {
    name: 'THE VOID HEART',
    sub: 'the last dark — break it and dawn comes',
    rows: [
      '...111111...',
      '..1......1..',
      '.1..2..2..1.',
      '.1........1.',
      '..1......1..',
    ],
    boss: { hp: 30, w: 230, h: 66 },
  },
];

// Count the breakable crystals in a level's rows.
export function countCrystals(rows) {
  let n = 0;
  for (const row of rows) {
    for (const ch of row) {
      if (ch !== '.') n += 1;
    }
  }
  return n;
}
