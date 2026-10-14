import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { customerPersonalExpiresAt, customerPhoneWithinSevenDays, customerPhoneRetentionExpiresAt } from '../functions/quote-retention.js';
const source = readFileSync(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
const day = 86400000;
const now = Date.now();
const iso = (days) => new Date(now + days * day).toISOString();
function setup(functionName, nextName, extra = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE customer_quotes (id TEXT PRIMARY KEY, created_at TEXT, selected_bid_id TEXT DEFAULT '', selected_at TEXT DEFAULT '', contact_released_bid_ids TEXT DEFAULT '[]', contact_release_scope TEXT, status TEXT, quote_expires_at TEXT, rank_notice_queued_at TEXT);
    CREATE TABLE bids (id TEXT PRIMARY KEY, quote_id TEXT);
    CREATE TABLE reviews (bid_id TEXT);
    CREATE TABLE anonymous_consultations (quote_id TEXT, status TEXT, selected_at TEXT, updated_at TEXT);`);
  db.prepare("INSERT INTO customer_quotes (id, created_at) VALUES ('q', ?)").run(iso(-20));
  db.exec("INSERT INTO bids VALUES ('old', 'q'), ('new', 'q'); INSERT INTO reviews VALUES ('old');");
  const DB = { prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; },
    async first() { return db.prepare(sql).get(...args); },
    async run() { return { meta: { changes: db.prepare(sql).run(...args).changes } }; },
  }; }, async batch(statements) {
    db.exec('BEGIN'); try { for (const statement of statements) await statement.run(); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
  const context = vm.createContext({
    json: (body, status = 200) => ({ body, status }),
    normalizeCustomerQuote: (row) => row, getQuoteImages: async () => [],
    getQuoteBids: async () => db.prepare("SELECT * FROM bids WHERE quote_id = 'q'").all(),
    ...extra,
  });
  const start = source.indexOf(`async function ${functionName}(`);
  assert.ok(start >= 0);
  vm.runInContext(source.slice(start, source.indexOf(`async function ${nextName}(`, start)), context);
  return { db, env: { DB }, invoke: context[functionName], row: () => db.prepare("SELECT * FROM customer_quotes WHERE id = 'q'").get() };
}
test('deleting the selected bid revokes access but preserves the original deadline', async () => {
  for (const selectedAt of [iso(-6), '', iso(-8)]) {
    const t = setup('deleteManagerBid', 'updateCustomerQuote');
    try {
      t.db.prepare("UPDATE customer_quotes SET selected_bid_id = 'old', selected_at = ?, contact_released_bid_ids = '[\"old\",\"new\"]'").run(selectedAt);
      const before = customerPhoneRetentionExpiresAt(t.row());
      assert.equal((await t.invoke(t.env, 'old')).status, 200);
      assert.equal(t.row().selected_bid_id, '');
      assert.equal(t.row().selected_at, selectedAt || iso(-20));
      assert.equal(customerPhoneRetentionExpiresAt(t.row()), before);
      assert.equal(customerPhoneWithinSevenDays(t.row(), now), false);
      assert.deepEqual(JSON.parse(t.row().contact_released_bid_ids), ['new']);
      assert.equal(t.db.prepare("SELECT COUNT(*) n FROM reviews").get().n, 0);
      assert.equal((await t.invoke(t.env, 'old')).status, 404);
    } finally { t.db.close(); }
  }
});
test('deleting an unselected bid leaves selection and privacy clock intact', async () => {
  const t = setup('deleteManagerBid', 'updateCustomerQuote');
  try {
    t.db.prepare("UPDATE customer_quotes SET selected_bid_id = 'new', selected_at = ?, contact_released_bid_ids = '[\"old\",\"new\"]'").run(iso(-2));
    assert.equal((await t.invoke(t.env, 'old')).status, 200);
    assert.equal(t.row().selected_bid_id, 'new');
    assert.equal(t.row().selected_at, iso(-2));
    assert.deepEqual(JSON.parse(t.row().contact_released_bid_ids), ['new']);
  } finally { t.db.close(); }
});
