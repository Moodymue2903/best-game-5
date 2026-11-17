// CROWNBOUND — live autopilot run in a real browser. Serves game/,
// opens ?auto=1 (or ?auto=lazy), waits for window.__autoResult, prints it.
// Usage: node tools/auto.mjs [lazy]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const repoDir = resolve(process.argv[3] || '/home/hatch/workspace/makefun/best-game-5-repo');
const port = 8102;
const mode = process.argv[2] === 'lazy' ? 'lazy' : '1';
// Match the Node test exactly: seed 1 for the autopilot, seed 7 for lazy.
const seed = mode === 'lazy' ? 7 : 1;
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

const errors = [];
try {
  await waitForServer(`http://127.0.0.1:${port}/index.html`);
  const browser = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?auto=${mode}&seed=${seed}`, { waitUntil: 'load' });
  const result = await page.waitForFunction(() => window.__autoResult || null, null, { timeout: 300000 }).then((h) => h.jsonValue()).catch(() => null);
  console.log('auto mode:', mode);
  console.log('result:', JSON.stringify(result));
  await browser.close();
} finally {
  serve.kill();
}
console.log('console/page errors:', errors.length ? errors : 'none');
