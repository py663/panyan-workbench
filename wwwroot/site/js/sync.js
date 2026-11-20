/* ============ 云端同步层 ============
   数据以服务器 SQLite 为准，本机 LocalStorage 只作为断网时的缓存。
   保存失败不会假装成功；两台设备同时修改会提示选择保留哪一份。
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
let IS_ONLINE = true;
let SERVER_READY = false;
let ACCOUNT_NAME = '';
let flushTimer = null;
let flushing = false;

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); } catch (e) { }
}

function snapshotAll() {
  SYNC_MODULES.forEach(m => { SNAPSHOT[m] = JSON.stringify(DB[m] ?? null); });
}

async function initDB() {
  // 先用本机缓存保证页面能立刻显示
  loadDB();
  try {
    const resp = await fetch('/api/data', { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const payload = await resp.json();
    const defaults = defaultData();

    SYNC_MODULES.forEach(m => {
      const remote = payload.modules ? payload.modules[m] : undefined;
      if (remote !== undefined && remote !== null) DB[m] = remote;
      else DB[m] = defaults[m] ?? (m === 'settings' || m === 'stats' ? defaults[m] : []);
      API_VERSIONS[m] = payload.versions && payload.versions[m] ? payload.versions[m] : 0;
    });

    DB.settings = Object.assign({}, defaults.settings, DB.settings || {});
    DB.stats = Object.assign({}, defaults.stats, DB.stats || {});
    DB.createdAt = DB.createdAt || Date.now();

    snapshotAll();
    saveLocal();
    SERVER_READY = true;
    setOnline(true);
    updateStatus('saved');

    try {
      const me = await fetch('/api/me').then(r => r.ok ? r.json() : null);
      if (me) ACCOUNT_NAME = me.username || '';
    } catch (e) { }
  } catch (e) {
    SERVER_READY = false;
    setOnline(false);
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
    if (now !== SNAPSHOT[m]) {
      DIRTY.add(m);
      changed = true;
    }
  });
  if (changed) {
    updateStatus('saving');
    scheduleFlush();
  }
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
      const body = JSON.stringify({ version: API_VERSIONS[module] || 0, data: DB[module] ?? [] });

      try {
        const resp = await fetch('/api/data/' + module, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body
        });

        if (resp.status === 409) {
          const info = await resp.json();
          handleConflict(module, info);
          continue;
        }
        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        const result = await resp.json();
        API_VERSIONS[module] = result.version;
        SNAPSHOT[module] = JSON.stringify(DB[module] ?? null);
        LAST_SAVED = new Date();
        setOnline(true);
        updateStatus('saved');
      } catch (e) {
        // 网络失败：保留待同步标记，明确告诉用户没有保存成功
        DIRTY.add(module);
        setOnline(false);
        updateStatus('offline');
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

function handleConflict(module, info) {
  const name = MODULE_NAMES[module] || module;
  const html = `
    <p style="margin:0 0 10px">「${name}」在另一台设备上已经被修改，服务器上的新版本时间更晚。</p>
    <p style="margin:0 0 6px;font-size:12px;color:var(--ink-sub)">如果直接覆盖，会丢掉另一台设备的改动。</p>
    <div style="max-height:160px;overflow:auto;background:var(--paper-2,#f5f2e8);padding:10px;border-radius:6px;font-size:12px;white-space:pre-wrap">${escapeForModal(JSON.stringify(info.data, null, 1)).slice(0, 1200)}</div>
    <p style="margin:12px 0 0;font-size:12px;color:var(--ink-sub)">选择要保留的版本：</p>`;

  if (typeof modal === 'function') {
    modal(html, [
      {
        txt: '保留我的', cls: 'btn-secondary', act: 'mine',
        onClick: () => {
          API_VERSIONS[module] = info.version;
          DIRTY.add(module);
          scheduleFlush();
        }
      },
      {
        txt: '用服务器的', cls: 'btn-primary', act: 'theirs',
        onClick: () => {
          DB[module] = info.data;
          SNAPSHOT[module] = JSON.stringify(DB[module] ?? null);
          API_VERSIONS[module] = info.version;
          saveLocal();
          if (typeof renderCurrent === 'function') renderCurrent();
          toast('已改用服务器版本', 'success');
        }
      }
    ]);
  } else {
    // 极端情况下退回浏览器确认框
    const useMine = window.confirm('「' + name + '」在另一台设备被修改。\n确定 = 保留我的版本，取消 = 用服务器的版本');
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setOnline(value) {
  IS_ONLINE = value;
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
      'font-family:inherit', 'pointer-events:none', 'transition:opacity .3s',
      'opacity:.9'
    ].join(';');
    document.body.appendChild(chip);
  }
  return chip;
}

function updateStatus(state) {
  const chip = statusChip();
  if (state === 'saving') {
    chip.textContent = '正在保存…';
    chip.style.color = '#7a877f';
  } else if (state === 'saved') {
    const t = LAST_SAVED || new Date();
    chip.textContent = '已保存到云端 ' + t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    chip.style.color = '#3d6b4a';
  } else if (state === 'offline') {
    chip.textContent = '离线：已存在本机，联网后自动重试';
    chip.style.color = '#8a5a33';
  } else if (state === 'error') {
    chip.textContent = '保存失败，请检查网络';
    chip.style.color = '#8a3d33';
  }
}

window.addEventListener('online', () => {
  setOnline(true);
  if (SERVER_READY) {
    SYNC_MODULES.forEach(m => {
      if (JSON.stringify(DB[m] ?? null) !== SNAPSHOT[m]) DIRTY.add(m);
    });
    if (DIRTY.size) { updateStatus('saving'); scheduleFlush(); }
    else updateStatus('saved');
  }
});

window.addEventListener('offline', () => {
  setOnline(false);
  updateStatus('offline');
});

/* ---------- 设置页：账号、同步、退出 ---------- */
function injectAccountCard() {
  if (!location.hash.includes('settings')) return;
  const page = document.querySelector('.page');
  if (!page || document.getElementById('wb-account-card')) return;

  const card = document.createElement('div');
  card.id = 'wb-account-card';
  card.className = 'card';
  card.style.marginBottom = 'var(--space-md)';
  card.innerHTML = `
    <div class="card-title">账号与同步</div>
    <div style="font-size:13px;line-height:2">
      <div>当前账号：<b>${escapeForModal(ACCOUNT_NAME || '（未读取）')}</b></div>
      <div>数据位置：服务器 SQLite 数据库</div>
      <div>最近保存：<span id="wb-last-saved">${LAST_SAVED ? LAST_SAVED.toLocaleString('zh-CN') : '尚未保存'}</span></div>
      <div>网络状态：<span id="wb-net-state">${IS_ONLINE ? '在线' : '离线'}</span></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <button class="btn-secondary" id="wb-sync-now">立即同步</button>
      <a class="btn-secondary" href="/Account/Logout" style="text-decoration:none;display:inline-flex;align-items:center">退出登录</a>
    </div>`;
  page.insertBefore(card, page.firstChild);

  const syncBtn = document.getElementById('wb-sync-now');
  if (syncBtn) {
    syncBtn.onclick = () => {
      SYNC_MODULES.forEach(m => {
        if (JSON.stringify(DB[m] ?? null) !== SNAPSHOT[m]) DIRTY.add(m);
      });
      updateStatus('saving');
      scheduleFlush();
      toast('正在同步…');
    };
  }
}

window.addEventListener('hashchange', () => setTimeout(injectAccountCard, 40));
