// ==UserScript==
// @name         OnePick
// @namespace    onepick
// @version      1.28.0
// @description  在支持站点页面插入 OnePick 下载按钮；支持逐站点开关；使用浏览器原生下载器保证落盘可靠。
// @author       Hugh
// @match        https://*.douyin.com/*
// @match        https://*.bilibili.com/*
// @match        https://*.youtube.com/*
// @match        https://youtu.be/*
// @match        https://*.tiktok.com/*
// @match        https://*.x.com/*
// @match        https://*.twitter.com/*
// @match        https://*.instagram.com/*
// @match        https://*.facebook.com/*
// @match        https://*.weibo.com/*
// @match        https://*.weibo.cn/*
// @match        https://*.xiaohongshu.com/*
// @match        https://*.kuaishou.com/*
// @match        https://*.acfun.cn/*
// @match        https://www.acfun.cn/*
// @match        https://*.pinterest.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  /* ===== 服务器分发时自动注入（保持原样，勿改动此两行格式） ===== */
  const PRESET_SERVER = '__ONEPICK_SERVER__';
  const PRESET_TOKEN = '__ONEPICK_TOKEN__';
  const preset = v => (v && !/^__ONEPICK_/.test(v)) ? v : '';

  const q = sel => { try { return document.querySelector(sel); } catch { return null; } };
  const findByText = (selectors, re) => {
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const txt = (el.textContent || '').trim();
        if (re.test(txt)) return el;
      }
    }
    return null;
  };
  const findIn = (root, selectors, re) => {
    if (!root) return null;
    for (const sel of selectors) {
      for (const el of root.querySelectorAll(sel)) {
        const txt = (el.textContent || '').trim();
        if (re.test(txt)) return el;
      }
    }
    return null;
  };
  const host = location.hostname;

  const SITES = {
    douyin: {
      name: '抖音',
      test: h => /(^|\.)douyin\.com$/.test(h),
      isContent: () => /\/video\/|\/note\/|modal_id=/.test(location.href),
      anchor: () => q('[data-e2e="video-share-container"]') || q('[data-e2e*="share"]')?.closest('div'),
      css: 'background:rgba(255,255,255,.14);color:#fff;border-radius:8px;font-size:13px;padding:7px 14px;backdrop-filter:blur(4px);',
    },
    bilibili: {
      name: 'Bilibili',
      test: h => /(^|\.)bilibili\.com$/.test(h),
      isContent: () => /\/video\/|\/bangumi\//.test(location.pathname),
      anchor: () => q('.video-share-wrap') || q('.toolbar-left') || q('.video-toolbar-left') || q('.video-toolbar'),
      css: 'background:#00AEEC;color:#fff;border-radius:6px;font-size:13px;padding:6px 14px;',
    },
    youtube: {
      name: 'YouTube',
      test: h => /(^|\.)youtube\.com$|^youtu\.be$/.test(h),
      isContent: () => /\/watch|\/shorts\//.test(location.pathname) || !!q('video'),
      anchor: () => q('#actions-inner #top-level-buttons-computed') || q('#top-level-buttons-computed') || q('#actions') || q('ytd-menu-renderer') || q('ytd-download-button-renderer') || q('#segmented-download-button') || findByText(['button', 'ytd-button-renderer', 'a'], /^(Download|下载)$/i),
      replaceNative: true,
      floating: true,
      css: 'background:var(--yt-spec-button-chip-background-hover,rgba(0,0,0,.05));color:var(--yt-spec-text-primary,#0f0f0f);border-radius:18px;font-size:14px;padding:8px 16px;font-family:Roboto,Arial;',
      darkCss: 'background:rgba(255,255,255,.12);color:#f1f1f1;',
    },
    tiktok: {
      name: 'TikTok',
      test: h => /(^|\.)tiktok\.com$/.test(h),
      isContent: () => /\/video\/|\/photo\/|\/@[^/]+\/video\//.test(location.pathname) || !!q('video'),
      anchor: () => findByText(['button', '[role="button"]', '[data-e2e*="follow"]'], /^(Follow|关注)$/i) || q('[data-e2e*="follow"]') || q('[data-e2e="browse-share"]')?.parentElement || q('[data-e2e="video-share-button"]')?.parentElement || q('[data-e2e*="share"]')?.closest('div') || q('button[aria-label*="Share"]')?.parentElement || q('[class*="DivActionItemContainer"]'),
      insert: 'before',
      floating: true,
      css: 'background:#FE2C55;color:#fff;border-radius:999px;font-size:13px;padding:7px 14px;font-weight:600;',
    },
    x: {
      name: 'X/Twitter',
      test: h => /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(h),
      isContent: () => /\/status\/\d+/.test(location.pathname) || !!q('article video'),
      anchor: () => q('article [role="group"]') || q('[data-testid="toolBar"]'),
      css: 'display:inline-flex;align-items:center;justify-content:center;background:transparent;color:#536471;border-radius:999px;padding:0;border:none;width:38px;height:38px;margin:0;vertical-align:middle;line-height:0;align-self:center;position:relative;top:0;',
    },
    instagram: {
      name: 'Instagram',
      test: h => /(^|\.)instagram\.com$/.test(h),
      isContent: () => /\/(p|reel|reels)\//.test(location.pathname),
      anchor: () => q('article section') || q('section:has(svg[aria-label])'),
      css: 'background:linear-gradient(45deg,#F58529,#DD2A7B,#8134AF);color:#fff;border-radius:8px;font-size:13px;padding:7px 14px;font-weight:600;',
    },
    facebook: {
      name: 'Facebook',
      test: h => /(^|\.)facebook\.com$/.test(h),
      isContent: () => /\/watch|\/videos\/|\/reel\//.test(location.href),
      anchor: () => null,
      css: 'background:#1877F2;color:#fff;border-radius:6px;font-size:13px;padding:7px 14px;font-weight:600;',
    },
    weibo: {
      name: '微博',
      test: h => /(^|\.)weibo\.com$|(^|\.)weibo\.cn$/.test(h),
      isContent: () => /\/tv\/show|\/status\/|\/\d{10,}\/[A-Za-z0-9]+/.test(location.href) || !!q('video'),
      anchor: () => q('.toolbar_main') || q('[class*="toolbar"]'),
      css: 'background:#FF8200;color:#fff;border-radius:4px;font-size:13px;padding:6px 14px;',
    },
    xiaohongshu: {
      name: '小红书',
      test: h => /(^|\.)xiaohongshu\.com$/.test(h),
      isContent: () => /\/explore\/|\/discovery\//.test(location.pathname) || !!q('#noteContainer') || !!q('[class*="note-detail"]') || (location.pathname !== '/' && !!q('video')),
      anchor: () => null,
      floating: true,
      css: 'background:#FF2442;color:#fff;border-radius:999px;font-size:13px;padding:7px 16px;font-weight:600;',
    },
    kuaishou: {
      name: '快手',
      test: h => /(^|\.)kuaishou\.com$/.test(h),
      isContent: () => /short-video|photoId|\/profile\//.test(location.href) || !!q('video'),
      anchor: () => q('.toolbar') || q('[class*="share"]')?.closest('div'),
      floating: true,
      css: 'background:#FE3666;color:#fff;border-radius:8px;font-size:13px;padding:7px 14px;font-weight:600;',
    },
    acfun: {
      name: 'AcFun',
      test: h => /(^|\.)acfun\.cn$/.test(h),
      isContent: () => /\/v\/ac\d+/.test(location.pathname) || !!q('video'),
      anchor: () => q('.video-description .operation') || q('.up-operation') || q('[class*="share"]')?.closest('div'),
      css: 'background:#FD4C5C;color:#fff;border-radius:6px;font-size:13px;padding:6px 14px;',
    },
    pinterest: {
      name: 'Pinterest',
      test: h => /pinterest\./.test(h),
      isContent: () => /\/pin\/\d+/.test(location.pathname),
      anchor: () => q('[data-test-id="pin-action-bar"]') || q('[data-test-id="closeup-action-items"]'),
      css: 'background:#E60023;color:#fff;border-radius:999px;font-size:14px;padding:9px 16px;font-weight:700;',
    },
  };

  const siteId = Object.keys(SITES).find(id => SITES[id].test(host));
  if (!siteId) return;
  const SITE = SITES[siteId];

  const cfg = {
    get server() { return ((GM_getValue('op_server', '') || preset(PRESET_SERVER)) + '').replace(/\/+$/, ''); },
    set server(v) { GM_setValue('op_server', v); },
    get token() { return GM_getValue('op_token', '') || preset(PRESET_TOKEN); },
    set token(v) { GM_setValue('op_token', v); },
    siteOn(id) {
      const v = GM_getValue('op_site_' + id, true);
      return !(v === false || v === 'false' || v === 0 || v === '0');
    },
    setSite(id, on) { GM_setValue('op_site_' + id, !!on); },
    siteQuality(id) { return GM_getValue('op_quality_' + id, '1080') || '1080'; },
    setQuality(id, q) { GM_setValue('op_quality_' + id, String(q)); },
    get showButton() { const v = GM_getValue('op_show_button', true); return !(v === false || v === 'false' || v === 0 || v === '0'); },
    set showButton(v) { GM_setValue('op_show_button', !!v); },
    buttonPos(id) { try { return JSON.parse(GM_getValue('op_button_pos_' + id, '') || 'null') || null; } catch { return null; } },
    setButtonPos(id, pos) { GM_setValue('op_button_pos_' + id, JSON.stringify(pos || null)); },
    resetButtonPos(id) { GM_setValue('op_button_pos_' + id, ''); },
  };

  const BTN_ID = 'onepick-dl-btn';
  const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" style="display:block" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v9.8"/><path d="m8.1 10.35 3.9 3.95 3.9-3.95"/><path d="M7.8 19.25h8.4"/></svg>';
  const btnLabel = () => 'OnePick';
  let downloading = false;
  const infoCache = new Map();
  const infoPending = new Map();

  function cacheKey(inputUrl) { return inputUrl || location.href; }
  function prefetchInfo(inputUrl) {
    const key = cacheKey(inputUrl);
    if (infoCache.has(key) || infoPending.has(key)) return;
    const href = downloadInfoUrl(key);
    if (!href || typeof GM_xmlhttpRequest !== 'function') return;
    infoPending.set(key, true);
    GM_xmlhttpRequest({
      method: 'GET', url: href, timeout: 180000,
      onload: resp => {
        infoPending.delete(key);
        try { const info = JSON.parse(resp.responseText || '{}'); if (resp.status === 200 && info?.downloadUrl) infoCache.set(key, { info, at: Date.now() }); } catch {}
      },
      onerror: () => infoPending.delete(key),
      ontimeout: () => infoPending.delete(key),
    });
  }



  function extractDouyinUrlFromText(text) {
    const raw = String(text || '').replace(/\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const full = raw.match(/https?:\/\/(?:www\.)?douyin\.com\/(?:video|note)\/\d+/i) || raw.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+/i);
    if (full) return full[0];
    const rel = raw.match(/\/(?:video|note)\/(\d{12,})/i) || raw.match(/[?&](?:modal_id|aweme_id|item_id)=(\d{12,})/i);
    if (rel) return `https://www.douyin.com/video/${rel[1]}`;
    return '';
  }

  function visibleDouyinUrl() {
    if (/\/(?:video|note)\/\d+/i.test(location.pathname)) return location.href;
    const params = new URLSearchParams(location.search);
    const modal = params.get('modal_id') || params.get('aweme_id') || params.get('item_id');
    if (modal && /^\d{12,}$/.test(modal)) return `https://www.douyin.com/video/${modal}`;
    const direct = Array.from(document.querySelectorAll('a[href]')).map(a => { try { return new URL(a.getAttribute('href'), location.origin).href; } catch { return ''; } }).find(h => /douyin\.com\/(video|note)\/\d+/i.test(h));
    if (direct) return direct;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const videos = Array.from(document.querySelectorAll('video'))
      .map(v => ({ el: v, rect: v.getBoundingClientRect(), paused: v.paused }))
      .filter(x => x.rect.width > 0 && x.rect.height > 0 && x.rect.bottom > 0 && x.rect.top < innerHeight)
      .sort((a,b)=>(a.paused-b.paused) || Math.abs((a.rect.top+a.rect.bottom)/2-cy)-Math.abs((b.rect.top+b.rect.bottom)/2-cy));
    for (const v of videos) {
      const box = v.el.closest('article, section, div[data-e2e], div[class], div') || v.el.parentElement;
      const hit = extractDouyinUrlFromText(box?.innerHTML || '');
      if (hit) return hit;
    }
    for (const sc of document.querySelectorAll('script')) {
      const hit = extractDouyinUrlFromText(sc.textContent || '');
      if (hit) return hit;
    }
    return extractDouyinUrlFromText(document.documentElement.innerHTML || '');
  }

  function decodeTikTokText(text) {
    return String(text || '')
      .replace(/\\u002F/g, '/')
      .replace(/\\\//g, '/')
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&');
  }

  function extractTikTokUrlFromText(text) {
    const raw = decodeTikTokText(text);
    const full = raw.match(/https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+\/(?:video|photo)\/\d+/);
    if (full) return full[0];
    const rel = raw.match(/\/@[A-Za-z0-9._-]+\/(?:video|photo)\/\d+/);
    if (rel) return new URL(rel[0], 'https://www.tiktok.com').href;
    const user = raw.match(/"uniqueId"\s*:\s*"([A-Za-z0-9._-]+)"/) || raw.match(/"unique_id"\s*:\s*"([A-Za-z0-9._-]+)"/) || raw.match(/"author"\s*:\s*"([A-Za-z0-9._-]+)"/);
    const id = raw.match(/"(?:id|itemId|aweme_id|awemeId|videoId)"\s*:\s*"?(\d{12,})"?/);
    if (user && id) return `https://www.tiktok.com/@${user[1]}/video/${id[1]}`;
    return '';
  }

  function findTikTokFromState() {
    const seen = new Set();
    const hits = [];
    function walk(x, depth = 0) {
      if (!x || depth > 7) return;
      if (typeof x === 'string') {
        if (/tiktok\.com\/@[^/]+\/(video|photo)\/\d+/.test(x)) hits.push(x);
        if (/^\d{12,}$/.test(x)) hits.push('__id__' + x);
        return;
      }
      if (typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      const id = x.id || x.itemId || x.aweme_id || x.awemeId || x.videoId;
      const author = x.author || x.authorInfo || x.authorStats || x.user || x.userInfo;
      const unique = x.uniqueId || x.unique_id || x.secUid || author?.uniqueId || author?.unique_id || author?.user?.uniqueId;
      if (id && unique && /^\d{12,}$/.test(String(id))) hits.push(`https://www.tiktok.com/@${String(unique).replace(/^@/,'')}/video/${id}`);
      for (const v of Object.values(x)) walk(v, depth + 1);
    }
    try { walk(window.__UNIVERSAL_DATA_FOR_REHYDRATION__); } catch {}
    try { walk(window.SIGI_STATE); } catch {}
    try { walk(window.__NEXT_DATA__); } catch {}
    const urlHit = hits.find(h => /^https?:/.test(h));
    if (urlHit) return urlHit;
    for (const sc of document.querySelectorAll('script')) {
      const fromScript = extractTikTokUrlFromText(sc.textContent || '');
      if (fromScript) return fromScript;
    }
    const fromHtml = extractTikTokUrlFromText(document.documentElement.innerHTML || '');
    if (fromHtml) return fromHtml;
    return '';
  }


  function visibleTikTokUrl() {
    const re = /tiktok\.com\/@[^/]+\/(video|photo)\/\d+/;
    const anchors = Array.from(document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]'))
      .map(a => ({ el: a, url: new URL(a.getAttribute('href'), location.origin).href }))
      .filter(x => re.test(x.url));
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const scored = anchors.map(x => {
      const r = x.el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const dx = (r.left + r.width / 2) - cx;
      const dy = (r.top + r.height / 2) - cy;
      return { ...x, visible, score: (visible ? 0 : 1e8) + Math.abs(dx) + Math.abs(dy) };
    }).sort((a, b) => a.score - b.score);
    if (scored[0]?.url) return scored[0].url;

    const videos = Array.from(document.querySelectorAll('video'))
      .map(v => ({ el: v, rect: v.getBoundingClientRect(), paused: v.paused }))
      .filter(x => x.rect.width > 0 && x.rect.height > 0 && x.rect.bottom > 0 && x.rect.top < innerHeight)
      .sort((a,b) => (a.paused - b.paused) || Math.abs((a.rect.top+a.rect.bottom)/2 - cy) - Math.abs((b.rect.top+b.rect.bottom)/2 - cy));
    for (const v of videos) {
      const box = v.el.closest('article, section, div[data-e2e], div[class*="Div"], div') || v.el.parentElement;
      const html = box?.innerHTML || '';
      const m = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@[^\"'<>\s]+\/(?:video|photo)\/\d+/) || html.match(/\/(?:@[^\"'<>\s]+)\/(?:video|photo)\/\d+/);
      if (m) return new URL(m[0], 'https://www.tiktok.com').href;
      const a = box?.querySelector?.('a[href*="/video/"], a[href*="/photo/"]');
      if (a) return new URL(a.getAttribute('href'), location.origin).href;
    }
    return '';
  }


  function decodeKuaishouText(text) {
    return String(text || '').replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&');
  }

  function extractKuaishouUrlFromText(text) {
    const raw = decodeKuaishouText(text);
    const full = raw.match(/https?:\/\/(?:www\.|m\.)?kuaishou\.com\/(?:short-video|fw\/photo|photo|video)\/[A-Za-z0-9_-]+/) || raw.match(/https?:\/\/v\.kuaishou\.com\/[A-Za-z0-9_-]+/) || raw.match(/https?:\/\/(?:www\.|m\.)?kuaishou\.com\/[^\"'<>\s]*[?&](?:photoId|photo_id|fid)=[A-Za-z0-9_-]+/);
    if (full) return full[0];
    const rel = raw.match(/\/(?:short-video|fw\/photo|photo|video)\/[A-Za-z0-9_-]+/) || raw.match(/(?:photoId|photo_id|fid)=([A-Za-z0-9_-]+)/);
    if (rel) return rel[0].includes('=') ? `https://www.kuaishou.com/short-video/${rel[1]}` : new URL(rel[0], 'https://www.kuaishou.com').href;
    const id = raw.match(/"(?:photoId|photo_id|fid)"\s*:\s*"?([A-Za-z0-9_-]{6,})"?/);
    if (id) return `https://www.kuaishou.com/short-video/${id[1]}`;
    return '';
  }

  function visibleKuaishouUrl() {
    const re = /kuaishou\.com\/(?:short-video|fw\/photo|photo|video)\/[A-Za-z0-9_-]+|[?&](?:photoId|photo_id|fid)=/;
    const anchors = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ el: a, url: new URL(a.getAttribute('href'), location.origin).href }))
      .filter(x => re.test(x.url));
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const scored = anchors.map(x => {
      const r = x.el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      return { ...x, score: (visible ? 0 : 1e8) + Math.abs((r.left+r.width/2)-cx) + Math.abs((r.top+r.height/2)-cy) };
    }).sort((a,b)=>a.score-b.score);
    if (scored[0]?.url) return scored[0].url;
    const videos = Array.from(document.querySelectorAll('video'))
      .map(v => ({ el:v, rect:v.getBoundingClientRect(), paused:v.paused }))
      .filter(x => x.rect.width > 0 && x.rect.height > 0 && x.rect.bottom > 0 && x.rect.top < innerHeight)
      .sort((a,b)=>(a.paused-b.paused) || Math.abs((a.rect.top+a.rect.bottom)/2-cy)-Math.abs((b.rect.top+b.rect.bottom)/2-cy));
    for (const v of videos) {
      const box = v.el.closest('article, section, div[class], div') || v.el.parentElement;
      const fromBox = extractKuaishouUrlFromText(box?.innerHTML || '');
      if (fromBox) return fromBox;
      const a = box?.querySelector?.('a[href*="short-video"], a[href*="photoId"], a[href*="photo_id"], a[href*="fid="]');
      if (a) return new URL(a.getAttribute('href'), location.origin).href;
    }
    const fromState = extractKuaishouUrlFromText(document.documentElement.innerHTML || '');
    return fromState || '';
  }

  function pageInputUrl() {
    if (siteId === 'douyin') {
      const hit = visibleDouyinUrl();
      if (hit) return hit;
      return '';
    }
    if (siteId === 'tiktok') {
      if (/\/@[^/]+\/(video|photo)\//.test(location.pathname)) return location.href;
      const html = document.documentElement.innerHTML || '';
      const rawMatch = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@[^\"'<>\s]+\/(?:video|photo)\/\d+/) || html.match(/\/(?:@[^\"'<>\s]+)\/(?:video|photo)\/\d+/);
      const candidates = [
        visibleTikTokUrl(),
        q('link[rel="canonical"]')?.href,
        q('meta[property="og:url"]')?.content,
        q('a[href*="/video/"]')?.href,
        q('a[href*="/photo/"]')?.href,
        findTikTokFromState(),
        rawMatch ? new URL(rawMatch[0], 'https://www.tiktok.com').href : '',
        Array.from(document.querySelectorAll('a[href]')).map(a => a.href).find(h => /tiktok\.com\/@[^/]+\/(video|photo)\//.test(h)),
      ].filter(Boolean);
      const hit = candidates.find(u => /tiktok\.com\/@[^/]+\/(video|photo)\//.test(u));
      if (hit) return hit;
      return '';
    }
    if (siteId === 'kuaishou') {
      if (/\/short-video\/|\/fw\/photo\/|\/photo\/|\/video\/|[?&](photoId|photo_id|fid)=/.test(location.href)) return location.href;
      const hit = visibleKuaishouUrl();
      if (hit) return hit;
      return '';
    }
    return location.href;
  }

  function downloadInfoUrl(inputUrl) {
    const base = cfg.server;
    const token = cfg.token;
    if (!base || !token) return '';
    const resolvedInput = inputUrl || pageInputUrl();
    if ((siteId === 'douyin' || siteId === 'tiktok' || siteId === 'kuaishou') && !resolvedInput) return '';
    const qs = new URLSearchParams({ token, input: resolvedInput, mode: 'video' });
    return `${base}/api/shortcut/browser-download-info?${qs.toString()}`;
  }

  function absolutize(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return cfg.server + (url.startsWith('/') ? url : '/' + url);
  }

  function chooseQuality(info) {
    const options = (info.qualityOptions || []).filter(x => x.downloadUrl);
    if (!options.length) return Promise.resolve({ downloadUrl: info.downloadUrl, label: '' });
    const want = cfg.siteQuality(siteId);
    const qualities = options.map(x => String(x.quality || ''));
    let selected = options.find(x => String(x.quality) === want);
    if (!selected) {
      const wantNum = Number(want) || 1080;
      selected = options
        .map(x => ({ opt: x, q: Number(x.quality) || 0 }))
        .filter(x => x.q && x.q <= wantNum)
        .sort((a,b) => b.q - a.q)[0]?.opt || options[0];
    }
    return Promise.resolve(selected);
  }

  function doDownload(btn) {
    const dynamicInput = (siteId === 'douyin' || siteId === 'tiktok' || siteId === 'kuaishou') ? pageInputUrl() : (btn?.dataset?.inputUrl || pageInputUrl());
    const infoHref = downloadInfoUrl(dynamicInput);
    if (!infoHref) { openPanel((siteId === 'douyin' || siteId === 'tiktok' || siteId === 'kuaishou') ? `未识别到当前 ${SITE.name} 作品链接，请点进详情页或用站内分享复制链接后重试。` : '请先填写服务器地址和 Token'); return; }
    if (downloading) return;
    if (typeof GM_download !== 'function' || typeof GM_xmlhttpRequest !== 'function') {
      setBtn(btn, '❌ 不支持下载', false);
      toast('当前油猴环境缺少 GM_download/GM_xmlhttpRequest，请升级 Tampermonkey。', true);
      return;
    }
    downloading = true;
    const inputKey = cacheKey(dynamicInput);
    const started = Date.now();
    const cached = infoCache.get(inputKey);
    const parseTimer = setInterval(() => {
      if (downloading) setBtn(btn, Math.floor((Date.now() - started) / 1000) + 's', true);
    }, 1000);
    const stopTimer = () => clearInterval(parseTimer);

    const handleInfo = async info => {
        const selected = await chooseQuality(info, btn);
        if (!selected) {
          stopTimer();
          downloading = false;
          setBtn(btn, btnLabel(), false);
          return;
        }
        setBtn(btn, `⬇️ 开始下载${selected.label ? ' ' + selected.label : ''}`, true);
        GM_download({
          url: absolutize(selected.downloadUrl || info.downloadUrl),
          name: info.filename || `onepick-${Date.now()}`,
          saveAs: false,
          onprogress: e => {
            stopTimer();
            if (e && e.loaded) setBtn(btn, '⬇️ ' + fmtSize(e.loaded), true);
          },
          onload: () => {
            stopTimer();
            downloading = false;
            setBtn(btn, '✅ 已保存', false);
            toast('下载已完成：' + (info.filename || 'OnePick'));
            setTimeout(() => setBtn(btn, btnLabel(), false), 3000);
          },
          onerror: err => {
            stopTimer();
            downloading = false;
            setBtn(btn, '❌ 失败', false);
            const msg = err && (err.error || err.details || err.message) ? (err.error || err.details || err.message) : '下载失败';
            toast('下载失败：' + String(msg).slice(0, 120), true);
            setTimeout(() => setBtn(btn, btnLabel(), false), 4000);
          },
          ontimeout: () => {
            stopTimer();
            downloading = false;
            setBtn(btn, '❌ 超时', false);
            toast('下载超时', true);
            setTimeout(() => setBtn(btn, btnLabel(), false), 4000);
          },
        });
      };

    if (cached?.info) {
      setBtn(btn, Math.floor((Date.now() - started) / 1000) + 's', true);
      handleInfo(cached.info);
      return;
    }
    setBtn(btn, '0s', true);
    GM_xmlhttpRequest({
      method: 'GET',
      url: infoHref,
      timeout: 180000,
      onload: async resp => {
        let info = null;
        try { info = JSON.parse(resp.responseText || '{}'); } catch { }
        if (resp.status !== 200 || !info?.downloadUrl) {
          stopTimer();
          downloading = false;
          setBtn(btn, '❌ 失败', false);
          toast('解析失败：' + String(info?.error || resp.responseText || `HTTP ${resp.status}`).slice(0, 120), true);
          setTimeout(() => setBtn(btn, btnLabel(), false), 4000);
          return;
        }
        infoCache.set(inputKey, { info, at: Date.now() });
        handleInfo(info);
      },
      onerror: () => {
        stopTimer();
        downloading = false;
        setBtn(btn, '❌ 连接失败', false);
        toast('无法连接 OnePick 服务器', true);
        setTimeout(() => setBtn(btn, btnLabel(), false), 4000);
      },
      ontimeout: () => {
        stopTimer();
        downloading = false;
        setBtn(btn, '❌ 解析超时', false);
        toast('解析超时', true);
        setTimeout(() => setBtn(btn, btnLabel(), false), 4000);
      },
    });
  }

  const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';

  function setBtn(btn, text, disabled) {
    if (!btn) return;
    if (siteId === 'x' && text === btnLabel()) btn.innerHTML = DOWNLOAD_ICON;
    else btn.textContent = text;
    btn.style.opacity = disabled ? '.72' : '1';
    btn.style.pointerEvents = disabled ? 'none' : 'auto';
  }

  function makeButton(floating, inputUrl = '', multi = false) {
    const b = document.createElement('button');
    if (!multi) b.id = BTN_ID;
    b.className = 'onepick-dl-btn';
    if (inputUrl && siteId !== 'tiktok' && siteId !== 'kuaishou') b.dataset.inputUrl = inputUrl;
    b.type = 'button';
    if (siteId === 'x') b.innerHTML = DOWNLOAD_ICON; else b.textContent = btnLabel();
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    let css = 'cursor:pointer;border:none;line-height:1.2;white-space:nowrap;z-index:99999;transition:opacity .2s;margin:0 6px;' + SITE.css;
    if (dark && SITE.darkCss) css += SITE.darkCss;
    if (floating) {
      const pos = cfg.buttonPos(siteId);
      css += 'position:fixed;box-shadow:0 4px 16px rgba(0,0,0,.25);';
      css += pos && Number.isFinite(pos.left) && Number.isFinite(pos.top) ? `left:${pos.left}px;top:${pos.top}px;` : 'right:20px;bottom:96px;';
    }
    b.style.cssText = css;
    let dragged = false, down = null;
    if (floating) {
      b.addEventListener('pointerdown', e => { dragged = false; down = { x:e.clientX, y:e.clientY, left:b.getBoundingClientRect().left, top:b.getBoundingClientRect().top }; b.setPointerCapture?.(e.pointerId); });
      b.addEventListener('pointermove', e => { if (!down) return; const dx=e.clientX-down.x, dy=e.clientY-down.y; if (Math.abs(dx)+Math.abs(dy)>4) dragged = true; if (dragged) { b.style.left = Math.max(8, Math.min(innerWidth-b.offsetWidth-8, down.left+dx)) + 'px'; b.style.top = Math.max(8, Math.min(innerHeight-b.offsetHeight-8, down.top+dy)) + 'px'; b.style.right='auto'; b.style.bottom='auto'; } });
      b.addEventListener('pointerup', () => { if (dragged) cfg.setButtonPos(siteId, { left: parseInt(b.style.left,10), top: parseInt(b.style.top,10) }); down = null; setTimeout(() => { dragged = false; }, 0); });
    }
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (dragged) return; doDownload(b); });
    setTimeout(() => prefetchInfo(inputUrl || pageInputUrl()), 600);
    return b;
  }


  function tweetStatusUrl(article) {
    const a = article?.querySelector?.('a[href*="/status/"]');
    return a ? new URL(a.getAttribute('href'), location.origin).href : location.href;
  }

  function injectXList() {
    const all = Array.from(document.querySelectorAll('.onepick-dl-btn'));
    if (!cfg.siteOn(siteId)) { all.forEach(x => x.remove()); return; }
    document.querySelectorAll('article').forEach(article => {
      if (!article.querySelector('video')) return;
      if (article.querySelector('.onepick-dl-btn, .onepick-x-holder')) return;
      const toolbar = article.querySelector('[role="group"]') || article.querySelector('[data-testid="toolBar"]');
      if (!toolbar) return;
      const btn = makeButton(false, tweetStatusUrl(article), true);
      btn.innerHTML = DOWNLOAD_ICON;
      btn.title = 'OnePick';
      const holder = document.createElement('div');
      holder.className = 'onepick-x-holder';
      holder.style.cssText = 'display:flex;align-items:center;justify-content:center;width:38px;height:38px;line-height:0;align-self:center;position:relative;top:0;';
      holder.appendChild(btn);
      const share = toolbar.querySelector('[data-testid="share"]')?.closest('[role="button"], div') || toolbar.lastElementChild;
      if (share && share.parentElement === toolbar) toolbar.insertBefore(holder, share);
      else toolbar.appendChild(holder);
    });
  }

  function inject() {
    if (!cfg.showButton) { document.querySelectorAll('.onepick-dl-btn,.onepick-x-holder').forEach(x => x.remove()); return; }
    if (siteId === 'x') { injectXList(); return; }
    const old = document.getElementById(BTN_ID);
    if (!cfg.siteOn(siteId)) { old?.remove(); return; }
    if (old) return;
    if (SITE.isContent && !SITE.isContent()) return;
    let anchor = null;
    try { anchor = SITE.anchor && SITE.anchor(); } catch { }
    if (SITE.floating) {
      document.body.appendChild(makeButton(true, pageInputUrl()));
    } else if (anchor && anchor.isConnected) {
      const button = makeButton(false, pageInputUrl());
      if (SITE.replaceNative && /download/i.test((anchor.textContent || '') + ' ' + (anchor.tagName || ''))) {
        anchor.style.display = 'none';
        anchor.parentElement?.insertBefore(button, anchor);
      } else if (SITE.insert === 'before') anchor.parentElement?.insertBefore(button, anchor);
      else anchor.appendChild(button);
    } else if (siteId !== 'bilibili') document.body.appendChild(makeButton(true, pageInputUrl()));
  }

  function css(el, text) { el.style.cssText = text; return el; }
  function div(text, style) { const el = document.createElement('div'); if (text !== undefined) el.textContent = text; if (style) css(el, style); return el; }
  function button(text, style) { const el = document.createElement('button'); el.type = 'button'; el.textContent = text; if (style) css(el, style); return el; }
  function input(id, value, placeholder) {
    const el = document.createElement('input');
    el.id = id; el.value = value || ''; el.placeholder = placeholder || '';
    css(el, 'width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid #d6d3c8;background:#fff;font-size:13px;color:#111;');
    return el;
  }

  function openPanel(hint) {
    document.getElementById('onepick-panel')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'onepick-panel';
    css(wrap, 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;');

    const card = div('', 'background:#f3f1ea;border-radius:18px;padding:22px;width:min(440px,92vw);max-height:86vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.3);color:#1f2937;');
    card.appendChild(div('OnePick 设置', 'font-size:17px;font-weight:700;color:#235F4C;margin-bottom:2px;'));
    if (hint) card.appendChild(div(hint, 'font-size:12px;color:#d1544a;margin-bottom:8px;'));
    card.appendChild(div('服务器地址（例 https://onepick.download.com:8088）', 'font-size:12px;color:#6b7280;margin:10px 0 4px;'));
    card.appendChild(input('op-server', cfg.server, 'https://'));
    card.appendChild(div('Token（apikey.xxx）', 'font-size:12px;color:#6b7280;margin:10px 0 4px;'));
    card.appendChild(input('op-token', cfg.token, 'apikey.'));

    const head = div('', 'display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px;');
    head.appendChild(div('站点独立开关', 'font-size:12px;color:#6b7280;'));
    head.appendChild(div(`当前：${SITE.name}`, 'font-size:12px;color:#235F4C;font-weight:600;'));
    card.appendChild(head);

    const currentBtn = button('', 'width:100%;border:none;border-radius:999px;padding:9px 12px;margin:0 0 8px;font-size:13px;font-weight:600;cursor:pointer;');
    function paintCurrent() {
      const on = cfg.siteOn(siteId);
      currentBtn.textContent = `当前${on ? '开启' : '关闭'}：${SITE.name}`;
      currentBtn.style.background = on ? '#235F4C' : '#d1544a';
      currentBtn.style.color = '#fff';
    }
    paintCurrent();
    currentBtn.onclick = () => {
      cfg.setSite(siteId, !cfg.siteOn(siteId));
      paintCurrent();
      refreshSiteButtons();
      document.getElementById(BTN_ID)?.remove();
      inject();
    };
    card.appendChild(currentBtn);

    const showBtn = button('', 'width:100%;border:none;border-radius:999px;padding:9px 12px;margin:0 0 8px;font-size:13px;font-weight:600;cursor:pointer;background:#e7f4ef;color:#235F4C;');
    const paintShow = () => { showBtn.textContent = `页面按钮：${cfg.showButton ? '显示' : '隐藏'}`; showBtn.style.background = cfg.showButton ? '#e7f4ef' : '#f1eee6'; };
    paintShow();
    showBtn.onclick = () => { cfg.showButton = !cfg.showButton; paintShow(); document.querySelectorAll('.onepick-dl-btn,.onepick-x-holder').forEach(x => x.remove()); inject(); };
    card.appendChild(showBtn);
    const resetPos = button('重置当前站点按钮位置', 'width:100%;border:1px solid #d8d2c4;border-radius:999px;padding:9px 12px;margin:0 0 10px;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#235F4C;');
    resetPos.onclick = () => { cfg.resetButtonPos(siteId); document.querySelectorAll('.onepick-dl-btn,.onepick-x-holder').forEach(x => x.remove()); inject(); toast('按钮位置已重置'); };
    card.appendChild(resetPos);

    const grid = div('', 'background:#fff;border-radius:12px;padding:8px 12px;display:grid;grid-template-columns:1fr 1fr;column-gap:18px;row-gap:8px;');
    const siteButtons = new Map();
    function paintSiteButton(id, btn) {
      const on = cfg.siteOn(id);
      btn.textContent = `${on ? '✓' : '×'} ${SITES[id].name}`;
      btn.dataset.on = String(on);
      btn.style.background = on ? '#e7f4ef' : '#f1eee6';
      btn.style.color = on ? '#235F4C' : '#8a8175';
      btn.style.borderColor = on ? 'rgba(35,95,76,.35)' : '#d8d2c4';
    }
    function refreshSiteButtons() { for (const [id, btn] of siteButtons) paintSiteButton(id, btn); }
    Object.entries(SITES).sort((a, b) => a[1].name.localeCompare(b[1].name, 'zh-Hans-CN', { sensitivity: 'base' })).forEach(([id, s]) => {
      const row = div('', 'display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;');
      const b = button('', 'width:100%;text-align:left;border:1px solid #d8d2c4;border-radius:10px;padding:7px 9px;font-size:13px;font-weight:600;cursor:pointer;');
      const sel = document.createElement('select');
      sel.style.cssText = 'border:1px solid #d8d2c4;border-radius:10px;padding:7px 6px;background:#fff;color:#235F4C;font-size:12px;font-weight:700;';
      ['2160','1080','720'].forEach(q => { const o=document.createElement('option'); o.value=q; o.textContent=q+'P'; sel.appendChild(o); });
      sel.value = cfg.siteQuality(id);
      sel.onchange = e => { cfg.setQuality(id, e.target.value); paintSiteButton(id, b); };
      paintSiteButton(id, b);
      b.onclick = () => {
        cfg.setSite(id, !cfg.siteOn(id));
        paintSiteButton(id, b);
        if (id === siteId) paintCurrent();
      };
      siteButtons.set(id, b);
      row.appendChild(b); row.appendChild(sel); grid.appendChild(row);
    });
    card.appendChild(grid);

    const actions = div('', 'display:flex;gap:10px;margin-top:16px;');
    const save = button('保存', 'flex:1;background:#235F4C;color:#fff;border:none;border-radius:999px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;');
    const close = button('关闭', 'flex:1;background:#e5e2d8;color:#374151;border:none;border-radius:999px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;');
    close.onclick = () => wrap.remove();
    save.onclick = () => {
      cfg.server = card.querySelector('#op-server').value.trim().replace(/\/+$/, '');
      cfg.token = card.querySelector('#op-token').value.trim();
      wrap.remove();
      document.getElementById(BTN_ID)?.remove();
      inject();
      toast('OnePick 设置已保存');
    };
    actions.appendChild(save); actions.appendChild(close); card.appendChild(actions);

    wrap.appendChild(card);
    document.documentElement.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  }

  function toast(msg, isErr) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `position:fixed;left:50%;bottom:60px;transform:translateX(-50%);z-index:2147483647;background:${isErr ? '#d1544a' : '#235F4C'};color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.25);font-family:system-ui,sans-serif;max-width:80vw;`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }


  function menuDownloadCurrent() {
    const b = makeButton(true, pageInputUrl(), true);
    b.style.right = '20px';
    b.style.bottom = '150px';
    document.body.appendChild(b);
    doDownload(b);
    setTimeout(() => { if (!downloading) b.remove(); }, 8000);
  }

  GM_registerMenuCommand('OnePick 下载当前页面', () => menuDownloadCurrent());
  GM_registerMenuCommand('OnePick 设置', () => openPanel());
  GM_registerMenuCommand(`当前${cfg.siteOn(siteId) ? '开启' : '关闭'}：${SITE.name}`, () => {
    cfg.setSite(siteId, !cfg.siteOn(siteId));
    document.getElementById(BTN_ID)?.remove();
    inject();
    toast(`${SITE.name} 已${cfg.siteOn(siteId) ? '开启' : '关闭'}`);
  });

  const bootAt = Date.now();
  inject();
  const mo = new MutationObserver(() => inject());
  mo.observe(document.body, { childList: true, subtree: true });
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) { lastHref = location.href; document.getElementById(BTN_ID)?.remove(); }
    inject();
  }, 1200);
})();
