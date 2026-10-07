import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('all shared admin routes use the same source and current assets', () => {
  const source = read('index.html');
  for (const route of ['admin.html', 'customers', 'sellers', 'approved-sellers', 'seller-access', 'brand-hall', 'alimtalk']) {
    assert.equal(read(route.endsWith('.html') ? route : `${route}/index.html`), source);
  }
  assert.match(source, /admin-workspace\.css\?v=20261007-workbench/);
  assert.doesNotMatch(source, /class="eyebrow"|dashboard-link-card/);
});
test('standalone tools share the navigation, font and icon assets', () => {
  for (const route of ['anonymous-chat', 'anonymous-consultation', 'subscription-products']) {
    const html = read(`${route}/index.html`);
    assert.match(html, /suit-variable\.woff2/);
    assert.match(html, /admin-icon-nodes\.js/);
    assert.match(html, /\/brand-hall/);
    assert.match(html, /admin-workspace\.js\?v=20261007-workbench/);
  }
});
test('workspace uses local typography and constrained mobile navigation', () => {
  const css = read('admin-workspace.css');
  const js = read('admin-workspace.js');
  assert.doesNotMatch(css, /@import|https:\/\//);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(js, /sidebar\.inert = mobile\.matches && !opened/);
  assert.match(js, /main\.inert = opened/);
  assert.match(js, /event\.key === 'Escape'/);
});
test('dashboard has record-driven queues without customer phone output', () => {
  const js = read('admin.js');
  const queue = js.slice(js.indexOf('function renderDashboardWorkQueue()'), js.indexOf('function summarizeCustomerQuotes('));
  assert.match(queue, /recentQuotes\.map/);
  assert.match(queue, /pending\.map/);
  assert.doesNotMatch(queue, /quote\.phone|row\.phone|targetPhone/);
  assert.match(js, /else void ensureAdminScope\(\)/);
});
test('only the selected Lucide icon nodes are shipped', () => {
  const icons = read('vendor/admin-icon-nodes.js');
  assert.ok(icons.length < 10000);
  assert.match(icons, /"Menu":\[\["line"/);
});
test('chat room switches abort stale requests and keep blocked content masked', () => {
  const js = read('anonymous-chat/chat-admin.js');
  assert.match(js, /roomController\?\.abort\(\)/);
  assert.match(js, /selectedId !== id/);
  assert.match(js, /esc\(Number\(message\.blocked\)/);
  assert.match(js, /'X-Admin-Token': token/);
  assert.doesNotMatch(js, /window\.prompt|[?&]token=/);
});
