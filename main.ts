// Starshatter — the hand-in program for make.fun best-game-01.
// Node 22, standard library only. The game itself is the plain static
// files under game/ (game/index.html and its ES modules, no library, no
// network request), and the screenshots are under screenshots/. This
// program copies both into the output directory and writes dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output, and run it twice: both runs must write the same bytes.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally while building it with `node serve.ts`, then
// open http://localhost:8080 in desktop Chrome.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file sits in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += countFiles(path);
    else if (entry.isFile()) total += 1;
  }
  return total;
}

function main() {
  if (!existsSync(gameDir)) {
    throw new Error(`game/ is missing beside main.ts: ${gameDir}`);
  }
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });

  // The screenshots are the maker's own renders of the game. They are
  // optional while the game is still being built, required for the entry.
  let shotCount = 0;
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
    shotCount = readdirSync(shotsDir).filter((name) => {
      const st = statSync(join(shotsDir, name));
      return st.isFile() && !name.startsWith('.');
    }).length;
  }

  // The scorer's own caps, as the kit names them: only text_max_bytes
  // shapes the dossier's bytes; the rest refuse an entry the scorer
  // would refuse (more than 4 screenshots or one over 256 KiB; more
  // than 993 files in game/ or 48 MiB of game files, or a path under
  // game/ over 1000 bytes — game/ counts beside /output's own
  // 1000-entry cap, its screenshots/ and dossier.json).
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const gameFiles = countFiles(join(outDir, 'game'));
  console.log(
    `starshatter handed in: ${gameFiles} game files, ${shotCount} screenshots, ` +
    `dossier.json ${dossier.length} bytes -> ${outDir}`,
  );
}

main();
