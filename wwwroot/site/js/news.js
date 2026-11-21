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
  if (location.hostname.endsWith('.github.io')) {
    throw new Error('GitHub Pages 静态版不支持热点抓取（需要服务端代理）');
  }
  if (location.protocol === 'file:') {
    throw new Error('请通过本地服务器打开工作台后再加载新闻');
  }
  const res = await fetch('/api/news', { signal: AbortSignal.timeout(25000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `新闻服务错误 ${res.status}`);
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
