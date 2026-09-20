import fs from 'node:fs/promises';
import path from 'node:path';
import { config, root, issueToMarkdown, filesIn, readFrontmatter } from './lib.mjs';

const repository = process.argv.find(arg => arg.startsWith('--repo='))?.slice(7) || config.issueSource;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('无效的仓库名，应为 owner/repository');
const directory = path.join(root, 'content/posts');
await fs.mkdir(directory, { recursive: true });
const existing = new Set(await Promise.all((await filesIn(directory)).map(async file => readFrontmatter(await fs.readFile(file, 'utf8'), file).data.source)));
const issues = [];
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=all&per_page=100&page=${page}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'markdown-blog-importer', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}；检查仓库名或 GITHUB_TOKEN。已保存文章不会被覆盖。`);
  const batch = await response.json();
  issues.push(...batch.filter(issue => !issue.pull_request));
  if (batch.length < 100) break;
}
let imported = 0;
for (const issue of issues) {
  if (existing.has(issue.html_url)) continue;
  const filename = `${issue.created_at.slice(0, 10)}-issue-${issue.number}.md`;
  // Exclusive creation also protects manually written articles with the same filename.
  await fs.writeFile(path.join(directory, filename), issueToMarkdown(issue, repository), { flag: 'wx' });
  imported++;
}
const backup = path.join(root, 'content/imports');
await fs.mkdir(backup, { recursive: true });
const snapshot = { repository, fetchedAt: new Date().toISOString(), issues: issues.map(({ number, title, body, labels, created_at, updated_at, html_url, state }) => ({ number, title, body, labels: labels.map(({ name, color }) => ({ name, color })), created_at, updated_at, html_url, state })) };
await fs.writeFile(path.join(backup, `${repository.replace('/', '-')}.json`), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`读取 ${issues.length} 篇 Issues，新增 ${imported} 篇，保留已有 ${issues.length - imported} 篇。原始正文、标签和日期已备份。`);
