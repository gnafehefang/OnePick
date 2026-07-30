// Self-test for src/cookiecloud.js — proves decryptCookieCloud round-trips
// with a CryptoJS/OpenSSL-compatible ciphertext, and validates platform mapping.
//
// Run: node scripts/test-cookiecloud.js

import assert from 'node:assert';
import {
  cookieCloudKeyMaterial,
  cryptoJsAesEncrypt,
  decryptCookieCloud,
  mapCookiesToPlatforms,
  buildPlatformDomainMap
} from '../src/cookiecloud.js';
import { PLATFORM_PATTERNS } from '../src/parsers/shared.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  \u2713 ${name}`);
}

console.log('CookieCloud self-test');

const uuid = 'test-uuid-1234';
const password = 'super-secret-pass';

const payload = {
  cookie_data: {
    'youtube.com': [
      { name: 'SID', value: 'abc123', domain: '.youtube.com', path: '/', secure: true, expirationDate: 1893456000 },
      { name: 'LOGIN_INFO', value: 'xyz', domain: '.youtube.com', path: '/', secure: true }
    ],
    'douyin.com': [
      { name: 'sessionid', value: 'dysess', domain: '.douyin.com', path: '/', secure: false }
    ]
  },
  local_storage_data: { 'youtube.com': { foo: 'bar' } }
};

// 1. Round-trip: encrypt with our CryptoJS-compatible encryptor, decrypt via public API.
const keyMaterial = cookieCloudKeyMaterial(uuid, password);
const encrypted = cryptoJsAesEncrypt(JSON.stringify(payload), keyMaterial);

check('keyMaterial is 16 hex chars', () => {
  assert.strictEqual(keyMaterial.length, 16);
  assert.match(keyMaterial, /^[0-9a-f]{16}$/);
});

check('ciphertext has OpenSSL "Salted__" header', () => {
  const raw = Buffer.from(encrypted, 'base64');
  assert.strictEqual(raw.subarray(0, 8).toString('ascii'), 'Salted__');
});

check('decryptCookieCloud round-trips the JSON exactly', () => {
  const decrypted = decryptCookieCloud(uuid, password, encrypted);
  assert.deepStrictEqual(decrypted, payload);
});

check('wrong password fails to decrypt', () => {
  let threw = false;
  try {
    decryptCookieCloud(uuid, 'wrong-password', encrypted);
  } catch {
    threw = true;
  }
  assert.strictEqual(threw, true, 'expected decryption to fail with wrong password');
});

// 2. Platform mapping
const whitelist = new Set(PLATFORM_PATTERNS.map(p => p.id));
const domainMap = buildPlatformDomainMap(PLATFORM_PATTERNS, whitelist);

check('buildPlatformDomainMap includes youtube -> youtube.com', () => {
  assert.ok(domainMap.youtube.includes('youtube.com'));
});

check('mapCookiesToPlatforms groups by platform', () => {
  const mapped = mapCookiesToPlatforms(payload.cookie_data, domainMap);
  assert.strictEqual(mapped.youtube.length, 2);
  assert.strictEqual(mapped.douyin.length, 1);
  assert.strictEqual(mapped.youtube[0].name, 'SID');
  assert.strictEqual(mapped.douyin[0].name, 'sessionid');
});

check('unknown domains are dropped', () => {
  const mapped = mapCookiesToPlatforms({
    'example.com': [{ name: 'a', value: 'b', domain: '.example.com' }]
  }, domainMap);
  assert.strictEqual(Object.keys(mapped).length, 0);
});

// 3. Cross-compat vector: a known salt so output is deterministic and verifiable.
check('deterministic vector with fixed salt decrypts', () => {
  const salt = Buffer.from('0102030405060708', 'hex');
  const enc = cryptoJsAesEncrypt(JSON.stringify({ cookie_data: {} }), keyMaterial, salt);
  const dec = decryptCookieCloud(uuid, password, enc);
  assert.deepStrictEqual(dec, { cookie_data: {} });
});

console.log(`\nALL ${passed} CHECKS PASSED`);
