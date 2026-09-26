import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, config, base, renderMarkdown, readFrontmatter, validatePost, loadPosts, issueToMarkdown, tagSlug } from '../scripts/lib.mjs';

test('restored issues preserve original text, timestamps and labels', async () => {
  const backup = JSON.parse(await fs.readFile(path.join(root, 'content/imports/Daniel011011-CDN.json'), 'utf8'));
  assert.equal(backup.issues.length, 17);
  // Check the conversion against the immutable source snapshot, without constraining future edits to articles.
  for (const issue of backup.issues) {
    const { data, body } = readFrontmatter(issueToMarkdown(issue, backup.repository));
    assert.equal(body.trim(), (issue.body || '').trim());
    assert.equal(data.title, issue.title);
    assert.equal(data.date, issue.created_at);
    assert.equal(data.updated, issue.updated_at);
    assert.deepEqual(data.tags, issue.labels.map(label => label.name));
  }
});

test('Markdown renders images and code but removes active HTML and dangerous URLs', () => {
  const { html } = renderMarkdown('# Hello\n\n<script>alert(1)</script>\n\n<img src="/images/test.png" onerror="alert(1)">\n\n<a href="javascript:alert(1)">bad</a>\n\n```js\nconst a = 1;\n```');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('onerror'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes(`${base}images/test.png`));
  assert.ok(html.includes('hljs-'));
  assert.ok(html.includes('id="section-1"'));
});

test('invalid metadata and unsafe slugs fail clearly', () => {
  const good = { title: '文章', date: '2026-09-20', tags: ['中文', '中文'] };
  assert.deepEqual(validatePost(good, 'a.md').tags, ['中文']);
  assert.throws(() => validatePost({ ...good, date: 'bad' }, 'a.md'), /date/);
  assert.throws(() => validatePost({ ...good, updated: '2020-01-01' }, 'a.md'), /updated/);
  assert.throws(() => validatePost({ ...good, tags: '思考' }, 'a.md'), /tags/);
  assert.throws(() => validatePost({ ...good, draft: 'false' }, 'a.md'), /draft/);
  assert.throws(() => validatePost({ ...good, slug: '../escape' }, 'a.md'), /slug/);
  assert.throws(() => readFrontmatter('no metadata'), /front matter/);
});

test('drafts are excluded, duplicate URLs rejected, nested Markdown links resolved', async () => {
  const parent = path.join(root, '.preview');
  await fs.mkdir(parent, { recursive: true });
  const directory = await fs.mkdtemp(path.join(parent, 'test-'));
  const post = (title, extra = '', body = 'body') => `---\ntitle: ${title}\ndate: "2026-09-20"\n${extra}---\n${body}`;
  try {
    await fs.mkdir(path.join(directory, 'nested'));
    await fs.writeFile(path.join(directory, 'a.md'), post('Published'));
    await fs.writeFile(path.join(directory, 'draft.md'), post('Draft', 'draft: true\n'));
    await fs.writeFile(path.join(directory, 'nested/b.md'), post('Nested', '', '[other](../a.md)'));
    const posts = await loadPosts(directory);
    assert.equal(posts.length, 2);
    assert.ok(posts.find(p => p.slug === 'b').html.includes(`${base}posts/a/`));
    await fs.writeFile(path.join(directory, 'duplicate.md'), post('Duplicate', 'slug: a\n'));
    await assert.rejects(loadPosts(directory), /重复/);
  } finally {
    assert.equal(path.dirname(directory), parent);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('legacy RSS and article links point at the restored blog', () => {
  const { html } = renderMarkdown('[rss](https://daniel011011-cdn.gitblog.xyz/feed)\n\n[article](https://daniel011011-cdn.gitblog.xyz/posts/9)', { issueLinks: new Map([['9', 'my-post']]) });
  assert.ok(html.includes(`${base}rss.xml`));
  assert.ok(html.includes(`${base}posts/my-post/`));
  assert.ok(!html.includes('gitblog.xyz'));
});

test('static build includes all articles, RSS, tags and valid internal page/assets links', async () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const posts = await loadPosts();
  const dist = path.join(root, 'dist');
  const home = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  assert.equal((home.match(/class="post-card"/g) || []).length, Math.min(config.recentCount, posts.length));
  const feed = await fs.readFile(path.join(dist, 'rss.xml'), 'utf8');
  assert.equal((feed.match(/<item>/g) || []).length, posts.length);
  assert.ok(feed.includes('<content:encoded>'));
  assert.ok(!/src="\/images/.test(feed));
  const tags = [...new Set(posts.flatMap(post => post.tags))];
  for (const tag of tags) await fs.access(path.join(dist, 'tags', tagSlug(tag), 'index.html'));
  const walk = async directory => (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
  for (const file of (await walk(dist)).filter(file => file.endsWith('.html'))) {
    const html = await fs.readFile(file, 'utf8');
    for (const [, reference] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (!reference.startsWith(base) || reference.startsWith('//')) continue;
      const target = decodeURIComponent(reference.split('#')[0].split('?')[0].slice(base.length));
      await assert.doesNotReject(fs.access(path.join(dist, target, target.endsWith('/') || !target ? 'index.html' : '')), `${file}: ${reference}`);
    }
  }
});
