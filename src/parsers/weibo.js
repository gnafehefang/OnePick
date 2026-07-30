import { resolveRedirects } from './shared.js';

export function extractWeiboId(url = '') {
  const text = String(url);
  const patterns = [
    /\/status\/(\d+)/i,
    /\/status\/(\w+)/i,
    /\/detail\/(\d+)/i,
    /\/tv\/show\/(\d+:[A-Za-z0-9]+)/i,
    /[?&](?:mid|id)=(\d+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return '';
}

function isProfileOrHome(url = '') {
  return /weibo\.com\/?(?:$|[?#])|weibo\.com\/(?:u\/)?\d+\/?(?:$|[?#])/i.test(url);
}

function isLoginOrError(url = '') {
  return /login|passport|error|404|verify/i.test(url);
}

export async function parseWeibo({ url }) {
  const resolved = await resolveRedirects(url);
  const weiboId = extractWeiboId(resolved.finalUrl) || extractWeiboId(url);
  if (isLoginOrError(resolved.finalUrl)) {
    const error = new Error('微博链接触发登录/错误页。请换一个公开视频链接，或配置微博 Cookie 后再解析。');
    error.statusCode = 422;
    throw error;
  }
  if (!weiboId && isProfileOrHome(resolved.finalUrl)) {
    const error = new Error('这是微博主页/用户页链接，不是单条微博。请粘贴微博详情链接。');
    error.statusCode = 422;
    throw error;
  }
  const error = new Error('微博专用解析器尚未接入可用接口；按 OnePick 策略，非 YouTube 不使用通用下载器兜底。');
  error.statusCode = 501;
  throw error;
}
