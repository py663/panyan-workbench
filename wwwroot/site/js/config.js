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
