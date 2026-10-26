import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const release = JSON.parse(read('admin-release.json')).version;

test('all admin documents load the current history guard and no retired theme', () => {
  for (const file of ['index.html','admin.html', ...['customers','sellers','approved-sellers','seller-access','brand-hall','alimtalk','anonymous-chat','anonymous-consultation','subscription-products','lead-customers'].map(route => `${route}/index.html`)]) {
    const html = read(file);
    assert.ok(html.includes(`/admin-release.js?v=${release}`), file);
    assert.doesNotMatch(html, /admin-(?:console|enterprise|enterprise-v6|system)\.css/);
  }
  const build = read('tools/build-admin-assets.mjs');
  for (const file of ['admin-console.css','admin-enterprise.css','admin-enterprise-v6.css','admin-system.css']) {
    assert.ok(!existsSync(new URL(`../${file}`, import.meta.url)));
    assert.ok(!build.includes(`"${file}"`));
  }
  assert.match(read('admin-workspace.js'), /addEventListener\('pageshow', \(\) => \{\s+setOpen\(false, false\);\s+decorate\(\)/);
  assert.doesNotMatch(read('lead-workspace.css'), /lead-admin-nav|lead-admin-body/);
});

function harness(fetchImpl) {
  let show, reloads = 0;
  vm.runInNewContext(read('admin-release.js'), {
    window: { addEventListener: (name, handler) => { if (name === 'pageshow') show = handler; } },
    fetch: fetchImpl, AbortSignal, location: { reload: () => reloads++ },
  });
  return { show: event => show(event), reloads: () => reloads };
}

test('history restoration reloads only when the server release differs', async () => {
  let calls = 0;
  const h = harness(async (url, options) => {
    calls++;
    assert.equal(url, '/admin-release.json');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ version: calls === 1 ? release : 'new-release' }) };
  });
  await h.show({ persisted: false });
  assert.equal(calls, 0);
  await h.show({ persisted: true });
  assert.equal(h.reloads(), 0);
  await h.show({ persisted: true });
  assert.equal(h.reloads(), 1);
});

test('offline history restore remains usable and does not loop reloads', async () => {
  const h = harness(async () => { throw new Error('offline'); });
  await h.show({ persisted: true });
  await h.show({ persisted: true });
  assert.equal(h.reloads(), 0);
});
