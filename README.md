# Daniel 的博客

从 `Daniel011011/CDN` 的 GitHub Issues 恢复的极简静态博客。文章用 Markdown 保存在当前仓库，通过 GitHub Actions 构建并部署到 GitHub Pages。

已恢复 **17 篇文章、5 个原始标签、8 张图片**。文章正文、Issue 创建/修改时间和来源链接均保留；没有标签的旧文章仍显示在首页及归档。日期在网页上按上海时区显示，因此可能比 UTC 文件名晚一天。标题中手写的日期保持原样，不会用它替换 Issue 创建时间。

## 第一次上线：只需要设置 GitHub Pages

代码已准备为 `Daniel011011/Blog` 部署，无需新建服务器、数据库、另一个仓库或访问令牌。

1. 将本仓库提交并推送到 GitHub 的 `main` 分支。
2. 打开 [Blog → Settings → Pages](https://github.com/Daniel011011/Blog/settings/pages)。在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 打开 [Actions](https://github.com/Daniel011011/Blog/actions)，选择 **Build and deploy blog**。如果首次推送时尚未启用 Pages 导致部署失败，启用后选择 **Run workflow → main → Run workflow**（或重新运行失败的工作流）。
4. 等 `build` 和 `deploy` 都成功后，访问 **https://daniel011011.github.io/Blog/**。

RSS 地址：**https://daniel011011.github.io/Blog/rss.xml**。

如果仓库是私有的，GitHub Pages 是否可用取决于账户套餐；免费个人账户通常需要公开仓库。是否公开请自行在 GitHub 设置，不需要为此创建 token。如果组织/仓库禁用了 Actions，也需先启用。工作流已声明部署所需权限，不必打开全局的读写权限。

配置方法参见 [GitHub 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 日常写作

### 方法一：直接修改 Markdown（推荐）

将 `.md` 文件放在 `content/posts/`，提交到 `main` 即会重建并部署。可以使用 Obsidian、VS Code、其他 Markdown 编辑器或 GitHub 网页编辑器。子文件夹也会扫描。

```markdown
---
title: "一个普通的下午"
date: "2026-09-20T16:30:00+08:00"
tags: ["生活", "思考"]
description: "可选简介，不填时从正文提取。"
draft: false
---

今天想记下的一些事情。

## 小标题

这里是正文。支持 **粗体**、列表、引用、表格、图片和代码块。
```

- 文件名示例：`2026-09-20-an-afternoon.md`，使用小写英文、数字、连字符。标题和标签可用中文。
- `date` 是文章日期，新建时填写一次，编辑时保留。Obsidian 模板自动填入新建时间；如果希望它代表正式发布时间，可以在发布时调整一次。
- **不需要维护 `updated`**。构建时自动读取这篇 Markdown 最近一次实际修改的 Git 提交时间，用于网页、文章元数据、RSS 的更新时间及站点地图。初次加入仓库、只改文件名、修改其他文件和重新部署不会刷新文章更新时间。相同内容重复上传不会产生新的文章修改记录。
- 旧文章已有的 `updated` 保留为历史基准；后续提交修改时自动使用较新的时间。构建不会改写 Markdown，也不使用电脑文件修改时间，因此 Obsidian 属性里不会自动出现新的 `updated`。
- `draft: true` 的文章不出现在页面、标签页、RSS 或站点地图中；但在公开仓库中源文件仍可被访问。
- `tags: []` 表示没有标签，标签无需预先创建。
- 可选 `slug: an-afternoon` 固定文章链接；不写则使用文件名。**已发布文章不要随意改文件名或 slug**，否则原 URL 和 RSS 的文章标识会改变。
- 未来日期不会定时发布。只有提交触发构建；需要隐藏时用 `draft: true`。
- 图片可以直接粘贴或拖入 Obsidian，默认存入 `content/attachments/`。提交时把文章和新增图片一起勾选并推送，博客会自动发布引用到的图片，无需图床。
- 支持 Obsidian 的 `![[图片.png]]`、`![[content/attachments/图片.png|300]]`、`![[图片.png|300x200]]`，以及普通 Markdown 的相对路径和仓库路径（例如 `![说明](../attachments/图片.png)`）。中文和空格文件名均可使用。
- 已有的 `public/images/` 图片及 `![说明](/images/photo.jpg)` 写法继续可用，生成器自动适配 `/Blog/` 子路径。HTML 的 `<img src="...">` 同样支持本地图片。
- 短图片名优先匹配文章同目录，再匹配仓库/公开目录，最后查找仓库内唯一的同名文件。若有多个同名图片，请使用完整的仓库路径；若图片漏提交、路径错误或指向仓库外，构建会明确报错，避免发布坏图。外部图片链接仍使用原地址。
- PNG、JPEG、GIF、WebP、AVIF、SVG、BMP、ICO 图片可用。`public/` 之外仅复制已发布文章引用的图片，并按内容生成独立链接；草稿独用的附件不会自动进入网站。仓库本身若公开，已提交文件仍可在 GitHub 查看。
- 站内文章可用 `[另一篇](./another-post.md)`；构建会校验引用并改为文章 URL。所有文章 slug 必须唯一。
- Markdown 中的安全 HTML（例如旧 Issue 的 `<img>`）会保留；脚本、事件属性、iframe 等会被清除。

### 在 Obsidian 中一键新建

用 Obsidian 打开整个 `Blog` 文件夹。本仓库已配置自带的「时间戳笔记」（Unique note creator）和「模板」，无需安装第三方插件。已有窗口首次更新配置后，重新加载一次 Obsidian。

1. 在 Blog 仓库按 **Ctrl+N**，或点击左侧功能区的「创建时间戳笔记」。文章直接建在 `content/posts/`，自动插入 `content/templates/post.md` 的内容、当前日期及固定链接标识。
2. 将属性 `title` 中的「新文章标题」改成文章标题，写正文，标签和简介可选。文件名可改成中文；模板生成的 `slug` 固定文章链接，请保留。
3. 写完取消勾选 `draft`，提交并推送到 `main`。网页自动构建、发布；以后修改正文再提交即可，更新时间由博客处理。

插图直接粘贴即可。GitHub Desktop 提交时同时选中文章和新增图片文件；只有本地粘贴、保存不会自动上传。附件目录设置随本仓库保存，使用已经打开的旧窗口时可重新加载一次以应用。

这个快捷键只在 Blog 仓库生效。文件列表的普通「新建笔记」仍会创建空白笔记；也可以先在 `content/posts/` 或其子文件夹创建笔记，再通过命令面板的「模板：插入模板」选择 `post`。不要直接复制模板文件，日期占位符需要由 Obsidian 插入模板时替换。

使用其他编辑器时，也可以运行：

```powershell
npm run new -- an-afternoon "一个普通的下午"
```

新文章默认是草稿。编辑完成后改成 `draft: false` 再提交。

### 方法二：在博客网页写作

点击页脚的「写作」，或访问 `/Blog/write/`：

1. 填写标题、英文文件名、发布时间、标签和正文。
2. 可切换 Markdown 预览。当前草稿保存在当前浏览器，刷新会恢复；不同设备不会自动同步。
3. 点击「导出 Markdown」得到完整 `.md`，放进 `content/posts/`；或点击「前往 GitHub 提交」。后者会复制 Markdown 并打开 GitHub 新建文件页。
4. 在 GitHub 粘贴正文，检查文件名，点击 **Commit changes**，提交到 `main`。如果分支受保护，则创建 PR 并合并到 `main`。

网页不会直接持有 GitHub 凭据，也不会在点击时自动完成仓库提交。纯静态网站要真正实现“一键写入仓库”需额外的授权服务或在浏览器提供访问令牌；当前采用 GitHub 自身登录和提交界面。没有写入权限的访客不能向你的仓库提交。

草稿仅有一个自动保存槽位；开始下一篇时请先导出当前文章。浏览器隐私模式/禁用存储可能无法保存，页面会提示。网页预览禁用原始 HTML，最终构建则支持清理后的安全 HTML；代码高亮以已发布页面为准。修改已发布文章请点击文章底部「编辑文章」，在 GitHub 更新正文后提交；更新时间会自动计算。

## 本地运行

需要 Node.js 22 或更高版本。

```powershell
npm ci
npm run dev
```

打开 http://localhost:4321/Blog/ 。修改后运行 `npm run build` 并刷新页面。`npm run preview` 也会先构建再启动同一预览服务器。

```powershell
npm test       # 内容、清理、草稿、链接及静态生成检查
npm run build  # 生成 dist/（不提交生成产物）
```

自动更新时间需要完整 Git 历史，Actions 已设置 `fetch-depth: 0`。如果本地使用浅克隆，先运行 `git fetch --unshallow`。未提交的本地编辑不会提前改变网页更新时间；下载 ZIP 等没有 Git 历史的副本使用文章内已有的日期。Git 提交时间表示这次版本记录的时间，不是服务器收到推送的时间。

## 修改站点

`site.config.json` 中配置站点名称、作者、描述、地址、仓库和首页篇数（默认 5 篇）。导航品牌、首页文案及关于页在 `scripts/build.mjs`；样式在 `public/assets/style.css`。无网络字体或前端框架，正文无需 JavaScript 即可阅读，主题提供跟随系统/浅色/深色。

如果更改仓库名称或使用自定义域名，必须同步更新 `url`，否则 RSS、canonical 和 sitemap 会指向旧地址。根域名站点用 `https://example.com/`。自定义域名另按 GitHub Pages 文档配置 DNS 和 Pages 的 Custom domain；可在 `public/CNAME` 写入域名。分支不是 `main` 时，还需更新配置及工作流触发分支。

## 迁移备份与重新导入

```powershell
npm run import:issues
node scripts/archive-images.mjs
```

导入默认读取 `Daniel011011/CDN` 全部分页，包括已关闭 Issues，排除 Pull Requests。按来源链接识别已导入文章；**重复运行不会覆盖本地修改**。新增 Issue 会生成新 Markdown；旧 Issue 修改不会自动同步。如需迁移别的来源，使用 `npm run import:issues -- --repo=owner/repository`。同文件名碰撞会报错，避免覆盖。

原始数据在 `content/imports/Daniel011011-CDN.json`；图片映射在 `content/imports/images.json`，本地图片在 `public/images/imported/`。图片 URL 和旧博客内部链接仅在构建时重写，原始正文保持不变。重新导入会刷新 JSON 快照，历史快照可从 Git 找回。旧博客的域名由原服务控制，本项目不能让那个域名自动重定向；RSS 阅读器需换成新地址。

备份和迁移程序不参与日常构建，Actions 只读取已提交的 Markdown 和图片，不依赖 GitHub Issues API。公开仓库通常不需要 token；遇到 GitHub API 限流时可以临时设置环境变量 `GITHUB_TOKEN`，不要写进文件或提交到仓库。

## 文件结构

```text
content/posts/        Markdown 文章，日常编辑这里
content/attachments/ Obsidian 粘贴的图片，随文章一起提交
content/templates/   新文章模板
content/imports/     旧 Issues 原始快照和图片映射
public/images/       图片（原样复制到站点）
public/assets/       样式、主题和网页写作脚本
scripts/             构建、预览和迁移脚本
test/                自动化验证
.github/workflows/   GitHub Actions 构建及部署
site.config.json     站点配置
```

首页显示最近发布的 5 篇摘要，全部文章按年份归档；标签页按原标签筛选，正文页保留日期、更新日期、阅读时间、前后篇、原 Issue 和编辑入口。全文 RSS 收录全部已发布文章，附带原发布时间和标签。PR 运行测试及构建，推送 main / 手动触发才执行 Pages 部署。无搜索、评论、统计或第三方追踪。
