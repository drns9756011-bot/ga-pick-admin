import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../deploy-assets/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = resolve(root, `.${path}`);
  if (target !== resolve(root) && !target.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
  try {
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch { response.writeHead(404).end('Not found'); }
}).listen(8766, '127.0.0.1', () => console.log('Administrator preview: http://127.0.0.1:8766'));
