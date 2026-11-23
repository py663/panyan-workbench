/* ============ 云端同步层（GitHub 仓库 + 云函数代理） ============
   本机 localStorage 是即时缓存，GitHub 仓库里的一个 JSON 文件是权威数据源。
   用文件 sha 做乐观锁，冲突时不静默覆盖，让用户选择保留哪一份。

   两种通道：
   1) 代理模式（默认，打开无需 token）：读写都走腾讯云函数，
      GitHub 令牌只存在云函数环境变量里，浏览器完全接触不到。
   2) 直连模式（回退）：浏览器直接调 GitHub Contents API，需本机填 token。
      仅当没配 proxyUrl 或 config.js 里 syncMode='direct' 时启用。

   未配置或连接失败时自动退回纯本机模式，页面照常可用。
*/
const SYNC_MODULES = ['words', 'tasks', 'courses', 'videos', 'inbox', 'notes', 'finance', 'links', 'settings', 'stats', 'trash', 'backups'];
const MODULE_NAMES = {
  words: '考研单词', tasks: '任务', courses: '课程表', videos: '视频库',
  inbox: '收集箱', notes: '笔记', finance: '记账', links: '常用链接',
  settings: '设置', stats: '统计', trash: '回收站', backups: '备份'
};

const SNAPSHOT = {};
const DIRTY = new Set();
let FILE_SHA = null;          // 云端文件的 sha，作为乐观锁凭据
let LAST_SAVED = null;
let SERVER_READY = false;
let LOCAL_ONLY = true;
let flushTimer = null;
let flushing = false;

const GH = window.DEFAULT_GITHUB_CONFIG || {};
const GH_OWNER = String(GH.owner || '').trim();
const GH_REPO = String(GH.repo || '').trim();
const GH_BRANCH = String(GH.branch || 'main').trim() || 'main';
const GH_PATH = String(GH.path || 'workbench-data.json').trim() || 'workbench-data.json';
const GH_ACCOUNT = GH.accountName || '共享账号';
const GH_API = 'https://api.github.com';
const GH_TOKEN_KEY = 'wb_github_token';   // 仅直连回退模式使用

const PROXY_CONF = window.DEFAULT_PROXY_CONFIG || {};
const PROXY_URL = String(PROXY_CONF.proxyUrl || '').trim().replace(/\/+$/, '');
const PROXY_KEY = String(PROXY_CONF.syncKey || '').trim();
/* 默认走代理；只有显式 syncMode='direct' 且没配 proxyUrl 时才直连 */
const USE_PROXY = !!PROXY_URL && String(GH.syncMode || '').trim() !== 'direct';

/* ---------- 直连回退模式用的 token ---------- */
function getToken() {
  try {
    const saved = localStorage.getItem(GH_TOKEN_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) { /* ignore */ }
  return String(GH.token || '').trim();
}
function setToken(t) {
  try { localStorage.setItem(GH_TOKEN_KEY, t.trim()); } catch (e) { /* ignore */ }
}
function hasToken() {
  return getToken().length > 20;
}

function ghConfigured() {
  return GH.enabled === true && !!GH_OWNER && !!GH_REPO;
}

function ghContentsUrl() {
  return GH_API + '/repos/' + encodeURIComponent(GH_OWNER) + '/' + encodeURIComponent(GH_REPO)
    + '/contents/' + GH_PATH.split('/').map(encodeURIComponent).join('/');
}

/* UTF-8 安全的 base64 编解码（直连模式下编码整份数据） */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function base64ToUtf8(b64) {
  const bin = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ---------- 直连 GitHub 请求（回退用） ---------- */
async function ghRequest(url, options = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + getToken(),
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    let detail = '';
    try { const err = await res.json(); detail = err.message || ''; } catch (e) { /* ignore */ }
    const error = new Error('GitHub HTTP ' + res.status + (detail ? '：' + detail : ''));
    error.status = res.status;
    throw error;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ---------- 云函数代理请求（默认通道，token 只在服务端） ---------- */
async function proxyRequest(path, payload) {
  const isPost = payload !== undefined && payload !== null;
  let url = PROXY_URL + path;
  const options = {
    method: isPost ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000)
  };
  if (isPost) {
    options.body = JSON.stringify(Object.assign({}, payload, { key: PROXY_KEY }));
  } else {
    url += '?key=' + encodeURIComponent(PROXY_KEY) + '&_t=' + Date.now();
  }
  const res = await fetch(url, options);
  const text = await res.text();
  let out;
  try { out = text ? JSON.parse(text) : {}; } catch (e) {
    throw new Error('云函数返回格式异常');
  }
  if (!res.ok) {
    const error = new Error(out.error || ('云函数 HTTP ' + res.status));
    error.status = res.status;
    throw error;
  }
  return out;
}

/* 读取云端整份数据。文件不存在返回 null */
async function ghRead() {
  if (USE_PROXY) {
    const out = await proxyRequest('/api/data-get');
    if (out.ok === false) {
      const error = new Error(out.error || '云端读取失败');
      error.status = 500;
      throw error;
    }
    if (out.notFound) return null;
    return { sha: out.sha, data: out.data };
  }
  // 直连回退
  let file;
  const cacheBust = '&_t=' + Date.now();
  try {
    file = await ghRequest(ghContentsUrl() + '?ref=' + encodeURIComponent(GH_BRANCH) + cacheBust);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
  let payload;
  if (file && file.content) {
    payload = JSON.parse(base64ToUtf8(file.content));
  } else if (file && file.download_url) {
    const raw = await fetch(file.download_url, { signal: AbortSignal.timeout(15000) });
    payload = await raw.json();
  } else {
    return null;
  }
  return { sha: file.sha, data: payload.data || payload };
}

/* 写入云端整份数据。首次创建不带 sha，更新必须带 sha（乐观锁） */
async function ghWrite(data, sha) {
  if (USE_PROXY) {
    const out = await proxyRequest('/api/data-save', { data: data, sha: sha || null });
    if (out.ok === false) {
      if (out.conflict) {
        const error = new Error('云端已被其他设备修改');
        error.status = 409;
        error.remote = out.remote;
        throw error;
      }
      const error = new Error(out.error || '云端保存失败');
      error.status = out.status || 500;
      throw error;
    }
    return out.sha || sha;
  }
  // 直连回退
  const body = {
    message: '工作台自动同步 ' + new Date().toISOString(),
    content: utf8ToBase64(JSON.stringify({ data: data, updatedAt: new Date().toISOString() })),
    branch: GH_BRANCH
  };
  if (sha) body.sha = sha;
  const result = await ghRequest(ghContentsUrl(), { method: 'PUT', body: JSON.stringify(body) });
  return result && result.content ? result.content.sha : sha;
}

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); } catch (e) { /* 容量满时忽略 */ }
}

function snapshotAll() {
  SYNC_MODULES.forEach(m => { SNAPSHOT[m] = JSON.stringify(DB[m] ?? null); });
}

function applyRemoteData(data) {
  const defaults = defaultData();
  SYNC_MODULES.forEach(m => {
    if (data && data[m] !== undefined && data[m] !== null) DB[m] = data[m];
    else if (DB[m] === undefined) DB[m] = defaults[m] ?? [];
  });
  DB.settings = Object.assign({}, defaults.settings, data && data.settings ? data.settings : (DB.settings || {}));
  DB.stats = Object.assign({}, defaults.stats, data && data.stats ? data.stats : (DB.stats || {}));
}

function fillLocalDefaults() {
  const defaults = defaultData();
  SYNC_MODULES.forEach(m => { if (DB[m] === undefined) DB[m] = defaults[m]; });
  DB.settings = Object.assign({}, defaults.settings, DB.settings || {});
  DB.stats = Object.assign({}, defaults.stats, DB.stats || {});
  snapshotAll();
  saveLocal();
}

/* 弹出 token 输入框（仅直连回退模式用；代理模式不会调用） */
function askToken(onDone) {
  const html = `
    <h3>连接云端同步（直连模式）</h3>
    <p>当前未配置云函数代理，需填写 GitHub 访问令牌（token）。只需填一次，保存在这台设备的浏览器里。</p>
    <p style="font-size:12px;color:#6b7a70">在 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens 生成，只授权 <b>${escapeForModal(GH_REPO)}</b> 仓库、只给 <b>Contents: read and write</b>。</p>
    <input id="wb-gh-token-input" type="password" placeholder="在这里粘贴你的 token" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cfd8d0;border-radius:6px;font-family:inherit;font-size:14px">
    <p style="font-size:12px;color:#8a5a33" id="wb-gh-token-err"></p>`;
  const finish = (m) => {
    const input = m && m.querySelector ? m.querySelector('#wb-gh-token-input') : null;
    const val = input ? input.value.trim() : '';
    if (val.length < 20) {
      const err = m && m.querySelector ? m.querySelector('#wb-gh-token-err') : null;
      if (err) err.textContent = 'token 看起来不对，请检查后重试';
      return false;
    }
    setToken(val);
    if (m && m.remove) m.remove();
    if (typeof toast === 'function') toast('已保存，正在连接云端…', 'success');
    if (typeof onDone === 'function') onDone();
    return true;
  };
  if (typeof modal === 'function') {
    modal(html, [
      { txt: '暂不连接', cls: 'btn-secondary', act: 'skip', onClick: () => {
          fillLocalDefaults();
          SERVER_READY = false; LOCAL_ONLY = true; updateStatus('local');
          if (typeof renderCurrent === 'function') renderCurrent();
      }},
      { txt: '保存并连接', cls: 'btn-primary', act: 'save', keepOpen: true, onClick: finish }
    ]);
  } else {
    const val = window.prompt('请输入 GitHub 访问令牌（在 GitHub 生成的那串）：');
    if (val && val.trim().length > 20) { setToken(val); if (onDone) onDone(); }
    else { fillLocalDefaults(); SERVER_READY = false; LOCAL_ONLY = true; updateStatus('local'); }
  }
}

async function initDB() {
  // 先显示本机缓存，保证页面立刻可用
  loadDB();
  const defaults = defaultData();

  if (!ghConfigured()) {
    fillLocalDefaults();
    SERVER_READY = false;
    LOCAL_ONLY = true;
    updateStatus('local');
    return;
  }

  // 直连回退模式才需要 token；代理模式直接读云端，打开无需任何输入
  if (!USE_PROXY && !hasToken()) {
    fillLocalDefaults();
    updateStatus('local');
    askToken(() => { initDB(); });
    return;
  }

  try {
    const remote = await ghRead();
    if (remote && remote.data) {
      // 云端有数据：以云端为准
      applyRemoteData(remote.data);
      FILE_SHA = remote.sha;
    } else {
      // 云端还没文件：把本机数据作为第一版上传
      SYNC_MODULES.forEach(m => { if (DB[m] === undefined) DB[m] = defaults[m]; });
      DB.settings = Object.assign({}, defaults.settings, DB.settings || {});
      DB.stats = Object.assign({}, defaults.stats, DB.stats || {});
      FILE_SHA = await ghWrite(DB, null);
      if (typeof toast === 'function') toast('已在云端创建数据文件', 'success');
    }
    snapshotAll();
    saveLocal();
    SERVER_READY = true;
    LOCAL_ONLY = false;
    LAST_SAVED = new Date();
    updateStatus('saved');
  } catch (e) {
    console.warn('云同步连接失败，使用本机数据：', e);
    SERVER_READY = false;
    LOCAL_ONLY = true;
    // 代理模式：401/403 表示应用密码不对或云函数没配 token，提示检查配置
    if (USE_PROXY && (e.status === 401 || e.status === 403)) {
      updateStatus('error');
      return;
    }
    // 直连模式：token 失效/权限不足，清掉旧 token 让下次重新输入
    if (!USE_PROXY && (e.status === 401 || e.status === 403)) {
      try { localStorage.removeItem(GH_TOKEN_KEY); } catch (err) { /* ignore */ }
      updateStatus('error');
      askToken(() => { initDB(); });
      return;
    }
    updateStatus('offline');
  }
}

/* 覆盖 store.js 里的 saveDB：先写本机，再按变化排队上传 */
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
  flushTimer = setTimeout(flush, 800);
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (DIRTY.size > 0) {
      DIRTY.clear(); // 整份上传，一次覆盖所有变化
      try {
        FILE_SHA = await ghWrite(DB, FILE_SHA);
        snapshotAll();
        LAST_SAVED = new Date();
        updateStatus('saved');
      } catch (e) {
        if (e.status === 409) {
          // sha 不匹配：别的设备刚改过云端
          const remote = e.remote || await ghRead();
          handleConflict(remote);
          DIRTY.clear();
          break;
        }
        // 其他失败：重新标记变化，保留本机，稍后重试
        SYNC_MODULES.forEach(m => {
          if (JSON.stringify(DB[m] ?? null) !== SNAPSHOT[m]) DIRTY.add(m);
        });
        updateStatus('offline');
        console.warn('同步失败，稍后重试：', e);
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

function handleConflict(remote) {
  if (!remote || !remote.data) { updateStatus('offline'); return; }
  const preview = escapeForModal(JSON.stringify(remote.data, null, 1)).slice(0, 1200);
  const html = `
    <p>云端数据在另一台设备上被修改过。</p>
    <p>如果直接覆盖，会丢掉那台设备的改动。</p>
    <pre style="max-height:200px;overflow:auto;background:#f4f6f2;padding:8px;border-radius:6px">${preview}</pre>
    <p>选择要保留的版本：</p>`;
  const useMine = () => {
    FILE_SHA = remote.sha;
    SYNC_MODULES.forEach(m => DIRTY.add(m));
    scheduleFlush();
    if (typeof toast === 'function') toast('将用本机数据覆盖云端', 'success');
  };
  const useTheirs = () => {
    applyRemoteData(remote.data);
    FILE_SHA = remote.sha;
    snapshotAll();
    saveLocal();
    if (typeof renderCurrent === 'function') renderCurrent();
    if (typeof toast === 'function') toast('已改用云端版本', 'success');
  };
  if (typeof modal === 'function') {
    modal(html, [
      { txt: '保留我的', cls: 'btn-secondary', act: 'mine', onClick: useMine },
      { txt: '用云端的', cls: 'btn-primary', act: 'theirs', onClick: useTheirs }
    ]);
  } else {
    if (window.confirm('云端数据在另一台设备被修改。\n确定 = 保留我的，取消 = 用云端的')) useMine();
    else useTheirs();
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
    chip.textContent = USE_PROXY ? '云端连接失败，请检查云函数配置' : '同步失败，请检查配置';
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
  const repoLabel = GH_OWNER && GH_REPO ? (GH_OWNER + '/' + GH_REPO) : '未配置';
  const channelText = USE_PROXY ? '云函数中转（打开无需令牌）' : '浏览器直连 GitHub';
  const tokenRow = USE_PROXY
    ? '<p>访问令牌：<b style="color:#3d6b4a">不需要（令牌只在云函数里）</b></p>'
    : '<p>访问令牌：' + (hasToken() ? '已在本机保存' : '未填写') + '</p>';
  const resetBtn = USE_PROXY ? '' : '<button class="btn-secondary" id="wb-token-reset" type="button">填写 / 更换令牌</button>';
  card.innerHTML = `
    <h3>账号与同步</h3>
    <p>当前账号：${escapeForModal(GH_ACCOUNT)}</p>
    <p>云端仓库：${escapeForModal(repoLabel)}</p>
    <p>数据文件：${escapeForModal(GH_PATH)}</p>
    <p>同步通道：${escapeForModal(channelText)}</p>
    <p>数据位置：${LOCAL_ONLY ? '当前浏览器（未连接云端）' : 'GitHub 仓库（免费）'}</p>
    ${tokenRow}
    <p>最近保存：${LAST_SAVED ? LAST_SAVED.toLocaleString('zh-CN') : '尚未保存'}</p>
    <p>云端状态：${SERVER_READY ? '已连接' : (ghConfigured() ? '未连接' : '未配置')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-primary" id="wb-sync-now" type="button">立即同步</button>
      ${resetBtn}
    </div>`;
  page.insertBefore(card, page.firstChild);

  const syncBtn = document.getElementById('wb-sync-now');
  if (syncBtn) {
    syncBtn.onclick = () => {
      if (!SERVER_READY) {
        if (!USE_PROXY && !hasToken()) { askToken(() => { initDB(); }); return; }
        if (typeof toast === 'function') toast('云端未连接，请稍后重试或刷新页面');
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
  const tokenBtn = document.getElementById('wb-token-reset');
  if (tokenBtn) {
    tokenBtn.onclick = () => {
      try { localStorage.removeItem(GH_TOKEN_KEY); } catch (e) { /* ignore */ }
      askToken(() => { initDB(); });
    };
  }
}
window.addEventListener('hashchange', () => setTimeout(injectAccountCard, 40));
