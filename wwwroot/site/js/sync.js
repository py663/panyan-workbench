/* ============ Supabase REST 同步层（GitHub Pages 静态版） ============
   localStorage 是即时缓存，Supabase 是权威数据源。
   未配置或连接失败时自动退回纯本机模式，页面照常可用。
   两个模块用 version 做乐观锁；冲突时让用户选择保留哪一份，不静默覆盖。
*/
const SYNC_MODULES = ['words', 'tasks', 'courses', 'videos', 'inbox', 'notes', 'finance', 'links', 'settings', 'stats'];
const MODULE_NAMES = {
  words: '考研单词', tasks: '任务', courses: '课程表', videos: '视频库',
  inbox: '收集箱', notes: '笔记', finance: '记账', links: '常用链接',
  settings: '设置', stats: '统计'
};

const API_VERSIONS = {};
const SNAPSHOT = {};
const DIRTY = new Set();
let LAST_SAVED = null;
let SERVER_READY = false;
let LOCAL_ONLY = true;
let flushTimer = null;
let flushing = false;

const SUPABASE = window.DEFAULT_SUPABASE_CONFIG || {};
const SB_URL = String(SUPABASE.url || '').replace(/\/$/, '');
const SB_KEY = SUPABASE.anonKey || '';
const SB_ACCOUNT = SUPABASE.accountName || '共享账号';

function sbConfigured() {
  return SUPABASE.enabled === true && /^https:\/\//.test(SB_URL) && SB_KEY.length > 20;
}

async function sbRequest(path, options = {}) {
  const headers = {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(SB_URL + path, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err.message || err.hint || '';
    } catch (e) { /* ignore */ }
    throw new Error('Supabase HTTP ' + res.status + (detail ? '：' + detail : ''));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); } catch (e) { /* 容量满时忽略 */ }
}

function snapshotAll() {
  SYNC_MODULES.forEach(m => { SNAPSHOT[m] = JSON.stringify(DB[m] ?? null); });
}

async function initDB() {
  // 先显示本机缓存，保证页面立刻可用
  loadDB();
  const defaults = defaultData();

  if (!sbConfigured()) {
    SYNC_MODULES.forEach(m => { if (DB[m] === undefined) DB[m] = defaults[m]; });
    DB.settings = Object.assign({}, defaults.settings, DB.settings || {});
    DB.stats = Object.assign({}, defaults.stats, DB.stats || {});
    snapshotAll();
    saveLocal();
    SERVER_READY = false;
    LOCAL_ONLY = true;
    updateStatus('local');
    return;
  }

  try {
    const rows = await sbRequest('/rest/v1/workbench_pages?select=module,data,version') || [];
    const byModule = {};
    (Array.isArray(rows) ? rows : []).forEach(r => { byModule[r.module] = r; });

    SYNC_MODULES.forEach(m => {
      const row = byModule[m];
      if (row && row.data !== null && row.data !== undefined) DB[m] = row.data;
      else if (DB[m] === undefined) DB[m] = defaults[m] ?? [];
      API_VERSIONS[m] = row ? (Number(row.version) || 0) : 0;
    });
    DB.settings = Object.assign({}, defaults.settings, DB.settings || {});
    DB.stats = Object.assign({}, defaults.stats, DB.stats || {});
    snapshotAll();
    saveLocal();
    SERVER_READY = true;
    LOCAL_ONLY = false;
    updateStatus('saved');
  } catch (e) {
    console.warn('Supabase 连接失败，使用本机数据：', e);
    SERVER_READY = false;
    LOCAL_ONLY = true;
    updateStatus('offline');
  }
}

/* 覆盖 store.js 里的 saveDB：先写本机，再按模块上传 */
function saveDB() {
  saveLocal();
  if (!SERVER_READY) return;
  let changed = false;
  SYNC_MODULES.forEach(m => {
    const now = JSON.stringify(DB[m] ?? null);
    if (now !== SNAPSHOT[m]) { DIRTY.add(m); changed = true; }
  });
  if (changed) { updateStatus('saving'); scheduleFlush(); }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 400);
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (DIRTY.size > 0) {
      const module = DIRTY.values().next().value;
      DIRTY.delete(module);
      const expected = API_VERSIONS[module] || 0;
      try {
        const current = await sbRequest(
          '/rest/v1/workbench_pages?select=version,data&module=eq.' + encodeURIComponent(module)
        );
        const remote = Array.isArray(current) && current.length ? current[0] : null;
        if (remote && (Number(remote.version) || 0) !== expected) {
          handleConflict(module, { version: Number(remote.version) || 0, data: remote.data });
          continue;
        }

        const payload = {
          module: module,
          data: DB[module] ?? [],
          version: expected + 1,
          updated_at: new Date().toISOString()
        };
        await sbRequest('/rest/v1/workbench_pages?on_conflict=module', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(payload)
        });

        API_VERSIONS[module] = expected + 1;
        SNAPSHOT[module] = JSON.stringify(DB[module] ?? null);
        LAST_SAVED = new Date();
        updateStatus('saved');
      } catch (e) {
        DIRTY.add(module);
        updateStatus('offline');
        console.warn('同步失败，稍后重试：', e);
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

function handleConflict(module, info) {
  const name = MODULE_NAMES[module] || module;
  const preview = escapeForModal(JSON.stringify(info.data, null, 1)).slice(0, 1200);
  const html = `
    <p>「${name}」在另一台设备上已经被修改，服务器版本时间更晚。</p>
    <p>如果直接覆盖，会丢掉另一台设备的改动。</p>
    <pre style="max-height:200px;overflow:auto;background:#f4f6f2;padding:8px;border-radius:6px">${preview}</pre>
    <p>选择要保留的版本：</p>`;
  if (typeof modal === 'function') {
    modal(html, [
      {
        txt: '保留我的', cls: 'btn-secondary', act: 'mine',
        onClick: () => { API_VERSIONS[module] = info.version; DIRTY.add(module); scheduleFlush(); }
      },
      {
        txt: '用服务器的', cls: 'btn-primary', act: 'theirs',
        onClick: () => {
          DB[module] = info.data;
          SNAPSHOT[module] = JSON.stringify(DB[module] ?? null);
          API_VERSIONS[module] = info.version;
          saveLocal();
          if (typeof renderCurrent === 'function') renderCurrent();
          if (typeof toast === 'function') toast('已改用服务器版本', 'success');
        }
      }
    ]);
  } else {
    const useMine = window.confirm('「' + name + '」在另一台设备被修改。\n确定 = 保留我的，取消 = 用服务器的');
    if (useMine) {
      API_VERSIONS[module] = info.version;
      DIRTY.add(module);
      scheduleFlush();
    } else {
      DB[module] = info.data;
      SNAPSHOT[module] = JSON.stringify(DB[module] ?? null);
      API_VERSIONS[module] = info.version;
      saveLocal();
      if (typeof renderCurrent === 'function') renderCurrent();
    }
  }
}

function escapeForModal(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusChip() {
  let chip = document.getElementById('wb-sync-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'wb-sync-chip';
    chip.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:88px', 'z-index:60',
      'font-size:11px', 'padding:5px 10px', 'border-radius:999px',
      'background:rgba(252,250,243,.92)', 'border:1px solid #d8e2d5',
      'color:#5c6b61', 'box-shadow:0 2px 8px rgba(47,74,58,.08)',
      'font-family:inherit', 'pointer-events:none', 'transition:opacity .3s', 'opacity:.9'
    ].join(';');
    document.body.appendChild(chip);
  }
  return chip;
}

function updateStatus(state) {
  const chip = statusChip();
  if (state === 'saving') {
    chip.textContent = '正在同步到云端…';
    chip.style.color = '#7a877f';
  } else if (state === 'saved') {
    const t = LAST_SAVED || new Date();
    chip.textContent = '已同步到云端 ' + t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    chip.style.color = '#3d6b4a';
  } else if (state === 'local') {
    chip.textContent = '本机模式（未配置云端）';
    chip.style.color = '#7a877f';
  } else if (state === 'offline') {
    chip.textContent = '离线：已存本机，联网后重试';
    chip.style.color = '#8a5a33';
  } else if (state === 'error') {
    chip.textContent = '同步失败，请检查配置';
    chip.style.color = '#8a3d33';
  }
}

window.addEventListener('online', () => {
  if (SERVER_READY) {
    SYNC_MODULES.forEach(m => {
      if (JSON.stringify(DB[m] ?? null) !== SNAPSHOT[m]) DIRTY.add(m);
    });
    if (DIRTY.size) { updateStatus('saving'); scheduleFlush(); }
    else updateStatus('saved');
  }
});
window.addEventListener('offline', () => { if (!LOCAL_ONLY) updateStatus('offline'); });

/* ---------- 设置页：账号与同步状态 ---------- */
function injectAccountCard() {
  if (!location.hash.includes('settings')) return;
  const page = document.querySelector('.page');
  if (!page || document.getElementById('wb-account-card')) return;
  const card = document.createElement('div');
  card.id = 'wb-account-card';
  card.className = 'card';
  card.style.marginBottom = 'var(--space-md)';
  card.innerHTML = `
    <h3>账号与同步</h3>
    <p>当前账号：${escapeForModal(SB_ACCOUNT)}</p>
    <p>数据位置：${LOCAL_ONLY ? '当前浏览器（未连接云端）' : 'Supabase PostgreSQL'}</p>
    <p>最近保存：${LAST_SAVED ? LAST_SAVED.toLocaleString('zh-CN') : '尚未保存'}</p>
    <p>云端状态：${SERVER_READY ? '已连接' : (sbConfigured() ? '未连接' : '未配置')}</p>
    <button class="btn-secondary" id="wb-sync-now" type="button">立即同步</button>`;
  page.insertBefore(card, page.firstChild);

  const syncBtn = document.getElementById('wb-sync-now');
  if (syncBtn) {
    syncBtn.onclick = () => {
      if (!SERVER_READY) {
        if (typeof toast === 'function') toast('云端未连接，请检查 config.js 里的 Supabase 配置');
        return;
      }
      SYNC_MODULES.forEach(m => {
        if (JSON.stringify(DB[m] ?? null) !== SNAPSHOT[m]) DIRTY.add(m);
      });
      updateStatus('saving');
      scheduleFlush();
      if (typeof toast === 'function') toast('正在同步…');
    };
  }
}
window.addEventListener('hashchange', () => setTimeout(injectAccountCard, 40));
