import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import hljs from 'highlight.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const config = JSON.parse(await fs.readFile(path.join(root, 'site.config.json'), 'utf8'));
export const siteURL = new URL(process.env.SITE_URL || config.url);
if (!siteURL.pathname.endsWith('/')) siteURL.pathname += '/';
export const base = siteURL.pathname;
export const url = (relative = '') => base + relative.replace(/^\//, '');
export const absolute = (relative = '') => new URL(relative.replace(/^\//, ''), siteURL).href;
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const tagSlug = (tag) => Buffer.from(tag).toString('base64url');
export const dateLabel = (date) => new Intl.DateTimeFormat('zh-CN', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date)).replaceAll('/', '.');
let archivedImages = {};
try { archivedImages = JSON.parse(await fs.readFile(path.join(root, 'content/imports/images.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

export function readFrontmatter(text, filename = 'Markdown') {
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${filename}: 缺少 YAML front matter（文章开头的 --- 配置）`);
  const data = parse(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${filename}: 文章配置必须是对象`);
  return { data, body: text.replace(/^\uFEFF/, '').slice(match[0].length) };
}

export function validatePost(data, filename) {
  if (typeof data.title !== 'string' || !data.title.trim()) throw new Error(`${filename}: title 必须是非空字符串`);
  for (const key of ['date', 'updated']) {
    if (key === 'updated' && data[key] == null) continue;
    if (typeof data[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(data[key]) || Number.isNaN(Date.parse(data[key]))) throw new Error(`${filename}: ${key} 必须是带引号的 ISO 日期`);
  }
  if (data.updated && Date.parse(data.updated) < Date.parse(data.date)) throw new Error(`${filename}: updated 不能早于 date`);
  if (data.tags != null && (!Array.isArray(data.tags) || data.tags.some(t => typeof t !== 'string' || !t.trim()))) throw new Error(`${filename}: tags 必须是字符串数组`);
  if (data.draft != null && typeof data.draft !== 'boolean') throw new Error(`${filename}: draft 必须是 true 或 false`);
  if (data.description != null && typeof data.description !== 'string') throw new Error(`${filename}: description 必须是字符串`);
  if (data.source && (typeof data.source !== 'string' || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(data.source))) throw new Error(`${filename}: source 必须是 GitHub Issue 链接`);
  const slug = data.slug || path.basename(filename, '.md');
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`${filename}: slug/文件名只能包含小写英文、数字和连字符`);
  return { ...data, slug, tags: [...new Set((data.tags || []).map(t => t.trim()))] };
}

const markdown = new MarkdownIt({
  html: true, linkify: true, breaks: false,
  highlight(code, language) {
    return language && hljs.getLanguage(language) ? hljs.highlight(code, { language, ignoreIllegals: true }).value : '';
  },
});

export function renderMarkdown(body, { imageBase = siteURL.href, links = new Map(), issueLinks = new Map(), filename = '' } = {}) {
  const tokens = markdown.parse(body, {});
  const headings = [];
  let headingIndex = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const id = `section-${++headingIndex}`;
      tokens[i].attrSet('id', id);
      headings.push({ id, text: tokens[i + 1].content, level: Number(tokens[i].tag.slice(1)) });
    }
  }
  const assetURL = (value) => {
    if (archivedImages[value]) return url(archivedImages[value]);
    if (!value || value.startsWith('//') || /^[a-z]+:/i.test(value)) return value;
    if (value.startsWith('/')) return value.startsWith(base) ? value : url(value);
    const resolved = new URL(value, imageBase);
    return resolved.origin === siteURL.origin ? resolved.pathname + resolved.search + resolved.hash : resolved.href;
  };
  const html = sanitizeHtml(markdown.renderer.render(tokens, markdown.options, {}), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'details', 'summary', 'del', 's', 'input'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['id'], a: ['href', 'title'], img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      code: ['class'], span: ['class'], th: ['align'], td: ['align'], input: ['type', 'checked', 'disabled'],
    },
    allowedClasses: { code: ['language-*'], span: ['hljs-*'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      img: (_, attrs) => ({ tagName: 'img', attribs: { ...attrs, src: assetURL(attrs.src), loading: 'lazy', decoding: 'async' } }),
      a: (_, attrs) => {
        let href = attrs.href || '';
        if (/^https?:\/\/daniel011011-cdn\.gitblog\.xyz(?:\/|$)/.test(href)) {
          const old = new URL(href);
          if (/^\/(feed|rss(?:\.xml)?)\/?$/.test(old.pathname)) href = url('rss.xml');
          else if (old.pathname === '/') href = url();
          else {
            const issueNumber = old.pathname.match(/^\/posts\/(\d+)\/?$/)?.[1];
            if (issueLinks.has(issueNumber)) href = url(`posts/${issueLinks.get(issueNumber)}/`) + old.hash;
          }
        }
        const [localFile, fragment] = href.split('#');
        if (localFile.endsWith('.md') && !/^(?:[a-z]+:|\/)/i.test(localFile)) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(filename), localFile));
          if (!links.has(target)) throw new Error(`${filename}: 无法找到文章链接 ${href}`);
          href = url(`posts/${links.get(target)}/`) + (fragment ? `#${fragment}` : '');
        } else if (href.startsWith('/') && !href.startsWith('//')) href = assetURL(href);
        return { tagName: 'a', attribs: { ...attrs, href } };
      },
      input: (_, attrs) => ({ tagName: 'input', attribs: { type: 'checkbox', disabled: '', ...(Object.hasOwn(attrs, 'checked') ? { checked: '' } : {}) } }),
    },
  });
  const plain = sanitizeHtml(html.replace(/<\/(p|h\d|li|pre)>/g, ' '), { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
  return { html, headings, excerpt: plain.slice(0, 170) + (plain.length > 170 ? '…' : ''), minutes: Math.max(1, Math.ceil(plain.length / 450)) };
}

export async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)));
  return files.flat().filter(file => file.endsWith('.md')).sort();
}

export async function loadPosts(directory = path.join(root, 'content/posts')) {
  const files = await filesIn(directory);
  const posts = await Promise.all(files.map(async file => {
    const filename = path.relative(directory, file).replaceAll('\\', '/');
    const { data, body } = readFrontmatter(await fs.readFile(file, 'utf8'), filename);
    return { ...validatePost(data, filename), body, filename };
  }));
  const slugs = new Set();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`重复的文章 slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  const published = posts.filter(post => !post.draft);
  const links = new Map(published.map(post => [post.filename, post.slug]));
  const issueLinks = new Map(published.filter(post => post.issueRepository === config.issueSource).map(post => [String(post.issue), post.slug]));
  return published.map(post => ({ ...post, ...renderMarkdown(post.body, { links, issueLinks, filename: post.filename }) }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.slug.localeCompare(b.slug));
}

export function issueToMarkdown(issue, repository) {
  return `---\n${stringify({ title: issue.title, date: issue.created_at, updated: issue.updated_at, tags: issue.labels.map(label => typeof label === 'string' ? label : label.name), draft: false, source: issue.html_url, issue: issue.number, issueRepository: repository })}---\n\n${issue.body || ''}\n`;
}
