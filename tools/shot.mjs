// CROWNBOUND — screenshot runner. Serves game/ locally, opens each
// staged shot (?shot=cover|play|title|victory), waits for window.__shotReady,
// and saves a 1280x720 JPEG under screenshots/. Usage:
//   node tools/shot.mjs [port]
// Chromium runs with --no-proxy-server: the game makes zero network
// requests, so no proxy is needed for local pages.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { statSync } from 'node:fs';

const repoDir = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8099);
const node22 = '/home/hatch/workspace/makefun/node22/node-v22.23.5-linux-x64/bin/node';

const serve = spawn(node22, [join(repoDir, 'serve.ts'), '--port', String(port)], { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] });
let serveLog = '';
serve.stdout.on('data', (d) => { serveLog += d; });
serve.stderr.on('data', (d) => { serveLog += d; });

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolveOk, reject) => {
    (function probe() {
      fetch(url).then((r) => { if (r.ok) resolveOk(); else retry(); }).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('server did not start: ' + serveLog));
        else setTimeout(probe, 200);
      }
    })();
  });
}

const shots = [
  ['cover', '1-cover.jpg'],
  ['play', '2-play.jpg'],
  ['title', '3-title.jpg'],
  ['victory', '4-victory.jpg'],
];

const errors = [];
try {
  await waitForServer(`http://127.0.0.1:${port}/index.html`);
  const browser = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  for (const [shot, file] of shots) {
    await page.goto(`http://127.0.0.1:${port}/index.html?shot=${shot}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
    } catch (e) {
      errors.push(shot + ': __shotReady never became true');
    }
    await page.waitForTimeout(400);
    const path = join(repoDir, 'screenshots', file);
    await page.screenshot({ path, type: 'jpeg', quality: 85 });
    const size = statSync(path).size;
    console.log(shot, '->', file, size, 'bytes', size < 262144 ? 'OK' : 'OVER 256KiB!');
  }
  await browser.close();
} finally {
  serve.kill();
}
console.log('console/page errors:', errors.length ? errors : 'none');
