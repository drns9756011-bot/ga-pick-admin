import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function alimtalkCheckDelay'), source.indexOf('document.addEventListener("visibilitychange", scheduleMessageStatusCheck)'));
function context() {
  const state = { page: 'alimtalk', token: 'test', rows: [{ status: 'sending' }], timers: [], calls: 0 };
  const sandbox = {
    Date, messageStatusTimer: 0, messageStatusCursor: '', messageStatusPaused: false, document: { hidden: false },
    getCurrentAdminPageKey: () => state.page, readAdminApiToken: () => state.token,
    getMessages: () => state.rows,
    syncPendingMessageStatuses: async () => { state.calls++; },
    window: { clearTimeout() { state.timers = []; }, setTimeout(fn, delay) { state.timers.push({ fn, delay }); return 1; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(functions, sandbox);
  return { state, sandbox };
}
test('30 seconds during daytime; sleeps until 09:00 across midnight', () => {
  const { sandbox } = context();
  for (const [iso, delay] of [
    ['2026-10-25T00:00:00Z', 30000],
    ['2026-10-25T10:59:00Z', 30000],
    ['2026-10-25T11:00:00Z', 13 * 3600000],
    ['2026-10-25T23:59:00Z', 60000],
  ]) assert.equal(sandbox.alimtalkCheckDelay(Date.parse(iso)), delay);
});
test('no timer for hidden pages, other routes, logged out or terminal statuses', () => {
  for (const mode of ['hidden', 'route', 'logout', 'sent']) {
    const { sandbox, state } = context();
    if (mode === 'hidden') sandbox.document.hidden = true;
    if (mode === 'route') state.page = 'customers';
    if (mode === 'logout') state.token = '';
    if (mode === 'sent') state.rows = [{ status: 'sent' }];
    sandbox.scheduleMessageStatusCheck();
    assert.equal(state.timers.length, 0);
  }
});
test('timer never overlaps and only requests status, not a page reload', async () => {
  const { sandbox, state } = context();
  sandbox.alimtalkCheckDelay = () => 30000;
  sandbox.scheduleMessageStatusCheck();
  sandbox.scheduleMessageStatusCheck();
  assert.equal(state.timers.length, 1);
  assert.equal(state.timers[0].delay, 30000);
  await state.timers[0].fn();
  assert.equal(state.calls, 1);
  assert.equal(state.timers.length, 1);
});
