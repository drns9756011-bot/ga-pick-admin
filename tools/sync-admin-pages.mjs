import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const version = '20261007-workbench';
const source = await readFile(new URL('index.html', root), 'utf8');
const template = source.replace(/\s*<p class="eyebrow">[^<]*<\/p>/g, '');
await writeFile(new URL('index.html', root), template);
const sidebar = template.match(/<aside class="sidebar">[\s\S]*?<\/aside>/)?.[0];
if (!sidebar) throw new Error('Shared administrator navigation is missing');
const shared = ['admin.html', 'customers/index.html', 'sellers/index.html', 'approved-sellers/index.html', 'seller-access/index.html', 'brand-hall/index.html', 'alimtalk/index.html'];
for (const path of shared) await writeFile(new URL(path, root), template);

const tools = ['anonymous-chat/index.html', 'anonymous-consultation/index.html', 'subscription-products/index.html'];
for (const path of tools) {
  let html = await readFile(new URL(path, root), 'utf8');
  const matches = html.match(/<aside class="sidebar">[\s\S]*?<\/aside>/g) || [];
  if (matches.length !== 1) throw new Error(`Expected one sidebar in ${path}`);
  const activePath = `/${path.split('/')[0]}`;
  const toolSidebar = sidebar.replace(/ class="is-active" aria-current="page"/g, '').replace(`href="${activePath}"`, `href="${activePath}" class="is-active" aria-current="page"`);
  html = html.replace(matches[0], toolSidebar)
    .replace(/\s*<p class="eyebrow">[^<]*<\/p>/g, '')
    .replace(/\/admin-workspace\.(css|js)\?v=[^"\s]+/g, `/admin-workspace.$1?v=${version}`);
  if (!html.includes('/vendor/admin-icon-nodes.js')) html = html.replace('<script defer src="/admin-workspace.js', `<script defer src="/vendor/admin-icon-nodes.js?v=${version}"></script>\n<script defer src="/admin-workspace.js`);
  if (!html.includes('rel="preload"')) html = html.replace('</head>', '<link rel="preload" href="/assets/suit-variable.woff2" as="font" type="font/woff2" crossorigin />\n</head>');
  await writeFile(new URL(path, root), html);
}
