import assert from 'node:assert/strict';
import { parseDouyin, extractAwemeFromJson, extractDouyinShareHtml } from '../src/parsers/douyin.js';
const id = '7694488517107305768';
const media = 'https://media.example/video.mp4?signature=opaque%2Fvalue';
const aweme = { aweme_id: id, desc: 'share fixture', video: { play_addr: { url_list: [media] }, duration: 12000 } };
const html = `<script>window._ROUTER_DATA = ${JSON.stringify({ loaderData: { video_layout: null, 'video_(id)/page': { videoInfoRes: { item_list: [aweme], status_code: 0 } } } })};</script>`;
const original = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  const u = new URL(url); calls.push({ u, options });
  if (u.pathname.includes('/aweme/detail/')) return new Response('Blocked by ArgusSecurityPlugin Uifid Not Found', { status: 403, headers: { 'content-type': 'text/plain' } });
  if (u.pathname === `/share/video/${id}/`) return new Response(html, { headers: { 'content-type': 'text/html' } });
  return new Response('', { status: 200 });
};
try {
  const result = await parseDouyin({ url: `https://www.douyin.com/video/${id}`, platform: { id: 'douyin', name: '抖音' } });
  assert.equal(result.items[0].url, 'https://media.example/video.mp4?signature=opaque%2Fvalue');
  assert.equal(result.parser, 'douyin-share');
  const shareCall = calls.find(({u}) => u.pathname === `/share/video/${id}/`);
  assert.ok(shareCall);
  assert.equal(shareCall.u.origin, 'https://www.douyin.com', 'never forward desktop cookies to a different domain');
  assert.equal(shareCall.options.redirect, 'manual', 'do not forward credentials across redirects');
  assert.ok(shareCall.options.signal instanceof AbortSignal);
  assert.ok(!JSON.stringify(result.diagnostics).includes('opaque%2Fvalue'));
} finally { globalThis.fetch = original; }
assert.equal(extractDouyinShareHtml(html, '111'), null, 'never return a different work');
assert.equal(extractDouyinShareHtml('<html>challenge</html>', id), null);
assert.equal(extractDouyinShareHtml('<script>window._ROUTER_DATA = {broken}</script>', id), null);
assert.equal(extractDouyinShareHtml(html.replace('"status_code":0', '"status_code":1'), id), null);
assert.equal(extractDouyinShareHtml('<script>window._ROUTER_DATA = (() => { throw 1 })()</script>', id), null);
assert.equal(extractDouyinShareHtml(html.replace('"video_layout":null,', ''), id).items[0].url, media);
const audio = 'https://media.example/narration.mp3?signature=opaque%2Fvalue&x=1';
const note = {
  aweme_id: id, desc: 'note fixture', images: [{ url_list: ['https://media.example/photo.webp'] }],
  music: { duration: 22 },
  video: { play_addr: { uri: audio, url_list: [`https://aweme.snssdk.com/aweme/v1/playwm/?video_id=${encodeURIComponent(audio)}&ratio=720p&line=0`] } }
};
const noteHtml = item => `<script>window._ROUTER_DATA = ${JSON.stringify({ loaderData: { 'note_(id)/page': { videoInfoRes: { status_code: 0, item_list: [item] } } } })}</script>`;
const parsedNote = extractDouyinShareHtml(noteHtml(note), id);
assert.deepEqual(parsedNote.items.map(item => item.type), ['image', 'audio']);
assert.equal(parsedNote.items[1].url, audio, 'opaque signed audio URL preserved exactly');
assert.equal(parsedNote.items[1].duration, 22);
assert.equal(parsedNote.items[1].ext, 'mp3');
assert.equal(extractAwemeFromJson({ aweme_detail: note }).items.length, 1, 'share-only fallback');
const musicNote = structuredClone(note);
musicNote.music.play_url = { url_list: ['https://media.example/preferred.m4a'] };
assert.equal(extractDouyinShareHtml(noteHtml(musicNote), id).items[1].url, 'https://media.example/preferred.m4a');
const officialPlay = 'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v0300fg10000db5171fog65mdo4j37e0&ratio=720p&line=0';
const officialAweme = { aweme_id: id, desc: 'official wrapper', video: { play_addr: { url_list: [officialPlay] } } };
const officialParsed = extractDouyinShareHtml(noteHtml(officialAweme), id);
assert.equal(new URL(officialParsed.items[0].url).pathname, '/aweme/v1/play/');
assert.equal(new URL(officialParsed.items[0].url).searchParams.get('video_id'), 'v0300fg10000db5171fog65mdo4j37e0');

for (const [uri, wrapper] of [
  [audio, `https://evil.example/aweme/v1/playwm/?video_id=${encodeURIComponent(audio)}`],
  [audio, `https://aweme.snssdk.com/other/?video_id=${encodeURIComponent(audio)}`],
  [audio, 'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=opaque-id'],
  ['opaque-id', 'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=opaque-id'],
  ['http://media.example/a.mp3', 'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=http%3A%2F%2Fmedia.example%2Fa.mp3'],
  ['https://media.example/a.mp4', 'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=https%3A%2F%2Fmedia.example%2Fa.mp4']
]) {
  const invalid = structuredClone(note);
  invalid.video.play_addr = { uri, url_list: [wrapper] };
  assert.deepEqual(extractDouyinShareHtml(noteHtml(invalid), id).items.map(item => item.type), ['image']);
}
console.log('Douyin share fallback regression passed');
