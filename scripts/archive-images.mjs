import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, filesIn } from './lib.mjs';

const sourceFiles = await filesIn(path.join(root, 'content/posts'));
const sources = new Set();
for (const file of sourceFiles) {
  const body = await fs.readFile(file, 'utf8');
  for (const match of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g)) sources.add(match[1] || match[2]);
}
const directory = path.join(root, 'public/images/imported');
await fs.mkdir(directory, { recursive: true });
const manifestPath = path.join(root, 'content/imports/images.json');
let manifest = {};
try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let failed = 0;
for (const source of sources) {
  if (manifest[source]) continue;
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'Blog-Image-Archive' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type')?.split(';')[0];
    const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }[type];
    if (!extension) throw new Error(`不支持的图片类型：${type}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error('图片大于 20 MB');
    const filename = createHash('sha256').update(source).digest('hex').slice(0, 16) + extension;
    await fs.writeFile(path.join(directory, filename), bytes);
    manifest[source] = `images/imported/${filename}`;
    console.log(`已备份 ${filename} (${Math.round(bytes.length / 1024)} KB)`);
  } catch (error) { failed++; console.warn(`保留远程链接 ${source}：${error.message}`); }
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`图片备份 ${Object.keys(manifest).length} 张，失败 ${failed} 张。原文不改动，构建时替换图片地址。`);
if (failed) process.exitCode = 1;
