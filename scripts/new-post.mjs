import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { root } from './lib.mjs';

const [slug, title] = process.argv.slice(2);
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug) || !title) throw new Error('用法：npm run new -- my-post "文章标题"（slug 使用英文、数字和连字符）');
const now = new Date().toISOString();
const filename = `${now.slice(0, 10)}-${slug}.md`;
await fs.mkdir(path.join(root, 'content/posts'), { recursive: true });
await fs.writeFile(path.join(root, 'content/posts', filename), `---\n${stringify({ title, date: now, updated: now, tags: [], draft: true })}---\n\n从这里开始写作。\n`, { flag: 'wx' });
console.log(`已创建 content/posts/${filename}。发布前把 draft 改为 false。`);
