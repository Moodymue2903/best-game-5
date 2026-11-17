// CROWNBOUND — the entrypoint handed to make.fun. Node 22, standard
// library only. It copies the game's files and its screenshots into the
// output directory and writes dossier.json with the vendored make.fun
// library, so the judge reads exactly what the browser plays.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');

function measure(dir) {
  let bytes = 0;
  let files = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = measure(p);
      bytes += sub.bytes;
      files += sub.files;
    } else {
      bytes += statSync(p).size;
      files += 1;
    }
  }
  return { bytes, files };
}

if (!existsSync(gameSrc)) throw new Error('game/ is missing from the repository');
const gameSize = measure(gameSrc);
if (gameSize.files > 993) throw new Error('game/ has ' + gameSize.files + ' files, over the 993 cap');
if (gameSize.bytes > 48 * 1024 * 1024) throw new Error('game/ is ' + gameSize.bytes + ' bytes, over the 48 MiB cap');

mkdirSync(dest, { recursive: true });
cpSync(gameSrc, join(dest, 'game'), { recursive: true });
mkdirSync(join(dest, 'screenshots'), { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(dest, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(dest, 'dossier.json'),
  buildDossier(dest, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('CROWNBOUND handed in: ' + gameSize.files + ' game files, ' + gameSize.bytes + ' bytes.');
