/* ============ 数据存储层 LocalStorage ============ */
const LS_KEY = 'qingyu_workbench_v1';

const defaultData = () => ({
  words: [],           // 考研单词本
  tasks: [],           // 代码练习 / 作业 / 学习计划 统一任务
  courses: [],         // 课程
  videos: [],          // 视频库
  inbox: [],           // 收集箱
  notes: [],           // 笔记
  finance: [],         // 记账
  settings: {
    dailyNewWords: 20,
    aiApiKey: (window.DEFAULT_AI_CONFIG || {}).apiKey || '',
    aiBaseUrl: (window.DEFAULT_AI_CONFIG || {}).baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
    aiModel: (window.DEFAULT_AI_CONFIG || {}).model || 'glm-4-flash',
    monthlyBudget: 1500,
    newsEnabled: true,
    newsSources: ['https://rsshub.app/36kr/newsflashes','https://rsshub.app/thepaper/featured'],
  },
  stats: {
    wordsLearnedToday: 0,
    wordsReviewedToday: 0,
    wordsHistory: [],  // [{date: '2026-11-18', new: 20, review: 35}]
    financeMonthly: {}, // { '2026-11': {income: x, expense: x} }
  },
  createdAt: Date.now(),
  schemaVersion: 8
});

let DB = null;

function loadDB() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      DB = JSON.parse(raw);
      // 补全新增字段
      const def = defaultData();
      for (const k in def) if (!(k in DB)) DB[k] = def[k];
      for (const k in def.settings) if (!(k in DB.settings)) DB.settings[k] = def.settings[k];
      for (const k in def.stats) if (!(k in DB.stats)) DB.stats[k] = def.stats[k];
      // 迁移：v8 修正周一 AutoCAD 为 6-8 节
      if (!DB.schemaVersion || DB.schemaVersion < 8) {
        DB.courses = DEFAULT_COURSES.map(c => ({ ...c, id: uid() }));
        DB.schemaVersion = 8;
        saveDB();
      }
      // 强制校验：即使浏览器此前已写入 v8，也必须把 CAD 修正为 6-8 节
      const cadCourse = DB.courses.find(c => c.day === 1 && /AutoCAD/i.test(c.name || ''));
      if (cadCourse && (cadCourse.periods[0] !== 6 || cadCourse.periods[1] !== 8)) {
        cadCourse.periods = [6, 8];
        saveDB();
      }
      // 清理早期 AI 编造或未核验的示例视频，只保留用户手动添加和真实搜索验证的记录
      const removedVideoTitles = new Set([
        '英语六级听力技巧解析',
        '陈越姥姥-数据结构-二叉树前序遍历',
        '田静-考研英语长难句分析',
        'GIS空间分析-ESRI官方教程'
      ]);
      DB.videos = (DB.videos || []).filter(v => (v.source === 'manual' || v.source === 'real') && !removedVideoTitles.has(v.title));
      saveDB();
      // 替换两项旧示例作业，保留原截止日期、优先级和完成状态
      const taskUpdates = {
        'GIS 空间分析作业第3章': { title: '网络地理信息系统实验期末报告', tags: ['网络地理', '报告'] },
        'GIS空间分析作业第3章': { title: '网络地理信息系统实验期末报告', tags: ['网络地理', '报告'] },
        '遥感图像解译报告': { title: '概率论作业', tags: ['概率论', '作业'] }
      };
      let taskChanged = false;
      DB.tasks.forEach(t => {
        const update = taskUpdates[t.title];
        if (update) {
          t.title = update.title;
          t.tags = update.tags;
          taskChanged = true;
        }
      });
      if (taskChanged) saveDB();
      const reportTask = DB.tasks.find(t => t.title === '网络地理信息系统实验期末报告');
      if (reportTask && reportTask.deadline === '2026-11-21') {
        reportTask.deadline = '2026-12-09';
        saveDB();
      }
      // 若本地未配置或仍为旧默认，则套用 config.js 里的 AI 配置
      const cfg = window.DEFAULT_AI_CONFIG;
      if (cfg && cfg.apiKey && (!DB.settings.aiApiKey || /volces/.test(DB.settings.aiBaseUrl || ''))) {
        DB.settings.aiApiKey = cfg.apiKey;
        DB.settings.aiBaseUrl = cfg.baseUrl;
        DB.settings.aiModel = cfg.model;
        saveDB();
      }
    } else {
      DB = defaultData();
      seedDemoData();
      saveDB();
    }
  } catch (e) {
    console.error('loadDB error', e);
    DB = defaultData();
    seedDemoData();
    saveDB();
  }
}

function saveDB() {
  localStorage.setItem(LS_KEY, JSON.stringify(DB));
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function today() { return new Date().toISOString().slice(0, 10); }
function todayTs() { return new Date(new Date().toDateString()).getTime(); }

/* ============ SM-2 间隔重复算法 ============
   基于 SuperMemo SM-2 简化版
   参数: ease(默认2.5), interval(天数), reps(次数)
   质量评分: 0-5, 5=非常熟, 4=熟, 3=模糊, 2=不熟, 1=忘记, 0=彻底忘记
*/
function sm2(prev, quality) {
  let { ease = 2.5, interval = 0, reps = 0, nextReview = 0 } = prev;
  if (quality < 3) {
    reps = 0;
    interval = 0;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = Math.round(interval * ease);
    reps++;
  }
  ease = Math.max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  nextReview = todayTs() + interval * 86400000;
  return { ease, interval, reps, nextReview };
}

/* ============ 课程表数据（2026-2027 第1学期） ============ */
// day: 1=周一 ... 7=周日；periods: [起始节, 结束节]
const PERIOD_TIMES = {
  1: '07:50-08:30', 2: '08:40-09:20',
  3: '09:35-10:15', 4: '10:30-11:10', 5: '11:20-12:00',
  6: '13:30-14:10', 7: '14:20-15:00', 8: '15:20-16:00', 9: '16:10-16:50',
  10: '18:30-19:10', 11: '19:20-20:00', 12: '20:10-20:50'
};

const DEFAULT_COURSES = [
  { name: '地理大数据分析与应用', day: 1, periods: [1, 3], location: '38-401', kind: 'theory' },
  { name: 'AutoCAD 地理制图实验', day: 1, periods: [6, 8], location: 'JX09-201', kind: 'lab' },
  { name: '环境学概论', day: 2, periods: [1, 3], location: '38-409', kind: 'theory' },
  { name: 'GIS应用开发实验', day: 2, periods: [4, 5], location: 'JX09-303', kind: 'lab' },
  { name: '概率论与数理统计', day: 2, periods: [6, 8], location: 'JX02-404', kind: 'theory' },
  { name: '网络地理信息系统实验', day: 3, periods: [3, 5], location: 'JX04-107', kind: 'lab' },
  { name: '遥感云计算技术', day: 3, periods: [8, 9], location: '39-A101', kind: 'theory' },
  { name: 'GIS空间分析', day: 4, periods: [4, 5], location: 'JX09-201', kind: 'theory' },
  { name: 'GIS应用开发', day: 4, periods: [8, 9], location: 'JX09-303', kind: 'theory' },
  { name: 'GIS空间分析实验', day: 5, periods: [6, 7], location: '38-409', kind: 'lab' }
];

function todayCourses() {
  const idx = (new Date().getDay() + 6) % 7 + 1; // 1=周一 ... 7=周日
  return DB.courses.filter(c => c.day === idx).sort((a, b) => a.periods[0] - b.periods[0]);
}

/* ============ 示例数据 ============ */
function seedDemoData() {
  // 考研单词 30 个示例
  const demoWords = [
    { w: "abandon", p: "/əˈbændən/", m: "v. 放弃；抛弃；遗弃", e: "He abandoned his studies to travel." },
    { w: "abundant", p: "/əˈbʌndənt/", m: "adj. 丰富的；充裕的", e: "The region has abundant natural resources." },
    { w: "abrupt", p: "/əˈbrʌpt/", m: "adj. 突然的；唐突的", e: "His abrupt departure surprised everyone." },
    { w: "absolute", p: "/ˈæbsəluːt/", m: "adj. 绝对的；完全的", e: "There is no absolute truth in science." },
    { w: "absorb", p: "/əbˈzɔːrb/", m: "v. 吸收；使专心", e: "Plants absorb water through their roots." },
    { w: "abstract", p: "/ˈæbstrækt/", m: "adj. 抽象的；n. 摘要", e: "The concept is too abstract for children." },
    { w: "accelerate", p: "/əkˈseləreɪt/", m: "v. 加速；促进", e: "Technology accelerates social change." },
    { w: "accessible", p: "/əkˈsesəbl/", m: "adj. 可接近的；可理解的", e: "Information should be accessible to all." },
    { w: "accomplish", p: "/əˈkɑːmplɪʃ/", m: "v. 完成；实现", e: "She accomplished her goal in two years." },
    { w: "accurate", p: "/ˈækjərət/", m: "adj. 准确的；精确的", e: "The report contains accurate statistics." },
    { w: "acquire", p: "/əˈkwaɪər/", m: "v. 获得；习得", e: "He acquired a taste for classical music." },
    { w: "adapt", p: "/əˈdæpt/", m: "v. 适应；改编", e: "Animals adapt to their environment." },
    { w: "adequate", p: "/ˈædɪkwət/", m: "adj. 足够的；适当的", e: "The salary is adequate for living costs." },
    { w: "adjacent", p: "/əˈdʒeɪsnt/", m: "adj. 邻近的；毗邻的", e: "The school is adjacent to the park." },
    { w: "administer", p: "/ədˈmɪnɪstər/", m: "v. 管理；执行", e: "The government administers public services." },
    { w: "advocate", p: "/ˈædvəkeɪt/", m: "v. 提倡；n. 拥护者", e: "She advocates for environmental protection." },
    { w: "aesthetic", p: "/esˈθetɪk/", m: "adj. 美学的；审美的", e: "The design has great aesthetic appeal." },
    { w: "affluent", p: "/ˈæfluənt/", m: "adj. 富裕的；丰富的", e: "He lives in an affluent neighborhood." },
    { w: "agenda", p: "/əˈdʒendə/", m: "n. 议程；日程", e: "Let's review today's agenda." },
    { w: "ambiguous", p: "/æmˈbɪɡjuəs/", m: "adj. 模糊的；歧义的", e: "The statement is deliberately ambiguous." },
    { w: "analyze", p: "/ˈænəlaɪz/", m: "v. 分析；解析", e: "Scientists analyze data carefully." },
    { w: "anticipate", p: "/ænˈtɪsɪpeɪt/", m: "v. 预期；预料", e: "We anticipate a long meeting." },
    { w: "apparent", p: "/əˈpærənt/", m: "adj. 明显的；表面上的", e: "The problem is apparent to everyone." },
    { w: "arbitrary", p: "/ˈɑːrbətreri/", m: "adj. 任意的；专断的", e: "The decision seemed arbitrary." },
    { w: "articulate", p: "/ɑːrˈtɪkjuleɪt/", m: "v. 表达；adj. 善于表达的", e: "She articulated her ideas clearly." },
    { w: "assume", p: "/əˈsuːm/", m: "v. 假定；承担", e: "Don't assume anything without evidence." },
    { w: "attain", p: "/əˈteɪn/", m: "v. 获得；达到", e: "He attained a high level of success." },
    { w: "authentic", p: "/ɔːˈθentɪk/", m: "adj. 真实的；正宗的", e: "The restaurant serves authentic Chinese food." },
    { w: "authorize", p: "/ˈɔːθəraɪz/", m: "v. 授权；批准", e: "Only managers can authorize expenses." },
    { w: "beneficial", p: "/ˌbenɪˈfɪʃl/", m: "adj. 有益的；有帮助的", e: "Exercise is beneficial for health." }
  ];

  // 构建单词条目，有的今天要复习，有的是新单词
  DB.words = demoWords.map((d, i) => {
    const ts = Date.now();
    if (i < 12) {
      // 已学过的，今天要复习
      const q = i < 6 ? 5 : 4; // 熟/很熟
      const r = sm2({ ease: 2.5, interval: i < 3 ? 14 : 7, reps: i < 3 ? 4 : 2, nextReview: 0 }, q);
      return {
        id: uid(), ...d,
        status: i < 3 ? 'mastered' : 'learning',
        ease: r.ease, interval: r.interval, reps: r.reps,
        nextReview: i < 12 ? todayTs() - 86400000 : r.nextReview, // 确保今天要复习
        addedAt: ts,
        reviewHistory: []
      };
    } else {
      // 今天的新单词
      return {
        id: uid(), ...d,
        status: 'new',
        ease: 2.5, interval: 0, reps: 0, nextReview: todayTs(),
        addedAt: ts, reviewHistory: []
      };
    }
  });

  // 示例任务
  DB.tasks = [
    { id: uid(), type: 'code', title: '二叉树前序遍历 Python 实现', status: 'todo', deadline: today(), priority: 'high', link: '代码练习', tags: ['数据结构','Python'] },
    { id: uid(), type: 'homework', title: '网络地理信息系统实验期末报告', status: 'in_progress', deadline: '2026-12-09', priority: 'high', tags: ['网络地理','报告'] },
    { id: uid(), type: 'plan', title: '本周复习英语长难句', status: 'todo', deadline: addDays(3), priority: 'medium', tags: ['考研英语'] },
    { id: uid(), type: 'code', title: 'LeetCode 每日一题', status: 'done', deadline: today(), priority: 'low', tags: ['算法'] },
    { id: uid(), type: 'homework', title: '概率论作业', status: 'todo', deadline: addDays(5), priority: 'medium', tags: ['概率论','作业'] }
  ];

  // 真实课程表（2026-2027 学年第 1 学期 · 啬园校区）
  DB.courses = DEFAULT_COURSES.map(c => ({ ...c, id: uid() }));

  // 视频由用户通过真实搜索添加，不预置无法核验的示例链接
  DB.videos = [];

  // 示例收集箱
  DB.inbox = [
    { id: uid(), type: 'text', content: '看到一个B站up讲遥感影像分类，记一下有空看', createdAt: Date.now() },
    { id: uid(), type: 'link', content: 'https://github.com', note: '找GDAL学习资料', createdAt: Date.now() - 3600000 },
    { id: uid(), type: 'task', content: '想练一下 PostGIS 空间查询', createdAt: Date.now() - 7200000 }
  ];

  // 示例记账
  DB.finance = [
    { id: uid(), type: 'expense', amount: 15, category: '餐饮', date: today(), note: '食堂午餐' },
    { id: uid(), type: 'expense', amount: 8, category: '交通', date: today(), note: '公交' },
    { id: uid(), type: 'expense', amount: 36, category: '学习', date: today(), note: '打印资料' },
    { id: uid(), type: 'income', amount: 500, category: '其他', date: addDays(-2), note: '兼职收入' },
    { id: uid(), type: 'expense', amount: 128, category: '娱乐', date: addDays(-3), note: '电影票' },
    { id: uid(), type: 'expense', amount: 56, category: '生活', date: addDays(-5), note: '生活用品' }
  ];
  DB.stats.financeMonthly = { [today().slice(0,7)]: { income: 500, expense: 247 } };

  // 学习历史
  DB.stats.wordsHistory = [
    { date: addDays(-6), new: 20, review: 30 },
    { date: addDays(-5), new: 20, review: 25 },
    { date: addDays(-4), new: 18, review: 32 },
    { date: addDays(-3), new: 20, review: 28 },
    { date: addDays(-2), new: 15, review: 35 },
    { date: addDays(-1), new: 20, review: 30 },
    { date: today(), new: 18, review: 12 }
  ];
}

function addDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ============ 单词相关 ============ */
function getTodayWords() {
  const n = DB.settings.dailyNewWords;
  const now = todayTs();
  // 复习：nextReview <= now，且不是从未学过的生词
  const review = DB.words.filter(w => w.nextReview <= now && w.status !== 'archived' && w.status !== 'new').sort((a,b) => a.nextReview - b.nextReview);
  // 新词：status=new 或从未背过的，取前n个
  let fresh = DB.words.filter(w => w.status === 'new').slice(0, n);
  // 如果新词不够n个，提示需要更多词库
  return { review, fresh };
}

function markWord(id, quality) {
  const w = DB.words.find(x => x.id === id);
  if (!w) return;
  const sm = sm2(w, quality);
  Object.assign(w, sm);
  if (quality >= 4) w.status = 'mastered';
  else if (quality >= 3) w.status = 'learning';
  w.reviewHistory = w.reviewHistory || [];
  w.reviewHistory.push({ date: today(), quality });
  saveDB();
  
  if (quality === 0 || quality === 1) DB.stats.wordsReviewedToday++;
  else if (quality >= 2) DB.stats.wordsReviewedToday++;
  saveTodayStats();
}

function saveTodayStats() {
  const d = today();
  const found = DB.stats.wordsHistory.find(h => h.date === d);
  if (!found) {
    DB.stats.wordsHistory.push({ date: d, new: DB.stats.wordsLearnedToday, review: DB.stats.wordsReviewedToday });
  } else {
    found.new = DB.stats.wordsLearnedToday;
    found.review = DB.stats.wordsReviewedToday;
  }
  saveDB();
}

/* ============ 任务相关 ============ */
function getTasks(filter = {}) {
  let arr = [...DB.tasks];
  if (filter.type) arr = arr.filter(t => t.type === filter.type);
  if (filter.status) arr = arr.filter(t => t.status === filter.status);
  if (filter.due) {
    arr = arr.filter(t => t.deadline && t.deadline <= filter.due && t.status !== 'done');
  }
  return arr;
}

function getTodayTasks() {
  const todayStr = today();
  const tomorrow = addDays(1);
  return DB.tasks.filter(t => 
    t.status !== 'done' && t.deadline && 
    (t.deadline === todayStr || (t.deadline >= todayStr && t.deadline <= tomorrow))
  );
}

/* ============ 记账相关 ============ */
function getFinanceByMonth(ym) {
  return DB.finance.filter(f => f.date.startsWith(ym));
}

function getFinanceSummary() {
  const ym = today().slice(0, 7);
  const items = getFinanceByMonth(ym);
  let income = 0, expense = 0;
  const catExpense = {};
  items.forEach(f => {
    if (f.type === 'income') income += f.amount;
    else { expense += f.amount; catExpense[f.category] = (catExpense[f.category] || 0) + f.amount; }
  });
  return { ym, income, expense, balance: income - expense, catExpense, budget: DB.settings.monthlyBudget };
}

/* ============ 导出/导入 ============ */
function exportData() {
  const data = JSON.stringify(DB, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `qingyu-workbench-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    DB = obj;
    saveDB();
    return true;
  } catch (e) {
    return false;
  }
}

function resetAll() {
  if (!confirm('确认清空所有数据？此操作不可恢复！')) return false;
  localStorage.removeItem(LS_KEY);
  loadDB();
  return true;
}
