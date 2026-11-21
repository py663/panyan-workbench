/* ============ GitHub Pages 静态版 · Supabase 配置 ============
   Project Settings → API Keys 复制 Project URL 和 Publishable key
   （新版 sb_publishable_ 开头的 key，等同旧版 anon public key）。

   注意：publishable key 会随前端发布，任何人拿到网址都能读写这份数据。
        只用于无隐私的学习数据；绝对不要填 sb_secret_ / service_role key。
*/
window.DEFAULT_SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://ndpoeqzrigqjbfbxq.supabase.co',
  anonKey: 'sb_publishable_uk_XwPEnYHNyJ5mN5BrmKg_E0faGt8B',
  accountName: '潘琰工作台'
};
