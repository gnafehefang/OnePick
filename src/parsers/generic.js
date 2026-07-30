import { makeYtDlpParser } from './ytdlp-parser.js';

const genericYtDlp = makeYtDlpParser('generic');

export async function parseGeneric({ url, platform, preferences }) {
  try {
    return await genericYtDlp({ url, platform: platform || { id: 'generic', name: '通用链接' }, preferences });
  } catch (error) {
    const name = platform?.name || platform?.id || '当前站点';
    const wrapped = new Error(`${name} 通用 yt-dlp 兜底暂未解析成功。请确认该链接是公开可访问的单个媒体页；若该站点需要登录/动态接口，需补专用解析器。诊断：${error.message}`);
    wrapped.statusCode = error.statusCode || 422;
    throw wrapped;
  }
}
