import assert from 'node:assert/strict';
import { extractAwemeFromJson } from '../src/parsers/douyin.js';
import { candidateUrlsForItem, parseDownloadFallback, serializeDownloadFallback } from '../src/media-download-utils.js';

const wrapper = 'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v2700fgi0000dbdbncnog65vvhp9fk6g&ratio=720p&line=0';
function item(urls, engine = 'douyin-share') {
  return extractAwemeFromJson({ aweme_detail: {
    aweme_id: '1234567890', video: { play_addr: { url_list: urls } }
  } }, { engine }).items[0];
}
const parsed = item([wrapper]);
const candidates = candidateUrlsForItem(parsed);
assert.equal(candidates.length, 2, 'official video has an alternate CDN line when the primary returns 502');
assert.equal(new URL(candidates[0]).pathname, '/aweme/v1/play/');
assert.equal(new URL(candidates[0]).searchParams.get('line'), '0');
assert.equal(new URL(candidates[1]).searchParams.get('line'), '1');
for (const url of candidates) {
  const u = new URL(url);
  assert.equal(u.origin, 'https://aweme.snssdk.com');
  assert.equal(u.pathname, '/aweme/v1/play/', 'do not fall back to watermarked playback');
  assert.equal(u.searchParams.get('video_id'), 'v2700fgi0000dbdbncnog65vvhp9fk6g');
  assert.equal(u.searchParams.get('ratio'), '720p');
}
assert.deepEqual(parseDownloadFallback(serializeDownloadFallback(parsed.urlCandidates)), candidates);
assert.deepEqual(candidateUrlsForItem(item([wrapper, wrapper])), candidates, 'deduplicate');
assert.equal(candidateUrlsForItem(item([wrapper.replace('line=0', 'line=1')]))[1], candidates[0]);
assert.equal(candidateUrlsForItem(item([wrapper.replace('&line=0', '')])).length, 2);
const cdn = 'https://cdn.example/video.mp4?sign=opaque%2Fvalue&line=0';
const backup = 'https://backup.example/video.mp4?sign=second%2Fvalue';
assert.deepEqual(candidateUrlsForItem(item([cdn, backup])), [cdn, backup], 'preserve all supplied CDN candidates verbatim');
assert.deepEqual(candidateUrlsForItem(item([cdn, backup], 'douyin-direct')), [cdn, backup]);
for (const url of [
  cdn,
  wrapper.replace('aweme.snssdk.com', 'aweme.snssdk.com.evil.example'),
  wrapper.replace('aweme.snssdk.com', 'user:password@aweme.snssdk.com'),
  wrapper.replace('aweme.snssdk.com', 'aweme.snssdk.com:8443'),
  wrapper.replace('/playwm/', '/other/'),
  wrapper.replace('v2700fgi0000dbdbncnog65vvhp9fk6g', 'https%3A%2F%2Fexample.com%2Fa.mp3'),
  wrapper + '&signature=opaque%2Fvalue',
  wrapper + '&line=1',
  wrapper.replace('line=0', 'line=9')
]) {
  assert.deepEqual(candidateUrlsForItem(item([url])), [url], 'never rewrite untrusted, signed, ambiguous or unsupported wrappers');
}
assert.deepEqual(candidateUrlsForItem(item([wrapper], 'douyin-direct')), [wrapper], 'synthetic fallback is share-only');
assert.equal(candidateUrlsForItem(item(Array.from({ length: 10 }, (_, i) => 'https://cdn.example/' + i))).length, 5);
console.log('Douyin video fallback regression passed');
