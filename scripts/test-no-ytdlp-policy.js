
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const parserDir = path.join(process.cwd(), 'src', 'parsers');
const allowed = new Set(['shared.js', 'youtube.js']);
const offenders = [];
for (const name of fs.readdirSync(parserDir)) {
  if (!name.endsWith('.js') || allowed.has(name)) continue;
  const content = fs.readFileSync(path.join(parserDir, name), 'utf8');
  if (/parseWithYtDlp|getCookieArgs\(|execFileAsync\(['"]yt-dlp['"]/i.test(content)) offenders.push(name);
}
assert.deepEqual(offenders, [], `non-YouTube parsers must not call yt-dlp: ${offenders.join(', ')}`);
console.log('no non-youtube yt-dlp policy passed');
