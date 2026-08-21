import assert from 'node:assert/strict';
import { detectPlatform, listSupportedPlatforms, parseMedia } from '../src/parsers/index.js';
import { extractTwitterStatusId } from '../src/parsers/twitter.js';

assert.equal(detectPlatform('https://x.com/example/status/1812345678901234567').id, 'twitter');
assert.equal(detectPlatform('https://twitter.com/example/status/1812345678901234567').id, 'twitter');
assert.equal(extractTwitterStatusId('https://x.com/example/status/1812345678901234567?s=20'), '1812345678901234567');
assert.equal(listSupportedPlatforms().find(p => p.id === 'twitter')?.parser, 'dedicated');

const originalFetch = globalThis.fetch;
let routedToSyndication = '';
globalThis.fetch = async (url) => {
  routedToSyndication = String(url);
  return new Response(JSON.stringify({
    id_str: '1812345678901234567',
    text: 'Router test tweet',
    mediaDetails: [{
      type: 'video',
      video_info: { variants: [{ content_type: 'video/mp4', bitrate: 256000, url: 'https://video.twimg.com/router-test.mp4' }] }
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
try {
  const parsed = await parseMedia({ input: 'https://x.com/example/status/1812345678901234567' });
  assert.equal(parsed.parser, 'twitter');
  assert.equal(parsed.engine, 'twitter-syndication');
  assert.match(routedToSyndication, /cdn\.syndication\.twimg\.com\/tweet-result/);
} finally {
  globalThis.fetch = originalFetch;
}

await assert.rejects(
  () => parseMedia({ input: 'https://x.com/someuser' }),
  /主页\/用户页链接|不是单条推文/
);

console.log('twitter parser tests passed');
