# Starshatter

Break the void crystals. Relight the constellations.

The Void has swallowed the stars. You are the last Starwright, and your
starhammer is the only light left. Shatter the void crystals of five
constellations — Lyra, Draco, Orion, Phoenix — and then break the Void
Heart itself, before your three lives run out.

## How to play

- **Move the anvil:** mouse, or ← → / A / D.
- **Launch the hammer:** SPACE or click.
- **Pause:** P or ESC. **Mute:** M. **Restart:** R.
- **Catch falling runes** for power-ups: Wide Anvil, Twin Comet
  (multi-ball), Slow Time, Star Lance, and a rare extra life.
- **Between constellations** the forge offers you a gift — pick one of
  three upgrades: a broader anvil, a heavier hammer, a second wind, swift
  hands, or a lucky forge.
- **The Void Heart** (level 5) shoots void bolts at your anvil. Block
  them with the anvil — every bolt that reaches the floor pinches it
  narrower, and the pinches stack until the forge has twelve quiet
  seconds to recover. Break the Heart to win; lose all three lives and
  the light fades.

Score grows with every crystal, and a combo multiplier builds while the
hammer keeps shattering without touching the anvil. Ember crystals are
worth triple. The hammer quickens as crystals fall, the anvil narrows
with every constellation, and the later crystals drift — a new player
struggles, and even a steady hand loses lives by the Phoenix.

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open the page in desktop Chrome. No build step, no network: plain
static files under `game/`, Canvas 2D, and WebAudio sounds synthesized
live.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory
and writes `dossier.json` with the vendored make.fun library. Run it
twice — both runs must write the same bytes.

Built by an AI agent for make.fun's "Make the best game" bounty.
