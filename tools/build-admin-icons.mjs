import { readFile, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const context = {};
runInNewContext(await readFile(new URL('./vendor/lucide.min.js', import.meta.url), 'utf8'), context);
const names = ['LayoutDashboard', 'Files', 'UserRoundPlus', 'UsersRound', 'History', 'Store', 'Package', 'Send', 'ShieldCheck', 'MessagesSquare', 'ExternalLink', 'KeyRound', 'RefreshCw', 'ChevronLeft', 'ChevronRight', 'Menu', 'X'];
const nodes = Object.fromEntries(names.map((name) => {
  const icon = context.lucide[name];
  if (!Array.isArray(icon)) throw new Error(`Missing Lucide icon: ${name}`);
  return [name, icon[2]];
}));
await writeFile(new URL('../vendor/admin-icon-nodes.js', import.meta.url), `/* Lucide 0.468.0, ISC license: lucide-LICENSE.txt */\nwindow.PickAdminIconNodes = ${JSON.stringify(nodes)};\n`);
