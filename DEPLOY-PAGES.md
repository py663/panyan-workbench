# 潘琰工作台 · GitHub Pages 免费公网部署说明

这套方案发布的是仓库里已有的纯前端 `wwwroot/site`，**不改动原来的 ASP.NET Core MVC 项目**。
GitHub Pages 只托管静态文件，服务端代码（登录、AI 代理、热点抓取）不会在 Pages 上运行；
数据改由浏览器直接通过 Supabase REST 读写。

## 访问地址

部署完成后：

```
https://py663.github.io/panyan-workbench/
```

手机、平板、其他电脑用浏览器打开即可，不需要信用卡、不需要域名。

## 你需要做的 4 步

### 1. 在 Supabase 建表

打开 Supabase 控制台 → 左侧 **SQL Editor** → **New query**，
把仓库根目录 `supabase-pages-setup.sql` 的全部内容粘进去，点 **Run**。

执行成功后会多出一张 `public.workbench_pages` 表，里面预置 10 个模块行。
这张表和原 MVC 应用的 `users` / `usermodules` 是分开的，不会互相影响。

### 2. 填写连接信息

编辑 `wwwroot/site/js/config.js`：

```js
window.DEFAULT_SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://你的项目.supabase.co',
  anonKey: '你的 anon public key',
  accountName: '潘琰工作台'
};
```

- `url` 和 `anonKey` 在 Supabase → **Project Settings → API** 页面获取。
- 只使用 **anon public** key，**绝对不要**填 `service_role` key。
- 填完推送后，这个 key 会随前端代码公开。这是「简单共享」模式的固有风险，只放无隐私数据。

### 3. 推送代码

把改动提交推送到 `main` 分支即可，工作流会自动构建发布：

```bash
git add .
git commit -m "Enable Supabase sync for Pages"
git push origin main
```

### 4. 开启 Pages

仓库页面 → **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
这一步只需做一次。之后打开 **Actions** 标签，等 `Deploy workbench to GitHub Pages` 变成绿色对勾即可访问。

## 工作流做了什么

`.github/workflows/deploy-pages.yml` 的步骤：

1. 检出仓库 `main` 分支
2. 把 `wwwroot/site` 复制到 `_site`
3. 用 `actions/upload-pages-artifact` 打包
4. 用 `actions/deploy-pages` 发布

由于页面使用的是相对路径（`css/style.css`、`js/app.js`），放在 `/panyan-workbench/` 子路径下也能正常加载，无需修改 base 路径。

## 数据同步规则

- 浏览器 `localStorage` 是即时缓存，页面打开时先显示本机数据。
- 随后从 Supabase 拉取云端数据覆盖本机，之后每次修改按模块自动上传（约 0.4 秒防抖）。
- 每个模块有 `version` 乐观锁；如果另一台设备先改过，会弹窗让你选择「保留我的」或「用服务器的」，不会静默覆盖。
- 云端不可用时退回本机模式，右下角状态条会明确提示，网络恢复后自动重试。
- 设置页新增「账号与同步」卡片，可手动点「立即同步」。

## 静态版的功能边界

GitHub Pages 没有服务端，以下功能在静态版受限：

- **AI 功能**：会尝试用你填写的 API Key 直连模型服务；如果服务商不允许跨域，会给出明确错误。需要 AI 时请用带服务端的部署方式。
- **热点新闻**：依赖 `/api/news` 服务端抓取，静态版会提示不可用。
- **真实视频搜索**：依赖 `/api/video-search`，静态版会提示不可用，可以在视频库手动添加。
- **账号登录**：静态版没有 Cookie 登录，所有人共用一份 Supabase 数据（简单共享模式）。

待办、课程表、单词、笔记、记账、收集箱、常用链接等核心模块全部可用。

## 重要：仓库必须保持 Public

GitHub Free 套餐下，**私有仓库不能使用 GitHub Pages**。
所以为了让免费站点持续可访问，请把 `panyan-workbench` 保持为 **Public**。
如果改回 Private，Pages 站点会停止工作；除非升级到 GitHub Pro/Team。

仓库是公开的，请勿在代码或数据里写真实隐私信息（身份证号、手机号、密码、service_role key 等）。

## 常见排查

- **页面 404**：确认 Settings → Pages 的 Source 是 GitHub Actions，且 Actions 最后一次运行成功。
- **样式丢失**：检查浏览器地址是否带仓库名 `/panyan-workbench/`，不要用其他路径直接打开 `index.html`。
- **状态条一直显示「本机模式」**：`config.js` 里 `enabled` 没改成 `true`，或 url / anonKey 填错。
- **状态条显示「离线」**：Supabase 项目可能暂停了（免费项目长期不用会暂停），到控制台恢复即可。
- **数据没更新**：浏览器强刷（Ctrl+F5），或看右下角是否显示「已同步到云端」。
