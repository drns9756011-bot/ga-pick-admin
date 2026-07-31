const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
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
};

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

function createId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function sellerName(row) {
  return [row.channel, row.branch].filter(Boolean).join(" ");
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
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

function formatPhoneNumber(value) {
  const digits = normalizePhone(value);
  if (!digits) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 9) return digits.replace(/^(02)(\d{3})(\d{4})$/, "$1-$2-$3");
    return digits.replace(/^(02)(\d{4})(\d{4})$/, "$1-$2-$3");
  }
  if (digits.length === 10) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
  return value || digits;
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

async function protectStoredPassword(storedPassword) {
  const stored = String(storedPassword || "");
  if (!stored) return "";
  return stored.startsWith("pbkdf2$") ? stored : hashPassword(stored);
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
  };
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

function normalizeDeletedQuoteLog(row) {
  if (!row) return null;
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

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeCustomerQuote(row, images = []) {
  if (!row) return null;
  const fullImages = images.filter((image) => image.image_type !== "thumbnail");
  const displayImages = fullImages.length ? fullImages : row.thumbnail_image ? [{ url: row.thumbnail_image }] : [];
  const bids = Array.isArray(row.bids) ? row.bids : [];
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customer: row.customer,
    phone: row.phone,
    items: row.items,
    quoteType: row.quote_type || row.quoteType || "",
    purchasePurpose: row.purchase_purpose || "",
    desiredBrand: normalizeQuoteBrand(row.desired_brand || row.desiredBrand || row.brand || ""),
    price: Number(row.price || 0),
    region: row.region || "",
    memo: row.memo || "",
    status: row.status || "open",
    selectedBidId: row.selected_bid_id || null,
    bidCount: Number(row.bid_count || bids.length || 0),
    bids,
    saleCompletedAt: row.sale_completed_at || "",
    thumbnailImage: row.thumbnail_image || "",
    thumbnailImageKey: row.thumbnail_image_key || "",
    quoteExpiresAt: row.quote_expires_at || "",
    fullImagesExpiresAt: row.full_images_expires_at || "",
    personalExpiresAt: row.personal_expires_at || "",
    createdAt: row.created_at || "",
    consent: parseJson(row.consent_json, {}),
    image: displayImages[0]?.url || row.thumbnail_image || "",
    images: displayImages.map((image) => image.url),
  };
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
    membershipType: row.membership_type || "",
    itemCount: Number(row.item_count || 0),
    totalRegPrice: Number(row.total_reg_price || 0),
    totalPoint: Number(row.total_point || 0),
    totalCashback: Number(row.total_cashback || 0),
    comboKey: row.combo_key || "",
    rows: parseJson(row.rows_json, []),
  };
}

function normalizeBid(row) {
  if (!row) return null;
  return {
    id: row.id,
    quoteId: row.quote_id || "",
    sellerId: row.seller_id || "",
    seller: row.seller || "",
    channel: row.channel || "",
    branch: row.branch || "",
    manager: row.manager || "",
    managerPosition: row.manager_position || "",
    phone: row.phone || "",
    price: Number(row.price || 0),
    benefits: row.benefits || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function dataUrlInfo(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1];
  const base64 = match[2];
  const ext = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }[contentType] || "bin";
  return { contentType, base64, ext };
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function saveDataUrlToR2(env, dataUrl, prefix, id) {
  const info = dataUrlInfo(dataUrl);
  if (!info || !env.FILES) return { url: dataUrl || "", key: "" };

  const key = `${prefix}/${id}.${info.ext}`;
  await env.FILES.put(key, base64ToArrayBuffer(info.base64), {
    httpMetadata: { contentType: info.contentType },
  });
  return { key, url: `/api/files/${key}` };
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
      // Already migrated.
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
  const sentAt = result.ok ? new Date().toISOString() : "";
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

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "").trim()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createSolapiSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getSolapiTemplateId(env, type) {
  return (
    {
      "customer-quote-received": solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED"),
      "customer-bid-received": solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED"),
      "customer-quote-closed": solapiValue(env, "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED"),
      "seller-application-received": solapiValue(env, "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION"),
      "seller-bid-selected": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_BID_SELECTED"),
      "seller-approved": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_APPROVED"),
      "seller-rejected": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_REJECTED"),
    }[type] || ""
  );
}

function canSendSolapi(env, message, templateId) {
  return Boolean(
    env.SOLAPI_API_KEY &&
      env.SOLAPI_API_SECRET &&
      solapiValue(env, "SOLAPI_CHANNEL_ID") &&
      solapiValue(env, "SOLAPI_FROM") &&
      templateId &&
      normalizePhone(message.targetPhone)
  );
}

function getSolapiMissingKeys(env, message, templateId) {
  return [
    ["SOLAPI_API_KEY", env.SOLAPI_API_KEY],
    ["SOLAPI_API_SECRET", env.SOLAPI_API_SECRET],
    ["SOLAPI_CHANNEL_ID", solapiValue(env, "SOLAPI_CHANNEL_ID")],
    ["SOLAPI_FROM", solapiValue(env, "SOLAPI_FROM")],
    ["templateId", templateId],
    ["targetPhone", normalizePhone(message.targetPhone)],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

async function sendSolapiAlimtalk(env, message, templateId) {
  if (!canSendSolapi(env, message, templateId)) {
    return {
      ok: false,
      skipped: true,
      error: `솔라피 설정 누락: ${getSolapiMissingKeys(env, message, templateId).join(", ")}`,
    };
  }

  const date = new Date().toISOString();
  const salt = createSolapiSalt();
  const apiKey = String(env.SOLAPI_API_KEY || "").trim();
  const apiSecret = String(env.SOLAPI_API_SECRET || "").trim();
  const signature = await hmacSha256Hex(apiSecret, date + salt);
  const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  const variables = {};
  Object.entries(message.variables || {}).forEach(([key, value]) => {
    variables[key] = String(value ?? "");
  });

  const response = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          type: "ATA",
          to: normalizePhone(message.targetPhone),
          from: normalizePhone(solapiValue(env, "SOLAPI_FROM")),
          kakaoOptions: {
            pfId: solapiValue(env, "SOLAPI_CHANNEL_ID"),
            templateId,
            variables,
            disableSms: false,
          },
        },
      ],
      strict: false,
      allowDuplicates: false,
      showMessageList: true,
    }),
  });

  const payload = await response.json().catch(() => ({}));
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

  const acceptedStatusCodes = ["2000", "3000"];
  const queueStatus = firstStatusCode === "4000" ? "sent" : acceptedStatusCodes.includes(firstStatusCode) ? "accepted" : "accepted";

  return {
    ok: true,
    queueStatus,
    payload,
    groupId: payload.groupInfo?.groupId || payload.groupId || "",
    messageId: firstMessage.messageId || firstMessage.message_id || "",
  };
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

async function getSellerApplications(env) {
  const result = await env.DB.prepare("SELECT * FROM seller_applications ORDER BY requested_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeSellerApplication) });
}

async function updateSellerApplication(env, request, id) {
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
      title: "판매자 등록이 완료되었습니다",
      body: `${sellerName(updated)} 등록이 완료되었습니다. 신청하신 아이디로 판매자 페이지에 로그인할 수 있습니다.`,
      relatedId: updated.id,
      variables: {
        "#{채널}": updated.channel,
        "#{지점명}": updated.branch,
        "#{매니저명}": updated.manager,
        "#{아이디}": updated.sellerId,
        "#{연락처}": formatPhoneNumber(updated.phone),
      },
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

async function getApprovedSellers(env) {
  const result = await env.DB.prepare("SELECT * FROM approved_sellers ORDER BY approved_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeApprovedSeller) });
}

async function ensureDeletedQuoteLogTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS deleted_quote_logs (
      id TEXT PRIMARY KEY,
      quote_id TEXT DEFAULT '',
      quote_number TEXT DEFAULT '',
      customer TEXT NOT NULL,
      phone TEXT NOT NULL,
      reason TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_deleted_quote_logs_deleted_at ON deleted_quote_logs(deleted_at)"
  ).run();
}

async function ensureCustomerQuoteColumns(env) {
  const statements = [
    "ALTER TABLE customer_quotes ADD COLUMN thumbnail_image TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN thumbnail_image_key TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN quote_expires_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN full_images_expires_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN personal_expires_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN desired_brand TEXT DEFAULT ''",
    "ALTER TABLE quote_images ADD COLUMN image_type TEXT DEFAULT 'full'",
    "ALTER TABLE quote_images ADD COLUMN expires_at TEXT DEFAULT ''",
  ];

  await Promise.all(
    statements.map(async (statement) => {
      try {
        await env.DB.prepare(statement).run();
      } catch (error) {
        // Already migrated.
      }
    })
  );
}

async function getQuoteImages(env, quoteId) {
  const result = await env.DB.prepare(
    `SELECT * FROM quote_images
     WHERE quote_id = ?
     ORDER BY sort_order ASC`
  )
    .bind(quoteId)
    .all();
  return result.results || [];
}

async function getQuoteBids(env, quoteId) {
  const result = await env.DB.prepare(
    `SELECT *
     FROM bids
     WHERE quote_id = ?
     ORDER BY price ASC, created_at ASC`
  )
    .bind(quoteId)
    .all();
  return (result.results || []).map(normalizeBid);
}

async function getCustomerQuotes(env) {
  await ensureCustomerQuoteColumns(env);
  const result = await env.DB.prepare("SELECT * FROM customer_quotes ORDER BY created_at DESC LIMIT 100").all();
  const rows = [];

  for (const quote of result.results || []) {
    const images = await getQuoteImages(env, quote.id);
    const bids = await getQuoteBids(env, quote.id);
    rows.push(normalizeCustomerQuote({ ...quote, bid_count: bids.length, bids }, images));
  }

  return json({ ok: true, rows });
}

async function getDeletedQuoteLogs(env) {
  await ensureDeletedQuoteLogTable(env);
  const result = await env.DB.prepare("SELECT * FROM deleted_quote_logs ORDER BY deleted_at DESC LIMIT 100").all();
  return json({ ok: true, rows: (result.results || []).map(normalizeDeletedQuoteLog) });
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

async function getLplanTrainingQuotes(env, request) {
  await ensureLplanTrainingTable(env);
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 12) || 12));
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) AS total, MAX(synced_at) AS latest_synced_at
       FROM lplan_quote_patterns`
  ).first();
  const result = await env.DB.prepare(
    `SELECT id, source_quote_id, title, source_saved_at, synced_at, branch, membership_type,
            item_count, total_reg_price, total_point, total_cashback, combo_key, rows_json
       FROM lplan_quote_patterns
       ORDER BY synced_at DESC
       LIMIT ?`
  )
    .bind(limit)
    .all();

  return json({
    ok: true,
    summary: {
      total: Number(summary?.total || 0),
      latestSyncedAt: summary?.latest_synced_at || "",
    },
    rows: (result.results || []).map(normalizeLplanTrainingQuote),
  });
}

async function deleteCustomerQuote(env, request, id) {
  await ensureCustomerQuoteColumns(env);
  await ensureDeletedQuoteLogTable(env);
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (reason.length < 2) {
    return json({ ok: false, message: "삭제 사유를 입력해주세요." }, 400);
  }

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  if (!quote) return json({ ok: false, message: "삭제할 고객 견적을 찾을 수 없습니다." }, 404);

  const images = await getQuoteImages(env, id);
  const objectKeys = Array.from(
    new Set(
      [
        quote.thumbnail_image_key || "",
        ...images.map((image) => image.object_key || ""),
      ].filter(Boolean)
    )
  );

  if (env.FILES) {
    for (const key of objectKeys) {
      try {
        await env.FILES.delete(key);
      } catch (error) {
        // Continue deleting database records even if an object was already removed.
      }
    }
  }

  const deletedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO deleted_quote_logs
      (id, quote_id, quote_number, customer, phone, reason, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(createId("deleted-quote"), quote.id, quote.quote_number || "", quote.customer, quote.phone, reason, deletedAt)
    .run();

  await env.DB.prepare("DELETE FROM reviews WHERE quote_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM bids WHERE quote_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM quote_images WHERE quote_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM alimtalk_queue WHERE related_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM customer_quotes WHERE id = ?").bind(id).run();

  return json({ ok: true, id, deletedAt });
}

async function updateCustomerQuote(env, request, id) {
  await ensureCustomerQuoteColumns(env);
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "수정할 고객 견적을 찾을 수 없습니다." }, 404);

  const nextCustomer = String(body.customer || "").trim();
  const nextPhone = normalizePhone(body.phone || "");
  const nextItems = String(body.items || "").trim();
  if (!nextCustomer || !nextPhone || !nextItems) {
    return json({ ok: false, message: "고객명, 연락처, 품목은 필수입니다." }, 400);
  }

  await env.DB.prepare(
    `UPDATE customer_quotes
     SET customer = ?,
         phone = ?,
         items = ?,
         purchase_purpose = ?,
         desired_brand = ?,
         price = ?,
         region = ?,
         memo = ?
     WHERE id = ?`
  )
    .bind(
      nextCustomer,
      nextPhone,
      nextItems,
      String(body.purchasePurpose || "").trim(),
      normalizeQuoteBrand(body.desiredBrand || body.desired_brand || body.brand || ""),
      Number(body.price || 0),
      String(body.region || "").trim(),
      String(body.memo || "").trim(),
      id
    )
    .run();

  const row = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ?").bind(id).first();
  const images = await getQuoteImages(env, id);
  return json({ ok: true, row: normalizeCustomerQuote(row, images) });
}

async function updateApprovedSeller(env, request, id) {
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

  return json({ ok: true, row });
}

async function deleteApprovedSeller(env, id) {
  const existing = await env.DB.prepare("SELECT id FROM approved_sellers WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, message: "승인 판매자를 찾을 수 없습니다." }, 404);

  await env.DB.prepare("DELETE FROM approved_sellers WHERE id = ?").bind(id).run();
  return json({ ok: true, id });
}

async function getAlimtalk(env) {
  await ensureAlimtalkColumns(env);
  const result = await env.DB.prepare("SELECT * FROM alimtalk_queue ORDER BY created_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeMessage) });
}

async function createAlimtalk(env, request) {
  const body = await request.json();
  await queueAlimtalk(env, body);
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

async function resendAlimtalk(env, id) {
  await ensureAlimtalkColumns(env);
  const row = normalizeMessage(
    await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
  );
  if (!row) return json({ ok: false, message: "알림톡 정보를 찾을 수 없습니다." }, 404);

  const templateId = row.templateId || getSolapiTemplateId(env, row.type || "notice");
  const result = await sendSolapiAlimtalk(env, row, templateId).catch((error) => ({
    ok: false,
    error: error?.message || "솔라피 재발송 처리 중 오류가 발생했습니다.",
  }));
  await updateAlimtalkDeliveryResult(env, id, result, { canceledAt: "", templateId });

  const updated = normalizeMessage(
    await env.DB.prepare("SELECT * FROM alimtalk_queue WHERE id = ?").bind(id).first()
  );
  return json({ ok: Boolean(result.ok), row: updated, message: result.ok ? "알림톡을 재발송했습니다." : result.error || "알림톡 재발송에 실패했습니다." });
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
  };
  return json({
    ok: true,
    hasApiKey: Boolean(String(env.SOLAPI_API_KEY || "").trim()),
    hasApiSecret: Boolean(String(env.SOLAPI_API_SECRET || "").trim()),
    hasChannelId: Boolean(solapiValue(env, "SOLAPI_CHANNEL_ID")),
    hasFrom: Boolean(solapiValue(env, "SOLAPI_FROM")),
    hasAdminPhone: Boolean(solapiValue(env, "SOLAPI_ADMIN_PHONE")),
    templates,
    missing: [
      !String(env.SOLAPI_API_KEY || "").trim() && "SOLAPI_API_KEY",
      !String(env.SOLAPI_API_SECRET || "").trim() && "SOLAPI_API_SECRET",
      !solapiValue(env, "SOLAPI_CHANNEL_ID") && "SOLAPI_CHANNEL_ID",
      !solapiValue(env, "SOLAPI_FROM") && "SOLAPI_FROM",
      !templates.customerQuoteReceived && "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED",
      !templates.customerQuoteClosed && "SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED",
      !templates.customerBidReceived && "SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED",
      !templates.adminSellerApplication && "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION",
      !templates.sellerBidSelected && "SOLAPI_TEMPLATE_SELLER_BID_SELECTED",
      !templates.sellerApproved && "SOLAPI_TEMPLATE_SELLER_APPROVED",
      !templates.sellerRejected && "SOLAPI_TEMPLATE_SELLER_REJECTED",
    ].filter(Boolean),
  });
}

async function getFile(env, key) {
  if (!env.FILES) return json({ ok: false, message: "R2 바인딩이 필요합니다." }, 500);
  const object = await env.FILES.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store",
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

export async function onRequest(context) {
  const { request, env, params } = context;
  const pathParts = Array.isArray(params.path) ? params.path : [];
  const path = pathParts.join("/");
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (path.startsWith("files/") && method === "GET") {
    return getFile(env, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (!env.DB) return json({ ok: false, message: "D1 DB 바인딩(DB)이 필요합니다." }, 500);
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  if (path === "seller-applications" && method === "GET") return getSellerApplications(env);
  if (path.startsWith("seller-applications/") && method === "PATCH") {
    return updateSellerApplication(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "approved-sellers" && method === "GET") return getApprovedSellers(env);
  if (path === "customer-quotes" && method === "GET") return getCustomerQuotes(env);
  if (path === "deleted-quote-logs" && method === "GET") return getDeletedQuoteLogs(env);
  if (path === "lplan-training-quotes" && method === "GET") return getLplanTrainingQuotes(env, request);
  if (path.startsWith("customer-quotes/") && method === "PATCH") {
    return updateCustomerQuote(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("customer-quotes/") && method === "DELETE") {
    return deleteCustomerQuote(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("approved-sellers/") && method === "PATCH") {
    return updateApprovedSeller(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("approved-sellers/") && method === "DELETE") {
    return deleteApprovedSeller(env, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "alimtalk" && method === "GET") return getAlimtalk(env);
  if (path === "alimtalk" && method === "POST") return createAlimtalk(env, request);
  if (path.startsWith("alimtalk/") && path.endsWith("/resend") && method === "POST") {
    return resendAlimtalk(env, decodeURIComponent(pathParts.slice(1, -1).join("/")));
  }
  if (path.startsWith("alimtalk/") && method === "PATCH") {
    return updateAlimtalk(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path === "solapi-health" && method === "GET") return getSolapiHealth(env);

  if (path === "uploads" && method === "POST") return uploadFile(env, request);

  return json({ ok: false, message: "API를 찾을 수 없습니다." }, 404);
}

