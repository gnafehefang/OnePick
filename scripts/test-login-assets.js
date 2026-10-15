import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(os.tmpdir(), 'onepick-login-assets-'));
let child;
let closed;
let logs = '';
let failures = 0;
let passed = 0;
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
try {
  const dataDir = path.join(temp, 'data');
  const cookieDir = path.join(temp, 'cookies');
  await mkdir(dataDir);
  await mkdir(cookieDir);
  const reservation = net.createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  // Deliberately do not inherit production credentials, proxies or storage paths.
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME: temp,
      TMPDIR: temp,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR: dataDir,
      COOKIE_DIR: cookieDir,
      ONEPICK_AUTH_USER: 'login-assets-test',
      ONEPICK_AUTH_PASSWORD: randomBytes(32).toString('hex'),
      ONEPICK_AUTH_SECRET: randomBytes(32).toString('hex'),
      ONEPICK_API_TOKEN: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  closed = once(child, 'close');
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  const base = `http://127.0.0.1:${port}`;
  const request = (url, method = 'GET') => fetch(base + url, {
    method, redirect: 'manual', signal: AbortSignal.timeout(3000)
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Server exited: ${logs}`);
    // Require this child's listening message, not a process winning the port race.
    if (logs.includes(`OnePick Tools listening on :${port}`)) {
      try {
        const health = await request('/api/health');
        assert.equal(health.status, 200);
        assert.equal((await health.json()).authEnabled, true);
        ready = true;
        break;
      } catch { /* Retry until startup deadline. */ }
    }
    await delay(100);
  }
  assert.ok(ready, `Isolated authenticated server did not start: ${logs}`);
  const check = async (name, fn) => {
    try { await fn(); passed++; console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
  };
  await check('login page is public', async () => {
    const response = await request('/login');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /logo\.png/);
  });
  for (const asset of ['logo.png', 'favicon.png']) {
    const expected = await readFile(path.join(root, 'public', asset));
    for (const query of ['', '?v=2.4.71']) {
      for (const method of ['GET', 'HEAD']) {
        const url = `/${asset}${query}`;
        await check(`${method} ${url} is public PNG`, async () => {
          const response = await request(url, method);
          assert.equal(response.status, 200, `expected 200, got ${response.status} (${response.headers.get('location')})`);
          assert.equal(response.headers.get('location'), null);
          assert.match(response.headers.get('content-type') || '', /^image\/png\b/);
          assert.equal(Number(response.headers.get('content-length')), expected.length);
          const body = Buffer.from(await response.arrayBuffer());
          if (method === 'HEAD') assert.equal(body.length, 0);
          else {
            assert.deepEqual(body.subarray(0, 8), pngSignature);
            assert.deepEqual(body, expected);
          }
        });
      }
    }
  }
  for (const method of ['GET', 'HEAD']) {
    for (const url of ['/api/history', '/api/cookies', '/api/runtime']) {
      await check(`${method} ${url} remains protected`, async () => {
        const response = await request(url, method);
        assert.equal(response.status, 401);
        if (method === 'GET') assert.equal((await response.json()).authRequired, true);
      });
    }
    for (const url of ['/app.js', '/app.js?v=2.4.71', '/env.js', '/icons/acfun.svg', '/logo.png/', '/favicon.png/', '/LOGO.PNG', '/favicon.png/extra', '/public/logo.png']) {
      await check(`${method} ${url} remains protected`, async () => {
        const response = await request(url, method);
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), `/login?next=${encodeURIComponent(url)}`);
      });
    }
  }
  console.log(`login assets: ${passed} passed, ${failures} failed`);
  if (failures) process.exitCode = 1;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    try { await closed; } finally { clearTimeout(killTimer); }
  }
  await rm(temp, { recursive: true, force: true });
}
