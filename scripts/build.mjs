import fs from 'node:fs/promises';
import path from 'node:path';
import { config, root, siteURL, url, absolute, escape as e, dateLabel, tagSlug, loadPosts } from './lib.mjs';

const output = path.join(root, 'dist');
const posts = await loadPosts();
const tags = new Map();
for (const post of posts) for (const tag of post.tags) tags.set(tag, [...(tags.get(tag) || []), post]);
const sortedTags = [...tags].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-CN'));
const pages = [];
// Only this fixed, generated directory is replaced. Validate content before touching it.
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'dist') throw new Error('不安全的输出目录');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(path.join(output, 'assets'), { recursive: true });
await fs.cp(path.join(root, 'public'), output, { recursive: true });
await fs.copyFile(path.join(root, 'node_modules/markdown-it/dist/browser/markdown-it.umd.min.js'), path.join(output, 'assets/markdown-it.min.js'));
await fs.copyFile(path.join(root, 'node_modules/highlight.js/styles/github.css'), path.join(output, 'assets/code-light.css'));
await fs.copyFile(path.join(root, 'node_modules/highlight.js/styles/github-dark.css'), path.join(output, 'assets/code-dark.css'));

const icons = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  rss: '<circle cx="5" cy="19" r="1"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>',
  system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const tagLink = (tag, count) => `<a class="tag" href="${url(`tags/${tagSlug(tag)}/`)}">${e(tag)}${count == null ? '' : `<span>${count}</span>`}</a>`;
const postTags = post => post.tags.map(tag => tagLink(tag)).join('');
const postMeta = post => `<div class="post-meta"><time datetime="${e(post.date)}">${dateLabel(post.date)}</time><span class="meta-dot">·</span><span>${post.minutes} 分钟阅读</span></div>`;
const articleCard = post => `<article class="post-card">${postMeta(post)}<h2><a href="${url(`posts/${post.slug}/`)}">${e(post.title)}</a></h2><p class="excerpt">${post.description ? e(post.description) : post.excerpt}</p><div class="card-bottom"><div class="tags">${postTags(post)}</div><a class="read-link" href="${url(`posts/${post.slug}/`)}" aria-label="阅读 ${e(post.title)}">阅读全文 ${icon('arrow')}</a></div></article>`;
const empty = '<div class="empty-state"><p>这里还很安静。</p><span>下一篇记录，正在路上。</span></div>';

function layout({ title, description = config.description, route = '', active = '', content, article, extraHead = '', script = '' }) {
  const pageTitle = title ? `${title} · ${config.title}` : config.title;
  const nav = [['', '最近', 'home'], ['archive/', '全部文章', 'archive'], ['tags/', '标签', 'tags'], ['about/', '关于', 'about']];
  return `<!doctype html>
<html lang="${e(config.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">
<title>${e(pageTitle)}</title><meta name="description" content="${e(description)}"><link rel="canonical" href="${absolute(route)}">
<meta property="og:type" content="${article ? 'article' : 'website'}"><meta property="og:title" content="${e(pageTitle)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${absolute(route)}"><meta property="og:locale" content="zh_CN">
${article ? `<meta property="article:published_time" content="${e(article.date)}"><meta property="article:modified_time" content="${e(article.updated || article.date)}">` : ''}
<link rel="alternate" type="application/rss+xml" title="${e(config.title)}" href="${url('rss.xml')}"><link rel="icon" href="${url('favicon.svg')}" type="image/svg+xml">
<script src="${url('assets/theme.js')}"></script><link rel="stylesheet" href="${url('assets/style.css')}">${extraHead}
</head><body><a class="skip-link" href="#main">跳到正文</a><div class="site-shell">
<header class="site-header"><a class="brand" href="${url()}"><span class="brand-mark">d<span>·</span></span><span>Daniel<span class="brand-period">.</span></span></a><nav aria-label="主导航">${nav.map(([route, label, key]) => `<a href="${url(route)}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav><a class="rss-icon" href="${url('rss.xml')}" title="RSS 订阅" aria-label="RSS 订阅">${icon('rss')}</a></header>
<main id="main">${content}</main>
<footer class="site-footer"><div><span class="footer-brand">${e(config.author)} 的文字存档</span><span class="footer-note">在自己的角落，慢慢记录。</span></div><div class="footer-controls"><div class="footer-links"><a href="${url('rss.xml')}">RSS 订阅 ${icon('rss')}</a><a href="${url('write/')}">写作</a><a href="https://github.com/${e(config.repository)}">GitHub</a></div><div class="theme-switch" role="group" aria-label="外观"><button type="button" data-theme-value="system" aria-label="跟随系统" title="跟随系统" aria-pressed="true">${icon('system')}</button><button type="button" data-theme-value="light" aria-label="浅色主题" title="浅色主题" aria-pressed="false">${icon('sun')}</button><button type="button" data-theme-value="dark" aria-label="深色主题" title="深色主题" aria-pressed="false">${icon('moon')}</button></div></div></footer>
</div><script src="${url('assets/main.js')}" defer></script>${script}</body></html>`;
}

async function writePage(route, options) {
  const filename = route === '404.html' ? route : `${route}index.html`;
  await fs.mkdir(path.dirname(path.join(output, filename)), { recursive: true });
  await fs.writeFile(path.join(output, filename), layout({ ...options, route }));
  if (route !== '404.html' && route !== 'write/') pages.push({ route, modified: options.article?.updated || options.article?.date });
}

await writePage('', { active: 'home', content: `<section class="hero"><div><p class="eyebrow"><span class="status-dot"></span> A PERSONAL JOURNAL</p><h1>记录生活，<br>也记录<span class="soft-title">想法。</span></h1><p class="hero-description">${e(config.description)}</p><a class="text-link" href="${url('about/')}">关于这个小小的角落 ${icon('arrow')}</a></div><div class="hero-aside"><span class="aside-line"></span><p>生活的切片<br>技术的折腾<br>偶尔的胡思乱想</p><span class="aside-count">${String(posts.length).padStart(2, '0')} 篇记录 · ${tags.size} 个标签</span></div></section>
<section aria-labelledby="latest-heading"><div class="section-heading"><h2 id="latest-heading">最近更新 <span>THE LATEST</span></h2><a href="${url('archive/')}">全部文章 <span class="small-count">${posts.length}</span> ${icon('arrow')}</a></div>${posts.slice(0, config.recentCount).map(articleCard).join('') || empty}</section>
<div class="end-note"><span>文字让记忆有迹可循。</span><a class="text-link" href="${url('archive/')}">翻翻以前的记录 ${icon('arrow')}</a></div>` });

const years = [...new Set(posts.map(post => dateLabel(post.date).slice(0, 4)))];
await writePage('archive/', { title: '全部文章', active: 'archive', content: `<header class="page-heading"><p class="eyebrow">THE ARCHIVE</p><h1>所有记录<span class="heading-count">${posts.length}</span></h1><p>日子一页页翻过，文字留在这里。</p></header><div class="tag-filter" aria-label="按标签浏览"><a class="tag selected" href="${url('archive/')}" aria-current="page">全部 <span>${posts.length}</span></a>${sortedTags.map(([tag, list]) => tagLink(tag, list.length)).join('')}</div>${years.map(year => `<section class="year-group" aria-labelledby="year-${year}"><div class="year-heading"><h2 id="year-${year}">${year}</h2><span>${posts.filter(post => dateLabel(post.date).startsWith(year)).length} 篇</span></div>${posts.filter(post => dateLabel(post.date).startsWith(year)).map(articleCard).join('')}</section>`).join('') || empty}` });

await writePage('tags/', { title: '标签', active: 'tags', content: `<header class="page-heading"><p class="eyebrow">EXPLORE BY TOPIC</p><h1>顺着兴趣，翻一翻。</h1><p>${tags.size} 个标签，串起不同的记录。未分类文章仍可在全部文章中找到。</p></header><div class="tag-grid">${sortedTags.map(([tag, list], i) => `<a class="tag-tile" href="${url(`tags/${tagSlug(tag)}/`)}"><span class="tile-number">${String(i + 1).padStart(2, '0')}</span><h2>${e(tag)}</h2><span class="tile-bottom">${list.length} 篇记录 ${icon('arrow')}</span></a>`).join('') || empty}</div>` });
for (const [tag, list] of sortedTags) await writePage(`tags/${tagSlug(tag)}/`, { title: `标签：${tag}`, active: 'tags', content: `<a class="back-link" href="${url('tags/')}">← 所有标签</a><header class="page-heading"><p class="eyebrow">TOPIC / ${list.length} POSTS</p><h1>${e(tag)}</h1><p>关于「${e(tag)}」的 ${list.length} 篇记录。</p></header><div class="tag-filter">${sortedTags.map(([name, tagged]) => name === tag ? `<span class="tag selected" aria-current="page">${e(name)} <span>${tagged.length}</span></span>` : tagLink(name, tagged.length)).join('')}</div>${list.map(articleCard).join('')}` });

for (const [index, post] of posts.entries()) {
  const previous = posts[index + 1];
  const next = posts[index - 1];
  const description = post.description || post.excerpt.replace(/&[^;]+;/g, ' ').slice(0, 160);
  await writePage(`posts/${post.slug}/`, { title: post.title, description, article: post, extraHead: `<link rel="stylesheet" href="${url('assets/code-light.css')}" id="code-light"><link rel="stylesheet" href="${url('assets/code-dark.css')}" id="code-dark" media="not all">`, content: `<article class="article-detail"><a class="back-link" href="${url('archive/')}">← 全部文章</a><header class="article-heading">${postMeta(post)}<h1>${e(post.title)}</h1><div class="tags">${postTags(post)}</div>${post.updated && post.updated !== post.date ? `<p class="updated">最后修改于 <time datetime="${e(post.updated)}">${dateLabel(post.updated)}</time></p>` : ''}</header>${post.headings.length > 2 ? `<details class="toc"><summary>文章目录 <span>${post.headings.length} 个章节</span></summary><ol>${post.headings.map(h => `<li><a href="#${h.id}">${e(h.text)}</a></li>`).join('')}</ol></details>` : ''}<div class="prose">${post.html}</div><div class="article-source"><span>写于 ${dateLabel(post.date)}</span><div>${post.source ? `<a href="${e(post.source)}">原始 Issue ↗</a>` : ''}<a href="https://github.com/${e(config.repository)}/edit/${encodeURIComponent(config.branch)}/content/posts/${post.filename.split('/').map(encodeURIComponent).join('/')}">编辑文章 ↗</a></div></div><nav class="post-navigation" aria-label="前后文章"><div>${previous ? `<span>更早一篇</span><a href="${url(`posts/${previous.slug}/`)}">← ${e(previous.title)}</a>` : ''}</div><div>${next ? `<span>更新一篇</span><a href="${url(`posts/${next.slug}/`)}">${e(next.title)} →</a>` : ''}</div></nav></article>` });
}

await writePage('about/', { title: '关于', active: 'about', content: `<header class="page-heading"><p class="eyebrow">A LITTLE ABOUT THIS SPACE</p><h1>你好，我是 ${e(config.author)}。</h1><p>欢迎来到我的文字存档。</p></header><div class="prose about-copy"><p>这里放着一些生活记录、技术折腾，以及不时冒出来的想法。</p><p>不必每次都有结论，也不必每篇都很完整。把当下的感受写下来，过一阵子回头看，就是时间留下的痕迹。</p><hr><h2>从哪里开始</h2><p>你可以从<a href="${url()}">最近的几篇文章</a>开始，也可以翻翻<a href="${url('archive/')}">全部记录</a>，或者挑一个<a href="${url('tags/')}">感兴趣的标签</a>。</p><h2>保持联系</h2><p>如果你也喜欢用阅读器慢慢阅读，可以<a href="${url('rss.xml')}">订阅 RSS</a>。新的文章会在那里与你见面。</p><p><a href="https://github.com/${e(config.repository.split('/')[0])}">在 GitHub 找到我 ↗</a></p></div>` });

await writePage('write/', { title: '写作', extraHead: '<meta name="robots" content="noindex">', content: `<header class="page-heading"><p class="eyebrow">A SPACE TO WRITE</p><h1>写下此刻。</h1><p>草稿自动保存在这台设备。写完后导出 Markdown，或复制到 GitHub 提交。</p></header><noscript><p>网页编辑器需要启用 JavaScript；也可以直接在 GitHub 的 content/posts 目录创建 Markdown 文件。</p></noscript><form id="writer" data-repository="${e(config.repository)}" data-branch="${e(config.branch)}"><label for="post-title">文章标题</label><input id="post-title" name="title" required placeholder="给这篇记录起个名字" maxlength="200"><div class="form-row"><div><label for="post-slug">文件名 <span>英文、数字和连字符</span></label><input id="post-slug" name="slug" required pattern="[a-z0-9][a-z0-9-]*" placeholder="a-little-note" maxlength="100"></div><div><label for="post-date">发布时间 <span>当前设备时区</span></label><input id="post-date" name="date" type="datetime-local" required></div></div><label for="post-tags">标签 <span>用逗号分隔</span></label><input id="post-tags" name="tags" placeholder="生活，思考"><label for="post-description">简介 <span>可选，默认从正文提取</span></label><input id="post-description" name="description" placeholder="用一句话概括这篇文章"><div class="editor-heading"><label for="post-body">正文</label><div role="group" aria-label="编辑模式"><button type="button" id="edit-tab" aria-pressed="true">编辑</button><button type="button" id="preview-tab" aria-pressed="false">预览</button></div></div><textarea id="post-body" name="body" rows="18" required placeholder="从一个念头开始。支持 Markdown。"></textarea><div id="markdown-preview" class="prose editor-preview" hidden></div><label class="checkbox-label"><input type="checkbox" name="draft"> 保存为草稿（不会显示在博客和 RSS 中）</label><div class="writer-actions"><button class="primary-button" type="submit">导出 Markdown ↓</button><button type="button" id="copy-post">复制 Markdown</button><button type="button" id="github-post">前往 GitHub 提交 ↗</button></div><p id="writer-status" role="status" aria-live="polite">草稿仅存于当前浏览器，建议及时导出备份。</p><p class="writer-help">提交方式：先复制 Markdown，打开 GitHub 后粘贴正文，再点击 Commit changes。长文章也可导出后上传到 <code>content/posts/</code>。提交到 main 分支后会自动发布。</p><details class="markdown-export"><summary>查看完整 Markdown（也可手动复制）</summary><textarea id="markdown-output" readonly aria-label="完整 Markdown" rows="10"></textarea></details></form>`, script: `<script src="${url('assets/markdown-it.min.js')}" defer></script><script src="${url('assets/writer.js')}" defer></script>` });
await writePage('404.html', { title: '页面未找到', content: `<section class="not-found"><p class="eyebrow">404 / NOT FOUND</p><h1>这一页，暂时不在。</h1><p>也许链接有误，去翻翻其他记录吧。</p><a class="primary-button" href="${url()}">回到首页 ${icon('arrow')}</a></section>` });

const cdata = value => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
const feedHTML = html => html.replace(/(href|src)="(\/[^\"]*)"/g, (_, attr, value) => `${attr}="${siteURL.origin}${value}"`);
const lastBuild = posts.length ? new Date(Math.max(...posts.map(p => Date.parse(p.updated || p.date)))).toUTCString() : new Date().toUTCString();
await fs.writeFile(path.join(output, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${e(config.title)}</title><link>${e(siteURL.href)}</link><description>${e(config.description)}</description><language>${e(config.language)}</language><lastBuildDate>${lastBuild}</lastBuildDate><atom:link href="${e(absolute('rss.xml'))}" rel="self" type="application/rss+xml"/>${posts.map(post => `<item><title>${e(post.title)}</title><link>${e(absolute(`posts/${post.slug}/`))}</link><guid isPermaLink="true">${e(absolute(`posts/${post.slug}/`))}</guid><pubDate>${new Date(post.date).toUTCString()}</pubDate><description>${cdata(post.description ? e(post.description) : post.excerpt)}</description><content:encoded>${cdata(feedHTML(post.html))}</content:encoded>${post.tags.map(tag => `<category>${e(tag)}</category>`).join('')}</item>`).join('')}</channel></rss>`);
await fs.writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(page => `<url><loc>${e(absolute(page.route))}</loc>${page.modified ? `<lastmod>${new Date(page.modified).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`);
await fs.writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${absolute('sitemap.xml')}\n`);
await fs.writeFile(path.join(output, '.nojekyll'), '');
console.log(`已生成 ${posts.length} 篇文章、${tags.size} 个标签、${pages.length + 2} 个页面，以及全文 RSS。站点：${siteURL.href}`);
