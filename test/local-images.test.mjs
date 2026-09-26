import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, renderMarkdown } from '../scripts/lib.mjs';
import { createImageAssets } from '../scripts/local-images.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=', 'base64');

async function fixture(t) {
  const parent = path.join(root, '.preview');
  await fs.mkdir(parent, { recursive: true });
  const directory = await fs.mkdtemp(path.join(parent, 'images-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await fs.rm(directory, { recursive: true, force: true });
  });
  const write = async (name, bytes = png) => {
    const file = path.join(directory, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return file;
  };
  return { directory, write };
}

test('Obsidian image embeds support dimensions and aliases without changing code examples', () => {
  const { html } = renderMarkdown('![[截图.png|300x200]]\n\n![[截图.png|图片说明]]\n\n`![[code.png]]`\n\n```md\n![[fenced.png]]\n```\n\n\\![[escaped.png]]\n\n![[note.md]]');
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.match(html, /width="300" height="200"/);
  assert.match(html, /alt="图片说明"/);
  assert.match(html, /!\[\[code.png\]\]/);
  assert.match(html, /!\[\[fenced.png\]\]/);
  assert.match(html, /!\[\[escaped.png\]\]/);
  assert.match(html, /!\[\[note.md\]\]/);
});

test('repository images resolve from note-relative, vault, shortest and public paths', async t => {
  const { directory, write } = await fixture(t);
  const article = await write('content/posts/nested/post.md', 'article');
  await write('content/attachments/中文 图片.png');
  await write('public/images/公开 图片.png');
  await write('根目录.png');
  const assets = await createImageAssets(directory, '/Blog/');
  const linked = assets.resolve('content/attachments/中文 图片.png', article);
  assert.match(linked, /^\/Blog\/assets\/linked-images\/[a-f0-9]{64}\.png$/);
  for (const reference of ['../../attachments/中文%20图片.png', '中文 图片.png', 'attachments/中文 图片.png', '/content/attachments/中文 图片.png']) {
    assert.equal(assets.resolve(reference, article), linked);
  }
  assert.equal(assets.resolve('根目录.png', article), linked, 'identical images are deduplicated');
  for (const reference of ['/images/公开%20图片.png', '/Blog/images/公开%20图片.png', 'public/images/公开 图片.png']) {
    assert.equal(assets.resolve(reference, article), '/Blog/images/' + encodeURIComponent('公开 图片.png'));
  }
  assert.equal(assets.resolve('中文 图片.png?version=1#view', article), linked + '?version=1#view');
  assert.equal(assets.resolve('https://example.com/image.png', article), 'https://example.com/image.png');
  assert.equal(assets.resolve('//example.com/image.png', article), '//example.com/image.png');
  const out = path.join(directory, 'dist');
  await assets.copyTo(out);
  assert.deepEqual(await fs.readFile(path.join(out, linked.slice('/Blog/'.length))), png);
  const rootAssets = await createImageAssets(directory, '/');
  assert.equal(rootAssets.resolve('/images/公开 图片.png', article), '/images/' + encodeURIComponent('公开 图片.png'));
});

test('missing, ambiguous and out-of-repository images fail with useful diagnostics', async t => {
  const { directory, write } = await fixture(t);
  const article = await write('content/posts/post.md', 'article');
  await write('one/same.png');
  await write('two/same.png', Buffer.from('different'));
  await write('.private/hidden.png');
  const assets = await createImageAssets(directory, '/Blog/');
  assert.throws(() => assets.resolve('same.png', article), /post.md.*多个同名图片.*same.png/);
  assert.throws(() => assets.resolve('missing.png', article), /post.md.*找不到.*missing.png/);
  assert.throws(() => assets.resolve('../../../outside.png', article), /仓库外/);
  assert.throws(() => assets.resolve('hidden.png', article), /找不到/);
  assert.throws(() => assets.resolve('%broken.png', article), /编码无效/);
  assert.notEqual(assets.resolve('one/same.png', article), assets.resolve('two/same.png', article));
  await write('content/posts/same.png');
  const refreshed = await createImageAssets(directory, '/Blog/');
  assert.equal(refreshed.resolve('same.png', article), refreshed.resolve('one/same.png', article), 'same-folder reference takes priority');
});

test('full build publishes referenced images for article HTML and RSS, excluding draft-only attachments', async t => {
  const { directory, write } = await fixture(t);
  await fs.cp(path.join(root, 'scripts'), path.join(directory, 'scripts'), { recursive: true });
  await fs.cp(path.join(root, 'public'), path.join(directory, 'public'), { recursive: true });
  await fs.copyFile(path.join(root, 'site.config.json'), path.join(directory, 'site.config.json'));
  await fs.symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await write('content/attachments/粘贴 图片.png');
  await write('content/posts/nested/inline.png');
  await write('unused.png', Buffer.from('not published'));
  await write('content/attachments/draft-only.png', Buffer.from('draft only'));
  await write('public/images/原图.png');
  const header = '---\ntitle: 图片测试\ndate: "2026-01-01"\n';
  await write('content/posts/nested/pictures.md', header + '---\n\n![[粘贴 图片.png|240]]\n\n![普通图片](../../attachments/粘贴%20图片.png)\n\n![同目录](./inline.png)\n\n<img src="/images/原图.png" onerror="alert(1)">\n\n`![[missing.png]]`\n');
  await write('content/posts/draft.md', header + 'draft: true\n---\n![[draft-only.png]]\n![[not-yet-pasted.png]]');
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = path.join(directory, 'dist');
  const html = await fs.readFile(path.join(output, 'posts/pictures/index.html'), 'utf8');
  const images = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(images.length, 4);
  assert.match(html, /width="240"/);
  assert.ok(!html.includes('onerror'));
  const rss = await fs.readFile(path.join(output, 'rss.xml'), 'utf8');
  for (const reference of images) {
    assert.ok(reference.startsWith('/Blog/'));
    assert.deepEqual(await fs.readFile(path.join(output, decodeURIComponent(reference.slice('/Blog/'.length)))), png);
    assert.ok(rss.includes('https://daniel011011.github.io' + reference));
  }
  assert.equal((await fs.readdir(path.join(output, 'assets/linked-images'))).length, 1);
  assert.ok(!rss.includes('draft-only'));
  assert.ok(!html.includes('content/attachments/'));
});
