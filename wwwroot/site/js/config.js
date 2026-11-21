/* AI 配置：密钥只在服务器端（环境变量 WORKBENCH_AI_KEY），前端不保存任何密钥 */
window.DEFAULT_AI_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  model: 'glm-4-flash',
  provider: '智谱 GLM'
};

/* ============ GitHub Pages 静态版 · Supabase 配置 ============
   1. 在 Supabase 控制台 SQL Editor 执行仓库根目录的 supabase-pages-setup.sql
   2. Project Settings → API 复制 Project URL 和 anon public key
   3. 填到下面 url / anonKey，并把 enabled 改为 true
   4. 推送到 GitHub，等待 Actions 完成

   注意：anon public key 会随前端发布，任何人拿到网址都能读写这份数据。
        只用于无隐私的学习数据；不要填 service_role key。
*/
window.DEFAULT_SUPABASE_CONFIG = {
  enabled: false,
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_PUBLIC_KEY',
  accountName: '潘琰工作台'
};
