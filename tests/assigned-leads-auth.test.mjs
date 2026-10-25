import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';
test('customer DB admin route rejects missing/wrong token before touching DB', async () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    for (const token of ['', 'wrong']) {
      const response = await onRequest({ env: { DB: { prepare() { throw new Error('must not access DB'); } }, ADMIN_API_TOKEN: 'expected' }, params: { path: ['assigned-leads'] }, request: new Request('https://admin/api/assigned-leads', { method, headers: { 'X-Admin-Token': token } }) });
      assert.equal(response.status, 401);
    }
  }
});
