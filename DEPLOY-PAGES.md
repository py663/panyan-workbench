# 潘琰工作台 · GitHub Pages 免费公网部署说明

这套方案发布的是仓库里已有的纯前端 `wwwroot/site`，**不改动原来的 ASP.NET Core MVC 项目**。
GitHub Pages 只托管静态文件，服务端代码（登录、AI 代理、热点抓取）不会在 Pages 上运行。
数据改由浏览器直接通过 **GitHub 仓库**读写：整份数据存成仓库里的一个 JSON 文件，
用 GitHub Contents API 同步。全程免费、无需实名、不绑卡，而且 `api.github.com` 在国内可直连。

## 访问地址

```
https://py663.github.io/panyan-workbench/
```

手机、平板、其他电脑用浏览器打开即可，不需要信用卡、不需要域名。

## 为什么从 Supabase 换成 GitHub 仓库

Supabase 免费版的项目 API 域名 `*.supabase.co` 在国内网络经常被阻断
（浏览器报 `ERR_CONNECTION_CLOSED` / `Failed to fetch`），手机流量也一样，
与配置无关。而 `api.github.com` 在国内稳定可访问，你的 GitHub 账号和仓库也都现成，
所以用 GitHub 仓库当云端数据库更可靠，且同样完全免费、不绑卡。

## 你需要做的 4 步

### 1. 创建一个 GitHub 访问令牌（token）

打开 <https://github.com/settings/personal-access-tokens/new>，按下面填写：

- **Token name**：随便填，比如 `workbench-sync`
- **Expiration**：建议 90 天（到期后换新即可）
- **Resource owner**：选 `py663`
- **Repository access**：选 **Only select repositories**，只勾选 `panyan-workbench`
- **Permissions → Repository permissions**：找到 **Contents**，设为 **Read and write**
- 其他权限全部保持默认（No access），**不要**给管理员/删除仓库等权限

拉到底点 **Generate token**，然后复制生成的 token（`github_pat_` 开头）。

### 2. 推送代码（config.js 里不要填 token）

`config.js` 只需确认仓库信息正确，**token 字段不要写进去**——GitHub 会扫描公开仓库里的 token 并自动吊销它。推送到 `main`，工作流会自动构建：

```bash
git add .
git commit -m "Switch sync to GitHub repository"
git push origin main
```

### 3. 确认 Pages 已开启

仓库页面 → **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**（只需一次）。
之后打开 **Actions** 标签，等 `Deploy workbench to GitHub Pages` 变成绿色对勾即可访问。

### 4. 打开网页，填一次 token

打开 https://py663.github.io/panyan-workbench/ ，会弹出一个输入框：
- 粘贴第 1 步生成的 token，点 **保存并连接**
- token 只保存在**这台设备的浏览器**里，不会上传、不会进代码，别人看不到
- 每台新设备（手机、别的电脑）第一次打开时，各填一次即可

首次连接时会自动在仓库根目录创建 `workbench-data.json`（存你全部数据）。
之后设置页的「账号与同步」卡片里可以随时点「填写 / 更换令牌」。

## 工作流做了什么

`.github/workflows/deploy-pages.yml` 的步骤：

1. 检出仓库 `main` 分支
2. 把 `wwwroot/site` 复制到 `_site`
3. 用 `actions/upload-pages-artifact` 打包
4. 用 `actions/deploy-pages` 发布

由于页面使用相对路径（`css/style.css`、`js/app.js`），放在 `/panyan-workbench/` 子路径下也能正常加载。

注意：数据文件 `workbench-data.json` 在仓库根目录，不在 `wwwroot/site` 里，
所以不会被发布成网页，只作为数据存取。

## 数据同步规则

- 浏览器 `localStorage` 是即时缓存，页面打开时先显示本机数据。
- 随后从 GitHub 仓库拉取云端数据覆盖本机，之后每次修改整份自动上传（约 0.8 秒防抖）。
- 用文件 `sha` 做乐观锁：如果另一台设备先改过，会弹窗让你选「保留我的」或「用云端的」，不会静默覆盖。
- 云端不可用时退回本机模式，右下角状态条明确提示，网络恢复后自动重试。
- 设置页有「账号与同步」卡片，可手动点「立即同步」。

## 安全提醒（重要）

token 只保存在你自己的浏览器里，**不会**写进代码、不会上传到仓库，别人打开网址看不到。
但为了稳妥，仍然务必：

- 只授权 `panyan-workbench` **这一个**仓库
- 只给 **Contents: read and write**，不要给其他权限
- 设置有效期（如 90 天），到期在设置页换新的
- 只存无隐私的学习数据

**千万不要把 token 填进 config.js**：GitHub 的 Secret scanning 会拦截提交，即使强行提交，token 也会被自动吊销，同步会失效。
如果怀疑 token 泄露，去 <https://github.com/settings/personal-access-tokens> 撤销它，再生成一个新的，在网页设置页填入即可。

## 静态版的功能边界

GitHub Pages 没有服务端，以下功能受限：

- **AI 功能**：会尝试用填写的 API Key 直连模型服务；若服务商不允许跨域会给出错误。
- **热点新闻**：依赖 `/api/news` 服务端抓取，静态版提示不可用。
- **真实视频搜索**：依赖 `/api/video-search`，静态版提示不可用，可手动添加。
- **账号登录**：静态版没有 Cookie 登录，所有人共用一份仓库数据（简单共享模式）。

待办、课程表、单词、笔记、记账、收集箱、常用链接等核心模块全部可用。

## 重要：仓库必须保持 Public

GitHub Free 套餐下，**私有仓库不能使用 GitHub Pages**。请保持 `panyan-workbench` 为 **Public**。
改回 Private 会让 Pages 站点停止工作（除非升级到付费套餐）。

仓库公开，请勿在代码或数据里写真实隐私信息。

## 常见排查

- **页面 404**：确认 Settings → Pages 的 Source 是 GitHub Actions，且最后一次 Actions 成功。
- **样式丢失**：确认地址带仓库名 `/panyan-workbench/`。
- **状态条「本机模式」**：`config.js` 里 `enabled` 不是 `true`，或 owner/repo/token 填错。
- **状态条「离线」**：打开浏览器控制台看红色报错。常见是 token 权限不足（401/403）或 token 过期。
- **状态条「正在同步」卡住**：检查 token 是否过期，或仓库是否改成了 Private。
- **数据没更新**：浏览器强刷（Ctrl+F5），或看右下角是否显示「已同步到云端」。
