/* ============ 主控制器 ============ */

// ---------- 通用工具 ----------
function toast(msg, type = '') {
  const c = document.querySelector('.toast-container') || (() => {
    const d = document.createElement('div'); d.className = 'toast-container'; document.body.appendChild(d); return d;
  })();
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function helpBtn(text) {
  return `<button class="help-btn" title="帮助">${ICONS.help}<div class="help-popover">${text}</div></button>`;
}

function modal(html, buttons = []) {
  const m = document.createElement('div');
  m.className = 'modal-overlay active';
  m.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>提示</h3>
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${ICONS.x}</button>
      </div>
      <div class="modal-body">${html}</div>
      ${buttons.length ? `<div class="modal-footer">${buttons.map(b => `<button class="${b.cls||'btn-secondary'}" data-act="${b.act}">${b.txt}</button>`).join('')}</div>` : ''}
    </div>`;
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m) m.remove(); };
  m.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      const r = buttons.find(b => b.act === act);
      if (r && r.onClick) r.onClick(m);
      if (!r || !r.keepOpen) m.remove();
    };
  });
  return m;
}

// ---------- 路由 ----------
const ROUTES = ['today','words','code','homework','plan','videos','links','finance','news','inbox','search','ai','settings'];

function currentRoute() {
  const h = location.hash.replace('#/', '') || 'today';
  return ROUTES.includes(h) ? h : 'today';
}

function navigate(r) { location.hash = '#/' + r; }

function updateTitle(r) {
  const titles = {
    today:'今日', words:'考研单词本', code:'代码练习', homework:'课程与作业', plan:'学习计划',
    videos:'学习视频库', finance:'记账', news:'新闻热点', inbox:'收集箱',
    search:'搜索', ai:'AI 帮手', settings:'设置与数据'
  };
  document.querySelector('.topbar-title').textContent = titles[r] || '工作台';
}

// ---------- 导航渲染 ----------
function renderSidebar() {
  const r = currentRoute();
  const words = getTodayWords();
  const reviewCount = words.review.length;
  
  const sections = [
    { label: '核心', items: [
      { key:'today', icon:'today', label:'今日总览', badge: (reviewCount>0?reviewCount+'':'') },
      { key:'words', icon:'book', label:'考研单词本' },
      { key:'code', icon:'code', label:'代码练习' },
      { key:'homework', icon:'school', label:'课程与作业' },
      { key:'plan', icon:'target', label:'学习计划' },
    ]},
    { label: '辅助', items: [
      { key:'links', icon:'link', label:'常用链接', badge: (DB.links||[]).length>0?(DB.links||[]).length+'' : '' },
      { key:'videos', icon:'video', label:'学习视频库' },
      { key:'finance', icon:'wallet', label:'记账' },
      { key:'news', icon:'news', label:'新闻热点' },
      { key:'inbox', icon:'inbox', label:'收集箱', badge: DB.inbox.length>0?DB.inbox.length+'' : '' },
    ]},
    { label: '公共', items: [
      { key:'search', icon:'search', label:'全局搜索' },
      { key:'ai', icon:'sparkles', label:'AI 帮手' },
      { key:'settings', icon:'settings', label:'设置与数据' },
    ]}
  ];
  
  document.querySelector('.sidebar-nav').innerHTML = sections.map(s => `
    <div class="nav-section-label">${s.label}</div>
    ${s.items.map(it => `
      <div class="nav-item ${r===it.key?'active':''}" data-route="${it.key}">
        ${ICONS[it.icon]}
        <span>${it.label}</span>
        ${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}
      </div>
    `).join('')}
  `).join('');
  
  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => {
      const route = el.dataset.route;
      // 今日总览与课程表由 ASP.NET 服务端渲染
      if (route === 'today') { location.href = '/Dashboard'; return; }
      if (route === 'homework') { location.href = '/Dashboard/Timetable'; return; }
      navigate(route);
    };
  });
}

function renderBottomNav() {
  const r = currentRoute();
  const items = [
    { key:'today', icon:'today', label:'今日' },
    { key:'words', icon:'book', label:'单词' },
    { key:'quick', icon:'plus', label:'添加' },
    { key:'more', icon:'more', label:'更多' }
  ];
  
  document.querySelector('.bottomnav-items').innerHTML = items.map(it => `
    <button class="bottomnav-item ${r===it.key?'active':''}" data-route="${it.key}">
      ${ICONS[it.icon]}
      <span>${it.label}</span>
    </button>
  `).join('');
  
  document.querySelectorAll('.bottomnav-item').forEach(el => {
    el.onclick = () => {
      const k = el.dataset.route;
      if (k === 'quick') openQuickAdd();
      else if (k === 'more') openMoreDrawer();
      else navigate(k);
    };
  });
}

function openMoreDrawer() {
  const sections = [
    { label:'学习', items:[
      { key:'code', icon:'code', label:'代码练习' },
      { key:'homework', icon:'school', label:'课程与作业' },
      { key:'plan', icon:'target', label:'学习计划' },
      { key:'videos', icon:'video', label:'学习视频库' },
    ]},
    { label:'生活', items:[
      { key:'links', icon:'link', label:'常用链接' },
      { key:'finance', icon:'wallet', label:'记账' },
      { key:'news', icon:'news', label:'新闻热点' },
      { key:'inbox', icon:'inbox', label:'收集箱' },
    ]},
    { label:'工具', items:[
      { key:'search', icon:'search', label:'全局搜索' },
      { key:'ai', icon:'sparkles', label:'AI 帮手' },
      { key:'settings', icon:'settings', label:'设置与数据' },
    ]}
  ];
  
  const b = document.querySelector('.mobile-menu-backdrop');
  const d = document.querySelector('.mobile-menu-drawer');
  b.classList.add('open');
  d.classList.add('open');
  d.innerHTML = `
    <div style="padding:16px 18px;border-bottom:1px solid rgba(212,207,191,0.15)">
      <div class="sidebar-logo"><div class="seal">潘</div>潘琰工作台</div>
    </div>
    <div style="padding:8px 0">
      ${sections.map(s => `
        <div class="nav-section-label">${s.label}</div>
        ${s.items.map(it => `
          <div class="nav-item" data-route="${it.key}">
            ${ICONS[it.icon]}
            <span>${it.label}</span>
          </div>
        `).join('')}
      `).join('')}
      <div class="nav-section-label">帮助</div>
      <div class="nav-item" data-route="settings" data-sub="help">
        ${ICONS.help}<span>使用说明</span>
      </div>
      <div class="nav-item" data-route="settings" data-sub="changelog">
        ${ICONS.refresh}<span>更新日志</span>
      </div>
    </div>`;
  
  d.querySelectorAll('[data-route]').forEach(el => {
        el.onclick = () => {
      const sub = el.dataset.sub;
      const route = el.dataset.route;
      closeDrawer();
      if (route === 'today') { location.href = '/Dashboard'; return; }
      if (route === 'homework') { location.href = '/Dashboard/Timetable'; return; }
      navigate(route);
      setTimeout(() => {
        if (sub === 'help') showHelpTab();
        if (sub === 'changelog') showChangelogTab();
      }, 50);
    };
  });
  
  b.onclick = closeDrawer;
}

function closeDrawer() {
  document.querySelector('.mobile-menu-backdrop').classList.remove('open');
  document.querySelector('.mobile-menu-drawer').classList.remove('open');
}

function openQuickAdd() {
  modal(`
    <h4 style="font-family:var(--font-serif);font-size:16px;margin-bottom:12px">快速记录</h4>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <button class="btn-secondary" style="flex:1;min-width:100px" data-t="word">${ICONS.book} 添加单词</button>
      <button class="btn-secondary" style="flex:1;min-width:100px" data-t="task">${ICONS.target} 添加任务</button>
      <button class="btn-secondary" style="flex:1;min-width:100px" data-t="finance">${ICONS.wallet} 记一笔</button>
      <button class="btn-secondary" style="flex:1;min-width:100px" data-t="inbox">${ICONS.inbox} 收集到箱</button>
    </div>
  `, [{txt:'关闭', cls:'btn-secondary', act:'close'}]);
  
  document.querySelectorAll('[data-t]').forEach(b => {
    b.onclick = () => {
      const t = b.dataset.t;
      closeAllModals();
      if (t === 'word') navigate('words');
      else if (t === 'task') navigate('plan');
      else if (t === 'finance') navigate('finance');
      else if (t === 'inbox') navigate('inbox');
    };
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
}

// ---------- 页面渲染：今日 ----------
function renderToday() {
  const page = document.querySelector('.page');
  const words = getTodayWords();
  const todayTasks = getTodayTasks();
  const todayStr = today();
  
  // 即将到期（7天内）
  const upcoming = DB.tasks
    .filter(t => t.status !== 'done' && t.deadline && t.deadline >= todayStr && t.deadline <= addDays(7))
    .sort((a,b) => a.deadline.localeCompare(b.deadline));
  
  // 超期
  const overdue = DB.tasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < todayStr);
  
  // 本月记账汇总
  const finSum = getFinanceSummary();
  const budgetRemain = finSum.budget - finSum.expense;
  const budgetPercent = Math.min(100, Math.round(finSum.expense / finSum.budget * 100));
  
  // 单词学习进度
  const hist = DB.stats.wordsHistory.slice(-7);
  const totalNew = hist.reduce((a,b) => a+b.new, 0);
  const totalReview = hist.reduce((a,b) => a+b.review, 0);
  
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了，注意休息';
    if (h < 12) return '早安，今天也要加油';
    if (h < 14) return '午后好，适度休息';
    if (h < 18) return '下午好，保持专注';
    return '晚上好，回顾一下今天吧';
  })();
  const weekday = ['周日','周一','周二','周三','周四','周五','周六'][new Date().getDay()];
  
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>${greeting}</h2>
      <p>${todayStr} ${weekday} · 把计划交给清单，把心意留给自己</p>
    </div>
    
    <div class="stat-grid today-stats">
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--primary-teal)">${words.review.length}</div>
        <div style="font-size:12px;color:var(--ink-sub)">今日复习词</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--ochre)">${words.fresh.length}</div>
        <div style="font-size:12px;color:var(--ink-sub)">今日新词</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--azure-stone)">${todayTasks.length}</div>
        <div style="font-size:12px;color:var(--ink-sub)">今日任务</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:${budgetRemain<0?'var(--cinnabar)':'var(--primary-teal)'}">¥${Math.max(0,budgetRemain)}</div>
        <div style="font-size:12px;color:var(--ink-sub)">本月剩余预算</div>
      </div>
    </div>
    
    <div class="main-grid">
      <!-- 左列 -->
      <div style="display:flex;flex-direction:column;gap:var(--space-md)">
        
        ${overdue.length > 0 ? `
          <div class="card" style="border-color:var(--cinnabar)">
            <div class="card-title" style="color:var(--cinnabar)">${ICONS.trash} 超期未完成 ${helpBtn('这些任务的截止日期已过，请尽快处理。点击任务进入详情，可标记完成或调整时间。')}</div>
            ${overdue.map(t => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
                <span class="tag tag-cinnabar">${t.type==='code'?'代码':t.type==='homework'?'作业':'计划'}</span>
                <div style="flex:1;cursor:pointer" onclick="gotoTask('${t.id}')">${t.title}</div>
                <span style="font-size:12px;color:var(--cinnabar)">已超 ${Math.ceil((new Date(todayStr).getTime()-new Date(t.deadline).getTime())/86400000)} 天</span>
              </div>
            `).join('')}
          </div>` : ''}
        
        <div class="card">
          <div class="card-title">${ICONS.book} 单词学习 ${helpBtn('今天需要复习的旧单词和要学的新单词。点击区域进入单词本开始学习。')}</div>
          <div style="display:flex;gap:var(--space-md)">
            <div style="flex:1;padding:16px;border:1px solid var(--border-paper-light);border-radius:var(--radius-md);cursor:pointer" onclick="navigate('words')">
              <div style="font-size:12px;color:var(--ink-sub);margin-bottom:4px">今日复习</div>
              <div style="font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--primary-teal)">${words.review.length} 个</div>
              <div style="font-size:12px;color:var(--ink-light);margin-top:4px">点击进入复习</div>
            </div>
            <div style="flex:1;padding:16px;border:1px solid var(--border-paper-light);border-radius:var(--radius-md);cursor:pointer" onclick="navigate('words')">
              <div style="font-size:12px;color:var(--ink-sub);margin-bottom:4px">今日新词</div>
              <div style="font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--ochre)">${words.fresh.length} 个</div>
              <div style="font-size:12px;color:var(--ink-light);margin-top:4px">共已学 ${DB.words.filter(w=>w.status!=='new').length} 个</div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-title">${ICONS.target} 今日任务 ${helpBtn('今天截止或近两天需要做的事。点任务进入对应模块。')}</div>
          ${todayTasks.length === 0 ? `<div class="empty-state"><h4>今日没有紧急任务</h4><p>可以复习单词或看看本周计划</p></div>` :
          todayTasks.map(t => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
              ${t.priority==='high' ? `<span style="color:var(--cinnabar)">${ICONS.star}</span>` : ''}
              <span class="tag ${t.type==='code'?'tag-teal':t.type==='homework'?'tag-ochre':'tag-azure'}">${t.type==='code'?'代码':t.type==='homework'?'作业':'计划'}</span>
              <div style="flex:1;cursor:pointer" onclick="gotoTask('${t.id}')">${t.title}</div>
              ${t.deadline === todayStr ? `<span style="font-size:11px;color:var(--cinnabar);font-weight:500">今日</span>` : `<span style="font-size:11px;color:var(--ink-light)">${t.deadline}</span>`}
            </div>
          `).join('')}
          <div style="margin-top:12px;text-align:right">
            <button class="btn-secondary" onclick="navigate('plan')">查看本周计划 ${ICONS.arrow}</button>
          </div>
        </div>
        
        ${upcoming.length > 0 ? `
        <div class="card">
          <div class="card-title">${ICONS.calendar} 本周待办（7天内）</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${upcoming.slice(0,5).map(t => `
              <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--bg-paper-light);border-radius:var(--radius-md)">
                <span style="font-size:12px;color:var(--ink-sub);width:80px">${t.deadline}</span>
                <div style="flex:1;font-size:13px;cursor:pointer" onclick="gotoTask('${t.id}')">${t.title}</div>
                <span class="tag tag-teal">${t.type==='code'?'代码':t.type==='homework'?'作业':'计划'}</span>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
      
      <!-- 右列 -->
      <div style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="card">
          <div class="card-title">${ICONS.trend} 近7天学习 ${helpBtn('近7天的单词学习量统计。')}</div>
          <div style="display:flex;align-items:flex-end;gap:6px;height:100px;margin-top:8px">
            ${hist.map(h => {
              const maxV = Math.max(totalNew, totalReview, 1);
              const newH = Math.max(4, h.new / maxV * 80);
              const revH = Math.max(4, h.review / maxV * 80);
              const d = new Date(h.date);
              const dayLabel = (d.getMonth()+1)+'/'+d.getDate();
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="display:flex;align-items:flex-end;height:80px;gap:3px">
                  <div style="width:8px;height:${newH}px;background:var(--ochre);border-radius:2px"></div>
                  <div style="width:8px;height:${revH}px;background:var(--primary-teal);border-radius:2px"></div>
                </div>
                <span style="font-size:10px;color:var(--ink-light)">${dayLabel}</span>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:16px;font-size:11px;color:var(--ink-sub);margin-top:8px">
            <span><span style="display:inline-block;width:10px;height:10px;background:var(--ochre);margin-right:4px;vertical-align:middle;border-radius:2px"></span>新词 ${totalNew}</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:var(--primary-teal);margin-right:4px;vertical-align:middle;border-radius:2px"></span>复习 ${totalReview}</span>
          </div>
        </div>
        
        <div class="card">
          <div class="card-title">${ICONS.wallet} 本月预算</div>
          <div style="margin:8px 0">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-sub);margin-bottom:4px">
              <span>已支出 ¥${finSum.expense}</span>
              <span>预算 ¥${finSum.budget}</span>
            </div>
            <div style="height:8px;background:var(--bg-paper-deep);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${budgetPercent}%;background:${budgetPercent>=100?'var(--cinnabar)':budgetPercent>70?'var(--ochre)':'var(--primary-teal)'};border-radius:4px"></div>
            </div>
          </div>
          ${Object.entries(finSum.catExpense).length > 0 ? `
            <div style="font-size:12px;color:var(--ink-sub);margin-top:8px">
              ${Object.entries(finSum.catExpense).slice(0,4).map(([k,v]) => `${k} ¥${v}`).join(' · ')}
            </div>` : `<div style="font-size:12px;color:var(--ink-light);margin-top:8px">本月还没有记录</div>`}
          <button class="btn-secondary" style="width:100%;margin-top:10px" onclick="navigate('finance')">查看明细 ${ICONS.arrow}</button>
        </div>
        
        <div class="card">
          <div class="card-title">${ICONS.school} 今日课程 ${helpBtn('今天要上的课，按节次排序。完整周课表在「课程与作业」页。')}</div>
          ${todayCourses().length === 0 ? `<div class="empty-state" style="padding:16px 0"><p>今天没有课</p></div>` :
          todayCourses().map(c => `
            <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
              <div style="font-weight:500;color:var(--ink-deep)">${c.name}</div>
              <div style="font-size:12px;color:var(--ink-sub);margin-top:2px">${courseTimeText(c)} · ${c.location}</div>
            </div>
          `).join('')}
          <div style="margin-top:10px;text-align:right">
            <button class="btn-secondary" onclick="navigate('homework')">查看周课表 ${ICONS.arrow}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function gotoTask(id) {
  const t = DB.tasks.find(x => x.id === id);
  if (!t) return;
  const map = { code:'code', homework:'homework', plan:'plan' };
  navigate(map[t.type] || 'plan');
}

// ---------- 页面渲染：考研单词本 ----------
let wordSession = null; // 当前学习会话

function renderWords() {
  const page = document.querySelector('.page');
  const words = getTodayWords();
  const mastering = DB.words.filter(w => w.status === 'mastered').length;
  const learning = DB.words.filter(w => w.status === 'learning').length;
  const total = DB.words.length;
  
  const hist = DB.stats.wordsHistory.slice(-30);
  const maxV = Math.max(1, ...hist.map(h => Math.max(h.new, h.review)));
  const sparkline = hist.slice(-14).map(h => {
    const hgt = Math.max(2, h.review / maxV * 40);
    return `<div style="width:4px;height:${hgt}px;background:var(--primary-teal);border-radius:1px"></div>`;
  }).join('');
  
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>考研单词本</h2>
      <p>每天坚持，间隔重复 · 当前已掌握 ${mastering} / ${total}</p>
    </div>

    ${total === 0 ? `
    <div class="card" style="margin-bottom:var(--space-md);border:1px solid var(--primary-teal)">
      <div class="card-title">内置考研词书</div>
      <div style="font-size:13px;color:var(--ink-sub);margin-bottom:14px;line-height:1.9">
        已内置《考研核心词汇》，共 3731 个单词，带音标和中文释义，不用手动输入。导入后按每天的新词数量自动安排学习和复习。
      </div>
      <button class="btn-primary" onclick="importBuiltinWordbook(this)">${ICONS.book} 导入考研词书（3731 词）</button>
    </div>` : ''}
    
    <div class="stat-grid">
      <div class="card">
        <div style="font-size:12px;color:var(--ink-sub)">今日待复习</div>
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--primary-teal);margin-top:4px">${words.review.length}</div>
        <div style="font-size:11px;color:var(--ink-light);margin-top:4px">${words.review.length>0?'点击下方"开始复习"':'今天没有需要复习的'}</div>
      </div>
      <div class="card">
        <div style="font-size:12px;color:var(--ink-sub)">今日待学习</div>
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--ochre);margin-top:4px">${words.fresh.length}</div>
        <div style="font-size:11px;color:var(--ink-light);margin-top:4px">共已学 ${mastering + learning} 个新词</div>
      </div>
      <div class="card">
        <div style="font-size:12px;color:var(--ink-sub)">累计已掌握</div>
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--azure-stone);margin-top:4px">${mastering}</div>
        <div style="font-size:11px;color:var(--ink-light);margin-top:4px">近14天趋势</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:40px;margin-top:4px">${sparkline || '<span style="font-size:11px;color:var(--ink-light)">暂无数据</span>'}</div>
      </div>
    </div>
    
    <div class="card" style="text-align:center;padding:32px">
      <div style="font-family:var(--font-serif);font-size:18px;color:var(--ink-deep);margin-bottom:8px">开始今日学习</div>
      <div style="font-size:13px;color:var(--ink-sub);margin-bottom:16px">按顺序：先复习旧词，再学习新词</div>
      <div style="display:flex;gap:var(--space-md);justify-content:center">
        <button class="btn-primary" onclick="startWordSession('review')" ${words.review.length===0?'disabled':''}>${ICONS.book} 开始复习（${words.review.length}）</button>
        <button class="btn-secondary" onclick="startWordSession('fresh')" ${words.fresh.length===0?'disabled':''}>${ICONS.sparkles} 学习新词（${words.fresh.length}）</button>
      </div>
    </div>
    
    <div class="ink-divider"></div>
    
    <div class="flex flex-between gap-md" style="margin-bottom:var(--space-md)">
      <div class="card-title" style="margin:0">全部单词 ${helpBtn('所有已添加的单词。可以搜索、编辑、删除。支持自定义词库导入。')}</div>
      <div class="flex gap-sm">
        <button class="btn-secondary" onclick="importBuiltinWordbook(this)">${ICONS.download} 导入词书</button>
        <button class="btn-secondary" onclick="showWordSettings">${ICONS.settings} 设置</button>
        <button class="btn-primary" onclick="showAddWordModal">${ICONS.plus} 添加单词</button>
      </div>
    </div>
    
    <div class="card" style="padding:0">
      <div style="padding:var(--space-md);border-bottom:1px solid var(--border-paper-light);display:flex;gap:var(--space-sm)">
        <input class="form-control" id="wordSearch" placeholder="搜索单词 / 释义..." oninput="filterWords()" style="flex:1">
        <select class="form-control" id="wordFilter" onchange="filterWords()" style="width:120px">
          <option value="all">全部状态</option>
          <option value="mastered">已掌握</option>
          <option value="learning">学习中</option>
          <option value="new">新词</option>
        </select>
      </div>
      <div id="wordList" style="max-height:400px;overflow-y:auto"></div>
    </div>
  `;
  
  filterWords();
}

// ---------- 内置词书导入 ----------
async function importBuiltinWordbook(btn) {
  const button = btn || null;
  if (button) {
    if (button.disabled) return;
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = '正在导入…';
  }

  try {
    const resp = await fetch('data/kaoyan.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const list = await resp.json();

    const existing = new Set(DB.words.map(x => String(x.w || '').toLowerCase()));
    const now = Date.now();
    let added = 0;

    list.forEach(item => {
      const word = String(item.w || '').trim();
      if (!word || existing.has(word.toLowerCase())) return;
      existing.add(word.toLowerCase());
      DB.words.push({
        id: uid(),
        w: word,
        p: String(item.p || ''),
        m: String(item.m || ''),
        e: '',
        status: 'new',
        ease: 2.5,
        interval: 0,
        reps: 0,
        nextReview: todayTs(),
        addedAt: now,
        reviewHistory: []
      });
      added++;
    });

    saveDB();
    renderWords();
    toast(added ? `已导入 ${added} 个考研单词` : '词书里的单词都已经在词库中', 'success');
  } catch (e) {
    toast('词书导入失败：' + e.message);
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.oldText || '重新导入';
    }
  }
}

function filterWords() {
  const q = (document.getElementById('wordSearch')?.value || '').toLowerCase();
  const f = document.getElementById('wordFilter')?.value || 'all';
  let list = DB.words;
  if (f !== 'all') list = list.filter(w => w.status === f);
  if (q) list = list.filter(w => w.w.toLowerCase().includes(q) || w.m.toLowerCase().includes(q));
  
  const container = document.getElementById('wordList');
  if (!container) return;
  
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>没有匹配的单词</p></div>`;
    return;
  }
  
  container.innerHTML = list.slice(0, 100).map(w => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border-paper-light)">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--font-serif);font-size:16px;font-weight:600">${w.w}</span>
          <span style="font-size:11px;color:var(--ink-light)">${w.p || ''}</span>
          ${w.status==='mastered'?'<span class="tag tag-teal">已掌握</span>':w.status==='learning'?'<span class="tag tag-ochre">学习中</span>':'<span class="tag tag-azure">新词</span>'}
        </div>
        <div style="font-size:13px;color:var(--ink-sub);margin-top:2px">${w.m}</div>
      </div>
      <button class="btn-secondary" style="padding:4px 8px" onclick="showWordDetail('${w.id}')">${ICONS.eye}</button>
    </div>
  `).join('');
}

// ---------- 单词学习会话 ----------
function startWordSession(type) {
  const words = type === 'review' ? getTodayWords().review : getTodayWords().fresh;
  if (words.length === 0) { toast('没有需要学习的单词', ''); return; }
  
  wordSession = { type, words: [...words], idx: 0 };
  showWordCard();
}

function showWordCard() {
  if (!wordSession) return;
  if (wordSession.idx >= wordSession.words.length) {
    // 完成
    const type = wordSession.type;
    wordSession = null;
    modal(`
      <div style="text-align:center;padding:20px 0">
        <div style="font-family:var(--font-serif);font-size:20px;color:var(--primary-teal);margin-bottom:8px">✦ ${type==='review'?'复习完成':'新词学习完成'} ✦</div>
        <p style="color:var(--ink-sub);font-size:14px">已保存学习进度，下次会自动按间隔时间推送</p>
      </div>
    `, [{txt:'好的', cls:'btn-primary', act:'close'}]);
    renderWords();
    return;
  }
  
  const w = wordSession.words[wordSession.idx];
  const isFresh = wordSession.type === 'fresh';
  // 新词第一次显示释义
  const showMeaning = !isFresh;
  
  modal(`
    <div style="text-align:center;padding:24px 0 12px">
      <div style="font-size:12px;color:var(--ink-sub);margin-bottom:16px">${wordSession.type==='review'?'复习':'新词'} ${wordSession.idx+1} / ${wordSession.words.length}</div>
      <div style="font-family:var(--font-serif);font-size:36px;font-weight:600;color:var(--ink-deep);letter-spacing:1px">${w.w}</div>
      <div style="font-size:13px;color:var(--ink-light);margin-top:8px">${w.p || ''}</div>
      
      ${!showMeaning ? `<button class="btn-primary" style="margin-top:20px" onclick="toggleMeaning(this)">${ICONS.eye} 显示释义</button>` : `
        <div style="margin-top:16px;padding:16px;background:var(--bg-paper-light);border-radius:var(--radius-md);text-align:left">
          <div style="font-size:16px;color:var(--ink-main);font-weight:500">${w.m}</div>
          ${w.e ? `<div style="font-size:13px;color:var(--ink-sub);margin-top:8px;font-style:italic">${w.e}</div>` : ''}
        </div>
        <div style="display:flex;justify-content:center;gap:8px;margin-top:24px">
          <button class="btn-danger" onclick="answerWord('${w.id}', 1)">不认识</button>
          <button class="btn-secondary" onclick="answerWord('${w.id}', 3)">模糊</button>
          <button class="btn-secondary" onclick="answerWord('${w.id}', 4)">认识</button>
          <button class="btn-primary" onclick="answerWord('${w.id}', 5)">非常熟</button>
        </div>
      `}
    </div>
    <div style="text-align:center;margin-top:12px">
      <button class="btn-secondary" onclick="closeAllModals();wordSession=null;renderWords()">退出学习</button>
    </div>
  `, [], true);
  
  window.toggleMeaning = function(btn) {
    btn.onclick = null;
    closeAllModals();
    showWordCard();
  };
  
  window.answerWord = function(id, quality) {
    markWord(id, quality);
    wordSession.idx++;
    closeAllModals();
    showWordCard();
  };
}

// ---------- 单词详情/添加/设置 ----------
function showAddWordModal() {
  modal(`
    <div class="form-group"><label>单词</label><input class="form-control" id="m-w" placeholder="如 geospatial"></div>
    <div class="form-group"><label>音标（可选）</label><input class="form-control" id="m-p" placeholder="如 /ˌdʒiːoʊˈspeɪʃl/"></div>
    <div class="form-group"><label>释义</label><input class="form-control" id="m-m" placeholder="如 adj. 地理空间的"></div>
    <div class="form-group"><label>例句（可选）</label><textarea class="form-control" id="m-e"></textarea></div>
  `, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'保存', cls:'btn-primary', act:'save', onClick: (m) => {
        const w = document.getElementById('m-w').value.trim();
        if (!w) { toast('请填写单词', 'error'); return; }
        DB.words.push({
          id: uid(), w,
          p: document.getElementById('m-p').value.trim(),
          m: document.getElementById('m-m').value.trim(),
          e: document.getElementById('m-e').value.trim(),
          status: 'new', ease: 2.5, interval: 0, reps: 0, nextReview: todayTs(),
          addedAt: Date.now(), reviewHistory: []
        });
        saveDB(); toast('已添加', 'success');
      }}
  ]);
}

function showWordDetail(id) {
  const w = DB.words.find(x => x.id === id);
  if (!w) return;
  modal(`
    <div style="padding:16px;background:var(--bg-paper-light);border-radius:var(--radius-md)">
      <div style="font-family:var(--font-serif);font-size:24px;font-weight:600">${w.w}</div>
      <div style="font-size:13px;color:var(--ink-light);margin-top:4px">${w.p || '(无音标)'}</div>
      <div style="font-size:15px;color:var(--ink-main);margin-top:12px">${w.m || '(暂无释义)'}</div>
      ${w.e ? `<div style="font-size:13px;color:var(--ink-sub);margin-top:8px;font-style:italic">"${w.e}"</div>` : ''}
    </div>
    <div style="margin-top:12px;display:flex;gap:12px;font-size:12px;color:var(--ink-sub)">
      <span>状态：${w.status}</span>
      <span>间隔：${w.interval || 0} 天</span>
      <span>次数：${w.reps || 0}</span>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn-secondary" style="flex:1" onclick="callAIWord('${w.w}')">${ICONS.sparkles} AI 辅助</button>
      <button class="btn-danger" onclick="deleteWord('${w.id}')">删除</button>
    </div>
    <div id="aiWordResult" style="margin-top:12px"></div>
  `, [
    { txt:'关闭', cls:'btn-secondary', act:'close' }
  ]);
}

async function callAIWord(word) {
  const r = document.getElementById('aiWordResult');
  r.innerHTML = '<div class="loading">AI 正在思考</div>';
  try {
    const txt = await aiWordHelp(word);
    r.innerHTML = `<div style="padding:12px;background:var(--bg-paper-deep);border-radius:var(--radius-md);font-size:13px;line-height:1.8">${txt.replace(/\n/g,'<br>')}</div>`;
  } catch (e) {
    r.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:12px;color:var(--danger)">${e.message}</p></div>`;
  }
}

function deleteWord(id) {
  modal(`确认删除这个单词？删除后无法恢复。`, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'确认删除', cls:'btn-danger', act:'del', onClick: () => {
        DB.words = DB.words.filter(w => w.id !== id);
        saveDB(); toast('已删除', 'success');
      }}
  ]);
}

function showWordSettings() {
  modal(`
    <div class="form-group">
      <label>每天新背单词数（当前：${DB.settings.dailyNewWords}）</label>
      <input type="number" class="form-control" id="m-dnw" min="5" max="100" value="${DB.settings.dailyNewWords}">
    </div>
    <div style="font-size:12px;color:var(--ink-sub);margin-top:16px">
      词库管理：
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-secondary" onclick="importWordFile()">${ICONS.upload} 导入自定义词库</button>
      <button class="btn-secondary" onclick="exportData()">${ICONS.download} 导出全部数据</button>
    </div>
    <input type="file" id="wordFile" accept=".json,.txt" style="display:none">
    <div id="importResult" style="margin-top:12px;font-size:12px"></div>
  `, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'保存', cls:'btn-primary', act:'save', onClick: () => {
        const v = parseInt(document.getElementById('m-dnw').value);
        if (v >= 5 && v <= 100) { DB.settings.dailyNewWords = v; saveDB(); toast('已保存', 'success'); }
        else toast('请输入 5-100 之间的数', 'error');
      }}
  ]);
}

function importWordFile() {
  const input = document.getElementById('wordFile');
  input.click();
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    const txt = await f.text();
    const r = document.getElementById('importResult');
    try {
      let arr = [];
      if (f.name.endsWith('.json')) {
        arr = JSON.parse(txt);
      } else {
        // 每行格式: word [pinyin] 释义 | word 释义  等
        arr = txt.split('\n').filter(l=>l.trim()).map(l => {
          const parts = l.trim().split(/\s+/);
          return { w: parts[0], m: parts.slice(1).join(' ') };
        });
      }
      let added = 0;
      arr.forEach(d => {
        if (d.w && !DB.words.find(x => x.w === d.w)) {
          DB.words.push({
            id: uid(), w: d.w, p: d.p || '', m: d.m || '', e: d.e || '',
            status: 'new', ease: 2.5, interval: 0, reps: 0, nextReview: todayTs(),
            addedAt: Date.now(), reviewHistory: []
          });
          added++;
        }
      });
      saveDB();
      r.innerHTML = `<span style="color:var(--primary-teal)">成功导入 ${added} 个新单词</span>`;
      filterWords();
    } catch (e) {
      r.innerHTML = `<span style="color:var(--danger)">解析失败：${e.message}</span>`;
    }
  };
}

// ---------- 页面渲染：通用任务页面 ----------
function renderTaskPage(type, title, desc, helpText, extraTop = '') {
  const page = document.querySelector('.page');
  const list = DB.tasks.filter(t => t.type === type).sort((a,b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return (a.deadline||'').localeCompare(b.deadline||'');
  });
  
  const doneCount = list.filter(t => t.status === 'done').length;
  const totalCount = list.length;
  const percent = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;
  
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>${title}</h2>
      <p>${desc}</p>
    </div>
    
    ${extraTop}
    
    <div class="stat-grid">
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--primary-teal)">${percent}%</div>
        <div style="font-size:12px;color:var(--ink-sub)">完成率</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--azure-stone)">${doneCount} / ${totalCount}</div>
        <div style="font-size:12px;color:var(--ink-sub)">已完成</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--ochre)">${list.filter(t=>t.priority==='high').length}</div>
        <div style="font-size:12px;color:var(--ink-sub)">高优先级</div>
      </div>
    </div>
    
    <div class="flex flex-between gap-md" style="margin-bottom:var(--space-md)">
      <div class="card-title" style="margin:0">任务列表 ${helpBtn(helpText)}</div>
      <button class="btn-primary" onclick="showAddTaskModal('${type}')">${ICONS.plus} 新建</button>
    </div>
    
    ${list.length === 0 ? `<div class="card"><div class="empty-state"><h4>还没有任何任务</h4><p>点击「新建」开始添加</p></div></div>` : `
    <div class="card" style="padding:0">
      ${list.map(t => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-paper-light);${t.status==='done'?'opacity:0.5':''}">
          <input type="checkbox" ${t.status==='done'?'checked':''} onchange="toggleTask('${t.id}')" style="width:16px;height:16px;accent-color:var(--primary-teal)">
          <div style="flex:1">
            <div style="font-size:14px;${t.status==='done'?'text-decoration:line-through':''}">${t.title}</div>
            <div style="font-size:11px;color:var(--ink-light);margin-top:2px">
              ${t.deadline ? `截止 ${t.deadline}` : ''}
              ${t.tags && t.tags.length ? ' · ' + t.tags.map(tg=>`<span class="tag">${tg}</span>`).join(' ') : ''}
            </div>
          </div>
          <span class="tag ${t.priority==='high'?'tag-cinnabar':t.priority==='medium'?'tag-ochre':'tag-teal'}">${t.priority==='high'?'高':t.priority==='medium'?'中':'低'}</span>
          <button class="btn-secondary" style="padding:4px 8px" onclick="showTaskDetail('${t.id}')">${ICONS.eye}</button>
        </div>
      `).join('')}
    </div>`}
    
    ${type === 'plan' ? `
    <div class="ink-divider"></div>
    <div class="card">
      <div class="card-title">${ICONS.sparkles} AI 帮我制定计划</div>
      <div class="flex gap-sm">
        <input class="form-control" id="planGoal" placeholder="比如：7天内刷完 LeetCode 20 道中等题" style="flex:1">
        <button class="btn-primary" onclick="aiMakePlanUI()">生成</button>
      </div>
      <div id="planAiResult" style="margin-top:16px"></div>
    </div>` : ''}
  `;
}

// ---------- 课程表 ----------
const COURSE_COLORS = ['#2A7E78', '#2F6E90', '#C9A227', '#B4472F', '#55A9A0', '#7FA8BE'];
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function courseTimeText(c) {
  const s = (PERIOD_TIMES[c.periods[0]] || '').split('-')[0];
  const e = (PERIOD_TIMES[c.periods[1]] || '').split('-')[1];
  return `${c.periods[0]}-${c.periods[1]}节 ${s}-${e}`;
}

function renderTimetableGrid() {
  const todayIdx = (new Date().getDay() + 6) % 7 + 1;
  const MAXP = 12, CELL = 44;
  return `
    <div class="tt-head">
      <div class="tt-corner">节次</div>
      ${WEEK_DAYS.map((d, i) => `<div class="tt-day-head ${todayIdx === i + 1 ? 'is-today' : ''}">${d}</div>`).join('')}
    </div>
    <div class="tt-body">
      <div class="tt-times">
        ${Array.from({ length: MAXP }, (_, i) => `
          <div class="tt-time-cell" style="height:${CELL}px">
            <b>${i + 1}</b><span>${(PERIOD_TIMES[i + 1] || '').split('-')[0]}</span><span>${(PERIOD_TIMES[i + 1] || '').split('-')[1]}</span>
          </div>`).join('')}
      </div>
      ${WEEK_DAYS.map((d, i) => {
        const idx = i + 1;
        const list = DB.courses.filter(c => c.day === idx);
        return `<div class="tt-col ${todayIdx === idx ? 'is-today' : ''}" style="height:${MAXP * CELL}px">
          ${list.map(c => {
            const [s, e] = c.periods;
            const color = COURSE_COLORS[(c.day + c.periods[0]) % COURSE_COLORS.length];
            const top = (s - 1) * CELL + 2;
            const h = (e - s + 1) * CELL - 4;
            const siblings = list.filter(x => x.periods[0] === s && x.periods[1] === e);
            const count = siblings.length;
            const index = siblings.findIndex(x => x.id === c.id);
            const width = `calc(${100 / count}% - 4px)`;
            const left = `calc(2px + ${index * 100 / count}%)`;
            return `<div class="tt-course" style="top:${top}px;height:${h}px;left:${left};width:${width};right:auto;border-left-color:${color};background:${color}1f">
              <div class="tt-course-name">${c.name}</div>
              <div class="tt-course-meta">${c.location}</div>
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>`;
}

function renderTimetableMobile() {
  const todayIdx = (new Date().getDay() + 6) % 7 + 1;
  return WEEK_DAYS.map((d, i) => {
    const idx = i + 1;
    const list = DB.courses.filter(c => c.day === idx).sort((a, b) => a.periods[0] - b.periods[0]);
    return `<div class="ttm-day ${todayIdx === idx ? 'is-today' : ''}">
      <div class="ttm-day-title">${d}${todayIdx === idx ? ' · 今天' : ''}<span>${list.length} 节课</span></div>
      ${list.length === 0 ? `<div class="ttm-empty">无课</div>` : list.map(c => `
        <div class="ttm-course">
          <div class="ttm-time">${c.periods[0]}-${c.periods[1]}节<br><span>${(PERIOD_TIMES[c.periods[0]] || '').split('-')[0]}-${(PERIOD_TIMES[c.periods[1]] || '').split('-')[1]}</span></div>
          <div class="ttm-info">
            <div class="ttm-name">${c.name}</div>
            <div class="ttm-meta">${c.location}</div>
          </div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderTimetableCard() {
  const todayList = todayCourses();
  return `
    <div class="card" style="margin-bottom:var(--space-lg)">
      <div class="flex flex-between gap-md" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin:0">${ICONS.calendar} 本周课程表 ${helpBtn('这是你的 2026-2027 学年第 1 学期课表，全部为啬园校区。今天有 ' + todayList.length + ' 节课。手机上会按天显示为列表；电脑上为周视图网格。')}</div>
        <span style="font-size:12px;color:var(--ink-sub)">今天 ${todayList.length} 节课</span>
      </div>
      <div class="tt-desktop">${renderTimetableGrid()}</div>
      <div class="tt-mobile">${renderTimetableMobile()}</div>
    </div>`;
}

function renderCode() { renderTaskPage('code', '代码练习', '编程任务管理 · Python / C++ / LeetCode', '代码练习模块。记录编程任务，到期自动在今日提醒。可关联学习视频。'); }
function renderHomework() { renderTaskPage('homework', '课程与作业', '作业管理 · 课程日程', '课程与作业模块。上方是本周课表，下方是作业列表，超期会在今日页高亮提示。', renderTimetableCard()); }
function renderPlan() { renderTaskPage('plan', '学习计划', '长期 / 短期计划拆解 · AI 辅助生成', '学习计划模块。把大目标拆解为每天可执行的小任务，支持 AI 帮你生成。'); }

function toggleTask(id) {
  const t = DB.tasks.find(x => x.id === id);
  if (t) { t.status = t.status === 'done' ? 'todo' : 'done'; saveDB(); }
  renderCurrent();
}

function showAddTaskModal(type) {
  const titles = { code:'代码练习', homework:'作业', plan:'学习计划' };
  modal(`
    <div class="form-group"><label>任务标题</label><input class="form-control" id="t-title"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>截止日期</label><input type="date" class="form-control" id="t-date" value="${addDays(1)}"></div>
      <div class="form-group"><label>优先级</label>
        <select class="form-control" id="t-pri">
          <option value="high">高</option>
          <option value="medium" selected>中</option>
          <option value="low">低</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>标签（逗号分隔）</label><input class="form-control" id="t-tags" placeholder="如 数据结构, Python"></div>
  `, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'保存', cls:'btn-primary', act:'save', onClick: () => {
        DB.tasks.push({
          id: uid(), type,
          title: document.getElementById('t-title').value.trim() || '未命名任务',
          status: 'todo',
          deadline: document.getElementById('t-date').value,
          priority: document.getElementById('t-pri').value,
          tags: (document.getElementById('t-tags').value || '').split(',').map(s=>s.trim()).filter(Boolean)
        });
        saveDB(); toast('已添加', 'success');
      }}
  ]);
}

function showTaskDetail(id) {
  const t = DB.tasks.find(x => x.id === id);
  if (!t) return;
  const titleMap = { code:'代码练习', homework:'作业', plan:'学习计划' };
  modal(`
    <div style="padding:16px;background:var(--bg-paper-light);border-radius:var(--radius-md)">
      <div style="font-family:var(--font-serif);font-size:20px;font-weight:600">${t.title}</div>
      <div style="font-size:12px;color:var(--ink-sub);margin-top:8px">
        类型：${titleMap[t.type]} · 状态：${t.status==='done'?'已完成':'进行中'} · 优先级：${t.priority==='high'?'高':t.priority==='medium'?'中':'低'}
      </div>
      <div style="font-size:13px;color:var(--ink-sub);margin-top:4px">截止：${t.deadline || '(未设)'}</div>
      ${t.tags && t.tags.length ? `<div style="margin-top:8px">${t.tags.map(x=>`<span class="tag">${x}</span>`).join(' ')}</div>` : ''}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn-secondary" style="flex:1" onclick="toggleTask('${t.id}');closeAllModals();renderCurrent()">${t.status==='done'?'标记未完成':'标记已完成'}</button>
      <button class="btn-danger" onclick="modal('确认删除这个任务？',[{txt:'取消',cls:'btn-secondary',act:'close'},{txt:'删除',cls:'btn-danger',act:'del',onClick:()=>{DB.tasks=DB.tasks.filter(x=>x.id!=='${t.id}');saveDB();closeAllModals();toast('已删除','success');renderCurrent()}}])">删除</button>
    </div>
  `, [{ txt:'关闭', cls:'btn-secondary', act:'close' }]);
}

// ---------- AI 计划生成 ----------
async function aiMakePlanUI() {
  const goal = document.getElementById('planGoal')?.value?.trim();
  if (!goal) { toast('请输入目标', 'error'); return; }
  const r = document.getElementById('planAiResult');
  r.innerHTML = '<div class="loading">AI 正在生成计划</div>';
  try {
    const plan = await aiMakePlan(goal, 7);
    let html;
    if (Array.isArray(plan)) {
      html = `<div style="border:1px solid var(--ochre);border-radius:var(--radius-md);padding:12px;background:rgba(139,105,20,0.05)">
        <div style="font-size:13px;color:var(--ochre);font-weight:500;margin-bottom:8px">AI 生成的计划（预览）</div>
        ${plan.map(p => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border-paper-light)">
          <span style="font-family:var(--font-serif);font-size:13px;color:var(--primary-teal);width:40px">Day${p.day}</span>
          <div style="flex:1;font-size:13px">${p.task}</div>
          <span style="font-size:11px;color:var(--ink-light)">${p.time||''}</span>
        </div>`).join('')}
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn-secondary" onclick="document.getElementById('planAiResult').innerHTML=''">跳过</button>
          <button class="btn-primary" onclick="confirmAiPlan(${JSON.stringify(plan).replace(/"/g,'&quot;')})">${ICONS.check} 确认添加到学习计划</button>
        </div>
      </div>`;
    } else {
      html = `<div style="padding:12px;background:var(--bg-paper-deep);border-radius:var(--radius-md);font-size:13px">${String(plan).replace(/\n/g,'<br>')}</div>`;
    }
    r.innerHTML = html;
  } catch (e) {
    r.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:12px;color:var(--danger)">${e.message}</p></div>`;
  }
}

function confirmAiPlan(plan) {
  plan.forEach((p, i) => {
    const d = new Date(); d.setDate(d.getDate() + (p.day || i+1) - 1);
    DB.tasks.push({
      id: uid(), type: 'plan',
      title: p.task,
      status: 'todo',
      deadline: d.toISOString().slice(0,10),
      priority: p.priority === 'high' ? 'high' : 'medium',
      tags: ['AI生成']
    });
  });
  saveDB(); toast(`已添加 ${plan.length} 个任务`, 'success');
  document.getElementById('planAiResult').innerHTML = '';
  renderCurrent();
}

// ---------- 页面渲染：学习视频库 ----------
function videoSearchUrl(v) {
  const q = encodeURIComponent(v.title || '');
  const p = String(v.platform || '').toLowerCase();
  if (p.includes('b站') || p.includes('bilibili')) return `https://search.bilibili.com/all?keyword=${q}`;
  if (p.includes('mooc') || p.includes('中国大学')) return `https://www.icourse163.org/search.htm?search=${q}`;
  if (p.includes('学堂在线')) return `https://www.xuetangx.com/search?query=${q}`;
  if (p.includes('慕课网')) return `https://www.imooc.com/search/?words=${q}`;
  return `https://www.baidu.com/s?wd=${encodeURIComponent(`${v.title || ''} ${v.platform || ''}`)}`;
}

function renderVideoLink(v) {
  const rawUrl = String(v.url || '').trim();
  const verifiedManual = (v.source === 'manual' || v.source === 'real') && /^https?:\/\//i.test(rawUrl);
  const url = verifiedManual ? rawUrl : videoSearchUrl(v);
  const label = verifiedManual ? '打开视频' : '平台搜索';
  return `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="text-decoration:none">${ICONS.arrow} ${label}</a>`;
}

function renderVideos() {
  const page = document.querySelector('.page');
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>学习视频库</h2>
      <p>收藏的优质学习视频 · AI 可根据知识点推荐</p>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="flex gap-sm" style="align-items:center">
        <input class="form-control" id="v-keyword" placeholder="输入知识点，AI 帮你找视频（如：二叉树前序遍历）" style="flex:1">
        <button class="btn-primary" onclick="aiRecommendUI()">${ICONS.sparkles} 真实搜索</button>
        <button class="btn-secondary" onclick="showAddVideoModal()">${ICONS.plus} 手动添加</button>
      </div>
      <div id="videoAiResult" style="margin-top:16px"></div>
    </div>
    
    ${DB.videos.length === 0 ? `<div class="card"><div class="empty-state"><h4>还没有收藏视频</h4><p>用 AI 搜索或手动添加</p></div></div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)" class="grid-2">
      ${DB.videos.map(v => `
        <div class="card">
          <div class="flex gap-sm" style="align-items:center;margin-bottom:8px">
            <span class="tag tag-teal">${ICONS.video} ${v.platform}</span>
            <span style="font-size:12px;color:var(--ink-sub)">${v.teacher || ''}</span>
          </div>
          <div style="font-size:14px;font-weight:500;color:var(--ink-deep);margin-bottom:8px">${v.title}</div>
          ${v.note ? `<div style="font-size:12px;color:var(--ink-sub);margin-bottom:8px">${v.note}</div>` : ''}
          ${v.tags && v.tags.length ? `<div style="margin-bottom:8px">${v.tags.map(x=>`<span class="tag">${x}</span>`).join(' ')}</div>` : ''}
          <div class="flex gap-sm">
            ${renderVideoLink(v)}
            <button class="btn-secondary" onclick="deleteVideo('${v.id}')">${ICONS.trash}</button>
          </div>
        </div>
      `).join('')}
    </div>`}
  `;
}

async function aiRecommendUI() {
  const kw = document.getElementById('v-keyword')?.value?.trim();
  if (!kw) { toast('请输入知识点', 'error'); return; }
  const r = document.getElementById('videoAiResult');
  r.innerHTML = '<div class="loading">正在检索国内学习平台并逐条验证链接</div>';
  try {
    const recs = await aiRecommendVideos(kw);
    if (Array.isArray(recs)) {
      r.innerHTML = `<div style="border:1px solid var(--ochre);border-radius:var(--radius-md);padding:12px;background:rgba(139,105,20,0.05)">
        <div style="font-size:13px;color:var(--ochre);font-weight:500;margin-bottom:8px">本次来源：${[...new Set(recs.map(v => v.platform))].join('、')} · 共 ${recs.length} 条，链接均已验证</div>
        ${recs.map((v,i) => `
          <div style="padding:10px;background:var(--bg-paper-light);border-radius:var(--radius-md);margin-bottom:8px">
            <div style="font-size:14px;font-weight:500">${v.title}</div>
            <div style="font-size:11px;color:var(--ink-sub);margin-top:2px">${v.teacher} · ${v.platform}</div>
            <div style="font-size:12px;color:var(--ink-sub);margin-top:4px">${v.reason}</div>
            <div class="flex gap-sm" style="margin-top:8px">
              <button class="btn-secondary" style="padding:4px 10px;font-size:12px" onclick="confirmAiVideo(${i})">确认添加</button>
              <button class="btn-secondary" style="padding:4px 10px;font-size:12px" onclick="showEditAiVideo(${i})">手动修改</button>
            </div>
          </div>`).join('')}
        <div id="_aiVideoRecs" style="display:none">${JSON.stringify(recs)}</div>
      </div>`;
    } else {
      r.innerHTML = `<div style="padding:12px;background:var(--bg-paper-deep);border-radius:var(--radius-md);font-size:13px">${String(recs).replace(/\n/g,'<br>')}</div>`;
    }
  } catch (e) {
    r.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:12px;color:var(--danger)">${e.message}</p></div>`;
  }
}

function getAiVideoRecs() {
  const d = document.getElementById('_aiVideoRecs');
  return d ? JSON.parse(d.textContent) : null;
}

function confirmAiVideo(i) {
  const recs = getAiVideoRecs();
  if (!recs || !recs[i]) return;
  const v = recs[i];
  DB.videos.push({
    id: uid(),
    title: v.title, teacher: v.teacher, platform: v.platform, platformType: 'other',
    url: v.url, source: 'real', note: v.reason, tags: [document.getElementById('v-keyword').value.trim()]
  });
  saveDB(); toast('已添加到视频库', 'success');
  renderVideos();
}

function showEditAiVideo(i) {
  const recs = getAiVideoRecs();
  if (!recs || !recs[i]) return;
  const v = recs[i];
  modal(`
    <div class="form-group"><label>标题</label><input class="form-control" id="ev-t" value="${v.title}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>老师</label><input class="form-control" id="ev-te" value="${v.teacher||''}"></div>
      <div class="form-group"><label>平台</label><input class="form-control" id="ev-p" value="${v.platform||''}"></div>
    </div>
    <div class="form-group"><label>视频链接</label><input class="form-control" id="ev-u" value="${v.url||''}"></div>
    <div class="form-group"><label>备注</label><textarea class="form-control" id="ev-n">${v.reason||''}</textarea></div>
  `, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'确认添加', cls:'btn-primary', act:'save', onClick: () => {
        DB.videos.push({
          id: uid(),
          title: document.getElementById('ev-t').value,
          teacher: document.getElementById('ev-te').value,
          platform: document.getElementById('ev-p').value,
          platformType: 'other',
          url: document.getElementById('ev-u').value,
          source: 'manual',
          note: document.getElementById('ev-n').value,
          tags: [document.getElementById('v-keyword').value.trim()]
        });
        saveDB(); toast('已添加', 'success');
      }}
  ]);
}

function showAddVideoModal() {
  modal(`
    <div class="form-group"><label>视频标题</label><input class="form-control" id="nv-t"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>老师/机构</label><input class="form-control" id="nv-te"></div>
      <div class="form-group"><label>平台</label>
        <select class="form-control" id="nv-p">
          <option>B站</option><option>中国大学MOOC</option><option>学堂在线</option><option>慕课网</option><option>智慧树</option><option>其他</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>视频链接</label><input class="form-control" id="nv-u" placeholder="https://..."></div>
    <div class="form-group"><label>知识点标签（逗号分隔）</label><input class="form-control" id="nv-tg"></div>
    <div class="form-group"><label>备注（可选）</label><textarea class="form-control" id="nv-n"></textarea></div>
  `, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'保存', cls:'btn-primary', act:'save', onClick: () => {
        DB.videos.push({
          id: uid(),
          title: document.getElementById('nv-t').value.trim() || '未命名',
          teacher: document.getElementById('nv-te').value.trim(),
          platform: document.getElementById('nv-p').value,
          platformType: 'other',
          url: document.getElementById('nv-u').value.trim(),
          source: 'manual',
          tags: (document.getElementById('nv-tg').value || '').split(',').map(s=>s.trim()).filter(Boolean),
          note: document.getElementById('nv-n').value.trim()
        });
        saveDB(); toast('已保存', 'success');
      }}
  ]);
}

function deleteVideo(id) {
  modal('确认删除这个视频？', [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'删除', cls:'btn-danger', act:'del', onClick: () => {
        DB.videos = DB.videos.filter(v => v.id !== id); saveDB(); toast('已删除', 'success'); renderVideos();
      }}
  ]);
}

// ---------- 页面渲染：记账 ----------
function renderFinance() {
  const page = document.querySelector('.page');
  const sum = getFinanceSummary();
  
  // 近6个月趋势
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const ym = d.toISOString().slice(0, 7);
    const items = getFinanceByMonth(ym);
    let inc = 0, exp = 0;
    items.forEach(f => f.type==='income'?inc+=f.amount:exp+=f.amount);
    trend.push({ ym, inc, exp });
  }
  const maxAmt = Math.max(1, ...trend.map(t => Math.max(t.inc, t.exp)));
  const trendHtml = trend.map(t => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="display:flex;align-items:flex-end;height:80px;gap:2px">
        <div style="width:10px;height:${Math.max(2,t.inc/maxAmt*70)}px;background:var(--azure-stone);border-radius:2px"></div>
        <div style="width:10px;height:${Math.max(2,t.exp/maxAmt*70)}px;background:var(--cinnabar);border-radius:2px"></div>
      </div>
      <span style="font-size:10px;color:var(--ink-light)">${t.ym.slice(5)}月</span>
    </div>
  `).join('');
  
  const catColors = { '餐饮':'#5EAA45','交通':'#7BA892','学习':'#B8960C','娱乐':'#E07A65','生活':'#8B6914','其他':'#9CA3AF' };
  const catHtml = Object.entries(sum.catExpense).map(([k,v]) => {
    const pct = sum.expense > 0 ? Math.round(v / sum.expense * 100) : 0;
    const color = catColors[k] || '#9CA3AF';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="width:10px;height:10px;background:${color};border-radius:2px"></span>
      <span style="flex:1;font-size:13px">${k}</span>
      <span style="font-size:12px;color:var(--ink-sub)">¥${v} · ${pct}%</span>
    </div>`;
  }).join('');
  
  // 本月流水
  const monthItems = getFinanceByMonth(sum.ym).sort((a,b) => b.date.localeCompare(a.date));
  
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>记账</h2>
      <p>本月收入 ¥${sum.income} · 支出 ¥${sum.expense} · 结余 ¥${sum.balance}</p>
    </div>
    
    <div class="stat-grid">
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-size:12px;color:var(--ink-sub)">本月收入</div>
        <div style="font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--azure-stone);margin-top:4px">¥${sum.income}</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-size:12px;color:var(--ink-sub)">本月支出</div>
        <div style="font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--cinnabar);margin-top:4px">¥${sum.expense}</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <div style="font-size:12px;color:var(--ink-sub)">预算剩余</div>
        <div style="font-family:var(--font-serif);font-size:24px;font-weight:600;color:${sum.budget-sum.expense<0?'var(--cinnabar)':'var(--primary-teal)'};margin-top:4px">¥${sum.budget - sum.expense}</div>
      </div>
      <div class="card" style="text-align:center;padding:20px">
        <button class="btn-primary" onclick="showFinanceModal()" style="width:100%">${ICONS.plus} 记一笔</button>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)" class="grid-2">
      <div class="card">
        <div class="card-title">近6个月趋势</div>
        <div style="display:flex;align-items:flex-end;gap:6px;height:110px">${trendHtml}</div>
        <div style="display:flex;gap:16px;font-size:11px;color:var(--ink-sub);margin-top:8px">
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--azure-stone);margin-right:4px;vertical-align:middle;border-radius:2px"></span>收入</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--cinnabar);margin-right:4px;vertical-align:middle;border-radius:2px"></span>支出</span>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">本月支出分类</div>
        ${catHtml || '<div class="empty-state"><p>本月还没有支出记录</p></div>'}
      </div>
    </div>
    
    <div class="ink-divider"></div>
    
    <div class="flex gap-md flex-between" style="margin-bottom:var(--space-md)">
      <div class="card-title" style="margin:0">本月流水 ${helpBtn('所有收支明细，按日期倒序排列。点击可删除。')}</div>
      <button class="btn-secondary" onclick="financeAiAnalyze()">${ICONS.sparkles} AI 消费建议</button>
    </div>
    ${monthItems.length === 0 ? `<div class="card"><div class="empty-state"><p>本月还没有记录</p></div></div>` : `
    <div class="card" style="padding:0">
      ${monthItems.map(f => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border-paper-light)">
          <div style="flex:1">
            <div style="font-size:14px">${f.note || f.category}</div>
            <div style="font-size:11px;color:var(--ink-light);margin-top:2px">${f.date} · ${f.category}</div>
          </div>
          <div style="font-family:var(--font-serif);font-size:16px;font-weight:600;color:${f.type==='income'?'var(--azure-stone)':'var(--cinnabar)'}">
            ${f.type==='income'?'+':'-'}¥${f.amount}
          </div>
          <button class="btn-secondary" style="padding:4px 8px" onclick="deleteFinance('${f.id}')">${ICONS.trash}</button>
        </div>
      `).join('')}
    </div>`}
  `;
}

function showFinanceModal() {
  modal(`
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn-primary" style="flex:1" id="ft-expense" onclick="switchFinanceType('expense')">支出</button>
      <button class="btn-secondary" style="flex:1" id="ft-income" onclick="switchFinanceType('income')">收入</button>
    </div>
    <div class="form-group"><label>金额</label><input type="number" step="0.01" class="form-control" id="fm-amt"></div>
    <div class="form-group"><label>分类</label>
      <select class="form-control" id="fm-cat">
        <option>餐饮</option><option>交通</option><option>学习</option><option>娱乐</option><option>生活</option><option>其他</option>
      </select>
    </div>
    <div class="form-group"><label>日期</label><input type="date" class="form-control" id="fm-date" value="${today()}"></div>
    <div class="form-group"><label>备注（可选）</label><input class="form-control" id="fm-note"></div>
  `, [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'保存', cls:'btn-primary', act:'save', onClick: () => {
        const type = document.getElementById('ft-expense').classList.contains('btn-primary') ? 'expense' : 'income';
        const amt = parseFloat(document.getElementById('fm-amt').value);
        if (!amt || amt <= 0) { toast('请填写有效金额', 'error'); return; }
        DB.finance.push({
          id: uid(), type, amount: amt,
          category: document.getElementById('fm-cat').value,
          date: document.getElementById('fm-date').value,
          note: document.getElementById('fm-note').value
        });
        saveDB(); toast('已记录', 'success');
      }}
  ]);
}

function switchFinanceType(type) {
  const e = document.getElementById('ft-expense');
  const i = document.getElementById('ft-income');
  if (type === 'expense') { e.className = 'btn-primary'; i.className = 'btn-secondary'; }
  else { e.className = 'btn-secondary'; i.className = 'btn-primary'; }
  // 收入分类调整
  const cat = document.getElementById('fm-cat');
  if (type === 'income') {
    cat.innerHTML = '<option>兼职</option><option>生活费</option><option>奖学金</option><option>其他</option>';
  } else {
    cat.innerHTML = '<option>餐饮</option><option>交通</option><option>学习</option><option>娱乐</option><option>生活</option><option>其他</option>';
  }
}

function deleteFinance(id) {
  modal('确认删除这条记录？', [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'删除', cls:'btn-danger', act:'del', onClick: () => { DB.finance = DB.finance.filter(f => f.id !== id); saveDB(); renderCurrent(); }}
  ]);
}

async function financeAiAnalyze() {
  const sum = getFinanceSummary();
  modal(`<div class="loading">AI 正在分析</div>`, []);
  try {
    const txt = await aiAnalyzeFinance(sum);
    const old = document.querySelector('.modal-body');
    if (old) old.innerHTML = `<div style="padding:16px;background:var(--bg-paper-light);border-radius:var(--radius-md);font-size:14px;line-height:1.8">${txt.replace(/\n/g,'<br>')}</div>`;
  } catch (e) {
    const old = document.querySelector('.modal-body');
    if (old) old.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:12px;color:var(--danger)">${e.message}</p></div>`;
  }
}

// ---------- 页面渲染：新闻热点 ----------
function renderNews() {
  const page = document.querySelector('.page');
  if (!DB.settings.newsEnabled) {
    page.innerHTML = `
      <div class="gradient-decor"><h2>新闻热点</h2><p>此功能已关闭</p></div>
      <div class="card"><div class="empty-state"><h4>新闻热点未开启</h4><p>请到设置中开启「新闻热点」功能</p><button class="btn-primary" onclick="navigate('settings')" style="margin-top:12px">去设置</button></div></div>`;
    return;
  }
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>新闻热点</h2>
      <p>百度实时热点 · 每10分钟自动缓存 · 联网刷新</p>
    </div>
    <div class="card" id="newsContent"><div class="loading">正在加载新闻...</div></div>
  `;
  
  fetchNews().then(items => {
    const c = document.getElementById('newsContent');
    if (!c) return;
    if (!items.length) {
      c.innerHTML = `<div class="empty-state"><h4>暂时没有新闻</h4><p>可能是网络问题或RSS源暂时不可用</p><button class="btn-secondary" onclick="renderNews()" style="margin-top:12px">${ICONS.refresh} 刷新</button></div>`;
      return;
    }
    // 按分类分组
    const groups = {};
    items.forEach(it => {
      (groups[it.category] = groups[it.category] || []).push(it);
    });
    c.innerHTML = Object.entries(groups).map(([cat, arr]) => `
      <div style="margin-bottom:20px">
        <div class="card-title">${cat}</div>
        ${arr.slice(0, 6).map(it => `
          <a href="${it.link}" target="_blank" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border-paper-light);text-decoration:none;color:inherit">
            <div style="flex:1">
              <div style="font-size:14px;color:var(--ink-main);font-weight:500">${it.title}</div>
              <div style="font-size:12px;color:var(--ink-sub);margin-top:3px">${it.desc || ''}</div>
              <div style="font-size:11px;color:var(--ink-light);margin-top:4px">${it.source} · ${it.pubDate}</div>
            </div>
            <span style="color:var(--ink-light);align-self:center">${ICONS.arrow}</span>
          </a>
        `).join('')}
      </div>
    `).join('');
  }).catch(e => {
    const c = document.getElementById('newsContent');
    if (c) c.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">加载失败：${e.message}</p></div>`;
  });
}

// ---------- 页面渲染：收集箱 ----------
function renderInbox() {
  const page = document.querySelector('.page');
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>收集箱</h2>
      <p>暂时不知道放哪里的内容 · AI 帮你建议去向</p>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="flex gap-sm">
        <input class="form-control" id="inboxInput" placeholder="输入内容，如链接 / 笔记 / 临时任务" style="flex:1" onkeydown="if(event.key==='Enter') addInbox()">
        <button class="btn-primary" onclick="addInbox()">${ICONS.plus} 收集</button>
      </div>
    </div>
    
    ${DB.inbox.length === 0 ? `<div class="card"><div class="empty-state"><h4>收集箱是空的</h4><p>把暂时不知道放哪里的内容收集到这里</p></div></div>` : `
    <div class="card" style="padding:0">
      ${DB.inbox.map(it => `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border-paper-light)">
          <div style="display:flex;gap:8px;margin-bottom:6px">
            <span class="tag ${it.type==='link'?'tag-teal':it.type==='task'?'tag-cinnabar':'tag-azure'}">${it.type==='text'?'文字':it.type==='link'?'链接':'任务'}</span>
            <span style="font-size:11px;color:var(--ink-light)">${new Date(it.createdAt).toLocaleString('zh-CN', { month:'numeric',day:'numeric',hour:'numeric',minute:'numeric' })}</span>
          </div>
          <div style="font-size:14px;color:var(--ink-main);margin-bottom:8px;word-break:break-all">${it.content}</div>
          <div class="flex gap-sm">
            <button class="btn-secondary" style="padding:4px 10px;font-size:12px" onclick="aiSuggestInboxUI('${it.id}')">${ICONS.sparkles} AI 建议去向</button>
            <button class="btn-secondary" style="padding:4px 10px;font-size:12px" onclick="deleteInbox('${it.id}')">删除</button>
          </div>
        </div>
      `).join('')}
    </div>`}
  `;
}

function addInbox() {
  const val = document.getElementById('inboxInput')?.value?.trim();
  if (!val) { toast('请输入内容', 'error'); return; }
  DB.inbox.push({
    id: uid(),
    type: val.startsWith('http') ? 'link' : val.includes('任务') || val.includes('要做') ? 'task' : 'text',
    content: val,
    createdAt: Date.now()
  });
  saveDB(); toast('已收集', 'success'); document.getElementById('inboxInput').value = '';
  renderCurrent();
}

function deleteInbox(id) {
  DB.inbox = DB.inbox.filter(i => i.id !== id); saveDB(); renderCurrent();
}

async function aiSuggestInboxUI(id) {
  const it = DB.inbox.find(x => x.id === id);
  if (!it) return;
  modal(`<div class="loading">AI 正在分析</div>`, []);
  try {
    const txt = await aiSuggestInbox(it.content);
    const old = document.querySelector('.modal-body');
    if (old) old.innerHTML = `
      <div style="padding:16px;background:var(--bg-paper-light);border-radius:var(--radius-md);margin-bottom:12px;font-size:14px">
        <div style="font-size:12px;color:var(--ochre);margin-bottom:8px">AI 建议</div>
        ${txt}
      </div>
      <div style="font-size:12px;color:var(--ink-sub);margin-bottom:12px;line-height:1.8">
        内容：${it.content}<br>
        请确认放置位置，AI 建议仅供参考
      </div>
    `;
    const oldFooter = document.querySelector('.modal-footer');
    if (oldFooter) oldFooter.remove();
    // 重新生成 footer
    const modalEl = document.querySelector('.modal');
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">先不处理</button>
      <button class="btn-primary" onclick="confirmInboxDelete('${id}')">确认删除（已记住建议）</button>
    `;
    modalEl.appendChild(footer);
  } catch (e) {
    const old = document.querySelector('.modal-body');
    if (old) old.innerHTML = `<div class="empty-state" style="padding:12px"><p style="font-size:12px;color:var(--danger)">${e.message}</p></div>`;
  }
}

function confirmInboxDelete(id) {
  DB.inbox = DB.inbox.filter(i => i.id !== id); saveDB(); closeAllModals(); toast('已清理', 'success'); renderInbox();
}

// ---------- 页面渲染：全局搜索 ----------
function renderSearch() {
  const page = document.querySelector('.page');
  page.innerHTML = `
    <div class="gradient-decor"><h2>全局搜索</h2><p>跨所有模块查找</p></div>
    <div class="card" style="margin-bottom:var(--space-md)">
      <input class="form-control" id="globalSearch" placeholder="输入关键词..." style="font-size:15px;padding:14px" oninput="doSearch()">
    </div>
    <div id="searchResult"></div>
  `;
}

function doSearch() {
  const q = (document.getElementById('globalSearch')?.value || '').toLowerCase().trim();
  const c = document.getElementById('searchResult');
  if (!q) { c.innerHTML = '<div class="empty-state"><p>输入关键词开始搜索</p></div>'; return; }
  
  const results = { modules:[], courses:[], words:[], tasks:[], videos:[], inbox:[], notes:[], finance:[] };
  const moduleEntries = [
    { title:'今日总览', desc:'查看今天要做的事项', route:'today', keywords:['今日','今天','待办'] },
    { title:'考研单词本', desc:'背单词与复习', route:'words', keywords:['单词','单词本','考研单词','背单词'] },
    { title:'代码练习', desc:'查看编程练习任务', route:'code', keywords:['代码','编程','练习'] },
    { title:'课程与作业', desc:'查看本周课程表和作业', route:'homework', keywords:['课程表','课表','课程','作业'] },
    { title:'学习计划', desc:'查看学习计划与任务', route:'plan', keywords:['学习计划','计划'] },
    { title:'学习视频库', desc:'查看收藏的学习视频', route:'videos', keywords:['视频','视频库','学习视频'] },
    { title:'记账', desc:'查看收入与支出', route:'finance', keywords:['记账','账单','消费'] },
    { title:'新闻热点', desc:'查看新闻与热点', route:'news', keywords:['新闻','热点'] },
    { title:'收集箱', desc:'查看暂存的内容', route:'inbox', keywords:['收集箱','收集'] },
    { title:'AI 帮手', desc:'使用 AI 学习辅助', route:'ai', keywords:['ai','ai帮手','人工智能'] },
    { title:'设置与数据', desc:'设置、备份与恢复', route:'settings', keywords:['设置','数据','备份','导出','更新日志','使用说明'] }
  ];
  results.modules = moduleEntries.filter(m => m.keywords.some(k => k.includes(q) || q.includes(k)));
  DB.courses.forEach(course => {
    const text = `${course.name || ''} ${course.location || ''}`.toLowerCase();
    if (text.includes(q)) results.courses.push(course);
  });
  DB.words.forEach(w => { if (w.w.toLowerCase().includes(q) || w.m.toLowerCase().includes(q)) results.words.push(w); });
  DB.tasks.forEach(t => { if ((t.title||'').toLowerCase().includes(q) || (t.tags||[]).join(' ').toLowerCase().includes(q)) results.tasks.push(t); });
  DB.videos.forEach(v => { if ((v.title||'').toLowerCase().includes(q) || (v.tags||[]).join(' ').toLowerCase().includes(q)) results.videos.push(v); });
  DB.inbox.forEach(i => { if (i.content.toLowerCase().includes(q)) results.inbox.push(i); });
  (DB.notes || []).forEach(n => { if (`${n.title || ''} ${n.content || ''}`.toLowerCase().includes(q)) results.notes.push(n); });
  DB.finance.forEach(f => { if ((f.note||'').toLowerCase().includes(q) || f.category.toLowerCase().includes(q)) results.finance.push(f); });
  
  const sections = [
    { key:'modules', title:'功能入口', icon:'search', items:results.modules, route:'' },
    { key:'courses', title:'课程表', icon:'calendar', items:results.courses, route:'homework' },
    { key:'words', title:'单词本', icon:'book', items:results.words, route:'words' },
    { key:'tasks', title:'任务', icon:'target', items:results.tasks, route:'plan' },
    { key:'videos', title:'视频库', icon:'video', items:results.videos, route:'videos' },
    { key:'inbox', title:'收集箱', icon:'inbox', items:results.inbox, route:'inbox' },
    { key:'notes', title:'笔记', icon:'book', items:results.notes, route:'inbox' },
    { key:'finance', title:'记账', icon:'wallet', items:results.finance, route:'finance' },
  ];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const weekNames = ['日','一','二','三','四','五','六'];
  
  const total = sections.reduce((a,s) => a + s.items.length, 0);
  c.innerHTML = `
    <div style="font-size:13px;color:var(--ink-sub);margin-bottom:12px">共找到 ${total} 条结果</div>
    ${sections.map(s => s.items.length ? `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title">${ICONS[s.icon]} ${s.title} · ${s.items.length}</div>
        ${s.items.slice(0,8).map(it => {
          let text = '';
          let target = s.route;
          if (s.key === 'modules') { text = `<b>${esc(it.title)}</b> - ${esc(it.desc)}`; target = it.route; }
          else if (s.key === 'courses') text = `<b>${esc(it.name)}</b> - 周${weekNames[it.day]} ${it.periods[0]}-${it.periods[1]}节 · ${esc(it.location)}`;
          else if (s.key === 'words') text = `<b>${esc(it.w)}</b> - ${esc(it.m)}`;
          else if (s.key === 'tasks') {
            text = `<b>${esc(it.title)}</b>`;
            target = it.type === 'homework' ? 'homework' : it.type === 'code' ? 'code' : 'plan';
          }
          else if (s.key === 'videos') text = `<b>${esc(it.title)}</b>`;
          else if (s.key === 'inbox') text = esc(it.content);
          else if (s.key === 'notes') text = `<b>${esc(it.title || '笔记')}</b> - ${esc(it.content || '')}`;
          else text = `${it.type==='income'?'收入':'支出'} ¥${it.amount} - ${esc(it.category)}`;
          return `<div style="padding:8px 0;border-bottom:1px dashed var(--border-paper-light);cursor:pointer" onclick="navigate('${target}')">${text}</div>`;
        }).join('')}
      </div>
    ` : '').join('')}
    ${total === 0 ? `<div class="empty-state"><h4>没有找到</h4><p>试试其他关键词</p></div>` : ''}
  `;
}

// ---------- 页面渲染：AI 帮手 ----------
function renderAI() {
  page = document.querySelector('.page');
  page.innerHTML = `
    <div class="gradient-decor">
      <h2>AI 帮手</h2>
      <p>需要先在设置中配置 API Key · 所有 AI 修改都会先预览</p>
    </div>
    
    ${aiAvailable() ? `
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">${ICONS.video} 知识点视频推荐</div>
      <div style="font-size:12px;color:var(--ink-sub);margin-bottom:10px">当前接入B站、中国大学MOOC、慕课网；逐条验证链接可访问后才展示</div>
      <div class="flex gap-sm">
        <input class="form-control" id="ai-v" placeholder="输入知识点，如 二叉树前序遍历" style="flex:1" onkeydown="if(event.key==='Enter') aiHelperVideo()">
        <button class="btn-primary" onclick="aiHelperVideo()">搜索</button>
      </div>
      <div id="ai-result-1" style="margin-top:12px"></div>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">${ICONS.target} 学习计划生成</div>
      <div class="flex gap-sm">
        <input class="form-control" id="ai-p" placeholder="输入你的目标，如 7天刷20道LeetCode" style="flex:1" onkeydown="if(event.key==='Enter') aiHelperPlan()">
        <button class="btn-primary" onclick="aiHelperPlan()">生成</button>
      </div>
      <div id="ai-result-2" style="margin-top:12px"></div>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">${ICONS.wallet} 消费建议</div>
      <button class="btn-secondary" onclick="financeAiAnalyze()" style="margin-top:8px">分析本月消费</button>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">${ICONS.sparkles} 单词辅助</div>
      <div class="flex gap-sm">
        <input class="form-control" id="ai-w" placeholder="输入单词" style="flex:1" onkeydown="if(event.key==='Enter') aiHelperWord()">
        <button class="btn-primary" onclick="aiHelperWord()">查询</button>
      </div>
      <div id="ai-result-3" style="margin-top:12px"></div>
    </div>
    ` : `
    <div class="card">
      <div class="empty-state">
        ${ICONS.sparkles}
        <h4>AI 未配置</h4>
        <p>请到「设置」中填写 API Key 和 Base URL</p>
        <button class="btn-primary" onclick="navigate('settings')" style="margin-top:12px">去配置</button>
      </div>
    </div>`}
    
    <div class="ink-divider"></div>
    <div class="card" style="font-size:12px;color:var(--ink-sub)">
      <div class="card-title" style="font-size:14px">AI 使用说明</div>
      <div style="line-height:1.8">
        · 所有 AI 生成的内容都会**先显示预览**，需要你确认后才会写入数据<br>
        · AI 不直接修改你的数据，仅提供建议和辅助<br>
        · 视频搜索当前接入B站、中国大学MOOC、慕课网，逐条验证链接可访问后才展示<br>
        · 单词辅助会返回词根词缀、例句、同义近义词，帮助记忆
      </div>
    </div>
  `;
}

async function aiHelperVideo() {
  const kw = document.getElementById('ai-v').value.trim();
  if (!kw) return;
  const r = document.getElementById('ai-result-1');
  r.innerHTML = '<div class="loading">正在检索并验证真实视频</div>';
  try {
    const recs = await aiRecommendVideos(kw);
    const esc = s => String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    if (Array.isArray(recs) && recs.length) {
      r.innerHTML = `<div style="background:var(--bg-paper-light);border-radius:var(--radius-md);padding:4px 14px">
        ${recs.map(v => `
          <div style="padding:14px 0;border-bottom:1px dashed var(--border-paper-light)">
            <div style="font-weight:600;color:var(--ink-deep)">${esc(v.title)}</div>
            <div style="font-size:12px;color:var(--ink-sub);margin-top:6px;line-height:1.8">
              ${esc(v.teacher || '未提供老师/机构')} · ${esc(v.platform || '未提供平台')}<br>
              ${esc(v.reason || '暂无推荐理由')}
            </div>
            <div style="margin-top:8px;font-size:12px">
              <a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary-teal-deep);font-weight:600">打开已验证视频</a>
            </div>
          </div>`).join('')}
      </div>`;
    } else {
      r.innerHTML = '<div class="empty-state"><h4>暂未获得有效推荐</h4><p>请换个知识点或稍后重试</p></div>';
    }
  } catch (e) { r.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`; }
}

async function aiHelperPlan() {
  const g = document.getElementById('ai-p').value.trim();
  if (!g) return;
  const r = document.getElementById('ai-result-2');
  r.innerHTML = '<div class="loading">AI 生成中</div>';
  try {
    const plan = await aiMakePlan(g, 7);
    if (Array.isArray(plan)) {
      r.innerHTML = `<div style="background:rgba(139,105,20,0.05);border:1px solid var(--ochre);border-radius:var(--radius-md);padding:12px">
        ${plan.map(p => `<div style="padding:4px 0;font-size:13px">Day${p.day} · ${p.task} <span style="color:var(--ink-light);font-size:11px">${p.time||''}</span></div>`).join('')}
      </div>`;
    } else r.innerHTML = `<div style="padding:12px;background:var(--bg-paper-light);border-radius:var(--radius-md);font-size:13px">${String(plan)}</div>`;
  } catch (e) { r.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`; }
}

async function aiHelperWord() {
  const w = document.getElementById('ai-w').value.trim();
  if (!w) return;
  const r = document.getElementById('ai-result-3');
  r.innerHTML = '<div class="loading">AI 查询中</div>';
  try {
    const txt = await aiWordHelp(w);
    r.innerHTML = `<div style="padding:12px;background:var(--bg-paper-light);border-radius:var(--radius-md);font-size:13px;line-height:1.8">${txt.replace(/\n/g,'<br>')}</div>`;
  } catch (e) { r.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${e.message}</p></div>`; }
}

// ---------- 页面渲染：设置 ----------
// ---------- 常用链接（老师要求模块） ----------
function linkEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderLinks() {
  const page = document.querySelector('.page');
  const links = Array.isArray(DB.links) ? DB.links : [];
  page.innerHTML = `
    <div class="gradient-decor"><h2>常用链接</h2><p>把常用网站收在一起，登录同一账号，电脑和手机都能打开</p></div>

    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">添加链接</div>
      <div class="form-group">
        <label>名称</label>
        <input class="form-control" id="link-title" placeholder="例如：学校教务系统">
      </div>
      <div class="form-group">
        <label>网址</label>
        <input class="form-control" id="link-url" placeholder="https://example.com">
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <input class="form-control" id="link-note" placeholder="用途说明">
      </div>
      <button class="btn-primary" onclick="addLink()">${ICONS.plus} 添加</button>
    </div>

    <div class="card">
      <div class="card-title">已收藏 ${links.length} 个</div>
      ${links.length ? links.map((l, i) => `
        <div class="flex gap-sm" style="align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
          <div style="min-width:0">
            <div style="font-size:14px;color:var(--ink-strong)">${linkEscape(l.title)}</div>
            <div style="font-size:11px;color:var(--ink-sub);word-break:break-all">${linkEscape(l.note || l.url)}</div>
          </div>
          <div class="flex gap-sm" style="flex-shrink:0">
            <a class="btn-secondary" href="${linkEscape(l.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center">打开</a>
            <button class="btn-danger" onclick="deleteLink(${i})">${ICONS.trash}</button>
          </div>
        </div>`).join('') : `<div style="padding:12px 0;font-size:13px;color:var(--ink-sub)">还没有收藏链接，先在上面添加一个。</div>`}
    </div>`;
}

function addLink() {
  const title = (document.getElementById('link-title').value || '').trim();
  let url = (document.getElementById('link-url').value || '').trim();
  const note = (document.getElementById('link-note').value || '').trim();

  if (!title) { toast('请填写名称'); return; }
  if (!url) { toast('请填写网址'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch (e) { toast('网址格式不正确'); return; }

  DB.links = Array.isArray(DB.links) ? DB.links : [];
  DB.links.push({ id: uid(), title, url, note });
  saveDB();
  renderLinks();
  toast('已添加', 'success');
}

function deleteLink(index) {
  const link = (DB.links || [])[index];
  if (!link) return;
  modal(`确定删除「${linkEscape(link.title)}」？`, [
    { txt: '取消', cls: 'btn-secondary', act: 'close' },
    { txt: '删除', cls: 'btn-danger', act: 'del', onClick: () => {
      DB.links.splice(index, 1);
      saveDB();
      renderLinks();
      toast('已删除', 'success');
    }}
  ]);
}

function renderSettings() {
  const page = document.querySelector('.page');
  const d = new Date(DB.createdAt);
  page.innerHTML = `
    <div class="gradient-decor"><h2>设置与数据</h2><p>工作台版本 v1.0 · 创建于 ${d.toLocaleDateString('zh-CN')}</p></div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">AI 配置</div>
      <div style="font-size:12px;color:var(--ink-sub);margin-bottom:12px">AI 由服务器统一代理调用智谱 GLM，密钥只保存在服务器环境变量中，网页源码和浏览器里都不会出现密钥。</div>
      <div class="form-group">
        <label>模型名称</label>
        <input class="form-control" id="ai-model" value="${DB.settings.aiModel || 'glm-4-flash'}" placeholder="glm-4-flash">
      </div>
      <button class="btn-primary" onclick="saveAISettings()">保存模型设置</button>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">功能开关</div>
      <div class="flex gap-sm" style="align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border-paper-light)">
        <span>新闻热点</span>
        <label class="toggle-switch">
          <input type="checkbox" ${DB.settings.newsEnabled?'checked':''} onchange="DB.settings.newsEnabled=this.checked;saveDB();toast('已保存','success')">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="flex gap-sm" style="align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border-paper-light)">
        <span>每日新背单词数</span>
        <input type="number" class="form-control" style="width:80px" value="${DB.settings.dailyNewWords}" onchange="DB.settings.dailyNewWords=parseInt(this.value)||20;saveDB()">
      </div>
      <div class="flex gap-sm" style="align-items:center;justify-content:space-between;padding:8px 0">
        <span>月度预算（元）</span>
        <input type="number" class="form-control" style="width:100px" value="${DB.settings.monthlyBudget}" onchange="DB.settings.monthlyBudget=parseFloat(this.value)||0;saveDB()">
      </div>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-title">数据管理</div>
      <div class="flex gap-sm" style="flex-wrap:wrap">
        <button class="btn-secondary" onclick="exportData()">${ICONS.download} 导出全部数据（JSON）</button>
        <button class="btn-secondary" onclick="importDataUI()">${ICONS.upload} 从 JSON 文件导入</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
        <button class="btn-danger" onclick="resetAllUI()">${ICONS.trash} 清空所有数据</button>
      </div>
      <div style="font-size:12px;color:var(--ink-sub);margin-top:12px">
        数据保存在服务器数据库，登录同一个账号即可在电脑和手机上看到同一份数据；断网时会先存在本机，联网后自动重试。
      </div>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md);cursor:pointer" onclick="showHelpTab()">
      <div class="card-title">${ICONS.help} 使用说明（点击展开）</div>
      <div id="helpTab" style="display:none;font-size:13px;line-height:2;color:var(--ink-main)"></div>
    </div>
    
    <div class="card" style="margin-bottom:var(--space-md);cursor:pointer" onclick="showChangelogTab()">
      <div class="card-title">${ICONS.refresh} 更新日志（点击展开）</div>
      <div id="changelogTab" style="display:none;font-size:13px;line-height:1.8;color:var(--ink-main)"></div>
    </div>
  `;
  
  // 注入 toggle 样式
  if (!document.getElementById('toggle-style')) {
    const s = document.createElement('style');
    s.id = 'toggle-style';
    s.textContent = `.toggle-switch{position:relative;display:inline-block;width:44px;height:24px}.toggle-switch input{opacity:0;width:0;height:0}.toggle-slider{position:absolute;cursor:pointer;inset:0;background:var(--border-paper);border-radius:24px;transition:0.2s}.toggle-slider::before{content:'';position:absolute;height:18px;width:18px;left:3px;top:3px;background:white;border-radius:50%;transition:0.2s}.toggle-switch input:checked + .toggle-slider{background:var(--primary-teal)}.toggle-switch input:checked + .toggle-slider::before{transform:translateX(20px)}`;
    document.head.appendChild(s);
  }
}

function showHelpTab() {
  const t = document.getElementById('helpTab');
  t.style.display = t.style.display === 'none' ? 'block' : 'none';
  t.innerHTML = `
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">工作台是什么？</b><br>
      这是一个专为你（地信大三学生、考研备考者）打造的个人学习工作台，纯静态网页，电脑和手机打开同一个网址，自动适配。
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">包含哪些模块？</b><br>
      ① 今日总览：聚合所有模块的紧急事项<br>
      ② 考研单词本：每天自动安排复习+新词，SM-2间隔重复算法<br>
      ③ 代码练习 / 课程作业 / 学习计划：统一任务管理<br>
      ④ 学习视频库：收藏视频+AI推荐<br>
      ⑤ 记账：收支记录+分类统计+预算<br>
      ⑥ 新闻热点：RSS源聚合（联网刷新，可开关）<br>
      ⑦ 收集箱：临时内容暂存+AI建议去向<br>
      ⑧ 全局搜索：跨所有模块搜索<br>
      ⑨ AI帮手：视频推荐/计划生成/消费建议/单词辅助<br>
      ⑩ 设置与数据：AI配置/功能开关/数据管理
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">AI 怎么用？</b><br>
      已预置智谱 GLM（glm-4-flash），打开「AI 帮手」即可使用：知识点视频推荐、学习计划生成、消费建议、单词辅助。也可以到设置里换成自己的 API Key。所有 AI 生成的内容都会先显示预览，需要你确认后才写入数据。Key 只保存在本机浏览器。
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">账号系统？</b><br>
      第一版没有账号系统，数据只保存在当前浏览器 LocalStorage。跨设备/浏览器使用需要手动导出 JSON，再在另一台设备导入。没有云同步功能。
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">数据保存 / 备份 / 恢复？</b><br>
      · 数据自动保存到浏览器 LocalStorage（无刷新丢失问题，除非你手动清理浏览器缓存）<br>
      · 「设置 → 数据管理 → 导出全部数据」可以把所有数据下载为 JSON 文件（备份用）<br>
      · 「设置 → 数据管理 → 从 JSON 文件导入」可以恢复数据（会覆盖当前数据，慎用）<br>
      · 「设置 → 数据管理 → 清空所有数据」会删除全部数据并恢复到初始示例数据，需要二次确认
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">同步 / 迁移 / 多设备？</b><br>
      第一版不支持自动同步。同一台电脑/手机的同一个浏览器打开同一个网址就是同一个数据。不同设备/不同浏览器之间需要手动导出/导入。
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">服务器 / 数据库 / API？</b><br>
      · 没有后端服务器，是纯静态网页<br>
      · 没有数据库，数据全部在浏览器 LocalStorage<br>
      · 唯一的外部调用：AI 大模型 API（你自己配）、新闻 RSS 源（RSSHub，公开免费，偶尔不稳定）
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">费用？</b><br>
      · 工作台本身：完全免费，零费用<br>
      · AI 功能：使用你自己的 API Key，费用由你使用的大模型服务商决定（豆包等有免费额度）<br>
      · 新闻热点：使用公开免费的 RSSHub 服务
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">部署 / 运行方式？</b><br>
      · 本地运行：双击 index.html 或用 VS Code Live Server<br>
      · 局域网访问：Python 的 python -m http.server 8000，电脑访问 localhost:8000，手机访问电脑局域网IP:8000（同WiFi）<br>
      · 公网部署：推 GitHub → Vercel 一键部署（免费），会生成 HTTPS 地址
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">做不到的 / 未启用的？</b><br>
      · 没有账号系统和云同步<br>
      · 新闻热点不能实时爬取全网，依赖 RSSHub，偶尔会不稳定<br>
      · AI 视频推荐的链接可能过期，需要你自己点进去验证<br>
      · 单词本没有语音朗读功能（静态站点无法调用TTS）<br>
      · 纯前端无法处理大文件，收集箱只适合文字/小链接
    </div>
    <div style="padding:8px 0">
      <b style="color:var(--ink-deep)">帮助按钮（圆圈问号）？</b><br>
      每个模块页面顶部都有一个圆圈问号图标：电脑端鼠标悬浮显示说明；手机端点击显示说明。说明内容包括：这个功能做什么、怎么操作、完成后会发生什么。
    </div>
  `;
}

function showChangelogTab() {
  const t = document.getElementById('changelogTab');
  t.style.display = t.style.display === 'none' ? 'block' : 'none';
  t.innerHTML = `
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v2.0 · 2026-11-20 · 升级为 ASP.NET 账号版</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：后端改为 ASP.NET Core（C#）+ SQLite 数据库；新增注册、登录、退出；数据按账号保存在服务器，电脑和手机登录同一账号看到同一份数据；新增“常用链接”模块；保存后显示“已保存到云端”时间；断网时先存本机并提示，联网后自动重试；两台设备同时修改时提示选择保留哪一份，不静默覆盖。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站<br><b>数据变化</b>：旧版浏览器数据不自动迁移，新账号从默认课程表开始<br><b>需要操作</b>：注册并登录<br><b>回退方式</b>：旧版文件仍保留在 workbench 目录，可随时运行旧版</div>
    </div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：真实搜索由仅B站扩展为B站、中国大学MOOC、慕课网；不同平台交错展示，每条结果均验证课程或视频页面可访问，确认添加后保留真实直链。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：学习视频库、AI 帮手视频搜索<br><b>需要操作</b>：刷新页面后重新搜索</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.21 · 2026-11-19 · 视频改为真实搜索与链接验证</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：视频推荐不再由大模型编造，改为检索B站真实结果，并逐条请求视频页面验证；确认添加后可直接打开真实视频；清理早期虚构示例。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：学习视频库、AI 帮手视频搜索<br><b>需要操作</b>：刷新页面后重新搜索并确认添加</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.20 · 2026-11-19 · 视频链接改为可核验的平台搜索</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：AI 推荐不再保存或打开可能编造的视频地址，改为跳转到对应国内平台的搜索结果；手动填写链接的视频仍可直接打开。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：学习视频库、AI 视频推荐<br><b>需要操作</b>：刷新页面；未核验的视频按钮显示“平台搜索”</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.19 · 2026-11-19 · AI 视频仅推荐国内平台</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：视频推荐限定 B站、中国大学MOOC、学堂在线等国内学习平台；增加境外平台结果过滤；不确定的链接留空，避免编造。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：AI 帮手 → 知识点视频推荐<br><b>需要操作</b>：刷新页面后重新搜索</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.18 · 2026-11-19 · 修复新闻热点加载</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：原 RSSHub 源超时且返回格式不兼容，改为通过本地服务器获取百度实时热点；显示热度并提供具体错误信息。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：新闻热点<br><b>需要操作</b>：刷新页面；需通过 server.py 打开工作台</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.17 · 2026-11-19 · 补全全局搜索范围</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：支持搜索课程表、具体课程、笔记和各模块入口；点击作业、代码、计划等结果会进入对应页面。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全局搜索<br><b>需要操作</b>：刷新页面后重新搜索</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.16 · 2026-11-19 · 修复 AI 视频推荐显示</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：推荐结果改为正常卡片；兼容 JSON 代码块和说明文字；空字段显示中文提示；无链接时不再展示原始数据。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：AI 帮手 → 知识点视频推荐<br><b>需要操作</b>：刷新页面后重新搜索</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.15 · 2026-11-19 · 调整报告截止日期</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：网络地理信息系统实验期末报告截止日期改为 2026-12-09。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：课程与作业、今日任务、搜索<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.14 · 2026-11-19 · 更新两项作业</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：将原 GIS 空间分析作业第3章替换为“网络地理信息系统实验期末报告”，将遥感图像解译报告替换为“概率论作业”；同步更新标签，保留截止日期、优先级和状态。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：课程与作业、今日任务、全局搜索<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.13 · 2026-11-19 · 修正 CAD 节次</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：周一 AutoCAD 地理制图实验由 6-9 节改为 6-8 节。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：本周课程表、今日课程、手机课表<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.12 · 2026-11-19 · 逐节重排课表</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：周一地理大数据分析与应用 1-3 节、AutoCAD 实验 6-9 节；周二环境学概论 1-3 节、GIS应用开发实验 4-5 节；周三网络地理信息系统实验 3-5 节；周四 GIS空间分析 4-5 节、GIS应用开发 8-9 节。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：本周课程表、今日课程、手机课表<br><b>需要操作</b>：刷新页面即可，旧课表会自动替换</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.11 · 2026-11-19 · 课程表与作息修正</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：校区统一为啬园校区；课程卡只显示课程名和教室；删除周三 GIS应用开发；遥感云计算技术改为周三 8-9 节；同一节次的实验课并排显示避免重合；按截图更新全部节次时间。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：本周课程表、今日课程、手机课表<br><b>需要操作</b>：刷新页面即可，旧课表会自动替换</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.10 · 2026-11-19 · 古风竹子背景</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：使用你提供的竹子水彩图作为全站背景，加米白蒙版保证文字清晰；顶部题头保留简洁标题，不再叠加其他植物装饰。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站背景与题头<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.9 · 2026-11-19 · 淡绿植物水彩主题</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：按最新参考图整体换为米白/淡绿植物风；标题改为简洁宋体大标题配右侧植物；卡片改为白底细绿边；图标去掉卡通脸，统一为细线图标；按钮与导航选中态改为灰绿。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站配色、题头、卡片、图标、按钮<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.8 · 2026-11-19 · 卡通题头</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：页面顶部山水横幅改为奶油黄天空、粗描边太阳/云朵/卡通小山，标题改深色，和整体卡通风格统一。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：所有页面顶部题头<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.7 · 2026-11-19 · 淡奶黄背景</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：页面、卡片、侧栏、顶栏和手机底栏改为参考图的淡奶黄/奶油白配色；侧栏选中项改为淡黄色高亮；保留彩色卡通图标。
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站背景与导航配色<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.6 · 2026-11-19 · 蜡笔小新风格图标</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 全站图标换成彩色卡通风：粗黑描边、圆脸大眼、明亮色块<br>
        · 修复部分卡片图标被撑大到整卡的问题，统一限制导航、标题、按钮和空状态图标尺寸
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站图标与卡片标题<br><b>需要操作</b>：刷新页面即可</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.5 · 2026-11-18 · 古风单线图标</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 全站图标换成古风单线纹样：竹简、亭台、卷轴、宫灯、铜钱、榜文、铜镜、莲花、玉璧等，统一 1.5 线宽圆头<br>
        · 今日=日历卷、单词=竹简、课程=亭台、计划=卷轴、视频=宫灯、记账=铜钱、新闻=榜文、收集=木匣、搜索=铜镜、AI=莲花、设置=玉璧
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站图标<br><b>需要操作</b>：无需操作</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.4 · 2026-11-18 · 水彩青绿山水视觉</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 按水彩参考图重做全站：翡翠绿与湖蓝主色、云雾底、金箔点缀<br>
        · 题头改为水彩山水横幅（远山／云带／飞鸟／小舟／金点）<br>
        · 侧边栏改为深青绿，选中态用金箔色<br>
        · 卡片改为白色大圆角 + 淡青阴影，按钮加入青绿渐变
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站视觉<br><b>需要操作</b>：无需操作</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.3 · 2026-11-18 · 更名与清透山水改造</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 工作台更名为「潘琰工作台」<br>
        · 全站字体统一为宋体<br>
        · 按参考图重做视觉：浅奶油纸底、淡青绿远山、留白加大、细线边、浅色侧边栏、小舟红点缀<br>
        · 题头改为大面积留白 + 淡山 + 红色小舟
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站视觉与品牌名<br><b>需要操作</b>：无需操作</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.2 · 2026-11-18 · 青绿山水视觉 + AI 接通</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 全站改为青绿山水风格：黛青墨色导航、宣纸底纹、远山剪影层、山水题头、朱砂细节点缀<br>
        · 接入智谱 GLM 大模型（glm-4-flash），AI 帮手 / 视频推荐 / 计划生成 / 消费建议 / 单词辅助 可直接使用<br>
        · 课表配色同步换成青绿山水色系
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：全站视觉、AI 帮手、设置<br><b>需要操作</b>：无需操作；如想换自己的 Key，可在「设置 → AI 配置」覆盖</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.1 · 2026-11-18 · 加入真实课程表</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 录入 2026-2027 学年第 1 学期真实课表（12 个课段，含嘉园校区教室；已按反馈删除「形势与政策」与周六晚间的 GIS空间分析，去掉课程名前的「调」字，并补充周五 6-7 节 GIS空间分析实验）<br>
        · 「课程与作业」页新增周课表：电脑端为周视图网格，手机端按天显示列表<br>
        · 「今日」页的今日课程改为只显示当天课程，带节次与时间<br>
        · 已自动迁移旧版示例课程数据
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：今日、课程与作业<br><b>需要操作</b>：无需操作，自动迁移</div>
    </div>
    <div style="padding:10px 0;border-bottom:1px dashed var(--border-paper-light)">
      <div style="font-weight:600;color:var(--ink-deep)">v1.0 · 2026-11-18 · 初始版本</div>
      <div style="margin-top:6px;color:var(--ink-main);line-height:1.9">
        <b>更新内容</b>：<br>
        · 完成所有核心模块：今日总览、考研单词本（含SM-2间隔重复）、代码练习、课程与作业、学习计划（含AI生成）、学习视频库（含AI推荐）、记账（含预算/分类统计/消费建议）、新闻热点（RSSHub源）、收集箱（含AI建议去向）、全局搜索、AI帮手、设置与数据<br>
        · 古风主题视觉：宣纸米黄背景、深墨绿侧边栏、青绿主色、印章图标、水墨渐变<br>
        · 响应式适配：电脑端侧边栏+手机端底部导航，360×800/375×812/390×844 三个尺寸验证<br>
        · 内置示例数据，首次打开有示例可看
      </div>
      <div style="margin-top:6px;color:var(--ink-sub)"><b>影响范围</b>：首次安装，全部模块<br><b>需要操作</b>：无需操作，开箱即用</div>
    </div>
  `;
}

function saveAISettings() {
  const model = document.getElementById('ai-model');
  if (model) DB.settings.aiModel = model.value.trim() || 'glm-4-flash';
  saveDB(); toast('AI 配置已保存', 'success');
}

function importDataUI() {
  const input = document.getElementById('importFile');
  input.click();
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    const txt = await f.text();
    const ok = importData(txt);
    if (ok) { toast('导入成功', 'success'); renderCurrent(); }
    else { toast('导入失败，文件格式不正确', 'error'); }
  };
}

function resetAllUI() {
  modal('确认清空所有数据？此操作不可恢复！', [
    { txt:'取消', cls:'btn-secondary', act:'close' },
    { txt:'确认清空', cls:'btn-danger', act:'del', onClick: () => { if (resetAll()) { toast('已重置', 'success'); renderCurrent(); } }}
  ]);
}

// ---------- 主入口：路由+渲染 ----------
const RENDERERS = {
  today: renderToday,
  words: renderWords,
  code: renderCode,
  homework: renderHomework,
  plan: renderPlan,
  videos: renderVideos,
  links: renderLinks,
  finance: renderFinance,
  news: renderNews,
  inbox: renderInbox,
  search: renderSearch,
  ai: renderAI,
  settings: renderSettings
};

function renderCurrent() {
  const r = currentRoute();
  updateTitle(r);
  renderSidebar();
  renderBottomNav();
  const fn = RENDERERS[r];
  if (fn) fn();
  else renderToday();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderCurrent);

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', async () => {
  // 从服务器读取当前账号的数据；断网时自动退回本机缓存
  await initDB();
  renderCurrent();
  if (typeof injectAccountCard === 'function') injectAccountCard();
});
