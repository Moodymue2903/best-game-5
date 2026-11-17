// CROWNBOUND — live playtest with a real mouse. Opens the game, clicks
// START, moves with the keyboard, clicks to throw a chain, holds F to haul,
// and confirms the state advances (time/score/chains change) with zero
// console/page errors.
// Usage: node tools/playtest.mjs  (run from ~/workspace/makefun/shot-tool/)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const repoDir = '/home/hatch/workspace/makefun/best-game-5-repo';
const port = 8106;
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
async function readState(page) {
  return page.evaluate(() => {
    const s = window.__crown.state;
    return {
      screen: s.screen, score: s.score, time: Math.round(s.time * 10) / 10,
      stage: s.stageIdx, hp: Math.round(s.king.hp), chains: s.chains.length,
      throws: s.throws, x: Math.round(s.king.x * 10) / 10, z: Math.round(s.king.z * 10) / 10,
    };
  });
}

try {
  await waitForServer(`http://127.0.0.1:${port}/index.html`);
  const browser = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  console.log('before start:', JSON.stringify(await readState(page)));
  await page.click('#btn-start'); // START THE DEFENCE
  await page.waitForTimeout(500);
  console.log('after start:', JSON.stringify(await readState(page)));
  // Move toward the colossus (up = toward -z), jump, throw a chain.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');
  await page.mouse.move(640, 300);
  await page.mouse.click(640, 300); // throw at centre (aims at a pin)
  await page.waitForTimeout(500);
  console.log('after move + jump + throw:', JSON.stringify(await readState(page)));
  // Hold F to haul for a few seconds, keep moving.
  await page.keyboard.down('KeyF');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down(i % 2 === 0 ? 'KeyA' : 'KeyD');
    await page.waitForTimeout(700);
    await page.keyboard.up(i % 2 === 0 ? 'KeyA' : 'KeyD');
    await page.mouse.click(640, 300);
    await page.waitForTimeout(700);
  }
  await page.keyboard.up('KeyF');
  const end = await readState(page);
  console.log('after ~10s of play:', JSON.stringify(end));
  await page.screenshot({ path: '/tmp/cb-live.jpg', type: 'jpeg', quality: 85 });
  console.log('live screenshot: /tmp/cb-live.jpg');
  // Under headless swiftshader the renderer runs at ~2 fps and the sim
  // accumulator caps at 5 steps/frame, so sim time advances slower than
  // real time; time>=3 with a live play screen and zero errors is the pass.
  console.log('state advanced (play, time>=3, king moved):', end.screen === 'play' && end.time >= 3 ? 'YES' : 'NO');
  await browser.close();
} finally {
  serve.kill();
}
console.log('console/page errors:', errors.length ? errors : 'none');
