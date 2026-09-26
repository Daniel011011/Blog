import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { root, loadPosts } from '../scripts/lib.mjs';
import { createPostDateResolver } from '../scripts/post-dates.mjs';

const exec = promisify(execFile);

async function fixture(t) {
  const parent = path.join(root, '.preview');
  await fs.mkdir(parent, { recursive: true });
  const directory = await fs.mkdtemp(path.join(parent, 'dates-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await fs.rm(directory, { recursive: true, force: true });
  });
  const git = (args, env = {}) => exec('git', [
    '-c', 'user.name=Blog Tests', '-c', 'user.email=tests@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=.git/no-hooks',
    '-c', 'core.autocrlf=false', ...args,
  ], { cwd: directory, encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env } });
  await git(['init', '--quiet', '--template=']);
  const commit = async date => {
    await git(['add', '--all']);
    await git(['commit', '--quiet', '-m', 'Test content change'], {
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z', GIT_COMMITTER_DATE: date,
    });
  };
  return { directory, git, commit };
}

test('article dates follow content commits, preserving imports and ignoring rebuilds and renames', async t => {
  const { directory, git, commit } = await fixture(t);
  const postsDir = path.join(directory, 'content/posts');
  await fs.mkdir(postsDir, { recursive: true });
  // Brackets and Chinese characters exercise literal Git paths, not pathspec patterns.
  const original = path.join(postsDir, '旧文章 [1].md');
  const published = '2020-02-01T08:00:00+08:00';
  const historical = '2021-03-01T08:00:00+08:00';
  const source = `---\ntitle: 旧文章\nslug: old-post\ndate: "${published}"\nupdated: "${historical}"\n---\n` + '原来的文章内容。\n'.repeat(100);
  await fs.writeFile(original, source);
  await fs.writeFile(path.join(postsDir, 'new.md'), '---\ntitle: 新文章\ndate: "2026-01-01"\n---\n新内容。\n');
  await commit('2026-01-10T00:00:00Z');
  let posts = await loadPosts(postsDir);
  assert.equal(posts.find(p => p.slug === 'old-post').updated, historical);
  assert.equal(posts.find(p => p.slug === 'new').updated, undefined);

  await fs.writeFile(path.join(directory, 'README.md'), 'Only the site documentation changed.');
  await commit('2026-01-11T00:00:00Z');
  await fs.utimes(original, new Date(), new Date());
  assert.equal((await loadPosts(postsDir)).find(p => p.slug === 'old-post').updated, historical);

  // Uncommitted edits do not pretend that a new version has already been published.
  await fs.appendFile(original, '\n新增一段。\n');
  assert.equal((await loadPosts(postsDir)).find(p => p.slug === 'old-post').updated, historical);
  await fs.appendFile(path.join(postsDir, 'new.md'), '\n更新新文章。\n');
  await commit('2026-02-10T00:00:00Z');
  posts = await loadPosts(postsDir);
  assert.equal(Date.parse(posts.find(p => p.slug === 'old-post').updated), Date.parse('2026-02-10T00:00:00Z'));
  assert.equal(posts.find(p => p.slug === 'old-post').date, published);
  assert.equal(Date.parse(posts.find(p => p.slug === 'new').updated), Date.parse('2026-02-10T00:00:00Z'));

  const renamed = path.join(postsDir, '改名后的文章.md');
  await git(['mv', original, renamed]);
  await commit('2026-03-10T00:00:00Z');
  assert.equal(Date.parse((await loadPosts(postsDir)).find(p => p.slug === 'old-post').updated), Date.parse('2026-02-10T00:00:00Z'));
  const moved = path.join(postsDir, '再次改名.md');
  await git(['mv', renamed, moved]);
  await fs.appendFile(moved, '\n改名的同时修改正文。\n');
  await commit('2026-04-10T00:00:00Z');
  assert.equal(Date.parse((await loadPosts(postsDir)).find(p => p.slug === 'old-post').updated), Date.parse('2026-04-10T00:00:00Z'));
  assert.equal(await fs.readFile(moved, 'utf8'), source + '\n新增一段。\n\n改名的同时修改正文。\n');

  const resolve = await createPostDateResolver(postsDir);
  const manual = { date: published, updated: '2026-05-01T00:00:00Z' };
  assert.deepEqual(await resolve(manual, moved), manual);
  const future = { date: '2027-01-01T00:00:00Z' };
  assert.deepEqual(await resolve(future, moved), future);
});

test('new untracked files keep their metadata and shallow checkouts fail clearly', async t => {
  const { directory, git, commit } = await fixture(t);
  const file = path.join(directory, 'post.md');
  const post = { date: '2026-01-01T00:00:00Z' };
  await fs.writeFile(file, 'New post');
  const resolve = await createPostDateResolver(directory);
  assert.deepEqual(await resolve(post, file), post);
  await commit('2026-01-01T00:00:00Z');
  const shallow = path.join(directory, 'shallow');
  await git(['clone', '--quiet', '--depth=1', pathToFileURL(directory).href, shallow]);
  await assert.rejects(createPostDateResolver(shallow), /完整 Git 历史/);
});
