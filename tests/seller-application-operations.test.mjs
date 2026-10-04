import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/[[path]].js";

function makeEnv() {
  const applications = [
    { id: "rejected-1", status: "rejected", card_image_key: "card-1" },
    { id: "rejected-2", status: "rejected", card_image_key: "card-2" },
    { id: "pending-1", status: "pending", card_image_key: "card-3" },
    { id: "approved-1", status: "approved", card_image_key: "card-4" },
  ];
  const notices = [
    { id: "notice-1", related_id: "rejected-1" },
    { id: "notice-2", related_id: "pending-1" },
  ];
  const deletedImages = [];
  const message = { id: "talk-1", status: "accepted", solapi_group_id: "group-1", solapi_message_id: "message-1", created_at: "2026-10-04T00:00:00.000Z", sent_at: "" };
  const env = {
    ADMIN_API_TOKEN: "test-token",
    SOLAPI_API_KEY: "test-key",
    SOLAPI_API_SECRET: "test-secret",
    FILES: { async delete(key) { deletedImages.push(key); } },
    DB: {
      prepare(sql) {
        let params = [];
        return {
          bind(...values) { params = values; return this; },
          async all() {
            if (sql.includes("SELECT id, solapi_message_id, created_at, sent_at FROM alimtalk_queue")) {
              return { results: [message] };
            }
            if (sql.includes("SELECT id, card_image_key FROM seller_applications")) {
              return { results: applications.filter((row) => row.status === "rejected" && (!params.length || row.id === params[0])) };
            }
            return { results: [] };
          },
          async first() {
            if (sql.includes("SELECT * FROM alimtalk_queue WHERE id")) return params[0] === message.id ? message : null;
            return null;
          },
          async run() {
            if (sql.startsWith("UPDATE alimtalk_queue SET status")) {
              [message.status, message.sent_at, message.error_message, message.solapi_response_json] = params;
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("DELETE FROM alimtalk_queue")) {
              const ids = new Set(applications.filter((row) => row.status === "rejected" && (!params.length || row.id === params[0])).map((row) => row.id));
              const before = notices.length;
              for (let i = notices.length - 1; i >= 0; i -= 1) if (ids.has(notices[i].related_id)) notices.splice(i, 1);
              return { meta: { changes: before - notices.length } };
            }
            if (sql.startsWith("DELETE FROM seller_applications")) {
              const before = applications.length;
              for (let i = applications.length - 1; i >= 0; i -= 1) {
                if (applications[i].status === "rejected" && (!params.length || applications[i].id === params[0])) applications.splice(i, 1);
              }
              return { meta: { changes: before - applications.length } };
            }
            return { meta: { changes: 0 } };
          },
        };
      },
      async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
    },
  };
  return { env, applications, notices, deletedImages, message };
}

async function requestDelete(env, path) {
  return onRequest({
    request: new Request(`https://admin.example/api/${path}`, { method: "DELETE", headers: { "X-Admin-Token": "test-token" } }),
    env,
    params: { path: path.split("/") },
  });
}

test("single rejection deletion removes only that record and its related notice/image", async () => {
  const state = makeEnv();
  const response = await requestDelete(state.env, "seller-applications/rejected-1");
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.deletedCount, 1);
  assert.deepEqual(state.applications.map((row) => row.id), ["rejected-2", "pending-1", "approved-1"]);
  assert.deepEqual(state.notices.map((row) => row.id), ["notice-2"]);
  assert.deepEqual(state.deletedImages, ["card-1"]);
});

test("bulk deletion preserves pending and approved applications", async () => {
  const state = makeEnv();
  const response = await requestDelete(state.env, "seller-applications/rejected");
  const payload = await response.json();
  assert.equal(payload.deletedCount, 2);
  assert.deepEqual(state.applications.map((row) => row.id), ["pending-1", "approved-1"]);
  assert.deepEqual(state.deletedImages, ["card-1", "card-2"]);
});

test("unauthorized deletion is denied", async () => {
  const state = makeEnv();
  const response = await onRequest({
    request: new Request("https://admin.example/api/seller-applications/rejected", { method: "DELETE" }),
    env: state.env,
    params: { path: ["seller-applications", "rejected"] },
  });
  assert.equal(response.status, 401);
  assert.equal(state.applications.length, 4);
});

test("Solapi delivery result changes accepted to sent", async () => {
  const state = makeEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    messageList: { "message-1": { messageId: "message-1", statusCode: "4000", dateReceived: "2026-10-04T01:00:00.000Z" } },
  }), { status: 200 });
  try {
    const response = await onRequest({
      request: new Request("https://admin.example/api/alimtalk/talk-1/refresh", { method: "POST", headers: { "X-Admin-Token": "test-token" } }),
      env: state.env,
      params: { path: ["alimtalk", "talk-1", "refresh"] },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.row.status, "sent");
    assert.equal(payload.row.sentAt, "2026-10-04T01:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("batch reconciliation checks multiple message IDs in one Solapi request", async () => {
  const state = makeEnv();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    const target = new URL(url);
    assert.equal(target.pathname, "/messages/v4/list");
    assert.deepEqual(JSON.parse(target.searchParams.get("messageIds")), ["message-1"]);
    return new Response(JSON.stringify({ messageList: { "message-1": { messageId: "message-1", statusCode: "4000" } } }), { status: 200 });
  };
  try {
    const response = await onRequest({
      request: new Request("https://admin.example/api/alimtalk/refresh-batch", {
        method: "POST",
        headers: { "X-Admin-Token": "test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      }),
      env: state.env,
      params: { path: ["alimtalk", "refresh-batch"] },
    });
    const payload = await response.json();
    assert.equal(payload.updated, 1);
    assert.equal(calls, 1);
    assert.equal(state.message.status, "sent");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
