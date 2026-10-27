import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
test('customer DB management is reachable from every admin menu and the dashboard', () => {
  for (const file of ['index.html', 'admin.html', ...['customers','sellers','approved-sellers','seller-access','brand-hall','alimtalk','anonymous-chat','anonymous-consultation','subscription-products','lead-customers'].map(route => `${route}/index.html`)]) {
    const html = read(file);
    assert.match(html, /href="\/lead-customers"[^>]*>고객DB 관리<\/a>/, file);
    assert.equal((html.match(/href="\/lead-customers"/g) || []).length, 1, file);
  }
  assert.match(read('admin.js'), /class="ops-link" href="\/lead-customers">고객DB 관리/);
  assert.match(read('lead-customers/index.html'), /고객DB 관리 \| 픽견적 관리자/);
  assert.match(read('lead-workspace.js'), /admin \? '고객DB 관리'/);
});
