import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/[[path]].js";
import { protectCustomerPhone } from "../functions/phone-vault.js";

globalThis.crypto ||= webcrypto;

function d1(db) {
  return {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() { return db.prepare(sql).get(...params) || null; },
        async all() { return { results: db.prepare(sql).all(...params) }; },
        async run() { const result = db.prepare(sql).run(...params); return { meta: { changes: result.changes } }; },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
}

async function call(env, path, method = "GET", headers = {}) {
  const response = await onRequest({
    env,
    request: new Request(`https://admin.example/api/${path}`, { method, headers }),
    params: { path: path.split("/") },
  });
  return { status: response.status, body: await response.json() };
}

test("admin list is masked and reveal needs fresh token before day seven", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const env = { DB: d1(db), ADMIN_API_TOKEN: "admin-test-token", CUSTOMER_PHONE_KEY: Buffer.alloc(32, 17).toString("base64") };
  const { hash, ciphertext } = await protectCustomerPhone(env, "01012345678");
  db.prepare(`INSERT INTO customer_quotes
    (id, quote_number, customer, phone, phone_hash, phone_ciphertext, items, created_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?)`).run("q1", "Q-1", "고객", hash, ciphertext, "TV", new Date().toISOString());
  assert.equal((await call(env, "customer-quotes")).status, 401);
  const list = await call(env, "customer-quotes", "GET", { "X-Admin-Token": env.ADMIN_API_TOKEN });
  assert.equal(list.status, 200);
  assert.equal(list.body.rows[0].phone, "***-****-****");
  assert.equal((await call(env, "customer-quotes/q1/phone", "POST", { "X-Admin-Token": env.ADMIN_API_TOKEN })).status, 403);
  const revealed = await call(env, "customer-quotes/q1/phone", "POST", {
    "X-Admin-Token": env.ADMIN_API_TOKEN, "X-Admin-Reauth": env.ADMIN_API_TOKEN,
  });
  assert.equal(revealed.body.phone, "01012345678");
  db.prepare("UPDATE customer_quotes SET created_at = ? WHERE id = 'q1'")
    .run(new Date(Date.now() - 8 * 86400000).toISOString());
  assert.equal((await call(env, "customer-quotes/q1/phone", "POST", {
    "X-Admin-Token": env.ADMIN_API_TOKEN, "X-Admin-Reauth": env.ADMIN_API_TOKEN,
  })).status, 410);
  db.close();
});
