const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token, X-Lplan-Sync-Token",
  "Cache-Control": "no-store",
};

const SOLAPI_DEFAULTS = {
  SOLAPI_CHANNEL_ID: "KA01PF260720091629575EzVmd2YRyU7",
  SOLAPI_FROM: "01066312323",
  SOLAPI_ADMIN_PHONE: "01066312323",
  SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED: "KA01TP260725102717135cJKdPONLQG6",
  SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED: "KA01TP260725102108064eaQr0cpVqwj",
  SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED: "KA01TP260725102553611B0oIQcJ0RCF",
  SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION: "KA01TP2607210300081256MK0cxuHata",
  SOLAPI_TEMPLATE_SELLER_BID_SELECTED: "KA01TP260725101805441M3apRU3OCMB",
  SOLAPI_TEMPLATE_SELLER_APPROVED: "KA01TP260725101616235ziVJkZImZ9O",
  SOLAPI_TEMPLATE_SELLER_REJECTED: "KA01TP260725102900428RYxfTGV9SoG",
  SOLAPI_TEMPLATE_SELLER_QUOTE_REGISTERED: "KA01TP260805074550965Bb2zfMAs16w",
};

const PUBLIC_API_VERSION = "20260811-seller-channel-brand-bid-v18";
const QUOTE_DURATION_HOURS = 72;
const QUOTE_DURATION_POLICY_KEY = "quote-duration-hours";
const NAVER_SHOPPING_CLIENT_ID_DEFAULT = "x1CsXB5ZCYULxcGnclGq";
const LPLAN_SYNC_TOKEN_DEFAULT = "pickquote-lplan-sync-v1";
const MASTER_SELLER_ID = "pickgj";
const MASTER_SELLER_PASSWORD = "qwer1234!!";
const MASTER_SELLER_PASSWORD_HASH =
  "pbkdf2$100000$67612d7069636b2d6d61737465722d73$23a61a5e679dd6475f9ddca3667166c9ea839ff7de5eed9de20a7e8964f4408c";

function solapiValue(env, key) {
  const bundledValue = String(SOLAPI_DEFAULTS[key] || "").trim();
  const runtimeValue = String(env?.[key] || "").trim();
  if (key.startsWith("SOLAPI_TEMPLATE_")) return bundledValue || runtimeValue;
  return runtimeValue || bundledValue;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}

async function apiBoundary(action, fallbackMessage = "서버 처리 중 오류가 발생했습니다.") {
  try {
    return await action();
  } catch (error) {
    return json(
      {
        ok: false,
        message: fallbackMessage,
        error: String(error?.message || error || ""),
      },
      500
    );
  }
}

function getAdminToken(env) {
  return String(env.ADMIN_API_TOKEN || "").trim();
}

function requireAdmin(request, env) {
  const expected = getAdminToken(env);
  if (!expected) return json({ ok: false, message: "ADMIN_API_TOKEN 설정이 필요합니다." }, 500);
  const actual = String(request.headers.get("X-Admin-Token") || "").trim();
  if (actual !== expected) return json({ ok: false, message: "관리자 인증이 필요합니다." }, 401);
  return null;
}

function hasValidAdminToken(request, env) {
  const expected = getAdminToken(env);
  const actual = String(request.headers.get("X-Admin-Token") || "").trim();
  return Boolean(expected && actual && actual === expected);
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function quoteDateKey() {
  return todayKey().replace(/-/g, "");
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown"
  );
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const clean = String(hex || "").trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const iterations = 100000;
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return `pbkdf2$${iterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, storedPassword) {
  const stored = String(storedPassword || "");
  if (!stored.startsWith("pbkdf2$")) return stored === String(password || "");
  const [, iterationText, saltHex, hashHex] = stored.split("$");
  if (!iterationText || !saltHex || !hashHex) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: Math.min(Number(iterationText || 100000), 100000) },
    key,
    256
  );
  return constantTimeEqual(new Uint8Array(bits), hexToBytes(hashHex));
}

async function safelyVerifyPassword(password, storedPassword) {
  try {
    return await verifyPassword(password, storedPassword);
  } catch (error) {
    return false;
  }
}

async function protectStoredPassword(storedPassword) {
  const stored = String(storedPassword || "");
  if (!stored) return "";
  return stored.startsWith("pbkdf2$") ? stored : hashPassword(stored);
}

function sellerName(row) {
  return [row.channel, row.branch].filter(Boolean).join(" ");
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function maskCustomerName(value) {
  const text = String(value || "").trim();
  if (!text) return "고객";
  if (text.length <= 1) return text;
  if (text.length === 2) return `${text[0]}*`;
  return `${text[0]}*${text.slice(-1)}`;
}

function formatPhoneNumber(value) {
  const digits = normalizePhone(value);
  if (!digits) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function formatAlimtalkPrice(value) {
  const amount = Number(value || 0);
  if (!amount) return "";
  if (amount >= 10000) return `${amount.toLocaleString("ko-KR")}원`;
  return `${amount.toLocaleString("ko-KR")}만원`;
}

function getNaverShoppingConfig(env) {
  return {
    clientId: String(env.NAVER_SHOPPING_CLIENT_ID || env.NAVER_CLIENT_ID || NAVER_SHOPPING_CLIENT_ID_DEFAULT).trim(),
    clientSecret: String(env.NAVER_SHOPPING_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || "").trim(),
  };
}

function stripHtmlTags(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^A-Z0-9가-힣]/g, "");
}

function normalizeModelCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function getModelSearchTokens(query) {
  const raw = stripHtmlTags(query);
  const full = normalizeModelCode(raw);
  const beforeDot = normalizeModelCode(raw.split(".")[0] || raw);
  return Array.from(new Set([full, beforeDot].filter((token) => token.length >= 5)));
}

function getTitleModelCandidates(title) {
  const chunks = stripHtmlTags(title).toUpperCase().match(/[A-Z0-9]+/g) || [];
  const candidates = new Set();
  const maxParts = Math.min(7, chunks.length);

  for (let start = 0; start < chunks.length; start += 1) {
    let joined = "";
    for (let offset = 0; offset < maxParts && start + offset < chunks.length; offset += 1) {
      joined += chunks[start + offset];
      if (joined.length >= 5 && joined.length <= 40) candidates.add(joined);
    }
  }

  return candidates;
}

function isAccessoryShoppingItem(item) {
  const titleText = normalizeSearchText(item?.title || "");
  const categoryText = normalizeSearchText(`${item?.category3 || ""} ${item?.category4 || ""}`);
  const strongBlockedWords = [
    "리모컨",
    "리모콘",
    "케이블",
    "안테나",
    "호환",
    "부품",
    "받침대",
    "거치대",
    "브라켓",
    "스탠드거치",
    "벽걸이브라켓",
    "액세서리",
    "악세사리",
    "소모품",
    "청소용품",
    "커버",
    "어댑터",
    "충전기",
  ];
  if (strongBlockedWords.some((word) => titleText.includes(normalizeSearchText(word)))) return true;

  const accessoryCategoryWords = ["액세서리", "악세사리", "부품", "소모품", "주변기기"];
  if (accessoryCategoryWords.some((word) => categoryText.includes(normalizeSearchText(word)))) return true;

  const filterAccessoryPhrases = ["교체용필터", "호환필터", "정품필터", "필터세트", "필터리필"];
  return filterAccessoryPhrases.some((phrase) => titleText.includes(normalizeSearchText(phrase)));
}

function isSubscriptionShoppingItem(item) {
  const text = normalizeSearchText(`${item.title} ${item.mallName} ${item.category3} ${item.category4}`);
  const blockedWords = [
    "구독",
    "렌탈",
    "렌트",
    "월납",
    "월납입",
    "월요금",
    "월렌탈",
    "케어솔루션",
    "방문관리",
    "약정",
    "36개월",
    "48개월",
    "60개월",
    "72개월",
  ];
  return blockedWords.some((word) => text.includes(normalizeSearchText(word)));
}

function isGeneralPurchaseShoppingItem(item) {
  const price = Number(item?.lprice || 0);
  if (price < 300000) return false;
  if (isAccessoryShoppingItem(item)) return false;
  if (isSubscriptionShoppingItem(item)) return false;
  return true;
}

function isExactSameModel(item, query) {
  const targets = getModelSearchTokens(query);
  if (!targets.length) return false;

  const titleCandidates = getTitleModelCandidates(item?.title || "");
  return targets.some((target) => titleCandidates.has(target));
}

function filterAbnormallyLowModelPrices(items) {
  if (items.length < 4) return items;
  const prices = items.map((item) => Number(item.lprice || 0)).filter((price) => price >= 300000).sort((a, b) => a - b);
  if (prices.length < 4) return items;

  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : Math.round((prices[middle - 1] + prices[middle]) / 2);
  const abnormalFloor = Math.max(300000, Math.round(median * 0.35));
  const filtered = items.filter((item) => Number(item.lprice || 0) >= abnormalFloor);
  return filtered.length ? filtered : items;
}

function normalizeNaverShoppingItem(item) {
  return {
    title: stripHtmlTags(item?.title),
    link: item?.link || "",
    image: item?.image || "",
    mallName: item?.mallName || "",
    productId: item?.productId || "",
    productType: item?.productType || "",
    maker: item?.maker || "",
    brand: item?.brand || "",
    category1: item?.category1 || "",
    category2: item?.category2 || "",
    category3: item?.category3 || "",
    category4: item?.category4 || "",
    lprice: Number(item?.lprice || 0),
    hprice: Number(item?.hprice || 0),
  };
}

async function requestNaverShoppingItems(config, query, display) {
  const apiUrl = new URL("https://openapi.naver.com/v1/search/shop.json");
  apiUrl.searchParams.set("query", query);
  apiUrl.searchParams.set("display", String(display));
  apiUrl.searchParams.set("start", "1");
  apiUrl.searchParams.set("sort", "asc");

  const response = await fetch(apiUrl.toString(), {
    method: "GET",
    headers: {
      "X-Naver-Client-Id": config.clientId,
      "X-Naver-Client-Secret": config.clientSecret,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.errorMessage || "네이버 쇼핑 최저가 조회에 실패했습니다.");
    error.status = response.status;
    error.errorCode = payload.errorCode || "";
    throw error;
  }

  return (payload.items || []).map(normalizeNaverShoppingItem).filter((item) => item.lprice > 0);
}

async function getNaverShoppingLowest(env, request) {
  const config = getNaverShoppingConfig(env);
  if (!config.clientId || !config.clientSecret) {
    const required = [];
    if (!config.clientId) required.push("NAVER_SHOPPING_CLIENT_ID");
    if (!config.clientSecret) required.push("NAVER_SHOPPING_CLIENT_SECRET");
    return json({
      ok: false,
      configured: false,
      message: "네이버 쇼핑 검색 API 키가 필요합니다.",
      required,
    });
  }

  const url = new URL(request.url);
  const query = String(url.searchParams.get("query") || "").trim();
  const display = Math.min(Math.max(Number(url.searchParams.get("display") || 10), 1), 30);
  if (!query) return json({ ok: false, message: "검색할 모델명을 입력해주세요." }, 400);

  const modelBodyQuery = String(query.split(".")[0] || query).trim();
  const searchQueries = [];
  const rawItems = [];
  try {
    // Naver search uses the model body only. LG and Samsung suffixes are
    // catalog-specific option codes and are handled by the AI catalog layer.
    searchQueries.push(modelBodyQuery);
    rawItems.push(...await requestNaverShoppingItems(config, modelBodyQuery, display));
  } catch (error) {
    const status = Number(error?.status || 502);
    return json({
      ok: false,
      configured: true,
      status,
      message: error?.message || "네이버 쇼핑 최저가 조회에 실패했습니다.",
      errorCode: error?.errorCode || "",
    }, status);
  }

  const uniqueItems = new Map();
  rawItems.forEach((item) => {
    const key = item.productId || item.link || `${item.title}-${item.lprice}`;
    const previous = uniqueItems.get(key);
    if (!previous || item.lprice < previous.lprice) uniqueItems.set(key, item);
  });
  const dedupedItems = [...uniqueItems.values()].sort((a, b) => a.lprice - b.lprice);
  const exactModelItems = dedupedItems.filter(
    (item) => isExactSameModel(item, modelBodyQuery) && isGeneralPurchaseShoppingItem(item)
  );
  const items = filterAbnormallyLowModelPrices(exactModelItems);

  return json({
    ok: true,
    configured: true,
    query,
    searchQueries,
    confidence: items.length ? "exact-model-filtered" : "no-exact-model-price",
    lowestPrice: items[0]?.lprice || 0,
    lowestItem: items[0] || null,
    rawResultCount: dedupedItems.length,
    filteredResultCount: items.length,
    ignoredResultCount: dedupedItems.length - items.length,
    exactModelResultCount: exactModelItems.length,
    modelMatchPolicy: "exact-normalized-model-name-category-agnostic",
    pricePolicy: "general-purchase-min-300000-no-accessory-no-subscription-abnormal-low-guard",
    items,
  });
}

function normalizeSellerApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requested_at || "",
    reviewedAt: row.reviewed_at || "",
    reviewMemo: row.review_memo || "",
    sellerId: row.seller_id,
    channel: row.channel,
    branch: row.branch,
    branchRegion: row.branch_region,
    manager: row.manager,
    managerPosition: row.manager_position || "",
    phone: row.phone,
    cardImage: row.card_image || "",
    cardImageKey: row.card_image_key || "",
    memo: row.memo || "",
    consent: parseJson(row.consent_json, {}),
  };
}

function normalizeApprovedSeller(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    sellerId: row.seller_id,
    channel: row.channel,
    branch: row.branch,
    branchRegion: row.branch_region,
    manager: row.manager,
    managerPosition: row.manager_position || "",
    phone: row.phone,
    cardImage: row.card_image || "",
    cardImageKey: row.card_image_key || "",
    memo: row.memo || "",
    consent: parseJson(row.consent_json, {}),
    requestedAt: row.requested_at || "",
    reviewedAt: row.reviewed_at || "",
    reviewMemo: row.review_memo || "",
    approvedAt: row.approved_at || "",
    quoteAlimtalkOptOut: Number(row.quote_alimtalk_opt_out || 0) === 1,
  };
}

async function isMasterSellerLogin(sellerId, password) {
  if (String(sellerId || "").trim() !== MASTER_SELLER_ID) return false;
  const typedPassword = String(password || "").trim();
  if (typedPassword === MASTER_SELLER_PASSWORD) return true;
  return safelyVerifyPassword(typedPassword, MASTER_SELLER_PASSWORD_HASH);
}

async function upsertMasterSeller(env) {
  const now = new Date().toISOString();
  const masterRow = {
    id: "seller-master-pickgj",
    status: "approved",
    seller_id: MASTER_SELLER_ID,
    password: MASTER_SELLER_PASSWORD_HASH,
    channel: "픽견적",
    branch: "운영본부",
    branch_region: "전국",
    manager: "마스터 관리자",
    manager_position: "관리자",
    phone: "010-6631-2323",
    card_image: "",
    card_image_key: "",
    memo: "운영자 마스터 계정",
    consent_json: "{}",
    requested_at: now,
    reviewed_at: now,
    review_memo: "마스터 계정 자동 복구",
    approved_at: now,
  };

  const existing = await env.DB.prepare(
    "SELECT id FROM approved_sellers WHERE id = ? OR seller_id = ? LIMIT 1"
  )
    .bind(masterRow.id, MASTER_SELLER_ID)
    .first();

  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE approved_sellers SET
        status = ?,
        password = ?,
        channel = ?,
        branch = ?,
        branch_region = ?,
        manager = ?,
        manager_position = ?,
        phone = ?,
        memo = ?,
        consent_json = ?,
        reviewed_at = ?,
        review_memo = ?,
        approved_at = ?
       WHERE id = ?`
    )
      .bind(
        masterRow.status,
        masterRow.password,
        masterRow.channel,
        masterRow.branch,
        masterRow.branch_region,
        masterRow.manager,
        masterRow.manager_position,
        masterRow.phone,
        masterRow.memo,
        masterRow.consent_json,
        masterRow.reviewed_at,
        masterRow.review_memo,
        masterRow.approved_at,
        existing.id
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO approved_sellers
        (id, status, seller_id, password, channel, branch, branch_region, manager, manager_position, phone,
         card_image, card_image_key, memo, consent_json, requested_at, reviewed_at, review_memo, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      masterRow.id,
      masterRow.status,
      masterRow.seller_id,
      masterRow.password,
      masterRow.channel,
      masterRow.branch,
      masterRow.branch_region,
      masterRow.manager,
      masterRow.manager_position,
      masterRow.phone,
      masterRow.card_image,
      masterRow.card_image_key,
      masterRow.memo,
      masterRow.consent_json,
      masterRow.requested_at,
      masterRow.reviewed_at,
      masterRow.review_memo,
      masterRow.approved_at
    )
    .run();
  }

  return env.DB.prepare("SELECT * FROM approved_sellers WHERE seller_id = ? AND status = 'approved' LIMIT 1")
    .bind(MASTER_SELLER_ID)
    .first();
}

function normalizeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    targetRole: row.target_role || "",
    targetName: row.target_name || "",
    targetPhone: row.target_phone || "",
    title: row.title,
    body: row.body,
    relatedId: row.related_id || "",
    templateId: row.template_id || "",
    variables: parseJson(row.variables_json, {}),
    solapiGroupId: row.solapi_group_id || "",
    solapiMessageId: row.solapi_message_id || "",
    errorMessage: row.error_message || "",
    solapiResponse: parseJson(row.solapi_response_json, null),
    createdAt: row.created_at || "",
    sentAt: row.sent_at || "",
    canceledAt: row.canceled_at || "",
  };
}

async function ensureAlimtalkColumns(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS alimtalk_queue (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'ready',
        type TEXT NOT NULL,
        target_role TEXT DEFAULT '',
        target_name TEXT DEFAULT '',
        target_phone TEXT DEFAULT '',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        related_id TEXT DEFAULT '',
        template_id TEXT DEFAULT '',
        variables_json TEXT DEFAULT '{}',
        solapi_group_id TEXT DEFAULT '',
        solapi_message_id TEXT DEFAULT '',
        error_message TEXT DEFAULT '',
        solapi_response_json TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        sent_at TEXT DEFAULT '',
        canceled_at TEXT DEFAULT ''
      )`
    ).run();
  } catch (error) {
    // Existing production databases may already have this table with a legacy shape.
  }

  const statements = [
    "ALTER TABLE alimtalk_queue ADD COLUMN template_id TEXT DEFAULT ''",
    "ALTER TABLE alimtalk_queue ADD COLUMN variables_json TEXT DEFAULT '{}'",
    "ALTER TABLE alimtalk_queue ADD COLUMN solapi_group_id TEXT DEFAULT ''",
    "ALTER TABLE alimtalk_queue ADD COLUMN solapi_message_id TEXT DEFAULT ''",
    "ALTER TABLE alimtalk_queue ADD COLUMN error_message TEXT DEFAULT ''",
    "ALTER TABLE alimtalk_queue ADD COLUMN solapi_response_json TEXT DEFAULT ''",
  ];

  for (const statement of statements) {
    try {
      await env.DB.prepare(statement).run();
    } catch (error) {
      // Column already exists on databases that were migrated earlier.
    }
  }
}

async function insertAlimtalkRow(env, row) {
  await ensureAlimtalkColumns(env);
  const valuesByColumn = {
    id: row.id,
    status: row.status,
    type: row.type,
    target_role: row.targetRole,
    target_name: row.targetName,
    target_phone: row.targetPhone,
    title: row.title,
    body: row.body,
    related_id: row.relatedId,
    template_id: row.templateId,
    variables_json: row.variablesJson,
    solapi_group_id: "",
    solapi_message_id: "",
    error_message: "",
    solapi_response_json: "",
    created_at: row.createdAt,
    sent_at: "",
    canceled_at: "",
  };
  const tableInfo = await env.DB.prepare("PRAGMA table_info(alimtalk_queue)").all();
  const columns = (tableInfo.results || [])
    .map((info) => info.name)
    .filter((name) => Object.prototype.hasOwnProperty.call(valuesByColumn, name));
  if (!columns.includes("id")) throw new Error("알림톡 큐 테이블에 id 컬럼이 없습니다.");

  const placeholders = columns.map(() => "?").join(", ");
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  return env.DB.prepare(`INSERT INTO alimtalk_queue (${quotedColumns}) VALUES (${placeholders})`)
    .bind(...columns.map((column) => valuesByColumn[column]))
    .run();
}

async function updateAlimtalkDeliveryResult(env, id, result, options = {}) {
  const sentAt = result.ok && result.queueStatus === "sent" ? new Date().toISOString() : "";
  const status = result.ok ? result.queueStatus || "accepted" : result.skipped ? "ready" : "failed";
  await ensureAlimtalkColumns(env);
  const valuesByColumn = {
    status,
    sent_at: sentAt,
    canceled_at: options.canceledAt,
    template_id: options.templateId,
    solapi_group_id: result.groupId || "",
    solapi_message_id: result.messageId || "",
    error_message: result.error || "",
    solapi_response_json: JSON.stringify(result.payload || {}),
  };
  const tableInfo = await env.DB.prepare("PRAGMA table_info(alimtalk_queue)").all();
  const assignments = [];
  const values = [];
  for (const info of tableInfo.results || []) {
    if (info.name === "id") continue;
    if (!Object.prototype.hasOwnProperty.call(valuesByColumn, info.name)) continue;
    const value = valuesByColumn[info.name];
    if (value === undefined) continue;
    assignments.push(`"${info.name}" = ?`);
    values.push(value);
  }
  if (!assignments.length) return;
  await env.DB.prepare(`UPDATE alimtalk_queue SET ${assignments.join(", ")} WHERE id = ?`).bind(...values, id).run();
}

async function updateAlimtalkStatusResult(env, id, status, sentAt, errorMessage, payload) {
  await ensureAlimtalkColumns(env);
  const valuesByColumn = {
    status,
    sent_at: sentAt,
    error_message: errorMessage,
    solapi_response_json: JSON.stringify(payload || {}),
  };
  const tableInfo = await env.DB.prepare("PRAGMA table_info(alimtalk_queue)").all();
  const assignments = [];
  const values = [];
  for (const info of tableInfo.results || []) {
    if (!Object.prototype.hasOwnProperty.call(valuesByColumn, info.name)) continue;
    assignments.push(`"${info.name}" = ?`);
    values.push(valuesByColumn[info.name]);
  }
  if (!assignments.length) return;
  await env.DB.prepare(`UPDATE alimtalk_queue SET ${assignments.join(", ")} WHERE id = ?`).bind(...values, id).run();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next.toISOString();
}

function normalizeQuoteBrand(value) {
  const raw = String(value || "").trim();
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (!compact) return "";
  if (compact.includes("비교")) return "비교견적";
  if (compact.includes("lg") || compact.includes("엘지")) return "LG전자";
  if (compact.includes("삼성") || compact.includes("samsung")) return "삼성전자";
  return raw;
}

function normalizeSellerBidBrandGroup(channelValue) {
  const compact = String(channelValue || "")
    .replace(/\s+/g, "")
    .replace(/[·ㆍ]/g, "")
    .toLowerCase();

  if (
    compact.includes("삼성스토어") ||
    compact.includes("이마트(삼성)") ||
    compact.includes("이마트삼성") ||
    compact.includes("전자랜드(삼성)") ||
    compact.includes("전자랜드삼성")
  ) return "samsung";

  if (
    compact.includes("lg전자bestshop") ||
    compact.includes("lg전자베스트샵") ||
    compact.includes("이마트(lg)") ||
    compact.includes("이마트lg") ||
    compact.includes("전자랜드(lg)") ||
    compact.includes("전자랜드lg")
  ) return "lg";

  return "all";
}

function sellerCanBidQuoteBrand(channelValue, quoteBrandValue) {
  const group = normalizeSellerBidBrandGroup(channelValue);
  const brand = normalizeQuoteBrand(quoteBrandValue);
  if (!brand || brand === "비교견적" || group === "all") return true;
  if (group === "samsung") return brand === "삼성전자";
  if (group === "lg") return brand === "LG전자";
  return true;
}

function sellerBidBrandRestrictionMessage(channelValue) {
  const group = normalizeSellerBidBrandGroup(channelValue);
  if (group === "samsung") return "삼성 계열 판매 채널은 삼성전자 또는 비교견적에만 제안할 수 있습니다.";
  if (group === "lg") return "LG 계열 판매 채널은 LG전자 또는 비교견적에만 제안할 수 있습니다.";
  return "현재 판매 채널에서는 이 브랜드 견적에 제안할 수 없습니다.";
}

function storedFileUrl(objectKey, fallbackUrl = "") {
  const key = String(objectKey || "").trim();
  if (key) {
    return `/api/files/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  }
  return String(fallbackUrl || "");
}

function normalizedStoredImage(image) {
  if (!image) return { url: "" };
  return { ...image, url: storedFileUrl(image.object_key || image.objectKey, image.url || "") };
}

function normalizeCustomerQuote(row, images = []) {
  if (!row) return null;
  const normalizedImages = images.map(normalizedStoredImage);
  const fullImages = normalizedImages.filter((image) => image.image_type !== "thumbnail");
  const thumbnailUrl = storedFileUrl(row.thumbnail_image_key, row.thumbnail_image || "");
  const displayImages = fullImages.length ? fullImages : thumbnailUrl ? [{ url: thumbnailUrl }] : [];
  const bids = Array.isArray(row.bids) ? row.bids : [];
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customer: row.customer,
    phone: row.phone,
    items: row.items,
    quoteType: row.quote_type || "",
    purchasePurpose: row.purchase_purpose || "",
    desiredBrand: normalizeQuoteBrand(row.desired_brand || row.desiredBrand || row.brand || ""),
    price: Number(row.price || 0),
    region: row.region || "",
    installDate: row.install_date || "",
    memo: row.memo || "",
    status: row.status || "open",
    selectedBidId: row.selected_bid_id || null,
    contactReleaseScope: row.contact_release_scope || "selected",
    contactReleasedBidIds: parseJson(row.contact_released_bid_ids, []),
    submissionCount: Number(row.submission_count || 1),
    previousLowestPrice: Number(row.previous_lowest_price || 0),
    rankNoticeQueuedAt: row.rank_notice_queued_at || "",
    saleCompletedAt: row.sale_completed_at || "",
    thumbnailImage: thumbnailUrl,
    thumbnailImageKey: row.thumbnail_image_key || "",
    quoteExpiresAt: row.quote_expires_at || "",
    fullImagesExpiresAt: row.full_images_expires_at || "",
    personalExpiresAt: row.personal_expires_at || "",
    createdAt: row.created_at || "",
    consent: parseJson(row.consent_json, {}),
    image: displayImages[0]?.url || thumbnailUrl,
    images: displayImages.map((image) => image.url),
    bidCount: Number(row.bid_count || bids.length || 0),
    bids,
  };
}

function hideSellerOnlyQuoteFields(quote) {
  if (!quote) return quote;
  const safeQuote = { ...quote };
  delete safeQuote.submissionCount;
  delete safeQuote.previousLowestPrice;
  delete safeQuote.rankNoticeQueuedAt;
  return safeQuote;
}

function normalizeBid(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.quote_id,
    quoteId: row.quote_id,
    sellerId: row.seller_id,
    seller: row.seller || "",
    channel: row.channel || "",
    branch: row.branch || "",
    manager: row.manager || "",
    managerPosition: row.manager_position || "",
    phone: row.phone || "",
    cardImage: row.card_image || "",
    price: Number(row.price || 0),
    benefits: row.benefits || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function maskSellerBranchName(value) {
  const text = String(value || "").trim();
  if (!text) return "지점 비공개";
  if (text.includes("*")) return text;
  const hasBranchSuffix = text.endsWith("점");
  const core = hasBranchSuffix ? text.slice(0, -1) : text;
  if (!core) return "*점";
  return `${core.slice(0, 1)}${"*".repeat(Math.max(2, core.length - 1))}${hasBranchSuffix ? "점" : ""}`;
}

function maskSellerManagerName(value) {
  const text = String(value || "").trim();
  if (!text) return "매니저 비공개";
  if (text.includes("*")) return text;
  return `${text.slice(0, 1)}${"*".repeat(Math.max(1, text.length - 1))}`;
}

function hideBidIdentityBeforeSelection(bid) {
  if (!bid) return bid;
  const channel = String(bid.channel || "판매 채널").trim() || "판매 채널";
  return {
    ...bid,
    seller: channel,
    channel,
    branch: maskSellerBranchName(bid.branch),
    manager: maskSellerManagerName(bid.manager),
    managerPosition: "",
    phone: "",
    cardImage: "",
  };
}

function normalizeReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.quote_id,
    quoteId: row.quote_id,
    bidId: row.bid_id,
    sellerId: row.seller_id || "",
    seller: row.seller || "",
    manager: row.manager || "",
    customer: row.customer || "",
    rating: Number(row.rating || 0),
    content: row.content || "",
    createdAt: row.created_at || "",
  };
}

async function ensureReviewsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      bid_id TEXT NOT NULL,
      seller_id TEXT DEFAULT '',
      seller TEXT DEFAULT '',
      manager TEXT DEFAULT '',
      customer TEXT DEFAULT '',
      rating INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quote_id) REFERENCES customer_quotes(id),
      FOREIGN KEY (bid_id) REFERENCES bids(id)
    )`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_reviews_quote_id ON reviews(quote_id)").run();
}

async function ensureCustomerQuoteColumns(env) {
  const statements = [
    "ALTER TABLE customer_quotes ADD COLUMN thumbnail_image TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN thumbnail_image_key TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN quote_expires_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN full_images_expires_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN personal_expires_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN desired_brand TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN quote_type TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN install_date TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN contact_release_scope TEXT DEFAULT 'selected'",
    "ALTER TABLE customer_quotes ADD COLUMN contact_released_bid_ids TEXT DEFAULT '[]'",
    "ALTER TABLE customer_quotes ADD COLUMN submission_count INTEGER DEFAULT 1",
    "ALTER TABLE customer_quotes ADD COLUMN previous_lowest_price INTEGER DEFAULT 0",
    "ALTER TABLE customer_quotes ADD COLUMN rank_notice_queued_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN sale_completed_at TEXT DEFAULT ''",
    "ALTER TABLE quote_images ADD COLUMN image_type TEXT DEFAULT 'full'",
    "ALTER TABLE quote_images ADD COLUMN expires_at TEXT DEFAULT ''",
  ];

  for (const statement of statements) {
    try {
      await env.DB.prepare(statement).run();
    } catch (error) {
      // Column already exists on databases that were migrated earlier.
    }
  }
}

async function ensureSellerColumns(env) {
  const statements = [
    "ALTER TABLE seller_applications ADD COLUMN reviewed_at TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN review_memo TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN password TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN channel TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN branch_region TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN manager_position TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN card_image TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN card_image_key TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN memo TEXT DEFAULT ''",
    "ALTER TABLE seller_applications ADD COLUMN consent_json TEXT DEFAULT '{}'",
    "ALTER TABLE approved_sellers ADD COLUMN branch_region TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN manager_position TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN card_image TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN card_image_key TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN memo TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN consent_json TEXT DEFAULT '{}'",
    "ALTER TABLE approved_sellers ADD COLUMN requested_at TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN reviewed_at TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN review_memo TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN approved_at TEXT DEFAULT ''",
    "ALTER TABLE approved_sellers ADD COLUMN quote_alimtalk_opt_out INTEGER NOT NULL DEFAULT 0",
  ];

  for (const statement of statements) {
    try {
      await env.DB.prepare(statement).run();
    } catch (error) {
      // Column already exists on databases that were migrated earlier.
    }
  }
}

async function createUniqueQuoteNumber(env, preferred) {
  const requested = String(preferred || "").trim();
  if (requested) {
    const duplicate = await env.DB.prepare("SELECT id FROM customer_quotes WHERE quote_number = ? LIMIT 1")
      .bind(requested)
      .first();
    if (!duplicate) return requested;
  }

  const match = requested.match(/^(\d{8})-\d{4}$/);
  const dateKey = match?.[1] || quoteDateKey();
  const result = await env.DB.prepare(
    "SELECT quote_number FROM customer_quotes WHERE quote_number LIKE ? ORDER BY quote_number DESC LIMIT 1"
  )
    .bind(`${dateKey}-%`)
    .first();
  const lastSequence = Number(String(result?.quote_number || "").split("-")[1] || 0);
  return `${dateKey}-${String(lastSequence + 1).padStart(4, "0")}`;
}

async function getPreviousQuoteStats(env, customer, phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!customer || !normalizedPhone) return { submissionCount: 1, previousLowestPrice: 0 };

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM customer_quotes
     WHERE customer = ? AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?`
  )
    .bind(customer, normalizedPhone)
    .first();

  const previousQuote = await env.DB.prepare(
    `SELECT id
     FROM customer_quotes
     WHERE customer = ? AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(customer, normalizedPhone)
    .first();

  let previousLowestPrice = 0;
  if (previousQuote?.id) {
    const lowest = await env.DB.prepare("SELECT MIN(price) AS lowest FROM bids WHERE quote_id = ?")
      .bind(previousQuote.id)
      .first();
    previousLowestPrice = Number(lowest?.lowest || 0);
  }

  return {
    submissionCount: Number(countRow?.total || 0) + 1,
    previousLowestPrice,
  };
}

async function getBidsForQuote(env, quoteId) {
  const result = await env.DB.prepare("SELECT * FROM bids WHERE quote_id = ? ORDER BY price ASC, created_at ASC")
    .bind(quoteId)
    .all();
  return (result.results || []).map(normalizeBid);
}

let quoteDurationPolicyReady = false;

async function ensureQuoteDurationPolicy72(env) {
  if (quoteDurationPolicyReady) return;
  await ensureCustomerQuoteColumns(env);
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();

  const current = await env.DB.prepare(
    "SELECT setting_value FROM app_settings WHERE setting_key = ?"
  ).bind(QUOTE_DURATION_POLICY_KEY).first();
  if (String(current?.setting_value || "") === String(QUOTE_DURATION_HOURS)) {
    quoteDurationPolicyReady = true;
    return;
  }

  const now = new Date();
  const result = await env.DB.prepare(
    `SELECT id, created_at, status, selected_bid_id, quote_expires_at, rank_notice_queued_at
       FROM customer_quotes
      WHERE created_at != ''`
  ).all();

  for (const quote of result.results || []) {
    if (quote.selected_bid_id) continue;
    const expiresAt = addHours(quote.created_at, QUOTE_DURATION_HOURS);
    const expiresTime = new Date(expiresAt).getTime();
    const wasAutomaticallyClosed =
      quote.status === "closed" && Boolean(String(quote.rank_notice_queued_at || "").trim());

    if (quote.status !== "closed") {
      await env.DB.prepare(
        "UPDATE customer_quotes SET quote_expires_at = ? WHERE id = ?"
      ).bind(expiresAt, quote.id).run();
      continue;
    }

    if (wasAutomaticallyClosed && Number.isFinite(expiresTime) && expiresTime > now.getTime()) {
      await env.DB.prepare(
        `UPDATE customer_quotes
            SET status = 'open', quote_expires_at = ?, rank_notice_queued_at = ''
          WHERE id = ?`
      ).bind(expiresAt, quote.id).run();
      try {
        await ensureAlimtalkColumns(env);
        await env.DB.prepare(
          `DELETE FROM alimtalk_queue
            WHERE related_id = ?
              AND type = 'customer-quote-closed'
              AND status IN ('ready', 'sending', 'accepted')
              AND (sent_at = '' OR sent_at IS NULL)`
        ).bind(quote.id).run();
      } catch (error) {
        // 기존 DB의 알림톡 테이블 구조가 다르더라도 견적 연장 처리는 유지합니다.
      }
    }
  }

  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = excluded.updated_at`
  ).bind(QUOTE_DURATION_POLICY_KEY, String(QUOTE_DURATION_HOURS), updatedAt).run();
  quoteDurationPolicyReady = true;
}

async function queueQuoteClosedNotice(env, quote, claimedAt) {
  if (isTestCustomerName(quote?.customer)) {
    return { ok: true, skipped: true, reason: "test-customer" };
  }
  try {
    return await queueAlimtalk(env, {
      type: "customer-quote-closed",
      targetRole: "customer",
      targetName: quote.customer,
      targetPhone: quote.phone,
      title: "견적 비교 시간이 종료되었습니다",
      body: `${quote.customer} 고객님의 견적 비교 시간이 종료되었습니다. 견적번호 ${quote.quote_number}의 제안 내역을 확인해 주세요.`,
      relatedId: quote.id,
      variables: {
        "#{고객명}": quote.customer,
        "#{견적번호}": quote.quote_number,
      },
    });
  } catch (error) {
    // 큐 저장 자체가 실패한 경우에만 선점 상태를 되돌려 다음 요청에서 재시도합니다.
    await env.DB.prepare(
      `UPDATE customer_quotes
          SET rank_notice_queued_at = ''
        WHERE id = ? AND rank_notice_queued_at = ?`
    ).bind(quote.id, claimedAt).run().catch(() => {});
    throw error;
  }
}

function isTestCustomerName(value) {
  const compactTestName = String(value || '').replace(/\s+/g, '').toLowerCase();
  if (compactTestName.includes("\uD14C\uC2A4\uD2B8\uC6A9") || compactTestName.includes("\uD14C\uC2A4\uD2B8") || compactTestName.includes("test")) return true;
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .includes("테스트용");
}

function isTestQuote(row) {
  return isTestCustomerName(row?.customer);
}

function isMasterSellerId(value) {
  return String(value || '').trim() === MASTER_SELLER_ID;
}

async function closeExpiredQuotes(env) {
  await ensureQuoteDurationPolicy72(env);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `SELECT * FROM customer_quotes
     WHERE quote_expires_at != ''
       AND quote_expires_at < ?
       AND (rank_notice_queued_at = '' OR rank_notice_queued_at IS NULL)`
  )
    .bind(now)
    .all();

  const rows = result.results || [];
  for (const quote of rows) {
    // 여러 화면이 동시에 만료 확인 API를 호출해도 한 요청만 알림 발송 권한을 갖습니다.
    const claim = await env.DB.prepare(
      `UPDATE customer_quotes
          SET status = 'closed', rank_notice_queued_at = ?
        WHERE id = ?
          AND (rank_notice_queued_at = '' OR rank_notice_queued_at IS NULL)`
    ).bind(now, quote.id).run();
    if (Number(claim?.meta?.changes || 0) !== 1) continue;

    await queueQuoteClosedNotice(env, quote, now);
  }
}

async function deleteR2Object(env, key) {
  if (!env.FILES || !key) return;
  try {
    await env.FILES.delete(key);
  } catch (error) {
    console.warn("R2 object delete failed", key, error);
  }
}

async function cleanupExpiredStoredData(env) {
  await ensureCustomerQuoteColumns(env);
  const now = new Date().toISOString();
  const expiredFullImages = await env.DB.prepare(
    `SELECT id, object_key
     FROM quote_images
     WHERE image_type = 'full'
       AND expires_at != ''
       AND expires_at < ?
     LIMIT 200`
  )
    .bind(now)
    .all();

  for (const image of expiredFullImages.results || []) {
    await deleteR2Object(env, image.object_key);
    await env.DB.prepare("DELETE FROM quote_images WHERE id = ?").bind(image.id).run();
  }

  const expiredQuotes = await env.DB.prepare(
    `SELECT id
     FROM customer_quotes
     WHERE personal_expires_at != ''
       AND personal_expires_at < ?
     LIMIT 100`
  )
    .bind(now)
    .all();

  for (const quote of expiredQuotes.results || []) {
    const images = await env.DB.prepare("SELECT object_key FROM quote_images WHERE quote_id = ?").bind(quote.id).all();
    for (const image of images.results || []) {
      await deleteR2Object(env, image.object_key);
    }
    await env.DB.prepare("DELETE FROM quote_images WHERE quote_id = ?").bind(quote.id).run();
    await env.DB.prepare("DELETE FROM bids WHERE quote_id = ?").bind(quote.id).run();
    await env.DB.prepare("DELETE FROM reviews WHERE quote_id = ?").bind(quote.id).run();
    await env.DB.prepare("DELETE FROM customer_quotes WHERE id = ?").bind(quote.id).run();
  }

  // 개인정보 처리방침의 1년 보유정책과 실제 서버 보관기간을 맞춥니다.
  // 아직 생성되지 않은 선택 기능 테이블은 기존 서비스에 영향을 주지 않도록 개별적으로 무시합니다.
  const oneYearAgo = addDays(now, -365);
  const cleanupResults = {};
  const cleanupQueries = [
    {
      key: "brandConsultationsDeleted",
      sql: "DELETE FROM brand_consultations WHERE created_at != '' AND created_at < ?",
    },
    {
      key: "reviewedSellerApplicationsDeleted",
      sql: "DELETE FROM seller_applications WHERE status != 'pending' AND reviewed_at != '' AND reviewed_at < ?",
    },
    {
      key: "sellerAccessLogsDeleted",
      sql: "DELETE FROM seller_access_logs WHERE created_at != '' AND created_at < ?",
    },
    {
      key: "deletedQuoteLogsDeleted",
      sql: "DELETE FROM deleted_quote_logs WHERE deleted_at != '' AND deleted_at < ?",
    },
    {
      key: "alimtalkLogsDeleted",
      sql: "DELETE FROM alimtalk_queue WHERE created_at != '' AND created_at < ?",
    },
    {
      key: "inactivePushTokensDeleted",
      sql: "DELETE FROM push_tokens WHERE updated_at != '' AND updated_at < ?",
    },
  ];

  for (const task of cleanupQueries) {
    try {
      const result = await env.DB.prepare(task.sql).bind(oneYearAgo).run();
      cleanupResults[task.key] = Number(result?.meta?.changes || 0);
    } catch (error) {
      cleanupResults[task.key] = 0;
    }
  }

  return {
    fullImagesDeleted: Number((expiredFullImages.results || []).length),
    quotesDeleted: Number((expiredQuotes.results || []).length),
    ...cleanupResults,
  };
}

async function migrateLegacySellerPasswords(env) {
  await ensureSellerColumns(env);
  let migrated = 0;
  const targets = [
    { table: "approved_sellers", key: "seller_id" },
    { table: "seller_applications", key: "seller_id" },
  ];

  for (const target of targets) {
    const rows = await env.DB.prepare(
      `SELECT ${target.key} AS seller_id, password
       FROM ${target.table}
       WHERE password IS NOT NULL
         AND password != ''
         AND password NOT LIKE 'pbkdf2$%'
       LIMIT 100`
    ).all();

    for (const row of rows.results || []) {
      await env.DB.prepare(`UPDATE ${target.table} SET password = ? WHERE ${target.key} = ?`)
        .bind(await hashPassword(row.password), row.seller_id)
        .run();
      migrated += 1;
    }
  }

  return { migrated };
}

async function runMaintenance(env) {
  await closeExpiredQuotes(env);
  const cleanup = await cleanupExpiredStoredData(env);
  const passwordMigration = await migrateLegacySellerPasswords(env);
  return json({ ok: true, cleanup, passwordMigration });
}

async function ensureGuideDismissalTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS guide_dismissals (
      id TEXT PRIMARY KEY,
      guide_type TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      dismiss_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_guide_dismissals_lookup ON guide_dismissals(guide_type, ip_hash, dismiss_date)"
  ).run();
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function detectFileContentType(bytes, declaredType = "") {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const ascii = (start, length) => String.fromCharCode(...data.slice(start, start + length));
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 8 && data[0] === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (data.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (data.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  if (data.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  if (data.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].includes(brand)) return "image/heic";
    if (["avif", "avis"].includes(brand)) return "image/avif";
  }
  return String(declaredType || "application/octet-stream").toLowerCase();
}

function extensionForContentType(contentType) {
  return {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "application/pdf": "pdf",
  }[contentType] || "bin";
}

function isBrowserSafeQuoteImageType(contentType) {
  return ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(String(contentType || "").toLowerCase());
}

function dataUrlInfo(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const declaredType = String(match[1] || "").toLowerCase();
  const base64 = match[2];
  const bytes = base64ToArrayBuffer(base64);
  const contentType = detectFileContentType(bytes, declaredType);
  return { contentType, declaredType, base64, bytes, ext: extensionForContentType(contentType) };
}

async function saveDataUrlToR2(env, dataUrl, prefix, id) {
  const info = dataUrlInfo(dataUrl);
  if (!info || !env.FILES) return { url: dataUrl || "", key: "", contentType: info?.contentType || "" };

  const key = `${prefix}/${id}.${info.ext}`;
  await env.FILES.put(key, info.bytes, {
    httpMetadata: { contentType: info.contentType },
  });
  return { key, url: `/api/files/${key}`, contentType: info.contentType };
}

function getSolapiConfig(env) {
  return {
    apiKey: String(env.SOLAPI_API_KEY || "").trim(),
    apiSecret: String(env.SOLAPI_API_SECRET || "").trim(),
    channelId: solapiValue(env, "SOLAPI_CHANNEL_ID"),
    from: normalizePhone(solapiValue(env, "SOLAPI_FROM")),
    adminPhone: normalizePhone(solapiValue(env, "SOLAPI_ADMIN_PHONE")),
  };
}

function createSolapiSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createHmacSha256Hex(secret, text) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createSolapiAuthorization(config) {
  const date = new Date().toISOString();
  const salt = createSolapiSalt();
  const signature = await createHmacSha256Hex(config.apiSecret, date + salt);
  return `HMAC-SHA256 apiKey=${config.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

function getSolapiTemplateId(env, type) {
  const templates = {
    "customer-quote-received": solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED"),
    "customer-bid-received": solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED"),
    "customer-quote-closed": solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED"),
    "seller-bid-selected": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_BID_SELECTED"),
    "seller-approved": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_APPROVED"),
    "seller-rejected": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_REJECTED"),
    "seller-application-received": solapiValue(env, "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION"),
    "seller-quote-registered": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_QUOTE_REGISTERED"),
  };
  return templates[type] || "";
}

function getSolapiMissingKeys(config, message, templateId) {
  return [
    ["SOLAPI_API_KEY", config.apiKey],
    ["SOLAPI_API_SECRET", config.apiSecret],
    ["SOLAPI_CHANNEL_ID", config.channelId],
    ["SOLAPI_FROM", config.from],
    ["templateId", templateId],
    ["targetPhone", normalizePhone(message.targetPhone)],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function createSolapiMessageBody(config, message, templateId) {
  const variables = {};
  Object.entries(message.variables || {}).forEach(([key, value]) => {
    variables[key] = String(value ?? "");
  });

  return {
    messages: [
      {
        type: "ATA",
        to: normalizePhone(message.targetPhone),
        from: config.from,
        kakaoOptions: {
          pfId: config.channelId,
          templateId,
          variables,
          disableSms: false,
        },
      },
    ],
    strict: false,
    allowDuplicates: Boolean(message.allowDuplicates),
    showMessageList: true,
  };
}

function parseSolapiSendResult(response, payload) {
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload.errorMessage || payload.message || "솔라피 발송에 실패했습니다.",
      payload,
    };
  }

  const firstMessage = payload.messageList?.[0] || payload.messages?.[0] || {};
  const failedMessage = payload.failedMessageList?.[0] || {};
  const failedCount = Number(
    payload.groupInfo?.failedCount ||
      payload.failedCount ||
      payload.groupInfo?.count?.registeredFailed ||
      payload.groupInfo?.count?.sentFailed ||
      payload.failedMessageList?.length ||
      0
  );
  const firstStatusCode = String(firstMessage.statusCode || failedMessage.statusCode || "");
  const groupStatus = String(payload.groupInfo?.status || "").toUpperCase();
  const sentSuccessCount = Number(payload.groupInfo?.count?.sentSuccess || payload.sentSuccess || 0);
  const nonSuccessStatusMessage =
    firstMessage.statusMessage && firstStatusCode && !firstStatusCode.startsWith("2")
      ? firstMessage.statusMessage
      : "";
  const firstError =
    failedMessage.statusMessage ||
    failedMessage.errorMessage ||
    failedMessage.errorCode ||
    nonSuccessStatusMessage ||
    firstMessage.errorMessage ||
    firstMessage.errorCode ||
    firstMessage.reason ||
    "";
  if (failedCount > 0 || firstError) {
    return {
      ok: false,
      status: response.status,
      error: firstError || "솔라피에서 발송 실패 응답을 반환했습니다.",
      payload,
      groupId: payload.groupInfo?.groupId || payload.groupId || "",
      messageId: firstMessage.messageId || failedMessage.messageId || firstMessage.message_id || "",
    };
  }

  let queueStatus = "accepted";
  if (firstStatusCode === "4000" || sentSuccessCount > 0) {
    queueStatus = "sent";
  } else if (groupStatus === "SENDING" || firstStatusCode === "2000" || firstStatusCode.startsWith("3")) {
    queueStatus = "sending";
  } else if (groupStatus === "COMPLETE") {
    queueStatus = "accepted";
  }

  return {
    ok: true,
    queueStatus,
    payload,
    groupId: payload.groupInfo?.groupId || payload.groupInfo?._id || payload.groupId || "",
    messageId: firstMessage.messageId || firstMessage.message_id || "",
  };
}

async function sendSolapiAlimtalk(env, message, templateId) {
  const config = getSolapiConfig(env);
  const missingKeys = getSolapiMissingKeys(config, message, templateId);
  if (missingKeys.length) {
    return {
      ok: false,
      skipped: true,
      error: `솔라피 설정 누락: ${missingKeys.join(", ")}`,
    };
  }

  const authorization = await createSolapiAuthorization(config);
  const response = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createSolapiMessageBody(config, message, templateId)),
  });
  const payload = await response.json().catch(() => ({}));
  return parseSolapiSendResult(response, payload);
}

async function sendSolapiTextMessage(env, message) {
  const config = getSolapiConfig(env);
  const missingKeys = [
    ["SOLAPI_API_KEY", config.apiKey],
    ["SOLAPI_API_SECRET", config.apiSecret],
    ["SOLAPI_FROM", config.from],
    ["targetPhone", normalizePhone(message.targetPhone)],
    ["body", message.body],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    return {
      ok: false,
      skipped: true,
      error: `문자 발송 설정 누락: ${missingKeys.join(", ")}`,
    };
  }

  const authorization = await createSolapiAuthorization(config);
  const response = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          type: "LMS",
          to: normalizePhone(message.targetPhone),
          from: config.from,
          text: message.body,
        },
      ],
      strict: false,
      allowDuplicates: true,
      showMessageList: true,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return parseSolapiSendResult(response, payload);
}

async function queueAlimtalk(env, message) {
  await ensureAlimtalkColumns(env);
  const now = new Date().toISOString();
  const id = createId("talk");
  const templateId = message.templateId || getSolapiTemplateId(env, message.type || "notice");
  const variablesJson = JSON.stringify(message.variables || {});
  await insertAlimtalkRow(env, {
    id,
    status: message.status || "ready",
    type: message.type || "notice",
    targetRole: message.targetRole || "",
    targetName: message.targetName || "",
    targetPhone: message.targetPhone || "",
    title: message.title || "알림",
    body: message.body || "",
    relatedId: message.relatedId || "",
    templateId,
    variablesJson,
    createdAt: now,
  });

  let result;
  try {
    result = await sendSolapiAlimtalk(env, message, templateId);
  } catch (error) {
    result = {
      ok: false,
      error: error?.message || "알림톡 발송 처리 중 오류가 발생했습니다.",
    };
  }
  await updateAlimtalkDeliveryResult(env, id, result);

  return { id, ...result };
}

async function queueTextMessage(env, message) {
  await ensureAlimtalkColumns(env);
  const now = new Date().toISOString();
  const id = createId("talk");
  await insertAlimtalkRow(env, {
    id,
    status: message.status || "ready",
    type: message.type || "sms-notice",
    targetRole: message.targetRole || "",
    targetName: message.targetName || "",
    targetPhone: message.targetPhone || "",
    title: message.title || "문자 알림",
    body: message.body || "",
    relatedId: message.relatedId || "",
    templateId: "",
    variablesJson: JSON.stringify(message.variables || {}),
    createdAt: now,
  });

  let result;
  try {
    result = await sendSolapiTextMessage(env, message);
  } catch (error) {
    result = {
      ok: false,
      error: error?.message || "문자 발송 처리 중 오류가 발생했습니다.",
    };
  }
  await updateAlimtalkDeliveryResult(env, id, result);

  return { id, ...result };
}

async function queueSellerApplicationAdminAlert(env, row) {
  const message = {
    type: "seller-application-received",
    targetRole: "admin",
    targetName: "관리자",
    targetPhone: solapiValue(env, "SOLAPI_ADMIN_PHONE") || "01066312323",
    title: "판매자 등록 요청이 접수되었습니다",
    body: `${sellerName(row)} ${row.manager} 매니저의 판매자 등록 요청이 접수되었습니다.`,
    relatedId: row.id,
    templateId: solapiValue(env, "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION") || "KA01TP2607210300081256MK0cxuHata",
    allowDuplicates: true,
    variables: {
      "#{채널}": row.channel,
      "#{지점명}": row.branch,
      "#{매니저명}": row.manager,
      "#{연락처}": formatPhoneNumber(row.phone),
    },
  };
  const id = createId("talk");
  const now = new Date().toISOString();
  const variablesJson = JSON.stringify(message.variables || {});

  let result;
  try {
    result = await sendSolapiAlimtalk(env, message, message.templateId);
  } catch (error) {
    result = {
      ok: false,
      error: error?.message || "판매자 등록 관리자 알림톡 발송 처리 중 오류가 발생했습니다.",
    };
  }

  try {
    await ensureAlimtalkColumns(env);
    const sentAt = result.ok && result.queueStatus === "sent" ? new Date().toISOString() : "";
    await env.DB.prepare(
      `INSERT INTO alimtalk_queue
        (id, status, type, target_role, target_name, target_phone, title, body, related_id,
         template_id, variables_json, solapi_group_id, solapi_message_id, error_message,
         created_at, sent_at, canceled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        result.ok ? result.queueStatus || "accepted" : result.skipped ? "ready" : "failed",
        message.type,
        message.targetRole,
        message.targetName,
        message.targetPhone,
        message.title,
        message.body,
        message.relatedId,
        message.templateId,
        variablesJson,
        result.groupId || "",
        result.messageId || "",
        result.error || "",
        now,
        sentAt,
        ""
      )
      .run();
  } catch (queueError) {
    return {
      id,
      ...result,
      queueError: queueError?.message || "알림톡 발송 결과를 큐에 저장하지 못했습니다.",
    };
  }

  return { id, ...result };
}

async function getSellerApplications(env) {
  await ensureSellerColumns(env);
  const result = await env.DB.prepare("SELECT * FROM seller_applications ORDER BY requested_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeSellerApplication) });
}

async function traceSellerAdminAlert(env, sellerId, message) {
  await env.DB.prepare("UPDATE seller_applications SET review_memo = ? WHERE id = ?")
    .bind(message, sellerId)
    .run();
}


async function queueSellerQuoteRegisteredAlerts(env, quote) {
  if (isTestCustomerName(quote?.customer)) {
    return { ok: true, skipped: true, total: 0, sent: 0, failed: 0, reason: "test-customer" };
  }
  const templateId = solapiValue(env, "SOLAPI_TEMPLATE_SELLER_QUOTE_REGISTERED");
  if (!templateId) {
    return { ok: false, skipped: true, total: 0, sent: 0, failed: 0, error: "판매자 신규 견적 알림톡 템플릿이 없습니다." };
  }

  await ensureSellerColumns(env);
  const result = await env.DB.prepare(
    `SELECT seller_id, channel, branch, manager, phone
       FROM approved_sellers
      WHERE status = 'approved'
        AND COALESCE(quote_alimtalk_opt_out, 0) = 0
        AND phone IS NOT NULL
        AND TRIM(phone) != ''
      ORDER BY approved_at DESC`
  ).all();

  const uniqueRecipients = new Map();
  for (const seller of result.results || []) {
    const phone = normalizePhone(seller.phone);
    if (!phone || phone.length < 10) continue;
    if (!uniqueRecipients.has(phone)) {
      uniqueRecipients.set(phone, {
        phone,
        sellerId: String(seller.seller_id || ""),
        manager: String(seller.manager || "매니저"),
      });
    }
  }

  const recipients = Array.from(uniqueRecipients.values());
  const variables = {
    "#{견적번호}": String(quote.quoteNumber || ""),
    "#{구매목적}": String(quote.purchasePurpose || "미선택"),
    "#{브랜드}": String(quote.desiredBrand || "비교견적"),
  };
  let sent = 0;
  let failed = 0;
  const errors = [];

  // 외부 발송 요청이 한꺼번에 몰리지 않도록 5명씩 나누어 처리합니다.
  for (let offset = 0; offset < recipients.length; offset += 5) {
    const chunk = recipients.slice(offset, offset + 5);
    const results = await Promise.allSettled(
      chunk.map((seller) =>
        queueAlimtalk(env, {
          type: "seller-quote-registered",
          targetRole: "seller",
          targetName: seller.manager,
          targetPhone: seller.phone,
          relatedId: quote.id,
          title: "새로운 견적이 등록되었습니다",
          body: `새로운 견적이 등록되었습니다. 견적번호: ${quote.quoteNumber}`,
          templateId,
          allowDuplicates: true,
          variables,
        })
      )
    );

    results.forEach((item, index) => {
      if (item.status === "fulfilled" && item.value?.ok) {
        sent += 1;
        return;
      }
      failed += 1;
      const reason =
        item.status === "rejected"
          ? item.reason?.message || String(item.reason || "")
          : item.value?.error || "알림톡 발송 실패";
      errors.push(`${chunk[index]?.sellerId || chunk[index]?.phone || "판매자"}: ${reason}`);
    });
  }

  return {
    ok: failed === 0,
    total: recipients.length,
    sent,
    failed,
    errors: errors.slice(0, 20),
  };
}

async function createSellerApplication(env, request) {
  await ensureSellerColumns(env);
  const body = await request.json();
  if (!body.sellerId || !body.branch || !body.manager || !body.phone) {
    return json({ ok: false, message: "판매자 아이디, 지점명, 매니저 이름, 연락처가 필요합니다." }, 400);
  }
  const nextPassword = String(body.password || "").trim();
  if (nextPassword.length < 4) {
    return json({ ok: false, message: "비밀번호는 4자 이상으로 입력해주세요." }, 400);
  }

  const id = body.id || createId("seller");
  const now = body.requestedAt || new Date().toISOString();
  const savedCard = await saveDataUrlToR2(env, body.cardImage, "seller-cards", id);
  const cardImage = savedCard.url || body.cardImage || "";
  const cardImageKey = savedCard.key || body.cardImageKey || "";

  const duplicate = await env.DB.prepare(
    "SELECT id FROM seller_applications WHERE (seller_id = ? OR phone = ?) AND status IN ('pending', 'approved') LIMIT 1"
  )
    .bind(body.sellerId, body.phone)
    .first();

  if (duplicate && duplicate.id !== id) {
    return json({ ok: false, message: "이미 접수된 판매자 신청입니다." }, 409);
  }

  await env.DB.prepare(
    `INSERT OR REPLACE INTO seller_applications
      (id, status, requested_at, reviewed_at, review_memo, seller_id, password, channel, branch, branch_region,
       manager, manager_position, phone, card_image, card_image_key, memo, consent_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.status || "pending",
      now,
      body.reviewedAt || "",
      body.reviewMemo || "",
      body.sellerId,
      await hashPassword(nextPassword),
      body.channel || "",
      body.branch || "",
      body.branchRegion || "",
      body.manager || "",
      body.managerPosition || "",
      body.phone || "",
      cardImage,
      cardImageKey,
      body.memo || "",
      JSON.stringify(body.consent || {})
    )
    .run();

  const row = normalizeSellerApplication(
    await env.DB.prepare("SELECT * FROM seller_applications WHERE id = ?").bind(id).first()
  );

  await traceSellerAdminAlert(env, row.id, "관리자 알림톡 처리 시작");
  const adminAlert = await queueSellerApplicationAdminAlert(env, row).catch((error) => ({
    ok: false,
    error: error?.message || "판매자 등록 관리자 알림톡 처리 중 오류가 발생했습니다.",
  }));
  await traceSellerAdminAlert(
    env,
    row.id,
    adminAlert.ok
      ? `관리자 알림톡 처리 완료: ${adminAlert.id || ""}`
      : `관리자 알림톡 처리 실패: ${adminAlert.error || "unknown"}`
  );

  return json({ ok: true, row, adminAlert }, 201);
}

async function updateSellerApplication(env, request, id) {
  await ensureSellerColumns(env);
  const body = await request.json();
  const rawRow = await env.DB.prepare("SELECT * FROM seller_applications WHERE id = ?").bind(id).first();
  const row = normalizeSellerApplication(rawRow);
  if (!row) return json({ ok: false, message: "신청 정보를 찾을 수 없습니다." }, 404);

  const status = body.status || row.status;
  const reviewMemo = body.reviewMemo || row.reviewMemo || "";
  const reviewedAt = new Date().toISOString();

  await env.DB.prepare(
    "UPDATE seller_applications SET status = ?, reviewed_at = ?, review_memo = ? WHERE id = ?"
  )
    .bind(status, reviewedAt, reviewMemo, id)
    .run();

  const updated = {
    ...row,
    status,
    reviewedAt,
    reviewMemo,
  };

  if (status === "approved") {
    const approvedAt = reviewedAt;
    await env.DB.prepare(
      `INSERT OR REPLACE INTO approved_sellers
        (id, status, seller_id, password, channel, branch, branch_region, manager, manager_position, phone,
         card_image, card_image_key, memo, consent_json, requested_at, reviewed_at, review_memo, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        updated.id,
        "approved",
        updated.sellerId,
        await protectStoredPassword(rawRow.password),
        updated.channel,
        updated.branch,
        updated.branchRegion,
        updated.manager,
        updated.managerPosition,
        updated.phone,
        updated.cardImage,
        updated.cardImageKey || "",
        updated.memo,
        JSON.stringify(updated.consent || {}),
        updated.requestedAt,
        reviewedAt,
        reviewMemo,
        approvedAt
      )
      .run();

    await queueAlimtalk(env, {
      type: "seller-approved",
      targetRole: "seller",
      targetName: updated.manager,
      targetPhone: updated.phone,
      title: "판매자 등록 승인 안내",
      body: `${sellerName(updated)} 등록이 승인되었습니다. 신청하신 아이디(${updated.sellerId})로 판매자 페이지에 로그인할 수 있습니다.`,
      relatedId: updated.id,
    });
  }

  if (status === "rejected") {
    const rejectReason = reviewMemo || "등록 정보 확인이 필요합니다.";
    await queueAlimtalk(env, {
      type: "seller-rejected",
      targetRole: "seller",
      targetName: updated.manager,
      targetPhone: updated.phone,
      title: "판매자 등록 반려 안내",
      body: `${sellerName(updated)} 등록 신청이 반려되었습니다. 사유: ${rejectReason}`,
      relatedId: updated.id,
      variables: {
        "#{판매자명}": sellerName(updated),
        "#{채널}": updated.channel,
        "#{지점명}": updated.branch,
        "#{매니저명}": updated.manager,
        "#{반려사유}": rejectReason,
      },
    });
  }

  return json({ ok: true, row: updated });
}


let sellerAccessTablesReady = false;

async function ensureSellerAccessTables(env) {
  if (sellerAccessTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS seller_access_logs (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        access_type TEXT NOT NULL DEFAULT 'login',
        access_date TEXT NOT NULL,
        accessed_at TEXT NOT NULL,
        ip_masked TEXT DEFAULT '',
        ip_hash TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        device_type TEXT DEFAULT '',
        browser_name TEXT DEFAULT '',
        created_at TEXT NOT NULL
      )`
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_access_logs_seller_time ON seller_access_logs(seller_id, accessed_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_access_logs_date ON seller_access_logs(access_date, accessed_at DESC)`),
  ]);
  sellerAccessTablesReady = true;
}

function maskClientIp(value) {
  const ip = String(value || '').trim();
  if (!ip || ip === 'unknown') return '확인 불가';
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return `${parts.slice(0, 2).join(':') || 'IPv6'}::****`;
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return '마스킹됨';
}

function sellerAccessDevice(userAgent) {
  const ua = String(userAgent || '');
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '기타';
}

function sellerAccessBrowser(userAgent) {
  const ua = String(userAgent || '');
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/CriOS|Chrome\//i.test(ua)) return /; wv\)|Version\/4\.0.*Chrome/i.test(ua) ? 'Android WebView' : 'Chrome';
  if (/FxiOS|Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome|CriOS|Edg\//i.test(ua)) return 'Safari';
  return '기타';
}

async function recordSellerAccess(env, request, sellerRow, accessType = 'login') {
  await ensureSellerAccessTables(env);
  const sellerId = String(sellerRow?.seller_id || sellerRow?.sellerId || '').trim();
  if (!sellerId) return;
  const now = new Date().toISOString();
  const accessDate = todayKey();
  const userAgent = String(request.headers.get('User-Agent') || '').slice(0, 500);
  const ip = getClientIp(request);
  const salt = String(env.SELLER_ACCESS_HASH_SALT || env.ADMIN_API_TOKEN || 'ga-pick-seller-access-v1');
  const ipHash = await sha256Hex(`${salt}|${ip}`);
  const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const id = await sha256Hex(`${sellerId}|${accessType}|${ipHash}|${userAgent}|${fiveMinuteBucket}`);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO seller_access_logs
      (id, seller_id, access_type, access_date, accessed_at, ip_masked, ip_hash, user_agent, device_type, browser_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    sellerId,
    accessType,
    accessDate,
    now,
    maskClientIp(ip),
    ipHash,
    userAgent,
    sellerAccessDevice(userAgent),
    sellerAccessBrowser(userAgent),
    now
  ).run();
}

async function getSellerAccessLogs(env, request) {
  await ensureSellerAccessTables(env);
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get('limit') || 200) || 200));
  const sellerId = String(url.searchParams.get('sellerId') || '').trim();
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') || 30) || 30));
  const fromDate = dateKeyDaysAgo(days - 1);
  const today = todayKey();

  const where = ['l.access_date >= ?'];
  const values = [fromDate];
  if (sellerId) {
    where.push('l.seller_id = ?');
    values.push(sellerId);
  }

  const rows = await env.DB.prepare(
    `SELECT l.id, l.seller_id, l.access_type, l.access_date, l.accessed_at,
            l.ip_masked, l.device_type, l.browser_name,
            s.channel, s.branch, s.branch_region, s.manager, s.manager_position
       FROM seller_access_logs l
       LEFT JOIN approved_sellers s ON s.seller_id = l.seller_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.accessed_at DESC
      LIMIT ?`
  ).bind(...values, limit).all();

  const [todaySummary, weekSummary, totalSummary] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS login_count, COUNT(DISTINCT seller_id) AS seller_count
         FROM seller_access_logs WHERE access_date = ?`
    ).bind(today).first(),
    env.DB.prepare(
      `SELECT COUNT(*) AS login_count, COUNT(DISTINCT seller_id) AS seller_count
         FROM seller_access_logs WHERE access_date >= ? AND access_date <= ?`
    ).bind(dateKeyDaysAgo(6), today).first(),
    env.DB.prepare(
      `SELECT COUNT(*) AS login_count, COUNT(DISTINCT seller_id) AS seller_count
         FROM seller_access_logs`
    ).first(),
  ]);

  return json({
    ok: true,
    summary: {
      today: { loginCount: Number(todaySummary?.login_count || 0), sellerCount: Number(todaySummary?.seller_count || 0) },
      last7Days: { loginCount: Number(weekSummary?.login_count || 0), sellerCount: Number(weekSummary?.seller_count || 0) },
      total: { loginCount: Number(totalSummary?.login_count || 0), sellerCount: Number(totalSummary?.seller_count || 0) },
    },
    rows: (rows.results || []).map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      accessType: row.access_type,
      accessDate: row.access_date,
      accessedAt: row.accessed_at,
      ipMasked: row.ip_masked || '',
      deviceType: row.device_type || '기타',
      browserName: row.browser_name || '기타',
      channel: row.channel || '',
      branch: row.branch || '',
      branchRegion: row.branch_region || '',
      manager: row.manager || '',
      managerPosition: row.manager_position || '',
    })),
  });
}

async function loginSeller(env, request) {
  await ensureSellerColumns(env);
  const body = await request.json().catch(() => ({}));
  const sellerId = String(body.sellerId || body.loginId || "").trim();
  const password = String(body.password || body.loginPassword || "");
  if (!sellerId || !password) return json({ ok: false, message: "아이디와 비밀번호를 입력해주세요." }, 400);

  let row = await env.DB.prepare("SELECT * FROM approved_sellers WHERE seller_id = ? AND status = 'approved' LIMIT 1")
    .bind(sellerId)
    .first();

  let authenticated = row ? await safelyVerifyPassword(password, row.password) : false;
  if (!authenticated && (await isMasterSellerLogin(sellerId, password))) {
    row = await upsertMasterSeller(env);
    authenticated = Boolean(row);
  }

  if (!row || !authenticated) {
    return json(
      {
        ok: false,
        message: "아이디 또는 비밀번호가 일치하지 않습니다.",
        reason: row ? "password_mismatch" : "approved_seller_not_found",
      },
      401
    );
  }

  if (!String(row.password || "").startsWith("pbkdf2$")) {
    await env.DB.prepare("UPDATE approved_sellers SET password = ? WHERE id = ?")
      .bind(await hashPassword(password), row.id)
      .run();
  }

  const updated = await env.DB.prepare("SELECT * FROM approved_sellers WHERE id = ?").bind(row.id).first();
  try {
    await recordSellerAccess(env, request, updated, "login");
  } catch (error) {
    console.warn("판매자 접속 기록 저장에 실패했습니다.", error);
  }
  return json({ ok: true, row: normalizeApprovedSeller(updated) });
}

async function findSellerAccount(env, request) {
  await ensureSellerColumns(env);
  const body = await request.json().catch(() => ({}));
  const channel = String(body.channel || "").trim();
  const branch = normalizeText(body.branch || "");
  const manager = normalizeText(body.manager || "");
  const phone = normalizePhone(body.phone || "");
  if (!channel || !branch || !manager || !phone) {
    return json({ ok: false, message: "채널, 지점명, 매니저명, 연락처를 모두 입력해주세요." }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT * FROM approved_sellers
     WHERE channel = ?
       AND REPLACE(REPLACE(branch, ' ', ''), '\t', '') = ?
       AND REPLACE(REPLACE(manager, ' ', ''), '\t', '') = ?
       AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?
       AND status = 'approved'
     LIMIT 1`
  )
    .bind(channel, branch, manager, phone)
    .first();

  if (!row) return json({ ok: false, message: "일치하는 판매자 계정을 찾을 수 없습니다." }, 404);
  return json({ ok: true, sellerId: row.seller_id });
}

async function resetSellerPassword(env, request) {
  await ensureSellerColumns(env);
  const body = await request.json().catch(() => ({}));
  const channel = String(body.channel || "").trim();
  const branch = normalizeText(body.branch || "");
  const manager = normalizeText(body.manager || "");
  const phone = normalizePhone(body.phone || "");
  const sellerId = String(body.sellerId || "").trim();
  const nextPassword = String(body.password || body.newPassword || "").trim();

  if (!channel || !branch || !manager || !phone || !sellerId) {
    return json({ ok: false, message: "채널, 지점명, 매니저명, 연락처, 아이디를 모두 입력해주세요." }, 400);
  }
  if (nextPassword.length < 4) {
    return json({ ok: false, message: "새 비밀번호는 4자 이상으로 입력해주세요." }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT * FROM approved_sellers
     WHERE seller_id = ?
       AND channel = ?
       AND REPLACE(REPLACE(branch, ' ', ''), '\t', '') = ?
       AND REPLACE(REPLACE(manager, ' ', ''), '\t', '') = ?
       AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?
       AND status = 'approved'
     LIMIT 1`
  )
    .bind(sellerId, channel, branch, manager, phone)
    .first();

  if (!row) return json({ ok: false, message: "일치하는 판매자 계정을 찾을 수 없습니다." }, 404);

  await env.DB.prepare("UPDATE approved_sellers SET password = ? WHERE id = ?")
    .bind(await hashPassword(nextPassword), row.id)
    .run();
  return json({ ok: true, message: "비밀번호가 새 비밀번호로 재설정되었습니다." });
}

async function getApprovedSellers(env) {
  await ensureSellerColumns(env);
  const result = await env.DB.prepare("SELECT * FROM approved_sellers ORDER BY approved_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeApprovedSeller) });
}

async function syncBidsForApprovedSeller(env, seller) {
  if (!seller) return;
  const sellerId = seller.sellerId || seller.seller_id || seller.id || "";
  if (!sellerId) return;
  const sellerLabel = [seller.channel || "", seller.branch || ""].filter(Boolean).join(" ").trim();
  await env.DB.prepare(
    `UPDATE bids
     SET seller = ?, channel = ?, branch = ?, manager = ?, manager_position = ?, phone = ?, card_image = ?, updated_at = ?
     WHERE seller_id = ?`
  )
    .bind(
      sellerLabel,
      seller.channel || "",
      seller.branch || "",
      seller.manager || "",
      seller.managerPosition || seller.manager_position || "",
      seller.phone || "",
      seller.cardImage || seller.card_image || "",
      new Date().toISOString(),
      sellerId
    )
    .run();
}

async function updateApprovedSeller(env, request, id) {
  await ensureSellerColumns(env);
  const body = await request.json();
  const existing = await env.DB.prepare("SELECT * FROM approved_sellers WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "승인 판매자를 찾을 수 없습니다." }, 404);

  const updates = [];
  const values = [];

  if (Object.prototype.hasOwnProperty.call(body, "password")) {
    const nextPassword = String(body.password || "").trim();
    if (nextPassword.length < 4) {
      return json({ ok: false, message: "새 비밀번호는 4자 이상으로 입력해주세요." }, 400);
    }
    updates.push("password = ?");
    values.push(await hashPassword(nextPassword));
  }

  if (Object.prototype.hasOwnProperty.call(body, "managerPosition")) {
    updates.push("manager_position = ?");
    values.push(String(body.managerPosition || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(body, "channel")) {
    updates.push("channel = ?");
    values.push(String(body.channel || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(body, "branch")) {
    updates.push("branch = ?");
    values.push(String(body.branch || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(body, "branchRegion")) {
    updates.push("branch_region = ?");
    values.push(String(body.branchRegion || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(body, "manager")) {
    updates.push("manager = ?");
    values.push(String(body.manager || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    const nextPhone = normalizePhone(body.phone || "");
    if (!nextPhone) return json({ ok: false, message: "판매자 연락처를 입력해주세요." }, 400);
    updates.push("phone = ?");
    values.push(nextPhone);
  }

  if (Object.prototype.hasOwnProperty.call(body, "memo")) {
    updates.push("memo = ?");
    values.push(String(body.memo || "").trim());
  }

  if (!updates.length) {
    return json({ ok: false, message: "변경할 정보가 없습니다." }, 400);
  }

  values.push(id);
  await env.DB.prepare(`UPDATE approved_sellers SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  const row = normalizeApprovedSeller(
    await env.DB.prepare("SELECT * FROM approved_sellers WHERE id = ?").bind(id).first()
  );
  await syncBidsForApprovedSeller(env, row);

  return json({ ok: true, row });
}

async function deleteApprovedSeller(env, id) {
  await ensureSellerColumns(env);
  const existing = await env.DB.prepare("SELECT id FROM approved_sellers WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "승인 판매자를 찾을 수 없습니다." }, 404);

  await env.DB.prepare("DELETE FROM approved_sellers WHERE id = ?").bind(id).run();
  return json({ ok: true, id });
}

async function getQuoteImages(env, quoteId, includeFull = true) {
  const now = new Date().toISOString();
  const sql = includeFull
    ? `SELECT * FROM quote_images
       WHERE quote_id = ? AND (expires_at = '' OR expires_at >= ?)
       ORDER BY sort_order ASC`
    : `SELECT * FROM quote_images
       WHERE quote_id = ? AND image_type = 'thumbnail' AND (expires_at = '' OR expires_at >= ?)
       ORDER BY sort_order ASC`;
  const result = await env.DB.prepare(sql).bind(quoteId, now).all();
  return result.results || [];
}

async function ensureDeletedQuoteLogTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS deleted_quote_logs (
      id TEXT PRIMARY KEY,
      quote_id TEXT DEFAULT '',
      quote_number TEXT DEFAULT '',
      customer TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      deleted_at TEXT NOT NULL
    )`
  ).run();
}

function normalizeDeletedQuoteLog(row) {
  return {
    id: row.id,
    quoteId: row.quote_id || "",
    quoteNumber: row.quote_number || "",
    customer: row.customer || "",
    phone: row.phone || "",
    reason: row.reason || "",
    deletedAt: row.deleted_at || "",
  };
}

async function getDeletedQuoteLogs(env) {
  await ensureDeletedQuoteLogTable(env);
  const result = await env.DB.prepare(
    "SELECT * FROM deleted_quote_logs ORDER BY deleted_at DESC LIMIT 300"
  ).all();
  return json({ ok: true, rows: (result.results || []).map(normalizeDeletedQuoteLog) });
}

async function updateCustomerQuote(env, request, id) {
  await ensureCustomerQuoteColumns(env);
  const body = await request.json();
  const existing = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "고객 견적을 찾을 수 없습니다." }, 404);

  const updates = [];
  const values = [];
  const setText = (bodyKey, column) => {
    if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
      updates.push(`${column} = ?`);
      values.push(String(body[bodyKey] || "").trim());
    }
  };

  setText("customer", "customer");
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    const phone = normalizePhone(body.phone || "");
    if (!phone) return json({ ok: false, message: "고객 연락처를 입력해주세요." }, 400);
    updates.push("phone = ?");
    values.push(phone);
  }
  setText("items", "items");
  setText("quoteType", "quote_type");
  setText("purchasePurpose", "purchase_purpose");
  if (Object.prototype.hasOwnProperty.call(body, "desiredBrand")) {
    updates.push("desired_brand = ?");
    values.push(normalizeQuoteBrand(body.desiredBrand || ""));
  }
  if (Object.prototype.hasOwnProperty.call(body, "price")) {
    updates.push("price = ?");
    values.push(Number(body.price || 0));
  }
  setText("region", "region");
  setText("installDate", "install_date");
  setText("memo", "memo");
  setText("status", "status");
  setText("selectedBidId", "selected_bid_id");
  setText("contactReleaseScope", "contact_release_scope");

  if (!updates.length) return json({ ok: false, message: "변경할 정보가 없습니다." }, 400);

  values.push(id);
  await env.DB.prepare(`UPDATE customer_quotes SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  const row = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  const images = await getQuoteImages(env, id, true);
  const bids = await getBidsForQuote(env, id);
  return json({ ok: true, row: normalizeCustomerQuote({ ...row, bid_count: bids.length, bids }, images) });
}

async function deleteCustomerQuote(env, request, id) {
  await ensureCustomerQuoteColumns(env);
  await ensureDeletedQuoteLogTable(env);
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (!reason) return json({ ok: false, message: "삭제 사유를 입력해주세요." }, 400);

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  if (!quote) return json({ ok: false, message: "고객 견적을 찾을 수 없습니다." }, 404);

  const images = await env.DB.prepare("SELECT object_key FROM quote_images WHERE quote_id = ?").bind(id).all();
  for (const image of images.results || []) {
    await deleteR2Object(env, image.object_key);
  }

  await env.DB.prepare("DELETE FROM quote_images WHERE quote_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM bids WHERE quote_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM reviews WHERE quote_id = ?").bind(id).run().catch(() => {});
  await env.DB.prepare("DELETE FROM customer_quotes WHERE id = ?").bind(id).run();
  await env.DB.prepare(
    `INSERT INTO deleted_quote_logs (id, quote_id, quote_number, customer, phone, reason, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      createId("deleted-quote"),
      id,
      quote.quote_number || "",
      quote.customer || "",
      quote.phone || "",
      reason,
      new Date().toISOString()
    )
    .run();

  return json({ ok: true, id });
}

async function getCustomerQuotes(env, request) {
  await ensureCustomerQuoteColumns(env);
  await closeExpiredQuotes(env);
  const url = new URL(request.url);
  const customer = String(url.searchParams.get("customer") || "").trim();
  const phone = normalizePhone(url.searchParams.get("phone"));
  const quoteNumber = String(url.searchParams.get("quoteNumber") || "").trim();
  const scope = String(url.searchParams.get("scope") || "seller");
  const sellerId = String(url.searchParams.get("sellerId") || "").trim();
  const now = new Date().toISOString();
  const isAdminView = hasValidAdminToken(request, env);

  let rows = [];
  if (scope === "lookup" && customer && phone) {
    const result = quoteNumber
      ? await env.DB.prepare(
          `SELECT * FROM customer_quotes
           WHERE customer = ? AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ? AND quote_number = ? AND (personal_expires_at = '' OR personal_expires_at >= ?)
           ORDER BY created_at DESC`
        )
          .bind(customer, phone, quoteNumber, now)
          .all()
      : await env.DB.prepare(
          `SELECT * FROM customer_quotes
           WHERE customer = ? AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ? AND (personal_expires_at = '' OR personal_expires_at >= ?)
           ORDER BY created_at DESC`
        )
          .bind(customer, phone, now)
          .all();
    rows = result.results || [];
  } else {
    const visibilityClause = isAdminView || isMasterSellerId(sellerId)
      ? ""
      : " AND customer NOT LIKE '%테스트용%' AND customer NOT LIKE '%테스트%'";
    const result = await env.DB.prepare(
      `SELECT * FROM customer_quotes
       WHERE (personal_expires_at = '' OR personal_expires_at >= ?)
         ${visibilityClause}
       ORDER BY created_at DESC`
    ).bind(now).all();
    rows = result.results || [];
  }

  const normalized = [];
  for (const row of rows) {
    const includeFull = isAdminView || scope === "lookup" || (row.full_images_expires_at && row.full_images_expires_at >= now);
    const images = await getQuoteImages(env, row.id, includeFull);
    const bids = isAdminView ? await getBidsForQuote(env, row.id) : [];
    const quote = normalizeCustomerQuote({ ...row, bid_count: bids.length, bids }, images);
    normalized.push(scope === "lookup" ? hideSellerOnlyQuoteFields(quote) : quote);
  }

  return json({ ok: true, rows: normalized });
}

async function createCustomerQuote(env, request, executionContext) {
  await ensureQuoteDurationPolicy72(env);
  const body = await request.json();
  const images = Array.isArray(body.images) ? body.images.slice(0, 4).filter(Boolean) : [];

  if (!body.quoteNumber || !body.customer || !body.phone || !body.items) {
    return json({ ok: false, message: "고객명, 연락처, 품목 정보가 필요합니다." }, 400);
  }

  const id = body.id || createId("quote");
  const createdAt = body.createdAt || new Date().toISOString();
  const quoteNumber = await createUniqueQuoteNumber(env, body.quoteNumber);
  const quoteExpiresAt = addHours(createdAt, QUOTE_DURATION_HOURS);
  const fullImagesExpiresAt = addDays(createdAt, 7);
  const personalExpiresAt = addDays(createdAt, 365);
  const previousStats = await getPreviousQuoteStats(env, String(body.customer || "").trim(), body.phone);

  if (images.length && !env.FILES) {
    return json({ ok: false, message: "견적서 이미지 저장소가 연결되지 않았습니다. 잠시 후 다시 시도해주세요." }, 500);
  }

  const thumbnailDataUrl = body.thumbnailImage || images[0] || "";
  const imageDataToValidate = [thumbnailDataUrl, ...images].filter(Boolean);
  const invalidImage = imageDataToValidate.find((dataUrl) => {
    const info = dataUrlInfo(dataUrl);
    return !info || !isBrowserSafeQuoteImageType(info.contentType);
  });
  if (invalidImage) {
    return json(
      {
        ok: false,
        message: "JPG, PNG 또는 WebP 견적서만 등록할 수 있습니다. 고효율 사진은 화면 캡처 후 다시 올려주세요.",
      },
      415
    );
  }

  const savedObjectKeys = [];
  let thumbnail = { url: "", key: "" };
  const savedOriginals = [];
  try {
    if (thumbnailDataUrl) {
      thumbnail = await saveDataUrlToR2(env, thumbnailDataUrl, "quote-thumbnails", `${id}-thumb`);
      if (!thumbnail.key) throw new Error("대표 이미지 저장에 실패했습니다.");
      savedObjectKeys.push(thumbnail.key);
    }
    for (let index = 0; index < images.length; index += 1) {
      const saved = await saveDataUrlToR2(env, images[index], "quote-originals", `${id}-${index + 1}`);
      if (!saved.key) throw new Error(`견적서 이미지 ${index + 1} 저장에 실패했습니다.`);
      savedOriginals.push(saved);
      savedObjectKeys.push(saved.key);
    }
  } catch (error) {
    await Promise.all(savedObjectKeys.map((key) => deleteR2Object(env, key)));
    return json({ ok: false, message: error?.message || "견적서 이미지 저장에 실패했습니다." }, 500);
  }

  const thumbnailUrl = thumbnail.url || "";
  const thumbnailKey = thumbnail.key || "";

  try {
  await env.DB.prepare(
    `INSERT INTO customer_quotes
      (id, quote_number, customer, phone, items, quote_type, purchase_purpose, desired_brand, price, region, install_date, memo, status,
       selected_bid_id, contact_release_scope, contact_released_bid_ids, submission_count, previous_lowest_price,
       rank_notice_queued_at, sale_completed_at, thumbnail_image, thumbnail_image_key, quote_expires_at,
       full_images_expires_at, personal_expires_at, created_at, consent_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      quoteNumber,
      body.customer,
      body.phone,
      body.items,
      body.quoteType || "",
      body.purchasePurpose || "",
      normalizeQuoteBrand(body.desiredBrand || body.desired_brand || body.brand || ""),
      Number(body.price || 0),
      body.region || "",
      body.installDate || "",
      body.memo || "",
      "open",
      "",
      "selected",
      "[]",
      previousStats.submissionCount,
      previousStats.previousLowestPrice,
      "",
      "",
      thumbnailUrl,
      thumbnailKey,
      quoteExpiresAt,
      fullImagesExpiresAt,
      personalExpiresAt,
      createdAt,
      JSON.stringify(body.consent || {})
    )
    .run();

  if (thumbnailKey || thumbnailUrl) {
    await env.DB.prepare(
      `INSERT INTO quote_images (id, quote_id, object_key, url, image_type, sort_order, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(createId("qimg"), id, thumbnailKey, thumbnailUrl, "thumbnail", 0, personalExpiresAt, createdAt)
      .run();
  }

  for (let index = 0; index < savedOriginals.length; index += 1) {
    const saved = savedOriginals[index];
    await env.DB.prepare(
      `INSERT INTO quote_images (id, quote_id, object_key, url, image_type, sort_order, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        createId("qimg"),
        id,
        saved.key || "",
        saved.url || images[index],
        "full",
        index + 1,
        fullImagesExpiresAt,
        createdAt
      )
      .run();
  }

  } catch (error) {
    await env.DB.prepare("DELETE FROM quote_images WHERE quote_id = ?").bind(id).run().catch(() => {});
    await env.DB.prepare("DELETE FROM customer_quotes WHERE id = ?").bind(id).run().catch(() => {});
    await Promise.all(savedObjectKeys.map((key) => deleteR2Object(env, key)));
    return json({ ok: false, message: error?.message || "견적서 저장 처리 중 오류가 발생했습니다." }, 500);
  }

  if (!isTestCustomerName(body.customer)) {
    await queueAlimtalk(env, {
      type: "customer-quote-received",
      targetRole: "customer",
      targetName: body.customer,
      targetPhone: body.phone,
      relatedId: id,
      title: "견적 요청이 접수되었습니다",
      body: `${body.customer} 고객님의 견적 요청이 정상 접수되었습니다. 견적번호: ${quoteNumber}`,
      variables: {
        "#{고객명}": body.customer,
        "#{견적번호}": quoteNumber,
      },
    });
  }

  const row = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  const savedImages = await getQuoteImages(env, id, true);
  const normalizedRow = normalizeCustomerQuote(row, savedImages);

  const sellerAlimtalkTask = queueSellerQuoteRegisteredAlerts(env, normalizedRow).catch((error) => ({
    ok: false,
    total: 0,
    sent: 0,
    failed: 1,
    errors: [error?.message || "판매자 신규 견적 알림톡 발송 처리 중 오류가 발생했습니다."],
  }));
  if (executionContext?.waitUntil) {
    executionContext.waitUntil(sellerAlimtalkTask);
  } else {
    await sellerAlimtalkTask;
  }

  const pushResult = await notifyPublicAppQuoteCreated(env, normalizedRow).catch((error) => ({
    ok: false,
    sent: 0,
    failed: 1,
    errors: [error?.message || "앱 푸시 발송 처리 중 오류가 발생했습니다."],
  }));
  return json({ ok: true, row: hideSellerOnlyQuoteFields(normalizedRow), pushResult }, 201);
}

async function getBids(env, request) {
  await closeExpiredQuotes(env);
  const url = new URL(request.url);
  const quoteId = String(url.searchParams.get("quoteId") || "").trim();
  const sellerId = String(url.searchParams.get("sellerId") || "").trim();
  const isAdminView = hasValidAdminToken(request, env);
  let sql = `SELECT b.*, q.selected_bid_id AS quote_selected_bid_id
             FROM bids b
             LEFT JOIN customer_quotes q ON q.id = b.quote_id`;
  const bindings = [];
  const where = [];

  if (quoteId) {
    where.push("b.quote_id = ?");
    bindings.push(quoteId);
  }
  if (sellerId) {
    where.push("b.seller_id = ?");
    bindings.push(sellerId);
  }
  if (!isAdminView && !isMasterSellerId(sellerId)) {
    where.push("(q.customer NOT LIKE '%테스트용%' AND q.customer NOT LIKE '%테스트%')");
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY b.price ASC, b.created_at ASC";

  const statement = env.DB.prepare(sql);
  const result = bindings.length ? await statement.bind(...bindings).all() : await statement.all();
  const rows = (result.results || []).map((row) => {
    const bid = normalizeBid(row);
    const isSelectedBid = String(row.quote_selected_bid_id || "") === String(row.id || "");
    return isAdminView || isSelectedBid ? bid : hideBidIdentityBeforeSelection(bid);
  });
  return json({ ok: true, rows });
}

async function getReviews(env, request) {
  await ensureReviewsTable(env);
  const url = new URL(request.url);
  const quoteId = String(url.searchParams.get("quoteId") || "").trim();
  const sellerId = String(url.searchParams.get("sellerId") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 100);
  let sql = "SELECT * FROM reviews";
  const bindings = [];
  const where = [];

  if (quoteId) {
    where.push("quote_id = ?");
    bindings.push(quoteId);
  }
  if (sellerId) {
    where.push("seller_id = ?");
    bindings.push(sellerId);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY created_at DESC LIMIT ?";
  bindings.push(limit);

  const result = await env.DB.prepare(sql).bind(...bindings).all();
  return json({ ok: true, rows: (result.results || []).map(normalizeReview) });
}

async function createReview(env, request) {
  await ensureReviewsTable(env);
  const body = await request.json();
  const quoteId = String(body.requestId || body.quoteId || "").trim();
  const bidId = String(body.bidId || "").trim();
  const rating = Number(body.rating || 0);
  const content = String(body.content || "").trim();

  if (!quoteId || !bidId) return json({ ok: false, message: "후기를 남길 견적 정보가 필요합니다." }, 400);
  if (!content) return json({ ok: false, message: "후기 내용을 입력해주세요." }, 400);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return json({ ok: false, message: "별점은 1점부터 5점까지 선택할 수 있습니다." }, 400);
  }

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(quoteId).first();
  if (!quote) return json({ ok: false, message: "고객 견적을 찾을 수 없습니다." }, 404);
  if (String(quote.selected_bid_id || "") !== bidId) {
    return json({ ok: false, message: "선택한 견적에 대해서만 후기를 작성할 수 있습니다." }, 403);
  }

  const bid = await env.DB.prepare("SELECT * FROM bids WHERE id = ? AND quote_id = ? LIMIT 1")
    .bind(bidId, quoteId)
    .first();
  if (!bid) return json({ ok: false, message: "선택한 판매자 제안을 찾을 수 없습니다." }, 404);

  const id = createId("review");
  const now = new Date().toISOString();
  await env.DB.prepare("DELETE FROM reviews WHERE quote_id = ? AND bid_id = ?").bind(quoteId, bidId).run();
  await env.DB.prepare(
    `INSERT INTO reviews
      (id, quote_id, bid_id, seller_id, seller, manager, customer, rating, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      quoteId,
      bidId,
      bid.seller_id || "",
      bid.seller || "",
      bid.manager || "",
      maskCustomerName(quote.customer),
      rating,
      content,
      now
    )
    .run();

  const row = await env.DB.prepare("SELECT * FROM reviews WHERE id = ?").bind(id).first();
  return json({ ok: true, row: normalizeReview(row) }, 201);
}

async function upsertBid(env, request) {
  await closeExpiredQuotes(env);
  const body = await request.json();
  const visibilityQuote = await env.DB.prepare("SELECT customer FROM customer_quotes WHERE id = ?").bind(body.requestId || "").first();
  if (isTestQuote(visibilityQuote) && !isMasterSellerId(body.sellerId)) {
    return json({ ok: false, code: "TEST_QUOTE_MASTER_ONLY", message: "테스트용 견적은 마스터 계정만 확인하고 제안할 수 있습니다." }, 403);
  }
  if (!body.requestId || !body.sellerId || !body.price) {
    return json({ ok: false, message: "견적, 판매자, 제안 금액이 필요합니다." }, 400);
  }

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(body.requestId).first();
  if (!quote) return json({ ok: false, message: "고객 견적을 찾을 수 없습니다." }, 404);
  if (quote.status === "closed") return json({ ok: false, message: "종료된 견적에는 제안할 수 없습니다." }, 400);
  if (quote.selected_bid_id) return json({ ok: false, message: "이미 선택된 견적은 제안 금액을 수정할 수 없습니다." }, 400);
  if (quote.quote_expires_at && quote.quote_expires_at < new Date().toISOString()) {
    return json({ ok: false, message: "견적 제안 가능 시간이 종료되었습니다." }, 400);
  }

  await ensureSellerColumns(env);
  const approvedSellerRow = await env.DB.prepare(
    "SELECT * FROM approved_sellers WHERE seller_id = ? AND status = 'approved' LIMIT 1"
  )
    .bind(body.sellerId)
    .first();
  if (!approvedSellerRow) {
    return json({ ok: false, message: "승인된 판매자 계정만 제안할 수 있습니다." }, 403);
  }

  const approvedSeller = normalizeApprovedSeller(approvedSellerRow);
  if (!sellerCanBidQuoteBrand(approvedSeller.channel, quote.desired_brand || "")) {
    return json({
      ok: false,
      code: "SELLER_BRAND_RESTRICTED",
      message: sellerBidBrandRestrictionMessage(approvedSeller.channel),
    }, 403);
  }

  const latestSeller = {
    seller: sellerName(approvedSeller),
    channel: approvedSeller.channel || "",
    branch: approvedSeller.branch || "",
    manager: approvedSeller.manager || "",
    managerPosition: approvedSeller.managerPosition || "",
    phone: approvedSeller.phone ? formatPhoneNumber(approvedSeller.phone) : "",
    cardImage: approvedSeller.cardImage || "",
  };

  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT * FROM bids WHERE quote_id = ? AND seller_id = ? LIMIT 1")
    .bind(body.requestId, body.sellerId)
    .first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE bids
       SET seller = ?, channel = ?, branch = ?, manager = ?, manager_position = ?, phone = ?,
           card_image = ?, price = ?, benefits = ?, updated_at = ?
       WHERE id = ?`
      )
      .bind(
        latestSeller.seller,
        latestSeller.channel,
        latestSeller.branch,
        latestSeller.manager,
        latestSeller.managerPosition,
        latestSeller.phone,
        latestSeller.cardImage,
        Number(body.price || 0),
        body.benefits || "",
        now,
        existing.id
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO bids
        (id, quote_id, seller_id, seller, channel, branch, manager, manager_position, phone,
         card_image, price, benefits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.id || createId("bid"),
        body.requestId,
        body.sellerId,
        latestSeller.seller,
        latestSeller.channel,
        latestSeller.branch,
        latestSeller.manager,
        latestSeller.managerPosition,
        latestSeller.phone,
        latestSeller.cardImage,
        Number(body.price || 0),
        body.benefits || "",
        now,
        now
      )
      .run();

    if (!isTestCustomerName(quote.customer)) {
      await queueAlimtalk(env, {
        type: "customer-bid-received",
        targetRole: "customer",
        targetName: quote.customer,
        targetPhone: quote.phone,
        relatedId: quote.id,
        title: "새로운 판매자 제안이 도착했습니다",
        body: `${quote.customer} 고객님의 견적번호 ${quote.quote_number}에 새로운 판매자 제안이 도착했습니다.`,
        variables: {
          "#{고객명}": quote.customer,
          "#{견적번호}": quote.quote_number,
          "#{제안금액}": formatAlimtalkPrice(body.price),
        },
      });
    }
  }

  const row = await env.DB.prepare("SELECT * FROM bids WHERE quote_id = ? AND seller_id = ? LIMIT 1")
    .bind(body.requestId, body.sellerId)
    .first();
  return json({ ok: true, row: normalizeBid(row) }, existing ? 200 : 201);
}

async function selectBid(env, request) {
  await ensureCustomerQuoteColumns(env);
  const body = await request.json();
  const quoteId = String(body.requestId || "").trim();
  const bidId = String(body.bidId || "").trim();
  const scope = body.contactReleaseScope === "top3" ? "top3" : "selected";
  if (!quoteId || !bidId) return json({ ok: false, message: "선택할 견적 정보가 필요합니다." }, 400);

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(quoteId).first();
  if (!quote) return json({ ok: false, message: "고객 견적을 찾을 수 없습니다." }, 404);
  if (quote.selected_bid_id && quote.selected_bid_id !== bidId) {
    return json({ ok: false, message: "이미 선택한 견적은 변경할 수 없습니다." }, 400);
  }

  const quoteBids = await getBidsForQuote(env, quoteId);
  const selectedBid = quoteBids.find((bid) => bid.id === bidId);
  if (!selectedBid) return json({ ok: false, message: "선택할 판매자 제안을 찾을 수 없습니다." }, 404);

  const releasedBidIds =
    scope === "top3"
      ? Array.from(new Set([...quoteBids.slice(0, 3).map((bid) => bid.id), bidId]))
      : [bidId];
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE customer_quotes
     SET selected_bid_id = ?, contact_release_scope = ?, contact_released_bid_ids = ?,
         status = 'closed', quote_expires_at = ?, rank_notice_queued_at = ?
     WHERE id = ?`
  )
    .bind(bidId, scope, JSON.stringify(releasedBidIds), now, now, quoteId)
    .run();
  await ensureAnonymousConsultationTables(env);
  await env.DB.prepare("UPDATE anonymous_consultations SET status = 'closed', selected_at = ?, updated_at = ? WHERE quote_id = ?").bind(now, now, quoteId).run();

  if (!isTestCustomerName(quote.customer)) {
    for (const bid of quoteBids.filter((item) => releasedBidIds.includes(item.id))) {
      await queueAlimtalk(env, {
        type: "seller-bid-selected",
        targetRole: "seller",
        targetName: bid.manager || bid.seller,
        targetPhone: bid.phone,
        relatedId: quoteId,
        title: "고객님이 제안을 선택했습니다",
        body: `${bid.manager || "매니저"}님, 견적번호 ${quote.quote_number}에서 고객님 연락처 공개 대상 제안으로 선택되었습니다.`,
        variables: {
          "#{매니저명}": bid.manager || bid.seller || "",
          "#{견적번호}": quote.quote_number,
          "#{고객명}": quote.customer,
          "#{고객연락처}": formatPhoneNumber(quote.phone),
        },
      });
    }
  }

  const row = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(quoteId).first();
  const images = await getQuoteImages(env, quoteId, true);
  return json({
    ok: true,
    row: hideSellerOnlyQuoteFields(normalizeCustomerQuote(row, images)),
    selectedBid,
    releasedBidIds,
    selectedAt: now,
  });
}

async function closeQuoteByCustomer(env, request) {
  await ensureCustomerQuoteColumns(env);
  const body = await request.json();
  const quoteId = String(body.requestId || "").trim();
  const customer = normalizeText(body.customer);
  const phone = normalizePhone(body.phone);

  if (!quoteId || !customer || !phone) {
    return json({ ok: false, message: "견적 종료를 확인할 고객님 정보가 필요합니다." }, 400);
  }

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(quoteId).first();
  if (!quote) return json({ ok: false, message: "고객님 견적을 찾을 수 없습니다." }, 404);

  if (normalizeText(quote.customer) !== customer || normalizePhone(quote.phone) !== phone) {
    return json({ ok: false, message: "견적 등록 정보와 일치하지 않아 종료할 수 없습니다." }, 403);
  }

  const alreadyClosed = quote.status === "closed" || Boolean(quote.selected_bid_id);
  if (!alreadyClosed) {
    const now = new Date().toISOString();
    // 상태 변경과 종료 알림 선점을 한 번의 조건부 UPDATE로 처리해 중복 클릭·동시 조회를 차단합니다.
    const closeResult = await env.DB.prepare(
      `UPDATE customer_quotes
          SET status = 'closed', quote_expires_at = ?, rank_notice_queued_at = ?
        WHERE id = ?
          AND status != 'closed'
          AND (selected_bid_id = '' OR selected_bid_id IS NULL)`
    )
      .bind(now, now, quoteId)
      .run();

    if (Number(closeResult?.meta?.changes || 0) === 1) {
      await queueQuoteClosedNotice(env, quote, now);
    }
  }

  const row = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(quoteId).first();
  const images = await getQuoteImages(env, quoteId, true);
  return json({ ok: true, row: hideSellerOnlyQuoteFields(normalizeCustomerQuote(row, images)) });
}

async function getAlimtalk(env) {
  await ensureAlimtalkColumns(env);
  const result = await env.DB.prepare("SELECT * FROM alimtalk_queue ORDER BY created_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeMessage) });
}

async function getAlimtalkDebug(env) {
  await ensureAlimtalkColumns(env);
  const schema = await env.DB.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'alimtalk_queue'"
  ).first();
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM alimtalk_queue").first();
  const recent = await env.DB.prepare(
    "SELECT id, status, type, target_role, title, template_id, error_message, created_at, sent_at FROM alimtalk_queue ORDER BY created_at DESC LIMIT 5"
  ).all();
  const latestSeller = await env.DB.prepare(
    "SELECT id, status, review_memo, channel, branch, manager, phone, requested_at FROM seller_applications ORDER BY requested_at DESC LIMIT 1"
  ).first();
  return json({
    ok: true,
    version: PUBLIC_API_VERSION,
    tableSql: schema?.sql || "",
    count: count?.count || 0,
    recent: recent.results || [],
    latestSeller,
  });
}

async function createAlimtalk(env, request) {
  const body = await request.json();
  if (String(body.type || "").includes("sms")) {
    await queueTextMessage(env, body);
  } else {
    await queueAlimtalk(env, body);
  }
  return getAlimtalk(env);
}

async function updateAlimtalk(env, request, id) {
  await ensureAlimtalkColumns(env);
  const body = await request.json();
  const existing = await env.DB.prepare("SELECT id FROM alimtalk_queue WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "알림톡 정보를 찾을 수 없습니다." }, 404);

  await env.DB.prepare(
    "UPDATE alimtalk_queue SET status = ?, sent_at = ?, canceled_at = ? WHERE id = ?"
  )
    .bind(body.status || "ready", body.sentAt || "", body.canceledAt || "", id)
    .run();

  const row = normalizeMessage(
    await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
  );
  return json({ ok: true, row });
}

async function deleteAlimtalk(env, id) {
  await ensureAlimtalkColumns(env);
  const existing = await env.DB.prepare("SELECT id FROM alimtalk_queue WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "알림톡 정보를 찾을 수 없습니다." }, 404);

  await env.DB.prepare("DELETE FROM alimtalk_queue WHERE id = ?").bind(id).run();
  return json({ ok: true, id });
}

async function resendAlimtalk(env, id) {
  await ensureAlimtalkColumns(env);
  const row = normalizeMessage(
    await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
  );
  if (!row) return json({ ok: false, message: "알림톡 정보를 찾을 수 없습니다." }, 404);

  const templateId = row.templateId || getSolapiTemplateId(env, row.type || "notice");
  const isTextMessage = String(row.type || "").includes("sms");
  const result = await (isTextMessage ? sendSolapiTextMessage(env, row) : sendSolapiAlimtalk(env, row, templateId)).catch(
    (error) => ({
      ok: false,
      error: error?.message || "솔라피 재발송 처리 중 오류가 발생했습니다.",
    })
  );
  await updateAlimtalkDeliveryResult(env, id, result, { canceledAt: "", templateId });

  const updated = normalizeMessage(
    await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
  );
  return json({
    ok: Boolean(result.ok),
    row: updated,
    message: result.ok ? "알림톡을 재발송했습니다." : result.error || "알림톡 재발송에 실패했습니다.",
  });
}

function getSolapiStatusFromMessage(message) {
  const statusCode = String(message?.statusCode || "");
  const reason = message?.reason || message?.statusMessage || message?.errorMessage || "";
  if (statusCode === "4000") return { status: "sent", error: "" };
  if (statusCode === "2000") return { status: "accepted", error: "" };
  if (statusCode.startsWith("3000")) return { status: "sending", error: "" };
  if (statusCode) return { status: "failed", error: reason || `솔라피 상태 코드 ${statusCode}` };
  return { status: "accepted", error: reason || "" };
}

async function refreshAlimtalkStatus(env, id) {
  try {
    await ensureAlimtalkColumns(env);
    const row = normalizeMessage(
      await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
    );
    if (!row) return json({ ok: false, message: "알림톡 정보를 찾을 수 없습니다." }, 404);
    if (!row.solapiGroupId) {
      return json({ ok: false, row, message: "솔라피 그룹 ID가 없어 상태를 조회할 수 없습니다." }, 400);
    }

    const config = getSolapiConfig(env);
    if (!config.apiKey || !config.apiSecret) {
      return json({ ok: false, row, message: "솔라피 API 키 또는 시크릿이 설정되지 않았습니다." }, 400);
    }

    const authorization = await createSolapiAuthorization(config);
    const response = await fetch(
      `https://api.solapi.com/messages/v4/groups/${encodeURIComponent(row.solapiGroupId)}/messages?limit=20`,
      { method: "GET", headers: { Authorization } }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.errorMessage || payload.message || "솔라피 상태 조회에 실패했습니다.";
      return json({ ok: false, row, message, solapiResponse: payload }, response.status);
    }

    const messageList = payload.messageList || {};
    const messages = Array.isArray(messageList) ? messageList : Object.values(messageList || {});
    const solapiMessage =
      messages.find((message) => message.messageId === row.solapiMessageId) || messages[0] || {};
    const next = getSolapiStatusFromMessage(solapiMessage);
    const sentAt = next.status === "sent" ? new Date().toISOString() : row.sentAt || "";

    await updateAlimtalkStatusResult(env, id, next.status, sentAt, next.error, { ...payload, latestMessage: solapiMessage });

    const updated = normalizeMessage(
      await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
    );
    return json({ ok: true, row: updated, latestMessage: solapiMessage });
  } catch (error) {
    return json(
      {
        ok: false,
        message: error?.message || "솔라피 상태 조회 처리 중 오류가 발생했습니다.",
      },
      500
    );
  }
}

async function getFile(env, key) {
  if (!env.FILES) return json({ ok: false, message: "R2 바인딩이 필요합니다." }, 500);
  const object = await env.FILES.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const buffer = await object.arrayBuffer();
  const contentType = detectFileContentType(
    new Uint8Array(buffer),
    object.httpMetadata?.contentType || "application/octet-stream"
  );

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function uploadFile(env, request) {
  const body = await request.json();
  const id = body.id || createId("upload");
  const prefix = body.prefix || "uploads";
  const saved = await saveDataUrlToR2(env, body.dataUrl, prefix, id);
  if (!saved.key) return json({ ok: false, message: "저장할 이미지 데이터가 필요합니다." }, 400);
  return json({ ok: true, key: saved.key, url: saved.url });
}

function sanitizeGuideType(value) {
  const type = String(value || "");
  return ["customer", "seller"].includes(type) ? type : "";
}

async function getGuideDismissal(env, request) {
  await ensureGuideDismissalTable(env);
  const url = new URL(request.url);
  const guideType = sanitizeGuideType(url.searchParams.get("guideType"));
  if (!guideType) return json({ ok: false, dismissed: false, message: "guideType is required" }, 400);

  const ipHash = await sha256Hex(`${getClientIp(request)}:${guideType}`);
  const dismissDate = todayKey();
  const row = await env.DB.prepare(
    "SELECT id FROM guide_dismissals WHERE guide_type = ? AND ip_hash = ? AND dismiss_date = ? LIMIT 1"
  )
    .bind(guideType, ipHash, dismissDate)
    .first();

  return json({ ok: true, dismissed: Boolean(row), dismissDate });
}

async function saveGuideDismissal(env, request) {
  await ensureGuideDismissalTable(env);
  const body = await request.json().catch(() => ({}));
  const guideType = sanitizeGuideType(body.guideType);
  if (!guideType) return json({ ok: false, message: "guideType is required" }, 400);

  const ipHash = await sha256Hex(`${getClientIp(request)}:${guideType}`);
  const dismissDate = todayKey();
  const now = new Date().toISOString();
  const id = `guide-${guideType}-${dismissDate}-${ipHash.slice(0, 16)}`;

  await env.DB.prepare(
    `INSERT OR REPLACE INTO guide_dismissals
      (id, guide_type, ip_hash, dismiss_date, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, guideType, ipHash, dismissDate, now)
    .run();

  return json({ ok: true, dismissed: true, dismissDate });
}

function getSolapiHealth(env) {
  const templates = {
    customerQuoteReceived: solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED"),
    customerQuoteClosed: solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED"),
    customerBidReceived: solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED"),
    adminSellerApplication: solapiValue(env, "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION"),
    sellerBidSelected: solapiValue(env, "SOLAPI_TEMPLATE_SELLER_BID_SELECTED"),
    sellerApproved: solapiValue(env, "SOLAPI_TEMPLATE_SELLER_APPROVED"),
    sellerRejected: solapiValue(env, "SOLAPI_TEMPLATE_SELLER_REJECTED"),
    sellerQuoteRegistered: solapiValue(env, "SOLAPI_TEMPLATE_SELLER_QUOTE_REGISTERED"),
  };
  return json({
    ok: true,
    version: PUBLIC_API_VERSION,
    hasApiKey: Boolean(env.SOLAPI_API_KEY),
    hasApiSecret: Boolean(env.SOLAPI_API_SECRET),
    hasChannelId: Boolean(solapiValue(env, "SOLAPI_CHANNEL_ID")),
    hasFrom: Boolean(solapiValue(env, "SOLAPI_FROM")),
    hasAdminPhone: Boolean(solapiValue(env, "SOLAPI_ADMIN_PHONE")),
    templates,
    missing: [
      !env.SOLAPI_API_KEY && "SOLAPI_API_KEY",
      !env.SOLAPI_API_SECRET && "SOLAPI_API_SECRET",
      !solapiValue(env, "SOLAPI_CHANNEL_ID") && "SOLAPI_CHANNEL_ID",
      !solapiValue(env, "SOLAPI_FROM") && "SOLAPI_FROM",
      !templates.customerQuoteReceived && "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED",
      !templates.customerQuoteClosed && "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED",
      !templates.customerBidReceived && "SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED",
      !templates.adminSellerApplication && "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION",
      !templates.sellerBidSelected && "SOLAPI_TEMPLATE_SELLER_BID_SELECTED",
      !templates.sellerApproved && "SOLAPI_TEMPLATE_SELLER_APPROVED",
      !templates.sellerRejected && "SOLAPI_TEMPLATE_SELLER_REJECTED",
      !templates.sellerQuoteRegistered && "SOLAPI_TEMPLATE_SELLER_QUOTE_REGISTERED",
    ].filter(Boolean),
  });
}

async function getSolapiAuthTest(env) {
  const config = getSolapiConfig(env);
  if (!config.apiKey || !config.apiSecret) {
    return json({ ok: false, message: "SOLAPI_API_KEY 또는 SOLAPI_API_SECRET이 없습니다." }, 500);
  }

  const authorization = await createSolapiAuthorization(config);
  const response = await fetch("https://api.solapi.com/messages/v4/list?limit=1", {
    method: "GET",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  return json({
    ok: response.ok,
    status: response.status,
    message: response.ok ? "솔라피 인증이 정상입니다." : payload.errorMessage || payload.message || "솔라피 인증 테스트에 실패했습니다.",
    errorCode: payload.errorCode || "",
    hasApiKey: Boolean(config.apiKey),
    hasApiSecret: Boolean(config.apiSecret),
    hasChannelId: Boolean(config.channelId),
    hasFrom: Boolean(config.from),
  }, response.ok ? 200 : 502);
}

async function ensurePushTokenTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS push_tokens (
      token TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'android',
      app TEXT NOT NULL DEFAULT 'public',
      role TEXT NOT NULL DEFAULT 'public',
      device_id TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      last_url TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();

  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_push_tokens_role ON push_tokens(role)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_push_tokens_updated_at ON push_tokens(updated_at)").run();
}

function sanitizePushText(value, maxLength = 300) {
  return String(value || "").trim().slice(0, maxLength);
}

function base64UrlFromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlFromJson(payload) {
  return base64UrlFromBytes(new TextEncoder().encode(JSON.stringify(payload)));
}

function privateKeyPemToDer(privateKey) {
  const clean = String(privateKey || "")
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function createFirebaseJwt(env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(env.FIREBASE_PRIVATE_KEY || "").trim();
  if (!projectId || !clientEmail || !privateKey) {
    return { ok: false, error: "Firebase 푸시 환경변수(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)가 필요합니다." };
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64UrlFromJson({ alg: "RS256", typ: "JWT" }),
    base64UrlFromJson({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ].join(".");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyPemToDer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return { ok: true, projectId, assertion: `${unsigned}.${base64UrlFromBytes(new Uint8Array(signature))}` };
}

async function getFirebaseAccessToken(env) {
  const jwt = await createFirebaseJwt(env);
  if (!jwt.ok) return jwt;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt.assertion,
    }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    return { ok: false, error: payload.error_description || payload.error || "Firebase access token 발급에 실패했습니다." };
  }
  return { ok: true, projectId: jwt.projectId, accessToken: payload.access_token };
}

async function sendFirebasePush(env, token, notification) {
  const auth = await getFirebaseAccessToken(env);
  if (!auth.ok) return auth;

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          title: notification.title,
          body: notification.body,
          url: notification.url || "https://ga-pick.com/seller",
          type: notification.type || "customer_quote_created",
        },
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "gapick_public_alerts",
          },
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: payload.error?.message || payload.error || "FCM 발송에 실패했습니다." };
  }
  return { ok: true, messageId: payload.name || "" };
}

async function notifyPublicAppQuoteCreated(env, quote) {
  if (isTestQuote(quote)) return { ok: true, sent: 0, failed: 0, skipped: "테스트용 견적은 일반 판매자 알림을 보내지 않습니다." };
  await ensurePushTokenTable(env);
  const tokenRows = await env.DB.prepare(
    `SELECT token FROM push_tokens
     WHERE app = 'public'
     ORDER BY updated_at DESC
     LIMIT 500`
  ).all();
  const tokens = [...new Set((tokenRows.results || []).map((row) => row.token).filter(Boolean))];
  if (!tokens.length) return { ok: true, sent: 0, failed: 0, skipped: "등록된 앱 푸시 토큰이 없습니다." };

  let sent = 0;
  let failed = 0;
  const errors = [];
  const title = "새로운 견적이 등록되었습니다";
  const body = `${quote.region || "전국"} · ${quote.items || "가전 견적"} 견적이 새로 접수되었습니다.`;
  for (const token of tokens) {
    const result = await sendFirebasePush(env, token, {
      title,
      body,
      url: "https://ga-pick.com/seller",
      type: "customer_quote_created",
    });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (errors.length < 3) errors.push(result.error || "unknown");
    }
  }
  return { ok: failed === 0, sent, failed, errors };
}

async function savePushToken(env, request) {
  await ensurePushTokenTable(env);

  const body = await request.json().catch(() => ({}));
  const token = sanitizePushText(body.token, 4096);
  if (!token) return json({ ok: false, message: "푸시 토큰이 없습니다." }, 400);

  const platform = sanitizePushText(body.platform || "android", 30);
  const app = sanitizePushText(body.app || "public", 30);
  const role = sanitizePushText(body.role || "public", 30);
  const deviceId = sanitizePushText(body.deviceId, 120);
  const lastUrl = sanitizePushText(body.lastUrl, 500);
  const userAgent = sanitizePushText(request.headers.get("User-Agent"), 500);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO push_tokens
      (token, platform, app, role, device_id, user_agent, last_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET
       platform = excluded.platform,
       app = excluded.app,
       role = excluded.role,
       device_id = excluded.device_id,
       user_agent = excluded.user_agent,
       last_url = excluded.last_url,
       updated_at = excluded.updated_at`
  )
    .bind(token, platform, app, role, deviceId, userAgent, lastUrl, now, now)
    .run();

  return json({ ok: true, message: "푸시 토큰이 저장되었습니다." });
}

async function getPushHealth(env) {
  await ensurePushTokenTable(env);
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_tokens WHERE app = 'public'").first();
  return json({
    ok: true,
    hasFirebaseProjectId: Boolean(String(env.FIREBASE_PROJECT_ID || "").trim()),
    hasFirebaseClientEmail: Boolean(String(env.FIREBASE_CLIENT_EMAIL || "").trim()),
    hasFirebasePrivateKey: Boolean(String(env.FIREBASE_PRIVATE_KEY || "").trim()),
    publicTokenCount: Number(countRow?.count || 0),
  });
}

async function ensureLplanTrainingTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS lplan_quote_patterns (
      id TEXT PRIMARY KEY,
      source_quote_id TEXT DEFAULT '',
      title TEXT DEFAULT '',
      source_saved_at TEXT DEFAULT '',
      synced_at TEXT NOT NULL,
      branch TEXT DEFAULT '',
      manager_hash TEXT DEFAULT '',
      membership_type TEXT DEFAULT '',
      quote_date TEXT DEFAULT '',
      delivery_date TEXT DEFAULT '',
      item_count INTEGER DEFAULT 0,
      total_reg_price INTEGER DEFAULT 0,
      total_point INTEGER DEFAULT 0,
      total_cashback INTEGER DEFAULT 0,
      combo_key TEXT DEFAULT '',
      rows_json TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lplan_quote_patterns_synced_at ON lplan_quote_patterns(synced_at)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lplan_quote_patterns_combo_key ON lplan_quote_patterns(combo_key)").run();
}

function getLplanSyncToken(env) {
  return String(env.LPLAN_SYNC_TOKEN || LPLAN_SYNC_TOKEN_DEFAULT).trim();
}

function requireLplanSync(request, env) {
  const expected = getLplanSyncToken(env);
  const actual = String(request.headers.get("X-Lplan-Sync-Token") || "").trim();
  if (!expected || actual !== expected) {
    return json({ ok: false, message: "엘플랜 동기화 인증이 필요합니다." }, 401);
  }
  return null;
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function pickLplanRows(body) {
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.data?.rows)) return body.data.rows;
  if (Array.isArray(body?.quote?.rows)) return body.quote.rows;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

function normalizeTrainingRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const model = pickFirstText(row?.model, row?.modelName, row?.model_name, row?.code, row?.sku, row?.productModel).toUpperCase();
      return {
        model,
        product: pickFirstText(row?.product, row?.category, row?.item, row?.name),
        sub: Boolean(row?.sub),
        existingBundle: Boolean(row?.existingBundle),
        wedding: Boolean(row?.wedding),
        regPrice: Number(row?.regPrice ?? row?.regularPrice ?? row?.price ?? row?.normalPrice ?? 0) || 0,
        point: Number(row?.point || 0) || 0,
        cashback: Number(row?.cashback || 0) || 0,
        care: pickFirstText(row?.care),
        contract: pickFirstText(row?.contract),
        prepay: pickFirstText(row?.prepay),
        fixedPrepayAmount: Number(row?.fixedPrepayAmount || 0) || 0,
        smallBusiness: Boolean(row?.smallBusiness),
      };
    })
    .filter((row) => row.model);
}

function normalizeLplanTrainingQuote(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceQuoteId: row.source_quote_id || "",
    title: row.title || "",
    sourceSavedAt: row.source_saved_at || "",
    syncedAt: row.synced_at || "",
    branch: row.branch || "",
    managerHash: row.manager_hash || "",
    membershipType: row.membership_type || "",
    itemCount: Number(row.item_count || 0),
    totalRegPrice: Number(row.total_reg_price || 0),
    totalPoint: Number(row.total_point || 0),
    totalCashback: Number(row.total_cashback || 0),
    comboKey: row.combo_key || "",
    rows: parseJson(row.rows_json, []),
  };
}

async function saveLplanTrainingQuote(env, request) {
  const denied = requireLplanSync(request, env);
  if (denied) return denied;

  await ensureLplanTrainingTable(env);
  const body = await request.json().catch(() => ({}));
  const rows = normalizeTrainingRows(pickLplanRows(body));
  if (!rows.length) return json({ ok: false, message: "저장할 모델 구성이 없습니다." }, 400);

  const sourceQuoteId = String(body.sourceQuoteId || body.id || "").trim() || createId("lplan-source");
  const id = `lplan-${sourceQuoteId}`;
  const now = new Date().toISOString();
  const totalRegPrice = Number(body.totalRegPrice || rows.reduce((sum, row) => sum + Number(row.regPrice || 0), 0)) || 0;
  const totalPoint = Number(body.totalPoint || rows.reduce((sum, row) => sum + Number(row.point || 0), 0)) || 0;
  const totalCashback = Number(body.totalCashback || rows.reduce((sum, row) => sum + Number(row.cashback || 0), 0)) || 0;
  const comboKey = rows.map((row) => row.model).sort().join("|");

  await env.DB.prepare(
    `INSERT OR REPLACE INTO lplan_quote_patterns
      (id, source_quote_id, title, source_saved_at, synced_at, branch, manager_hash, membership_type,
       quote_date, delivery_date, item_count, total_reg_price, total_point, total_cashback, combo_key, rows_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      sourceQuoteId,
      pickFirstText(body.title, body.data?.title, body.quote?.title).slice(0, 120),
      pickFirstText(body.savedAt, body.sourceSavedAt, body.data?.savedAt, body.quote?.savedAt),
      now,
      pickFirstText(body.branch, body.data?.basic?.branch, body.basic?.branch).slice(0, 80),
      pickFirstText(body.managerHash).slice(0, 96),
      pickFirstText(body.membershipType, body.data?.membershipType).slice(0, 40),
      pickFirstText(body.quoteDate, body.data?.basic?.quoteDate, body.basic?.quoteDate).slice(0, 40),
      pickFirstText(body.deliveryDate, body.data?.basic?.deliveryDate, body.basic?.deliveryDate).slice(0, 40),
      rows.length,
      totalRegPrice,
      totalPoint,
      totalCashback,
      comboKey,
      JSON.stringify(rows)
    )
    .run();

  return json({ ok: true, id, savedRows: rows.length, syncedAt: now });
}

async function getLplanTrainingQuotes(env, request) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  await ensureLplanTrainingTable(env);
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) AS total, MAX(synced_at) AS latest_synced_at
       FROM lplan_quote_patterns`
  ).first();
  const branchRows = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(branch, ''), '지점 미기록') AS branch, COUNT(*) AS count, MAX(synced_at) AS latest_synced_at
       FROM lplan_quote_patterns
       GROUP BY COALESCE(NULLIF(branch, ''), '지점 미기록')
       ORDER BY count DESC, latest_synced_at DESC
       LIMIT 20`
  ).all();
  const rows = await env.DB.prepare(
    `SELECT id, source_quote_id, title, source_saved_at, synced_at, branch, manager_hash,
            membership_type, item_count, total_reg_price, total_point, total_cashback, combo_key, rows_json
       FROM lplan_quote_patterns
       ORDER BY synced_at DESC
       LIMIT 50`
  ).all();

  return json({
    ok: true,
    version: PUBLIC_API_VERSION,
    summary: {
      total: Number(summary?.total || 0),
      latestSyncedAt: summary?.latest_synced_at || "",
      branches: (branchRows.results || []).map((row) => ({
        branch: row.branch || "지점 미기록",
        count: Number(row.count || 0),
        latestSyncedAt: row.latest_synced_at || "",
      })),
    },
    rows: (rows.results || []).map(normalizeLplanTrainingQuote),
  });
}

async function getLplanModelLearning(env) {
  await ensureLplanTrainingTable(env);
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) AS total, MAX(synced_at) AS latest_synced_at
       FROM lplan_quote_patterns`
  ).first();
  const rows = await env.DB.prepare(
    `SELECT rows_json
       FROM lplan_quote_patterns
       ORDER BY synced_at DESC
       LIMIT 1000`
  ).all();

  const modelCounts = {};
  const productCounts = {};
  for (const row of rows.results || []) {
    const quoteModels = new Set();
    const quoteProducts = new Set();
    const parsedRows = parseJson(row.rows_json, []);
    const quoteRows = Array.isArray(parsedRows)
      ? parsedRows
      : Array.isArray(parsedRows?.rows)
        ? parsedRows.rows
        : [];
    for (const item of quoteRows) {
      const model = String(item?.model || item?.modelName || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
      if (model) quoteModels.add(model);
      const product = String(item?.product || item?.category || item?.item || item?.name || "")
        .trim()
        .replace(/\s+/g, " ");
      if (product) quoteProducts.add(product);
    }
    for (const model of quoteModels) modelCounts[model] = Number(modelCounts[model] || 0) + 1;
    for (const product of quoteProducts) productCounts[product] = Number(productCounts[product] || 0) + 1;
  }

  return json({
    ok: true,
    version: PUBLIC_API_VERSION,
    totalQuotes: Number(summary?.total || 0),
    latestSyncedAt: summary?.latest_synced_at || "",
    modelCounts,
    productCounts,
  });
}


let siteVisitTablesReady = false;

async function ensureSiteVisitTables(env) {
  if (siteVisitTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS site_visit_daily (
        visit_date TEXT PRIMARY KEY,
        page_views INTEGER NOT NULL DEFAULT 0,
        unique_visitors INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS site_visit_uniques (
        visit_date TEXT NOT NULL,
        visitor_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (visit_date, visitor_hash)
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS site_visit_events (
        event_key TEXT PRIMARY KEY,
        visit_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_site_visit_events_date ON site_visit_events(visit_date)`),
  ]);
  siteVisitTablesReady = true;
}

function dateKeyDaysAgo(days) {
  const [year, month, day] = todayKey().split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - Number(days || 0));
  return value.toISOString().slice(0, 10);
}

function normalizeVisitPath(value) {
  const raw = String(value || "/").trim();
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120) || "/";
}

function isAutomatedVisitor(userAgent) {
  return /bot|crawler|spider|preview|headless|lighthouse|pagespeed|facebookexternalhit|kakaotalk-scrap/i.test(
    String(userAgent || "")
  );
}

async function recordSiteVisit(env, request) {
  await ensureSiteVisitTables(env);
  const userAgent = String(request.headers.get("User-Agent") || "");
  if (isAutomatedVisitor(userAgent)) return json({ ok: true, counted: false, reason: "automated" });

  let payload = {};
  try {
    payload = await request.json();
  } catch (error) {
    payload = {};
  }

  const visitDate = todayKey();
  const path = normalizeVisitPath(payload.path);
  const now = new Date().toISOString();
  const ip = getClientIp(request);
  const salt = String(env.VISITOR_HASH_SALT || env.ADMIN_API_TOKEN || "ga-pick-visit-daily-v1");
  const visitorHash = await sha256Hex(`${salt}|${visitDate}|${ip}|${userAgent.slice(0, 300)}`);
  const thirtyMinuteBucket = Math.floor(Date.now() / (30 * 60 * 1000));
  const eventKey = await sha256Hex(`${visitorHash}|${path}|${thirtyMinuteBucket}`);

  const eventInsert = await env.DB.prepare(
    `INSERT OR IGNORE INTO site_visit_events (event_key, visit_date, created_at) VALUES (?, ?, ?)`
  )
    .bind(eventKey, visitDate, now)
    .run();
  const countedPageView = Number(eventInsert?.meta?.changes || 0) > 0;
  if (!countedPageView) return json({ ok: true, counted: false, duplicateWindow: true });

  const uniqueInsert = await env.DB.prepare(
    `INSERT OR IGNORE INTO site_visit_uniques (visit_date, visitor_hash, created_at) VALUES (?, ?, ?)`
  )
    .bind(visitDate, visitorHash, now)
    .run();
  const countedUnique = Number(uniqueInsert?.meta?.changes || 0) > 0;

  await env.DB.prepare(
    `INSERT INTO site_visit_daily (visit_date, page_views, unique_visitors, updated_at)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(visit_date) DO UPDATE SET
       page_views = site_visit_daily.page_views + 1,
       unique_visitors = site_visit_daily.unique_visitors + excluded.unique_visitors,
       updated_at = excluded.updated_at`
  )
    .bind(visitDate, countedUnique ? 1 : 0, now)
    .run();

  if (Math.random() < 0.02) {
    await env.DB.prepare(`DELETE FROM site_visit_events WHERE visit_date < ?`).bind(dateKeyDaysAgo(30)).run();
    await env.DB.prepare(`DELETE FROM site_visit_uniques WHERE visit_date < ?`).bind(dateKeyDaysAgo(400)).run();
  }

  return json({ ok: true, counted: true, unique: countedUnique });
}

async function getSiteVisitStats(env) {
  await ensureSiteVisitTables(env);
  const today = todayKey();
  const sevenDaysAgo = dateKeyDaysAgo(6);
  const [todayRow, sevenDayRow, totalRow, dailyRows] = await Promise.all([
    env.DB.prepare(
      `SELECT page_views, unique_visitors FROM site_visit_daily WHERE visit_date = ?`
    ).bind(today).first(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(page_views), 0) AS page_views,
              COALESCE(SUM(unique_visitors), 0) AS unique_visitors
         FROM site_visit_daily
        WHERE visit_date >= ? AND visit_date <= ?`
    ).bind(sevenDaysAgo, today).first(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(page_views), 0) AS page_views,
              COALESCE(SUM(unique_visitors), 0) AS unique_visitors
         FROM site_visit_daily`
    ).first(),
    env.DB.prepare(
      `SELECT visit_date, page_views, unique_visitors
         FROM site_visit_daily
        ORDER BY visit_date DESC
        LIMIT 14`
    ).all(),
  ]);

  return json({
    ok: true,
    today: {
      date: today,
      pageViews: Number(todayRow?.page_views || 0),
      uniqueVisitors: Number(todayRow?.unique_visitors || 0),
    },
    last7Days: {
      from: sevenDaysAgo,
      to: today,
      pageViews: Number(sevenDayRow?.page_views || 0),
      uniqueVisitors: Number(sevenDayRow?.unique_visitors || 0),
    },
    total: {
      pageViews: Number(totalRow?.page_views || 0),
      dailyUniqueVisitors: Number(totalRow?.unique_visitors || 0),
    },
    daily: (dailyRows?.results || []).map((row) => ({
      date: row.visit_date,
      pageViews: Number(row.page_views || 0),
      uniqueVisitors: Number(row.unique_visitors || 0),
    })),
  });
}



async function ensureBrandHallTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS brand_packages (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      channel TEXT DEFAULT '',
      branch TEXT DEFAULT '',
      branch_region TEXT DEFAULT '',
      manager TEXT DEFAULT '',
      manager_phone TEXT DEFAULT '',
      brand TEXT DEFAULT '',
      title TEXT NOT NULL,
      items_json TEXT DEFAULT '[]',
      original_price INTEGER DEFAULT 0,
      sale_price INTEGER DEFAULT 0,
      benefits TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      cover_image_key TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS brand_consultations (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      channel TEXT DEFAULT '',
      branch TEXT DEFAULT '',
      manager TEXT DEFAULT '',
      manager_phone TEXT DEFAULT '',
      package_title TEXT DEFAULT '',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_region TEXT DEFAULT '',
      preferred_time TEXT DEFAULT '',
      memo TEXT DEFAULT '',
      consent_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'new',
      delivery_status TEXT DEFAULT 'pending',
      delivery_error TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
  const statements = [
    "CREATE INDEX IF NOT EXISTS idx_brand_packages_status_updated ON brand_packages(status, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_brand_packages_seller ON brand_packages(seller_id, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_brand_consultations_seller ON brand_consultations(seller_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_brand_consultations_package ON brand_consultations(package_id, created_at DESC)",
  ];
  for (const sql of statements) {
    try { await env.DB.prepare(sql).run(); } catch (error) { console.warn("브랜드관 인덱스 생성 실패", error); }
  }
}

function normalizePublicBrandChannel(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const compact = text.replace(/\s+/g, "").toLowerCase();
  if (compact.includes("전자랜드")) return "전자랜드";
  if (compact.includes("하이마트")) return "하이마트";
  if (compact.includes("삼성스토어") || compact.includes("samsungstore")) return "삼성스토어";
  if (compact.includes("lg전자bestshop") || compact.includes("lgbestshop") || compact.includes("lg베스트샵") || compact.includes("베스트샵")) return "LG전자 BEST SHOP";
  return "";
}

function normalizeBrandPackage(row, options = {}) {
  if (!row) return null;
  const publicView = options.publicView !== false;
  const normalized = {
    id: row.id,
    channel: publicView ? normalizePublicBrandChannel(row.channel) : (row.channel || ""),
    brand: row.brand || "",
    title: row.title || "",
    items: parseJson(row.items_json, []),
    originalPrice: Number(row.original_price || 0),
    salePrice: Number(row.sale_price || 0),
    benefits: row.benefits || "",
    coverImage: row.cover_image || "",
    status: row.status || "active",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
  if (!publicView) {
    normalized.branch = row.branch || "";
    normalized.branchRegion = row.branch_region || "";
  }
  if (!publicView) {
    normalized.sellerId = row.seller_id || "";
    normalized.manager = row.manager || "";
    normalized.managerPhone = row.manager_phone || "";
    normalized.coverImageKey = row.cover_image_key || "";
  }
  return normalized;
}

function normalizeBrandConsultation(row) {
  if (!row) return null;
  return {
    id: row.id,
    packageId: row.package_id || "",
    sellerId: row.seller_id || "",
    channel: row.channel || "",
    branch: row.branch || "",
    manager: row.manager || "",
    packageTitle: row.package_title || "",
    customerName: row.customer_name || "",
    customerPhone: normalizePhone(row.customer_phone || ""),
    customerPhoneFormatted: formatPhoneNumber(row.customer_phone || ""),
    customerRegion: row.customer_region || "",
    preferredTime: row.preferred_time || "",
    memo: row.memo || "",
    status: row.status || "new",
    deliveryStatus: row.delivery_status || "pending",
    deliveryError: row.delivery_error || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

async function authenticateBrandSeller(env, sellerIdValue, passwordValue) {
  await ensureSellerColumns(env);
  const sellerId = String(sellerIdValue || "").trim();
  const password = String(passwordValue || "");
  if (!sellerId || !password) return { ok: false, status: 400, message: "판매자 아이디와 비밀번호가 필요합니다." };

  let row = await env.DB.prepare("SELECT * FROM approved_sellers WHERE seller_id = ? AND status = 'approved' LIMIT 1")
    .bind(sellerId)
    .first();
  let authenticated = row ? await safelyVerifyPassword(password, row.password) : false;
  if (!authenticated && (await isMasterSellerLogin(sellerId, password))) {
    row = await upsertMasterSeller(env);
    authenticated = Boolean(row);
  }
  if (!row || !authenticated) return { ok: false, status: 401, message: "승인된 판매자 계정의 아이디 또는 비밀번호가 일치하지 않습니다." };
  return { ok: true, row };
}

async function getPublicBrandPackages(env, request) {
  await ensureBrandHallTables(env);
  const url = new URL(request.url);
  const brand = String(url.searchParams.get("brand") || "").trim();
  const channel = String(url.searchParams.get("channel") || "").trim();
  const clauses = ["status = 'active'"];
  const values = [];
  if (brand) { clauses.push("brand = ?"); values.push(brand); }
  const sql = `SELECT * FROM brand_packages WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT 200`;
  const statement = env.DB.prepare(sql);
  const result = values.length ? await statement.bind(...values).all() : await statement.all();
  const rows = (result.results || [])
    .map((row) => normalizeBrandPackage(row, { publicView: true }))
    .filter((row) => row.channel && (!channel || row.channel === channel));
  return json({ ok: true, rows });
}

async function handleBrandSellerPackages(env, request) {
  await ensureBrandHallTables(env);
  const body = await request.json().catch(() => ({}));
  const auth = await authenticateBrandSeller(env, body.sellerId, body.password);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status || 401);
  const seller = auth.row;
  const sellerId = String(seller.seller_id || body.sellerId || "").trim();
  const action = String(body.action || "list").trim();

  if (action === "list") {
    const result = await env.DB.prepare("SELECT * FROM brand_packages WHERE seller_id = ? ORDER BY updated_at DESC")
      .bind(sellerId)
      .all();
    return json({ ok: true, rows: (result.results || []).map((row) => normalizeBrandPackage(row, { publicView: false })) });
  }

  if (action === "consultations") {
    const result = await env.DB.prepare("SELECT * FROM brand_consultations WHERE seller_id = ? ORDER BY created_at DESC LIMIT 300")
      .bind(sellerId)
      .all();
    return json({ ok: true, rows: (result.results || []).map(normalizeBrandConsultation) });
  }

  if (action === "delete") {
    const packageId = String(body.packageId || "").trim();
    if (!packageId) return json({ ok: false, message: "삭제할 패키지를 찾을 수 없습니다." }, 400);
    const existing = await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? AND seller_id = ? LIMIT 1")
      .bind(packageId, sellerId)
      .first();
    if (!existing) return json({ ok: false, message: "삭제할 패키지가 없거나 다른 판매자의 패키지입니다." }, 404);
    await env.DB.prepare("DELETE FROM brand_packages WHERE id = ? AND seller_id = ?").bind(packageId, sellerId).run();
    if (existing.cover_image_key) await deleteR2Object(env, existing.cover_image_key);
    const verify = await env.DB.prepare("SELECT id FROM brand_packages WHERE id = ? LIMIT 1").bind(packageId).first();
    if (verify?.id) return json({ ok: false, message: "서버에서 패키지 삭제를 확인하지 못했습니다." }, 500);
    return json({ ok: true, deletedId: packageId });
  }

  if (action !== "create" && action !== "update") {
    return json({ ok: false, message: "지원하지 않는 브랜드관 판매자 작업입니다." }, 400);
  }

  const payload = body.package || {};
  const title = String(payload.title || "").trim().slice(0, 80);
  const brand = String(payload.brand || "").trim().slice(0, 40);
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12)
    : [];
  const originalPrice = Math.max(0, Math.floor(Number(payload.originalPrice || 0)));
  const salePrice = Math.max(0, Math.floor(Number(payload.salePrice || 0)));
  const benefits = String(payload.benefits || "").trim().slice(0, 600);
  const status = String(payload.status || "active") === "hidden" ? "hidden" : "active";
  if (!title || !brand || !items.length || !salePrice) {
    return json({ ok: false, message: "브랜드, 패키지 제목, 제품 구성, 패키지 금액을 모두 입력해주세요." }, 400);
  }

  const now = new Date().toISOString();
  const packageId = action === "update" ? String(payload.id || "").trim() : createId("brandpkg");
  let existing = null;
  if (action === "update") {
    if (!packageId) return json({ ok: false, message: "수정할 패키지 ID가 없습니다." }, 400);
    existing = await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? AND seller_id = ? LIMIT 1")
      .bind(packageId, sellerId)
      .first();
    if (!existing) return json({ ok: false, message: "수정할 패키지가 없거나 다른 판매자의 패키지입니다." }, 404);
  }

  let coverImage = existing?.cover_image || "";
  let coverImageKey = existing?.cover_image_key || "";
  const coverDataUrl = String(payload.coverImageDataUrl || "");
  if (coverDataUrl) {
    const info = dataUrlInfo(coverDataUrl);
    if (!info || !isBrowserSafeQuoteImageType(info.contentType)) {
      return json({ ok: false, message: "브랜드관 대표 이미지는 JPG, PNG 또는 WebP만 등록할 수 있습니다." }, 415);
    }
    if (!env.FILES) return json({ ok: false, message: "브랜드관 이미지 저장소(R2)가 연결되지 않았습니다." }, 500);
    const saved = await saveDataUrlToR2(env, coverDataUrl, "brand-packages", `${packageId}-cover-${Date.now()}`);
    if (!saved.key) return json({ ok: false, message: "브랜드관 대표 이미지를 저장하지 못했습니다." }, 500);
    const oldKey = coverImageKey;
    coverImage = saved.url || "";
    coverImageKey = saved.key || "";
    if (oldKey && oldKey !== coverImageKey) await deleteR2Object(env, oldKey);
  }

  const snapshot = {
    channel: seller.channel || "",
    branch: seller.branch || "",
    branchRegion: seller.branch_region || "",
    manager: seller.manager || "",
    managerPhone: normalizePhone(seller.phone || ""),
  };

  if (action === "create") {
    await env.DB.prepare(
      `INSERT INTO brand_packages
        (id, seller_id, channel, branch, branch_region, manager, manager_phone, brand, title, items_json,
         original_price, sale_price, benefits, cover_image, cover_image_key, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      packageId, sellerId, snapshot.channel, snapshot.branch, snapshot.branchRegion, snapshot.manager,
      snapshot.managerPhone, brand, title, JSON.stringify(items), originalPrice, salePrice, benefits,
      coverImage, coverImageKey, status, now, now
    ).run();
  } else {
    await env.DB.prepare(
      `UPDATE brand_packages SET channel = ?, branch = ?, branch_region = ?, manager = ?, manager_phone = ?,
       brand = ?, title = ?, items_json = ?, original_price = ?, sale_price = ?, benefits = ?, cover_image = ?,
       cover_image_key = ?, status = ?, updated_at = ? WHERE id = ? AND seller_id = ?`
    ).bind(
      snapshot.channel, snapshot.branch, snapshot.branchRegion, snapshot.manager, snapshot.managerPhone,
      brand, title, JSON.stringify(items), originalPrice, salePrice, benefits, coverImage, coverImageKey,
      status, now, packageId, sellerId
    ).run();
  }

  const savedRow = await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? AND seller_id = ? LIMIT 1")
    .bind(packageId, sellerId)
    .first();
  if (!savedRow) return json({ ok: false, message: "패키지가 서버에 저장되었는지 확인하지 못했습니다." }, 500);
  return json({ ok: true, row: normalizeBrandPackage(savedRow, { publicView: false }) });
}

async function createBrandConsultation(env, request) {
  await ensureBrandHallTables(env);
  const body = await request.json().catch(() => ({}));
  if (String(body.website || "").trim()) return json({ ok: true, message: "접수되었습니다." });
  const packageId = String(body.packageId || "").trim();
  const customerName = String(body.customerName || "").trim().slice(0, 20);
  const customerPhone = normalizePhone(body.customerPhone || "");
  const customerRegion = String(body.customerRegion || "").trim().slice(0, 40);
  const preferredTime = String(body.preferredTime || "").trim().slice(0, 50);
  const memo = String(body.memo || "").trim().slice(0, 500);
  const consent = body.consent || {};
  if (!packageId || !customerName || customerPhone.length < 10 || !customerRegion || !preferredTime || !consent.privacy) {
    return json({ ok: false, message: "이름, 연락처, 설치 지역, 상담 희망 시간과 개인정보 동의를 확인해주세요." }, 400);
  }

  const pkg = await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? AND status = 'active' LIMIT 1")
    .bind(packageId)
    .first();
  if (!pkg) return json({ ok: false, message: "현재 상담할 수 없는 패키지입니다. 목록을 새로고침해주세요." }, 404);

  const duplicateSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const duplicate = await env.DB.prepare(
    "SELECT id FROM brand_consultations WHERE package_id = ? AND customer_phone = ? AND created_at >= ? LIMIT 1"
  ).bind(packageId, customerPhone, duplicateSince).first();
  if (duplicate?.id) return json({ ok: true, id: duplicate.id, deliveryStatus: "already_received", message: "이미 동일한 상담 요청이 접수되었습니다." });

  const id = createId("brandconsult");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO brand_consultations
      (id, package_id, seller_id, channel, branch, manager, manager_phone, package_title, customer_name,
       customer_phone, customer_region, preferred_time, memo, consent_json, status, delivery_status,
       delivery_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending', '', ?, ?)`
  ).bind(
    id, packageId, pkg.seller_id || "", pkg.channel || "", pkg.branch || "", pkg.manager || "",
    normalizePhone(pkg.manager_phone || ""), pkg.title || "", customerName, customerPhone, customerRegion,
    preferredTime, memo, JSON.stringify({ ...consent, receivedAt: now }), now, now
  ).run();

  // 브랜드관 상담은 판매자에게 직접 전달하지 않습니다.
  // 픽견적 운영자가 먼저 상담한 뒤 실제 계약 단계에서 판매처를 연결합니다.
  const adminPhone = normalizePhone(solapiValue(env, "SOLAPI_ADMIN_PHONE") || "");
  let deliveryStatus = "saved";
  let deliveryError = "";
  if (adminPhone) {
    const smsBody = [
      "[픽견적 브랜드관 신규 상담]",
      `${customerName} 고객님 상담 요청`,
      `공개 채널: ${normalizePublicBrandChannel(pkg.channel) || "브랜드관"}`,
      `내부 판매처: ${[pkg.channel, pkg.branch].filter(Boolean).join(" ")}`,
      `담당 매니저: ${pkg.manager || "미지정"} ${formatPhoneNumber(pkg.manager_phone || "")}`.trim(),
      `패키지: ${pkg.title || "다품목 가전 패키지"}`,
      `고객 연락처: ${formatPhoneNumber(customerPhone)}`,
      `설치지역: ${customerRegion}`,
      `희망시간: ${preferredTime}`,
      memo ? `문의: ${memo}` : "",
      "관리자 브랜드관에서 상담 및 정산 상태를 관리해주세요.",
    ].filter(Boolean).join("\n");
    const sent = await sendSolapiTextMessage(env, { targetPhone: adminPhone, body: smsBody, allowDuplicates: true })
      .catch((error) => ({ ok: false, error: String(error?.message || error || "관리자 문자 발송 실패") }));
    if (sent?.ok) deliveryStatus = "admin_notified";
    else { deliveryStatus = "saved"; deliveryError = String(sent?.error || "관리자 문자 전달 실패").slice(0, 500); }
  } else {
    deliveryError = "SOLAPI_ADMIN_PHONE이 설정되어 있지 않아 서버에만 저장되었습니다.";
  }

  await env.DB.prepare("UPDATE brand_consultations SET delivery_status = ?, delivery_error = ?, updated_at = ? WHERE id = ?")
    .bind(deliveryStatus, deliveryError, new Date().toISOString(), id)
    .run();
  return json({ ok: true, id, deliveryStatus, message: "상담 요청이 픽견적에 정상적으로 접수되었습니다." });
}

// Pre-selection anonymous consultation: text-only, customer-first, server-validated.
let anonymousConsultationTablesReady = false;
async function ensureAnonymousConsultationTables(env) {
  if (anonymousConsultationTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_consultations (id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, bid_id TEXT NOT NULL, seller_id TEXT NOT NULL, started_by TEXT NOT NULL DEFAULT 'customer', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, selected_at TEXT DEFAULT '')`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_consultation_bid ON anonymous_consultations(quote_id, bid_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_consultation_messages (id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL, sender_role TEXT NOT NULL, sender_id TEXT DEFAULT '', body TEXT NOT NULL, normalized_body TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, block_reason TEXT DEFAULT '', created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_anon_messages_consultation ON anonymous_consultation_messages(consultation_id, created_at)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_policy_cases (id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL, message_id TEXT NOT NULL, quote_id TEXT NOT NULL, bid_id TEXT NOT NULL, seller_id TEXT NOT NULL, branch TEXT DEFAULT '', detection_type TEXT NOT NULL, original_message TEXT NOT NULL, normalized_message TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'UNDER_REVIEW', follow_up_action TEXT DEFAULT '', prior_violation_count INTEGER DEFAULT 0, region_violation_count INTEGER DEFAULT 0, reviewed_at TEXT DEFAULT '', reviewed_by TEXT DEFAULT '', review_memo TEXT DEFAULT '', created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_anon_cases_status ON anonymous_policy_cases(status, created_at DESC)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_seller_restrictions (seller_id TEXT PRIMARY KEY, branch_key TEXT NOT NULL, seller_status TEXT NOT NULL DEFAULT 'ACTIVE', region_status TEXT NOT NULL DEFAULT 'NORMAL', violation_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, last_case_id TEXT DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_audit_logs (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, case_id TEXT DEFAULT '', consultation_id TEXT DEFAULT '', seller_id TEXT DEFAULT '', payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`),
  ]);
  anonymousConsultationTablesReady = true;
}

function normalizeAnonymousMessage(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}
function scanAnonymousMessage(body, role, history = []) {
  const current = normalizeAnonymousMessage(body);
  const combined = [...history.slice(-3).map(normalizeAnonymousMessage), current].join(' ');
  const compact = combined.replace(/[\s().,/_\\-]+/g, '');
  if (/01[016789]\d{7,8}/.test(compact)) return { blocked: true, type: 'PHONE_CONTACT', reason: '전화번호 또는 분할된 연락처가 감지되었습니다.' };
  if (/(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|co\.kr|kr|net|org|me|ly|io)(?:\/|\b))/i.test(current) || /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i.test(current)) return { blocked: true, type: 'URL_OR_EMAIL', reason: 'URL 또는 이메일 공유는 선택 전에 허용되지 않습니다.' };
  const route = /(카톡|카카오|오픈채팅|네이버\s*아이디|인스타|instagram|telegram|텔레그램|라인|line|sns|메신저|이메일|메일|url|링크|qr|큐알|전화|연락처|문자|지도에서|매장 검색|지점 어디|매장 어디|담당자 누구|매니저 누구|이름이 뭐|검색해보)/i;
  const identity = role === 'seller' ? /(저는|제가|제 이름|매니저|담당자|지점|매장|주소|위치|근무|소속|명함|사업자|직통|연락)/i : /(성함|이름|전화번호|연락처|주소|카톡|카카오|아이디|이메일|직접 연락|번호 알려|연락 주세요)/i;
  if (route.test(current) || route.test(combined)) return { blocked: true, type: role === 'seller' ? 'SELLER_IDENTITY' : 'CONTACT_ROUTE', reason: '전화번호, 링크, 메신저, 매장·담당자 식별정보 공유 또는 요청이 감지되었습니다.' };
  if (identity.test(current)) return { blocked: true, type: role === 'seller' ? 'SELLER_IDENTITY' : 'CUSTOMER_PERSONAL_INFO', reason: '선택 전에는 고객과 판매자의 식별정보를 공유하거나 요청할 수 없습니다.' };
  return { blocked: false, type: '', reason: '' };
}
function anonymousSafeBlockMessage() { return '픽견적 안전정책에 따라 해당 메시지가 전송되지 않았습니다. 선택 전에는 전화번호, 링크, 메신저 등 연락처와 식별정보를 공유할 수 없습니다.'; }
async function getAnonymousContext(env, body) {
  const quoteId = String(body.quoteId || body.requestId || '').trim();
  const bidId = String(body.bidId || '').trim();
  if (!quoteId || !bidId) return { error: json({ ok: false, message: '견적과 판매자 제안 정보가 필요합니다.' }, 400) };
  const quote = await env.DB.prepare('SELECT * FROM customer_quotes WHERE id = ? LIMIT 1').bind(quoteId).first();
  const bid = await env.DB.prepare('SELECT * FROM bids WHERE id = ? AND quote_id = ? LIMIT 1').bind(bidId, quoteId).first();
  if (!quote || !bid) return { error: json({ ok: false, message: '상담을 시작할 견적 제안을 찾을 수 없습니다.' }, 404) };
  return { quoteId, bidId, quote, bid };
}
async function createAnonymousConsultation(env, request) {
  await ensureAnonymousConsultationTables(env);
  const body = await request.json().catch(() => ({}));
  const context = await getAnonymousContext(env, body);
  if (context.error) return context.error;
  if (String(body.role || 'customer') === 'seller') return json({ ok: false, message: '판매자는 고객의 질문 이후에만 익명상담에 답할 수 있습니다.' }, 403);
  const { quoteId, bidId, bid } = context;
  if (context.quote.selected_bid_id) return json({ ok: false, message: '판매자 선택이 완료되어 익명상담을 시작할 수 없습니다.' }, 403);
  const existing = await env.DB.prepare('SELECT * FROM anonymous_consultations WHERE quote_id = ? AND bid_id = ? LIMIT 1').bind(quoteId, bidId).first();
  const now = new Date().toISOString();
  const id = existing?.id || createId('anon-consult');
  if (!existing) await env.DB.prepare(`INSERT INTO anonymous_consultations (id, quote_id, bid_id, seller_id, started_by, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'customer', 'open', ?, ?)`).bind(id, quoteId, bidId, bid.seller_id || '', now, now).run();
  return json({ ok: true, id, quoteId, bidId, status: existing?.status || 'open', sellerId: bid.seller_id || '' });
}
async function getAnonymousConsultation(env, request) {
  await ensureAnonymousConsultationTables(env);
  const url = new URL(request.url);
  let id = String(url.searchParams.get('id') || '').trim();
  if (!id) {
    const quoteId = String(url.searchParams.get('quoteId') || '').trim();
    const bidId = String(url.searchParams.get('bidId') || '').trim();
    if (quoteId && bidId) {
      const found = await env.DB.prepare('SELECT id FROM anonymous_consultations WHERE quote_id = ? AND bid_id = ? LIMIT 1').bind(quoteId, bidId).first();
      id = String(found?.id || '');
    }
  }
  if (!id) return json({ ok: false, message: '상담 정보가 필요합니다.' }, 400);
  const consultation = await env.DB.prepare('SELECT * FROM anonymous_consultations WHERE id = ? LIMIT 1').bind(id).first();
  if (!consultation) return json({ ok: false, message: '익명상담을 찾을 수 없습니다.' }, 404);
  const rows = await env.DB.prepare('SELECT id, sender_role, body, blocked, block_reason, created_at FROM anonymous_consultation_messages WHERE consultation_id = ? ORDER BY created_at ASC').bind(id).all();
  return json({ ok: true, consultation: { id: consultation.id, quoteId: consultation.quote_id, bidId: consultation.bid_id, sellerId: consultation.seller_id, status: consultation.status }, rows: rows.results || [] });
}
async function postAnonymousConsultationMessage(env, request) {
  await ensureAnonymousConsultationTables(env);
  const body = await request.json().catch(() => ({}));
  const consultationId = String(body.consultationId || '').trim();
  const message = String(body.message || '').trim();
  const role = String(body.role || '') === 'seller' ? 'seller' : 'customer';
  const senderId = String(body.senderId || '').trim();
  if (!consultationId || !message) return json({ ok: false, message: '상담 메시지를 입력해주세요.' }, 400);
  if (message.length > 1000) return json({ ok: false, message: '메시지는 1,000자 이내로 입력해주세요.' }, 400);
  if (body.attachment || body.attachments || body.file || body.image) return json({ ok: false, blocked: true, message: '선택 전 익명상담은 개인정보 보호를 위해 텍스트만 사용할 수 있습니다.' }, 400);
  const consultation = await env.DB.prepare('SELECT * FROM anonymous_consultations WHERE id = ? LIMIT 1').bind(consultationId).first();
  if (!consultation || consultation.status !== 'open') return json({ ok: false, message: '현재 상담을 이용할 수 없습니다.' }, 403);
  const quote = await env.DB.prepare('SELECT selected_bid_id FROM customer_quotes WHERE id = ? LIMIT 1').bind(consultation.quote_id).first();
  if (quote?.selected_bid_id) return json({ ok: false, message: '판매자 선택이 완료되어 익명상담이 종료되었습니다.' }, 403);
  if (role === 'seller' && senderId !== String(consultation.seller_id || '')) return json({ ok: false, message: '판매자 상담 권한을 확인할 수 없습니다.' }, 403);
  const prior = await env.DB.prepare('SELECT body FROM anonymous_consultation_messages WHERE consultation_id = ? AND blocked = 0 ORDER BY created_at DESC LIMIT 3').bind(consultationId).all();
  if (role === 'seller' && !(prior.results || []).length) return json({ ok: false, message: '고객이 먼저 질문한 뒤 답변할 수 있습니다.' }, 403);
  const scan = scanAnonymousMessage(message, role, (prior.results || []).reverse().map((row) => row.body));
  const now = new Date().toISOString();
  const messageId = createId('anon-msg');
  await env.DB.prepare(`INSERT INTO anonymous_consultation_messages (id, consultation_id, sender_role, sender_id, body, normalized_body, blocked, block_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(messageId, consultationId, role, role === 'seller' ? senderId : '', message, normalizeAnonymousMessage(message), scan.blocked ? 1 : 0, scan.reason, now).run();
  await env.DB.prepare('UPDATE anonymous_consultations SET updated_at = ? WHERE id = ?').bind(now, consultationId).run();
  if (scan.blocked) {
    const bid = await env.DB.prepare('SELECT branch FROM bids WHERE id = ? LIMIT 1').bind(consultation.bid_id).first();
    const caseId = createId('anon-case');
    const restriction = await env.DB.prepare('SELECT violation_count FROM anonymous_seller_restrictions WHERE seller_id = ? LIMIT 1').bind(consultation.seller_id).first();
    await env.DB.prepare(`INSERT INTO anonymous_policy_cases (id, consultation_id, message_id, quote_id, bid_id, seller_id, branch, detection_type, original_message, normalized_message, reason, prior_violation_count, region_violation_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).bind(caseId, consultationId, messageId, consultation.quote_id, consultation.bid_id, consultation.seller_id, bid?.branch || '', scan.type, message, normalizeAnonymousMessage(message), scan.reason, Number(restriction?.violation_count || 0), now).run();
    await env.DB.prepare(`INSERT INTO anonymous_audit_logs (id, event_type, case_id, consultation_id, seller_id, payload_json, created_at) VALUES (?, 'MESSAGE_BLOCKED', ?, ?, ?, ?, ?)`).bind(createId('anon-audit'), caseId, consultationId, consultation.seller_id, JSON.stringify({ type: scan.type, reason: scan.reason }), now).run();
    return json({ ok: false, blocked: true, caseId, message: anonymousSafeBlockMessage() }, 400);
  }
  return json({ ok: true, row: { id: messageId, senderRole: role, body: message, createdAt: now } }, 201);
}
async function getAnonymousPolicyCases(env, request) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  await ensureAnonymousConsultationTables(env);
  const rows = await env.DB.prepare('SELECT * FROM anonymous_policy_cases ORDER BY created_at DESC LIMIT 500').all();
  return json({ ok: true, rows: rows.results || [] });
}
async function reviewAnonymousPolicyCase(env, request, caseId) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  await ensureAnonymousConsultationTables(env);
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision || '').toUpperCase();
  if (!['NOT_VIOLATION', 'ADDITIONAL_REVIEW', 'APPROVED'].includes(decision)) return json({ ok: false, message: '판정값이 올바르지 않습니다.' }, 400);
  const item = await env.DB.prepare('SELECT * FROM anonymous_policy_cases WHERE id = ? LIMIT 1').bind(caseId).first();
  if (!item) return json({ ok: false, message: '판정 사례를 찾을 수 없습니다.' }, 404);
  const now = new Date().toISOString(); let action = decision;
  if (decision === 'APPROVED') {
    const prior = await env.DB.prepare('SELECT * FROM anonymous_seller_restrictions WHERE seller_id = ? LIMIT 1').bind(item.seller_id).first();
    const count = Number(prior?.violation_count || 0) + 1;
    const sellerStatus = count >= 2 ? 'PERMANENTLY_BANNED' : 'TEMP_RESTRICTED';
    const regionStatus = count >= 2 ? 'PERMANENTLY_BANNED' : 'NEW_SIGNUP_BLOCKED';
    await env.DB.prepare(`INSERT INTO anonymous_seller_restrictions (seller_id, branch_key, seller_status, region_status, violation_count, updated_at, last_case_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(seller_id) DO UPDATE SET seller_status = excluded.seller_status, region_status = excluded.region_status, violation_count = excluded.violation_count, updated_at = excluded.updated_at, last_case_id = excluded.last_case_id`).bind(item.seller_id, item.branch || '', sellerStatus, regionStatus, count, now, caseId).run();
    action = count >= 2 ? 'PERMANENTLY_BANNED' : 'NEW_SIGNUP_BLOCKED';
  }
  await env.DB.prepare('UPDATE anonymous_policy_cases SET status = ?, follow_up_action = ?, reviewed_at = ?, reviewed_by = ?, review_memo = ? WHERE id = ?').bind(decision, action, now, 'admin', String(body.memo || '').slice(0, 1000), caseId).run();
  await env.DB.prepare(`INSERT INTO anonymous_audit_logs (id, event_type, case_id, consultation_id, seller_id, payload_json, created_at) VALUES (?, 'CASE_REVIEWED', ?, ?, ?, ?, ?)`).bind(createId('anon-audit'), caseId, item.consultation_id, item.seller_id, JSON.stringify({ decision, action }), now).run();
  return json({ ok: true, decision, action });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const pathParts = Array.isArray(params.path) ? params.path : [];
  const path = pathParts.join("/");
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (!env.DB) return json({ ok: false, message: "D1 DB 바인딩(DB)이 필요합니다." }, 500);

  if (path === "public-health" && method === "GET") {
    return json({
      ok: true,
      version: PUBLIC_API_VERSION,
      sellerLoginIsPublic: true,
      message: "노출용 API가 정상 연결되었습니다.",
    });
  }

  if (path === "site-visit" && method === "POST") {
    return apiBoundary(() => recordSiteVisit(env, request), "방문 기록 처리 중 오류가 발생했습니다.");
  }
  if (path === "visit-stats" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return apiBoundary(() => getSiteVisitStats(env), "방문자 통계를 불러오지 못했습니다.");
  }
  if (path === "seller-access-logs" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return apiBoundary(() => getSellerAccessLogs(env, request), "판매자 접속 기록을 불러오지 못했습니다.");
  }

  if (path === "anonymous-consultations" && method === "POST") return apiBoundary(() => createAnonymousConsultation(env, request), "익명상담을 시작하지 못했습니다.");
  if (path === "anonymous-consultations" && method === "GET") return apiBoundary(() => getAnonymousConsultation(env, request), "익명상담을 불러오지 못했습니다.");
  if (path === "anonymous-consultation-messages" && method === "POST") return apiBoundary(() => postAnonymousConsultationMessage(env, request), "익명상담 메시지를 처리하지 못했습니다.");
  if (path === "anonymous-policy-cases" && method === "GET") return apiBoundary(() => getAnonymousPolicyCases(env, request), "익명상담 판정 사례를 불러오지 못했습니다.");
  if (path.startsWith("anonymous-policy-cases/") && method === "PATCH") return apiBoundary(() => reviewAnonymousPolicyCase(env, request, decodeURIComponent(pathParts.slice(1).join("/"))), "익명상담 판정을 저장하지 못했습니다.");
  if (path === "seller-applications" && method === "POST") return createSellerApplication(env, request);
  if (path === "seller-login" && method === "POST") {
    return apiBoundary(() => loginSeller(env, request), "판매자 로그인 처리 중 오류가 발생했습니다.");
  }
  if (path === "seller-account-find" && method === "POST") return findSellerAccount(env, request);
  if (path === "seller-password-reset" && method === "POST") return resetSellerPassword(env, request);
  if (path === "brand-packages" && method === "GET") return apiBoundary(() => getPublicBrandPackages(env, request), "브랜드관 패키지를 불러오지 못했습니다.");
  if (path === "brand-consultations" && method === "POST") return apiBoundary(() => createBrandConsultation(env, request), "브랜드관 상담 요청 처리 중 오류가 발생했습니다.");

  if (path === "seller-applications" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getSellerApplications(env);
  }
  if (path.startsWith("seller-applications/") && method === "PATCH") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return updateSellerApplication(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "approved-sellers" && method === "GET") return getApprovedSellers(env);
  if (path.startsWith("approved-sellers/") && method === "PATCH") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return updateApprovedSeller(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("approved-sellers/") && method === "DELETE") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return deleteApprovedSeller(env, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "deleted-quote-logs" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getDeletedQuoteLogs(env);
  }
  if (path.startsWith("customer-quotes/") && method === "PATCH") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return updateCustomerQuote(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("customer-quotes/") && method === "DELETE") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return deleteCustomerQuote(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path === "customer-quotes" && method === "GET") return getCustomerQuotes(env, request);
  if (path === "customer-quotes" && method === "POST") return createCustomerQuote(env, request, context.ctx || context);
  if (path === "lplan-training-quotes" && method === "POST") return saveLplanTrainingQuote(env, request);
  if (path === "lplan-training-quotes" && method === "GET") return getLplanTrainingQuotes(env, request);
  if (path === "lplan-model-learning" && method === "GET") return getLplanModelLearning(env);
  if (path === "bids" && method === "GET") return getBids(env, request);
  if (path === "bids" && method === "POST") return upsertBid(env, request);
  if (path === "reviews" && method === "GET") return getReviews(env, request);
  if (path === "reviews" && method === "POST") return createReview(env, request);
  if (path === "bid-selection" && method === "POST") return selectBid(env, request);
  if (path === "quote-close" && method === "POST") return closeQuoteByCustomer(env, request);
  if (path === "naver-shopping-lowest" && method === "GET") return getNaverShoppingLowest(env, request);

  if (path === "guide-dismissal" && method === "GET") return getGuideDismissal(env, request);
  if (path === "guide-dismissal" && method === "POST") return saveGuideDismissal(env, request);
  if (path === "solapi-health" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getSolapiHealth(env);
  }
  if (path === "solapi-auth-test" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getSolapiAuthTest(env);
  }

  if (path === "alimtalk" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getAlimtalk(env);
  }
  if (path === "alimtalk-debug" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getAlimtalkDebug(env);
  }
  if (path === "alimtalk" && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return createAlimtalk(env, request);
  }
  if (path.startsWith("alimtalk/") && path.endsWith("/resend") && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return resendAlimtalk(env, decodeURIComponent(pathParts.slice(1, -1).join("/")));
  }
  if (path.startsWith("alimtalk/") && path.endsWith("/refresh") && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return refreshAlimtalkStatus(env, decodeURIComponent(pathParts.slice(1, -1).join("/")));
  }
  if (path.startsWith("alimtalk/") && method === "DELETE") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return deleteAlimtalk(env, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("alimtalk/") && method === "PATCH") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return updateAlimtalk(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "push-tokens" && method === "POST") return savePushToken(env, request);
  if (path === "push-health" && method === "GET") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return getPushHealth(env);
  }
  if (path === "maintenance" && method === "POST") {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    return runMaintenance(env);
  }

  if (path === "uploads" && method === "POST") return uploadFile(env, request);
  if (path.startsWith("files/") && method === "GET") return getFile(env, decodeURIComponent(pathParts.slice(1).join("/")));

  return json({ ok: false, message: "API를 찾을 수 없습니다." }, 404);
}

export async function onScheduled(context) {
  const { env } = context;
  if (!env.DB) return;
  await closeExpiredQuotes(env);
  await cleanupExpiredStoredData(env);
  await migrateLegacySellerPasswords(env);
}
