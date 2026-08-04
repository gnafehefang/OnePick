import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const YOUTUBE_REQUIRED_COOKIE_NAMES = [
  'SID', 'HSID', 'SSID', 'APISID', 'SAPISID',
  '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO'
];

export function youtubeCookiePaths(cookieDir = process.env.COOKIE_DIR || '/app/cookies') {
  return {
    legacy: path.join(cookieDir, 'youtube.txt'),
    candidate: path.join(cookieDir, 'youtube.candidate.txt'),
    master: path.join(cookieDir, 'youtube.master.txt'),
    status: path.join(cookieDir, 'youtube.master.json')
  };
}

export function inspectYoutubeCookieText(text = '') {
  const names = new Set();
  const domains = new Set();
  let count = 0;
  for (const line of String(text).split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    count += 1;
    domains.add(parts[0]);
    names.add(parts[5]);
  }
  const missing = YOUTUBE_REQUIRED_COOKIE_NAMES.filter(name => !names.has(name));
  return { count, domains: [...domains].sort(), names: [...names].sort(), missing, complete: missing.length === 0 };
}

function atomicWrite(filePath, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  fs.writeFileSync(temp, content, { mode });
  fs.renameSync(temp, filePath);
}

export function activeYoutubeMasterPath(cookieDir = process.env.COOKIE_DIR || '/app/cookies') {
  const paths = youtubeCookiePaths(cookieDir);
  for (const filePath of [paths.master, paths.legacy]) {
    try {
      if (fs.statSync(filePath).size > 0) return filePath;
    } catch { /* continue */ }
  }
  return '';
}

export async function promoteYoutubeCandidate(content, {
  cookieDir = process.env.COOKIE_DIR || '/app/cookies',
  validate
} = {}) {
  const summary = inspectYoutubeCookieText(content);
  if (!summary.complete) {
    const error = new Error(`YouTube Cookie 候选缺少关键登录态：${summary.missing.join(', ')}`);
    error.errorClass = 'incomplete';
    throw error;
  }
  const paths = youtubeCookiePaths(cookieDir);
  fs.mkdirSync(cookieDir, { recursive: true });
  const candidateDir = fs.mkdtempSync(path.join(cookieDir, '.youtube-candidate-'));
  const candidatePath = path.join(candidateDir, 'cookies.txt');
  fs.writeFileSync(candidatePath, content, { mode: 0o600 });
  let result;
  try {
    result = validate ? await validate(candidatePath, summary) : { ok: true };
  } catch (cause) {
    result = { ok: false, errorClass: cause.errorClass || 'validation-error', message: cause.message };
  } finally {
    fs.rmSync(candidateDir, { recursive: true, force: true });
  }
  if (!result?.ok) {
    const error = new Error(`YouTube Cookie 候选验证失败：${result?.errorClass || 'unknown'}`);
    error.errorClass = result?.errorClass || 'validation-error';
    throw error;
  }
  atomicWrite(paths.master, content);
  atomicWrite(paths.status, JSON.stringify({
    promotedAt: new Date().toISOString(),
    count: summary.count,
    domains: summary.domains,
    names: summary.names,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
    validation: { ok: true }
  }, null, 2) + '\n');
  return { promoted: true, summary, master: paths.master, candidate: candidatePath };
}

export async function withRuntimeCookieArgs(platformId, callback, {
  cookieDir = process.env.COOKIE_DIR || '/app/cookies'
} = {}) {
  if (String(platformId) !== 'youtube') return callback([], '');
  const master = activeYoutubeMasterPath(cookieDir);
  if (!master) return callback([], '');
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onepick-youtube-cookie-'));
  const runtimePath = path.join(runtimeDir, 'cookies.txt');
  try {
    fs.copyFileSync(master, runtimePath);
    fs.chmodSync(runtimePath, 0o600);
    return await callback(['--cookies', runtimePath], runtimePath);
  } finally {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
}
