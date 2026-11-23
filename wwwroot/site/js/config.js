/* AI 配置：密钥只在服务器端（环境变量 WORKBENCH_AI_KEY），前端不保存任何密钥 */
window.DEFAULT_AI_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  model: 'glm-4-flash',
  provider: '智谱 GLM'
};

/* ============ GitHub Pages 静态版 · GitHub 仓库同步配置 ============
   用你自己的 GitHub 仓库当云端数据库：整份数据存成一个 JSON 文件，
   通过 GitHub Contents API 读写。api.github.com 在国内可直连，
   全程免费、无需实名、不绑卡。

   重要：token 不写在这里！GitHub 会扫描公开仓库里的 token 并自动吊销。
   打开页面时会弹窗让你填一次 token，保存在这台设备的浏览器里，
   不会上传、不会进代码。每台新设备首次打开时填一次即可。

   下面只需确认仓库信息正确，一般不用改。
*/
window.DEFAULT_GITHUB_CONFIG = {
  enabled: true,
  owner: 'py663',
  repo: 'panyan-workbench',
  branch: 'main',
  path: 'workbench-data.json',
  accountName: '潘琰工作台'
};

/* ============ 云函数代理（腾讯云函数 · 一个函数干两件事）============
   函数 URL：https://1539620899-eak8s2wajf.ap-guangzhou.tencentscf.com
   注意：结尾不要带 /，不要带 /api/xxx 后缀，只填根地址。

   1) 联网搜索：/api/video-search、/api/news
   2) 数据中转：/api/data-get、/api/data-save
      GitHub 令牌只放在云函数环境变量 GITHUB_TOKEN 里，浏览器永远拿不到，
      所以打开页面不需要填 token。只要 proxyUrl 在这里，就自动走代理模式。

   syncKey：应用访问密码，防止函数 URL 被无关人员随意读写。
      需与云函数环境变量 SYNC_KEY 保持一致。它不是 GitHub 凭证，泄露也不影响仓库安全。
      想关掉校验就把云函数的 SYNC_KEY 留空（不推荐）。
*/
window.DEFAULT_PROXY_CONFIG = {
  proxyUrl: 'https://1539620899-eak8s2wajf.ap-guangzhou.tencentscf.com',
  syncKey: 'panyan-workbench-2026'
};
