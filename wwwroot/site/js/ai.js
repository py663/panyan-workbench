/* ============ AI 辅助模块（兼容 Pages 静态版） ============
   用户自带 API Key，支持兼容 OpenAPI 格式的所有大模型服务
   所有 AI 修改先返回预览 + 变化说明，由用户确认后才落库
   静态版没有服务端代理，会尝试直连模型服务（是否允许跨域取决于服务商）
*/

function isStaticPages() {
  return location.hostname.endsWith('.github.io');
}

async function aiAvailable() {
  return !!(DB.settings.aiApiKey && DB.settings.aiBaseUrl);
}

async function callAI(prompt, system = "你是一个大学生学习助手，回答简洁有条理，中文回复。") {
  if (!(await aiAvailable())) {
    throw new Error('AI 未配置，请在设置中填写 API Key 和 Base URL');
  }
  // 本地/自建服务端走同源代理；GitHub Pages 静态版只能直连模型服务
  const viaProxy = !isStaticPages() && location.protocol !== 'file:';
  const url = viaProxy
    ? '/api/ai'
    : DB.settings.aiBaseUrl.replace(/\/$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json' };
  if (viaProxy) headers['X-AI-Key'] = DB.settings.aiApiKey;
  else headers['Authorization'] = `Bearer ${DB.settings.aiApiKey}`;

  const body = {
    model: DB.settings.aiModel || 'glm-4-flash',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1500
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API 错误 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    if (isStaticPages()) {
      throw new Error('静态版 AI 直连失败（通常是服务商不允许跨域）。如需 AI 功能，请改用带服务端的部署方式。' + e.message);
    }
    throw e;
  }
}

/* 获取联网搜索代理地址（腾讯云函数，用户可在配置里填） */
function getProxyBase() {
  var cfg = window.DEFAULT_PROXY_CONFIG;
  return (cfg && cfg.proxyUrl ? String(cfg.proxyUrl) : '').replace(/\/+$/, '');
}

/* AI 功能：学习视频推荐（走腾讯云函数代理，或本地服务端） */
async function aiRecommendVideos(keyword) {
  var proxy = getProxyBase();
  var url;
  if (proxy) {
    url = proxy + '/api/video-search?q=' + encodeURIComponent(keyword);
  } else if (!isStaticPages() && location.protocol !== 'file:') {
    url = '/api/video-search?q=' + encodeURIComponent(keyword);
  } else {
    throw new Error('视频搜索未配置：请先在 config.js 填入云函数地址（proxyUrl），再在视频库搜索');
  }
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const data = await resp.json().catch(() => ({}));
  if (data.error) throw new Error(data.error);
  if (!resp.ok) throw new Error('真实视频搜索失败 ' + resp.status + '，请稍后重试');
  return (data.items || []).map(v => ({
    title: String(v.title || '').trim(),
    teacher: String(v.teacher || '').trim(),
    platform: String(v.platform || 'B站').trim(),
    url: String(v.url || '').trim(),
    reason: String(v.reason || '真实搜索结果').trim(),
    source: 'real',
    verified: v.verified === true
  })).filter(v => v.title && v.url && v.verified);
}

/* AI 功能：单词辅助（词根词缀、例句） */
async function aiWordHelp(word) {
  const prompt = `请为考研单词「${word}」补充：1. 词根词缀记忆法 2. 一个考研真题风格的例句 3. 2-3 个同义近义词。简洁中文回复。`;
  return await callAI(prompt, "你是考研英语辅导老师，擅长词根词缀和真题例句。");
}

/* AI 功能：学习计划生成 */
async function aiMakePlan(goal, duration = 7) {
  const prompt = `请帮我制定一个 ${duration} 天的学习计划，目标是：「${goal}」。
严格按JSON数组格式返回，不要输出其他内容：
[
  {"day":1,"task":"今天的具体任务","time":"建议时长(如2小时)","priority":"high/medium/low"}
]`;
  const raw = await callAI(prompt, "你是学习规划师，擅长把大目标拆解为每天可执行的小任务。只输出JSON。");
  try {
    let text = raw.trim();
    if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
    return JSON.parse(text);
  } catch (e) {
    return raw;
  }
}

/* AI 功能：收集箱去向建议 */
async function aiSuggestInbox(inboxContent) {
  const prompt = `我在收集箱里有一条内容：「${inboxContent}」。请建议应该放到哪个模块：
1. 考研单词本（如果是单词相关）
2. 代码练习（如果是编程任务）
3. 学习计划（如果是长期任务）
4. 视频库（如果是视频推荐）
5. 笔记（如果是资料/链接）
6. 记账（如果是消费相关）
7. 新闻（如果是新闻/热点）
只输出模块编号和一句理由，格式如："2 | 这是编程练习任务"`;
  return await callAI(prompt, "你是学习工作台助手，帮助用户把内容分类到正确的模块。");
}

/* AI 功能：消费分析 */
async function aiAnalyzeFinance(summary) {
  const prompt = `我的本月消费情况：收入${summary.income}元，总支出${summary.expense}元，预算${summary.budget}元。
按类别支出：${JSON.stringify(summary.catExpense)}。
请给我3条具体的消费建议（中文，每条一句话）。`;
  return await callAI(prompt, "你是大学生理财顾问，建议具体务实。");
}
