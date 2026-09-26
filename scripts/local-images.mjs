import fs from 'node:fs/promises';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const imageExtension = /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;
const external = value => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
const inside = (parent, file) => {
  const relative = path.relative(parent, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

// Parse embeds as Markdown tokens so examples in code blocks and inline code stay literal.
export function obsidianImages(markdown) {
  markdown.inline.ruler.before('image', 'obsidian-image', (state, silent) => {
    const start = state.pos;
    if (state.src.slice(start, start + 3) !== '![[') return false;
    const end = state.src.indexOf(']]', start + 3);
    if (end < 0) return false;
    const content = state.src.slice(start + 3, end);
    if (content.includes('\n')) return false;
    const [target, label = ''] = content.split('|');
    if (!imageExtension.test(target.split(/[?#]/)[0])) return false;
    if (!silent) {
      const token = state.push('image', 'img', 0);
      token.attrs = [['src', target.trim()], ['alt', '']];
      const dimensions = label.match(/^(\d+)(?:x(\d+))?$/);
      if (dimensions) {
        token.attrSet('width', dimensions[1]);
        if (dimensions[2]) token.attrSet('height', dimensions[2]);
      }
      const text = new state.Token('text', '', 0);
      text.content = dimensions ? path.posix.basename(target) : label || path.posix.basename(target);
      token.children = [text];
      token.content = text.content;
    }
    state.pos = end + 2;
    return true;
  });
}

export async function createImageAssets(repository, base = '/') {
  repository = await fs.realpath(repository);
  const files = new Map();
  const copies = new Map();
  const destinations = new Map();
  const scan = async directory => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      // Never follow symlinks or index Git metadata, dependencies, or generated output.
      if (entry.name.startsWith('.') || ['node_modules', 'dist'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (entry.isFile() && imageExtension.test(entry.name)) {
        files.set(path.relative(repository, file).replaceAll('\\', '/'), file);
      }
    }
  };
  await scan(repository);
  const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
  return {
    resolve(value, article) {
      if (!value || external(value)) return value;
      const fail = message => { throw new Error(`${path.relative(repository, article)}: ${message}「${value}」`); };
      const match = value.match(/^([^?#]*)([?#].*)?$/);
      let reference;
      try { reference = decodeURIComponent(match[1]); } catch { fail('图片路径编码无效：'); }
      const suffix = match[2] || '';
      if (!reference || reference.includes('\\') || reference.includes('\0') || !imageExtension.test(reference)) fail('不支持的本地图片路径：');
      const rooted = reference.startsWith('/');
      const explicitRelative = /^\.{1,2}\//.test(reference);
      const candidates = [];
      if (rooted) {
        const webPath = reference.startsWith(base) ? reference.slice(base.length) : reference.slice(1);
        candidates.push(path.resolve(repository, 'public', webPath), path.resolve(repository, reference.slice(1)));
      } else {
        candidates.push(path.resolve(path.dirname(article), reference));
        if (!explicitRelative) candidates.push(path.resolve(repository, reference), path.resolve(repository, 'public', reference));
      }
      if (candidates.some(file => !inside(repository, file))) fail('图片不能引用仓库外的文件：');
      let source = candidates.map(file => files.get(path.relative(repository, file).replaceAll('\\', '/'))).find(Boolean);
      if (!source && !rooted && !explicitRelative) {
        const matches = [...files].filter(([name]) => name === reference || name.endsWith('/' + reference));
        if (matches.length > 1) fail('存在多个同名图片，请填写从仓库根目录开始的完整路径：');
        source = matches[0]?.[1];
      }
      if (!source) fail('找不到本地图片，请确认图片文件已一同提交：');
      if (!inside(repository, realpathSync(source))) fail('图片不能引用仓库外的文件：');
      if (!destinations.has(source)) {
        const relative = path.relative(repository, source).replaceAll('\\', '/');
        if (relative.startsWith('public/')) destinations.set(source, relative.slice(7));
        else {
          const bytes = readFileSync(source);
          const digest = createHash('sha256').update(bytes).digest('hex');
          const destination = `assets/linked-images/${digest}${path.extname(source).toLowerCase()}`;
          copies.set(destination, bytes);
          destinations.set(source, destination);
        }
      }
      return base + encodePath(destinations.get(source)) + suffix;
    },
    async copyTo(output) {
      for (const [destination, bytes] of copies) {
        const target = path.join(output, destination);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, bytes);
      }
    },
  };
}
