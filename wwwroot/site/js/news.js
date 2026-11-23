/* ============ 新闻热点模块（兼容 Pages 静态版） ============
   本地服务端通过 /api/news 抓取百度热点；GitHub Pages 静态版没有服务端，
   该模块会给出明确提示，不影响其余功能。
*/

let newsCache = { data: null, ts: 0 };
const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10分钟

async function fetchNews() {
  if (newsCache.data && Date.now() - newsCache.ts < NEWS_CACHE_TTL) {
    return newsCache.data;
  }
  var cfg = window.DEFAULT_PROXY_CONFIG;
  var proxy = (cfg && cfg.proxyUrl ? String(cfg.proxyUrl) : '').replace(/\/+$/, '');
  var url;
  if (proxy) {
    url = proxy + '/api/news';
  } else if (location.hostname.endsWith('.github.io') || location.protocol === 'file:') {
    throw new Error('新闻热点未配置：请先在 config.js 填入云函数地址（proxyUrl）');
  } else {
    url = '/api/news';
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(json.error);
  if (!res.ok) throw new Error(`新闻服务错误 ${res.status}`);
  const items = (json.items || []).filter(it => it.title && it.link).map(it => ({
    title: it.title,
    link: it.link,
    desc: String(it.desc || '').replace(/<[^>]+>/g, '').slice(0, 120),
    pubDate: it.hotScore ? `热度 ${it.hotScore}` : '',
    source: it.source || '百度实时热点',
    category: it.category || '实时热点'
  }));
  newsCache = { data: items, ts: Date.now() };
  return items;
}
