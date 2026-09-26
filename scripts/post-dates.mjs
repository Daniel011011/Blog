import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

// Use committed content changes, never checkout times or the current build time.
export async function createPostDateResolver(directory) {
  let repository;
  const git = (...args) => exec('git', args, {
    cwd: repository || directory, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' },
  });
  try {
    repository = (await git('rev-parse', '--show-toplevel')).stdout.trim();
  } catch (error) {
    // Exported ZIPs and machines without Git can still use the saved metadata.
    if (error.code === 'ENOENT' || /not a git repository/i.test(error.stderr || '')) return async post => post;
    throw error;
  }
  if ((await git('rev-parse', '--is-shallow-repository')).stdout.trim() === 'true') {
    throw new Error('自动更新时间需要完整 Git 历史，请运行 git fetch --unshallow（Actions 使用 fetch-depth: 0）。');
  }
  try {
    await git('rev-parse', '--verify', '--quiet', 'HEAD');
  } catch (error) {
    if (error.code === 1) return async post => post; // Newly initialized repository.
    throw error;
  }
  return async (post, file) => {
    const relative = path.relative(repository, file).replaceAll('\\', '/');
    const { stdout } = await git('log', '--follow', '--format=%x1e%cI', '--numstat', '--no-ext-diff', '--no-textconv', '--', relative);
    const changes = stdout.split('\x1e').filter(record => {
      // A pure move/rename has zero changed lines and should not look like an edit.
      return record.split('\n').some(line => {
        const stat = line.match(/^(\d+)\t(\d+)\t/);
        return stat && Number(stat[1]) + Number(stat[2]) > 0;
      });
    });
    // The initial import is not an update: keep historical Issue dates intact.
    if (changes.length < 2) return post;
    const modified = changes[0].trim().split('\n')[0];
    if (!Number.isFinite(Date.parse(modified))) throw new Error(`${relative}: 无法读取 Git 修改日期`);
    const previous = post.updated || post.date;
    return Date.parse(modified) > Date.parse(previous) ? { ...post, updated: modified } : post;
  };
}
