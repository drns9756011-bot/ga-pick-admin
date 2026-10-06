import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { onRequest } from "../functions/api/[[path]].js";

const source = readFileSync(new URL("../admin.js", import.meta.url), "utf8");
const start = source.indexOf("let applicationCardObjectUrl =");
const end = source.indexOf("function renderApplicationDetail(", start);
const requests = [];
const TestURL = class extends URL {};
TestURL.createObjectURL = () => "blob:admin-card";
TestURL.revokeObjectURL = () => {};
const context = vm.createContext({
  URL: TestURL,
  Blob,
  window: { location: { origin: "https://admin.example" } },
  document: { createElement: (tagName) => ({ tagName }) },
  readAdminApiToken: () => "admin-test-token",
  sellerName: () => "테스트 판매자",
  fetch: async (path, options) => {
    requests.push({ path, options });
    return { ok: true, blob: async () => new Blob(["image"], { type: "image/png" }) };
  },
});
vm.runInContext(source.slice(start, end), context);

test("admin card preview fetches its R2 key with the admin token", async () => {
  const preview = { isConnected: true, replaceChildren(child) { this.child = child; } };
  const application = {
    cardImage: "/api/files/seller-cards/seller-1.png",
    cardImageKey: "seller-cards/seller-1.png",
  };
  assert.equal(context.sellerCardObjectKey(application), "seller-cards/seller-1.png");
  await context.loadApplicationCard(application, preview, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/api/files/seller-cards/seller-1.png");
  assert.equal(requests[0].options.headers["X-Admin-Token"], "admin-test-token");
  assert.equal(preview.child.src, "blob:admin-card");
});

test("external card URL never receives the admin token", async () => {
  const preview = { isConnected: true, replaceChildren(child) { this.child = child; } };
  await context.loadApplicationCard({ cardImage: "https://elsewhere.example/api/files/seller-cards/seller-2.png" }, preview, 0);
  assert.equal(requests.at(-1).path, "/api/files/seller-cards/seller-2.png");
  assert.equal(requests.at(-1).options.headers["X-Admin-Token"], "admin-test-token");
  assert.equal(preview.child.src, "blob:admin-card");
});

test("admin image route requires a token and returns the stored image", async () => {
  const env = {
    ADMIN_API_TOKEN: "admin-test-token",
    DB: {},
    FILES: { async get(key) {
      assert.equal(key, "seller-cards/seller-1.png");
      return { body: new Blob(["image"], { type: "image/png" }).stream(), httpMetadata: { contentType: "image/png" } };
    } },
  };
  const path = ["files", "seller-cards", "seller-1.png"];
  const unauthorized = await onRequest({ request: new Request("https://admin.example/api/files/seller-cards/seller-1.png"), env, params: { path } });
  assert.equal(unauthorized.status, 401);
  const authorized = await onRequest({ request: new Request("https://admin.example/api/files/seller-cards/seller-1.png", { headers: { "X-Admin-Token": "admin-test-token" } }), env, params: { path } });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.headers.get("Content-Type"), "image/png");
});
