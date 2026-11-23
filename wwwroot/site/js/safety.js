/* ============ 数据安全层：回收站 / 备份恢复 / 导入预览 / 单模块导出 ============
   加载顺序在 app.js 之后，覆盖 saveDB 与导入/清空 UI。
   设计要点：
   - 回收站：包装 saveDB，保存前把"本次消失的条目"自动收进 DB.trash，带删除时间与原模块。
     这样所有删除入口（单词/任务/视频/记账/收集箱/链接）无需逐个改动即可恢复。
   - 备份：DB.backups 保存带时间点的整份快照，可查看/恢复/删除；导入与清空前自动备份。
   - 导入预览：解析后列出将新增/修改/跳过的条目，用户确认后才写入。
   - 单模块导出：按模块导出 JSON。
   - trash 与 backups 都放进 DB，随 GitHub 仓库一起同步（见 sync.js 的 SYNC_MODULES）。
*/
(function () {
  'use strict';

  // 这些模块是可恢复的"条目集合"（数组、每项有 id）；settings/stats 是配置对象，不进回收站
  var TRASHABLE = ['words', 'tasks', 'courses', 'videos', 'inbox', 'notes', 'finance', 'links'];
  var MOD_CN = {
    words: '考研单词', tasks: '任务', courses: '课程', videos: '视频库',
    inbox: '收集箱', notes: '笔记', finance: '记账', links: '常用链接',
    settings: '设置', stats: '统计'
  };
  var TRASH_LIMIT = 100;     // 回收站最多保留条数
  var BACKUP_LIMIT = 10;     // 备份最多保留份数
  var DAY = 86400000;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function moduleLabel(m) { return MOD_CN[m] || m; }

  function ensureFields() {
    if (!window.DB) return;
    if (!Array.isArray(DB.trash)) DB.trash = [];
    if (!Array.isArray(DB.backups)) DB.backups = [];
  }

  // ---------- 回收站：保存前对比快照，收集被删条目 ----------
  var lastSnapshot = null;

  function buildSnapshot() {
    var s = {};
    TRASHABLE.forEach(function (m) {
      s[m] = {};
      (DB[m] || []).forEach(function (item) {
        if (item && item.id != null) s[m][String(item.id)] = item;
      });
    });
    return s;
  }

  function collectDeleted() {
    ensureFields();
    var cur = buildSnapshot();
    if (lastSnapshot) {
      var added = [];
      TRASHABLE.forEach(function (m) {
        var prev = lastSnapshot[m] || {};
        var now = cur[m] || {};
        Object.keys(prev).forEach(function (id) {
          if (!(id in now)) {
            added.push({
              tid: uid(),
              module: m,
              item: clone(prev[id]),
              deletedAt: Date.now()
            });
          }
        });
      });
      if (added.length) {
        DB.trash = added.concat(DB.trash).slice(0, TRASH_LIMIT);
      }
    }
    lastSnapshot = cur;
  }

  // 包装全局 saveDB：先收回收站，再走原（sync.js 的）保存+同步
  var origSaveDB = window.saveDB;
  window.saveDB = function () {
    try { collectDeleted(); } catch (e) { console.warn('回收站记录失败', e); }
    if (typeof origSaveDB === 'function') return origSaveDB.apply(this, arguments);
  };

  // 云端数据加载完成后重建快照，避免把"云端覆盖本机"误判成删除
  // initDB 可能由 app.js 包装过，这里对当前绑定再包一层
  var origInitDB = window.initDB;
  if (typeof origInitDB === 'function') {
    window.initDB = function () {
      return Promise.resolve(origInitDB.apply(this, arguments)).then(function (r) {
        try { ensureFields(); lastSnapshot = buildSnapshot(); } catch (e) { /* ignore */ }
        return r;
      });
    };
  }

  // ---------- 备份 ----------
  function createBackup(auto) {
    ensureFields();
    var counts = {};
    TRASHABLE.concat(['settings', 'stats']).forEach(function (m) {
      counts[m] = Array.isArray(DB[m]) ? DB[m].length : 1;
    });
    var snap = clone(DB);
    // 备份里不再嵌套 backups，避免体积膨胀
    if (snap.backups) snap.backups = [];
    DB.backups.unshift({
      bid: uid(),
      createdAt: Date.now(),
      label: (auto ? '自动 · ' : '手动 · ') + nowStr(),
      counts: counts,
      data: snap
    });
    DB.backups = DB.backups.slice(0, BACKUP_LIMIT);
    return DB.backups[0];
  }

  // ---------- 导出：全部 / 单模块 ----------
  function download(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }
  function exportAll() {
    download('workbench-backup-' + new Date().toISOString().slice(0, 10) + '.json', DB);
  }
  function exportModule(m) {
    ensureFields();
    var payload = { module: m, exportedAt: new Date().toISOString(), data: DB[m] };
    download('workbench-' + m + '-' + new Date().toISOString().slice(0, 10) + '.json', payload);
  }

  // ---------- 导入预览 ----------
  function normalizeImport(obj) {
    // 兼容两种格式：整份 DB（含各模块）或单模块（{module,data}）
    if (obj && obj.module && obj.data !== undefined && MOD_CN[obj.module]) {
      var r = {};
      r[obj.module] = obj.data;
      return r;
    }
    return obj || {};
  }

  function diffImport(obj) {
    var inc = normalizeImport(obj);
    var rows = [];
    var totalAdd = 0, totalMod = 0, totalSkip = 0;
    TRASHABLE.forEach(function (m) {
      var incoming = inc[m];
      if (!Array.isArray(incoming)) return;
      var existing = {};
      (DB[m] || []).forEach(function (it) { if (it && it.id != null) existing[String(it.id)] = it; });
      var add = 0, mod = 0, skip = 0;
      incoming.forEach(function (it) {
        if (!it || it.id == null) { skip++; return; }
        var id = String(it.id);
        if (!(id in existing)) { add++; }
        else if (JSON.stringify(existing[id]) !== JSON.stringify(it)) { mod++; }
        else { skip++; }
      });
      if (add || mod || skip) rows.push({ m: m, add: add, mod: mod, skip: skip });
      totalAdd += add; totalMod += mod; totalSkip += skip;
    });
    ['settings', 'stats'].forEach(function (m) {
      if (inc[m] && typeof inc[m] === 'object') rows.push({ m: m, add: 0, mod: 1, skip: 0, object: true });
    });
    return { rows: rows, add: totalAdd, mod: totalMod, skip: totalSkip, inc: inc };
  }

  function applyImport(diff) {
    ensureFields();
    createBackup(true); // 导入前先备份
    TRASHABLE.forEach(function (m) {
      var incoming = diff.inc[m];
      if (!Array.isArray(incoming)) return;
      var map = {};
      (DB[m] || []).forEach(function (it) { if (it && it.id != null) map[String(it.id)] = it; });
      incoming.forEach(function (it) {
        if (!it || it.id == null) return;
        var id = String(it.id);
        if (id in map) { DB[m][DB[m].indexOf(map[id])] = it; } // 修改
        else { DB[m].push(it); }                              // 新增
      });
    });
    ['settings', 'stats'].forEach(function (m) {
      if (diff.inc[m] && typeof diff.inc[m] === 'object') {
        DB[m] = Object.assign({}, DB[m] || {}, diff.inc[m]);
      }
    });
    window.saveDB();
  }

  window.importDataUI = function importDataUI() {
    var input = document.getElementById('importFile');
    if (!input) return;
    input.value = '';
    input.click();
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var obj;
        try { obj = JSON.parse(reader.result); }
        catch (e) {
          if (typeof toast === 'function') toast('导入失败：不是有效的 JSON 文件', 'error');
          return;
        }
        var diff = diffImport(obj);
        var body = '<p>导入前请确认。已自动创建一份备份，可随时恢复。</p>' +
          '<p>将 <b style="color:#3d6b4a">新增 ' + diff.add + '</b> 条、' +
          '<b style="color:#8a5a33">修改 ' + diff.mod + '</b> 条、' +
          '<b style="color:#7a877f">跳过 ' + diff.skip + '</b> 条（跳过=内容相同或无 id）。</p>';
        if (diff.rows.length) {
          body += '<div style="font-size:13px;line-height:1.9;max-height:220px;overflow:auto">' +
            diff.rows.map(function (r) {
              return '· ' + esc(moduleLabel(r.m)) + '：新增 ' + r.add + ' / 修改 ' + r.mod + ' / 跳过 ' + r.skip;
            }).join('<br>') + '</div>';
        } else {
          body += '<p style="color:#8a5a33">没有识别到可导入的模块数据，请检查文件格式。</p>';
        }
        if (typeof modal === 'function') {
          modal(body + '<p style="font-size:12px;color:#6b7a70">说明：导入只新增或修改，不会删除你现有的数据。</p>', [
            { txt: '取消', cls: 'btn-secondary', act: 'cancel' },
            { txt: '确认导入', cls: 'btn-primary', act: 'ok', onClick: function (m) {
                if (!diff.rows.length) return;
                applyImport(diff);
                if (m && m.remove) m.remove();
                if (typeof toast === 'function') toast('导入完成，已自动备份', 'success');
                if (typeof renderCurrent === 'function') renderCurrent();
              } }
          ]);
        }
      };
      reader.readAsText(f);
    };
  };

  // ---------- 清空前自动备份 ----------
  var origResetAll = window.resetAll;
  window.resetAll = function () {
    try { createBackup(true); } catch (e) { /* ignore */ }
    if (typeof origResetAll === 'function') return origResetAll.apply(this, arguments);
  };

  // ---------- 回收站 / 备份 的查看与操作 ----------
  function restoreTrash(tid) {
    ensureFields();
    var idx = DB.trash.findIndex(function (t) { return t.tid === tid; });
    if (idx < 0) return;
    var t = DB.trash[idx];
    if (!Array.isArray(DB[t.module])) DB[t.module] = [];
    // 若同 id 已存在则跳过，避免重复
    if (!DB[t.module].some(function (x) { return x && String(x.id) === String(t.item.id); })) {
      DB[t.module].push(clone(t.item));
    }
    DB.trash.splice(idx, 1);
    window.saveDB();
    if (typeof toast === 'function') toast('已恢复到「' + moduleLabel(t.module) + '」', 'success');
    if (typeof renderCurrent === 'function') renderCurrent();
  }
  function purgeTrash(tid) {
    ensureFields();
    DB.trash = DB.trash.filter(function (t) { return t.tid !== tid; });
    window.saveDB();
    if (typeof renderCurrent === 'function') renderCurrent();
  }
  function clearTrash() {
    ensureFields();
    DB.trash = [];
    window.saveDB();
    if (typeof toast === 'function') toast('回收站已清空', 'success');
    if (typeof renderCurrent === 'function') renderCurrent();
  }
  function restoreBackup(bid) {
    ensureFields();
    var b = DB.backups.find(function (x) { return x.bid === bid; });
    if (!b) return;
    // 当前状态也留一份备份，防止误恢复
    createBackup(true);
    var data = clone(b.data);
    data.backups = DB.backups; // 保留备份列表本身
    Object.keys(DB).forEach(function (k) { delete DB[k]; });
    Object.assign(DB, data);
    lastSnapshot = buildSnapshot();
    window.saveDB();
    if (typeof toast === 'function') toast('已恢复到 ' + b.label, 'success');
    if (typeof renderCurrent === 'function') renderCurrent();
  }
  function deleteBackup(bid) {
    ensureFields();
    DB.backups = DB.backups.filter(function (x) { return x.bid !== bid; });
    window.saveDB();
    if (typeof renderCurrent === 'function') renderCurrent();
  }
  function createBackupUI() {
    ensureFields();
    createBackup(false);
    window.saveDB();
    if (typeof toast === 'function') toast('备份已创建', 'success');
    if (typeof renderCurrent === 'function') renderCurrent();
  }

  function showTrashModal() {
    ensureFields();
    if (!DB.trash.length) {
      if (typeof modal === 'function') modal('<h3>回收站</h3><p>回收站是空的，没有可恢复的内容。</p>', [{ txt: '知道了', cls: 'btn-secondary', act: 'ok' }]);
      return;
    }
    var list = DB.trash.map(function (t) {
      var when = new Date(t.deletedAt).toLocaleString('zh-CN');
      var label = t.item.w || t.item.title || t.item.name || t.item.url || t.item.q || '(无标题)';
      return '<div style="padding:8px 0;border-bottom:1px dashed var(--border-paper-light)">' +
        '<div><b>' + esc(moduleLabel(t.module)) + '</b> · ' + esc(String(label).slice(0, 40)) + '</div>' +
        '<div style="font-size:12px;color:var(--ink-sub)">删除于 ' + esc(when) + '</div>' +
        '<div style="margin-top:6px;display:flex;gap:8px">' +
        '<button class="btn-secondary" onclick="window.__safetyRestoreTrash(\'' + t.tid + '\')">恢复</button>' +
        '<button class="btn-danger" onclick="window.__safetyPurgeTrash(\'' + t.tid + '\')">彻底删除</button>' +
        '</div></div>';
    }).join('');
    if (typeof modal === 'function') {
      modal('<h3>回收站（' + DB.trash.length + ' 条）</h3>' +
        '<p style="font-size:12px;color:#6b7a70">删除的内容会保存在这里，最多保留最近 ' + TRASH_LIMIT + ' 条，并随云端同步。</p>' +
        '<div style="max-height:360px;overflow:auto">' + list + '</div>',
        [{ txt: '清空回收站', cls: 'btn-danger', act: 'clear', onClick: function () {
            clearTrash(); if (typeof toast === 'function') toast('回收站已清空', 'success');
          } },
         { txt: '关闭', cls: 'btn-secondary', act: 'close' }]);
    }
  }

  function showBackupModal() {
    ensureFields();
    var list = DB.backups.length ? DB.backups.map(function (b) {
      var cnt = Object.keys(b.counts || {}).map(function (k) { return moduleLabel(k) + ' ' + b.counts[k]; }).join(' · ');
      return '<div style="padding:8px 0;border-bottom:1px dashed var(--border-paper-light)">' +
        '<div><b>' + esc(b.label) + '</b></div>' +
        '<div style="font-size:12px;color:var(--ink-sub)">' + esc(cnt) + '</div>' +
        '<div style="margin-top:6px;display:flex;gap:8px">' +
        '<button class="btn-secondary" onclick="window.__safetyRestoreBackup(\'' + b.bid + '\')">恢复到此版本</button>' +
        '<button class="btn-danger" onclick="window.__safetyDeleteBackup(\'' + b.bid + '\')">删除备份</button>' +
        '</div></div>';
    }).join('') : '<p style="color:var(--ink-sub)">还没有备份。可以点「立即备份」创建第一个。</p>';
    if (typeof modal === 'function') {
      modal('<h3>备份与恢复</h3>' +
        '<p style="font-size:12px;color:#6b7a70">最多保留最近 ' + BACKUP_LIMIT + ' 份，随云端同步。恢复前会先把当前状态再备份一份。</p>' +
        '<div style="max-height:360px;overflow:auto">' + list + '</div>',
        [{ txt: '立即备份', cls: 'btn-primary', act: 'new', onClick: function () { createBackupUI(); } },
         { txt: '关闭', cls: 'btn-secondary', act: 'close' }]);
    }
  }

  // 暴露给内联 onclick 使用
  window.__safetyRestoreTrash = restoreTrash;
  window.__safetyPurgeTrash = purgeTrash;
  window.__safetyRestoreBackup = restoreBackup;
  window.__safetyDeleteBackup = deleteBackup;
  window.__safetyShowTrash = showTrashModal;
  window.__safetyShowBackups = showBackupModal;
  window.__safetyCreateBackup = createBackupUI;
  window.__safetyExportModule = exportModule;
  window.__safetyExportAll = exportAll;

  // ---------- 设置页：注入「数据安全」卡片 ----------
  function injectSafetyCard() {
    if (location.hash.indexOf('settings') < 0) return;
    var page = document.querySelector('.page');
    if (!page || document.getElementById('wb-safety-card')) return;
    var card = document.createElement('div');
    card.id = 'wb-safety-card';
    card.className = 'card';
    card.style.marginBottom = 'var(--space-md)';
    ensureFields();
    var modules = TRASHABLE.map(function (m) {
      return '<option value="' + m + '">' + esc(moduleLabel(m)) + '</option>';
    }).join('');
    card.innerHTML =
      '<h3>数据安全</h3>' +
      '<p style="font-size:12px;color:var(--ink-sub)">回收站 ' + (DB.trash ? DB.trash.length : 0) +
      ' 条 · 备份 ' + (DB.backups ? DB.backups.length : 0) + ' 份（均随云端同步）</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">' +
      '<button class="btn-secondary" onclick="window.__safetyShowTrash()">回收站</button>' +
      '<button class="btn-secondary" onclick="window.__safetyShowBackups()">备份与恢复</button>' +
      '<button class="btn-secondary" onclick="window.__safetyCreateBackup()">立即备份</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
      '<select id="wb-export-module" class="form-control" style="width:auto">' + modules + '</select>' +
      '<button class="btn-secondary" onclick="window.__safetyExportModule(document.getElementById(\'wb-export-module\').value)">导出所选模块</button>' +
      '<button class="btn-secondary" onclick="window.__safetyExportAll()">导出全部</button>' +
      '</div>';
    // 插在账号卡片之后（若存在），否则放最前
    var anchor = document.getElementById('wb-account-card');
    if (anchor && anchor.nextSibling) page.insertBefore(card, anchor.nextSibling);
    else page.insertBefore(card, page.firstChild);
  }
  window.addEventListener('hashchange', function () { setTimeout(injectSafetyCard, 60); });
  // 初次若在设置页
  setTimeout(injectSafetyCard, 120);

  // 初始化快照（同步数据加载完成后再刷新一次）
  ensureFields();
  if (window.DB) lastSnapshot = buildSnapshot();
  window.addEventListener('hashchange', function () {
    setTimeout(function () { if (window.DB) lastSnapshot = buildSnapshot(); }, 80);
  });

})();
