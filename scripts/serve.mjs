import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, base } from './lib.mjs';

const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const output = path.join(root, 'dist');
const port = Number(process.env.PORT || 4321);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/' && base !== '/') { res.writeHead(302, { Location: base }); res.end(); return; }
    if (!pathname.startsWith(base)) { res.writeHead(404); res.end('Not found'); return; }
    pathname = pathname.slice(base.length);
    let filename = path.resolve(output, pathname || 'index.html');
    if (!filename.startsWith(output + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      const stat = await fs.stat(filename);
      if (stat.isDirectory()) {
        if (!req.url.split('?')[0].endsWith('/')) { res.writeHead(302, { Location: new URL(req.url, 'http://localhost').pathname + '/' }); res.end(); return; }
        filename = path.join(filename, 'index.html');
      }
      const bytes = await fs.readFile(filename);
      res.writeHead(200, { 'Content-Type': `${types[path.extname(filename)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' }); res.end(bytes);
    } catch { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(await fs.readFile(path.join(output, '404.html'))); }
  } catch { res.writeHead(400); res.end('Bad request'); }
});
server.listen(port, '127.0.0.1', () => console.log(`预览地址：http://localhost:${port}${base}\n修改后运行 npm run build，刷新页面即可。`));
