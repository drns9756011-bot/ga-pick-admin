const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SOLAPI_DEFAULTS = {
  SOLAPI_CHANNEL_ID: "KA01PF260720091629575EzVmd2YRyU7",
  SOLAPI_FROM: "01066312323",
  SOLAPI_ADMIN_PHONE: "01066312323",
  SOLAPI_TEMPLATE_CUSTOMER_QUOTE_RECEIVED: "KA01TP260721025042754h4ZUWHp0Vl8",
  SOLAPI_TEMPLATE_CUSTOMER_QUOTE_CLOSED: "KA01TP2607210258227887LLx9OshNug",
  SOLAPI_TEMPLATE_CUSTOMER_BID_RECEIVED: "KA01TP260721025517053z5NPvs1ZUIX",
  SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION: "KA01TP2607210300081256MK0cxuHata",
  SOLAPI_TEMPLATE_SELLER_BID_SELECTED: "KA01TP260721133628815TgDs1sAwUhc",
  SOLAPI_TEMPLATE_SELLER_APPROVED: "KA01TP2607211355258674q0EFuag5GE",
};

function solapiValue(env, key) {
  return String(env?.[key] || SOLAPI_DEFAULTS[key] || "").trim();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
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

function normalizeSellerApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requested_at || "",
    reviewedAt: row.reviewed_at || "",
    reviewMemo: row.review_memo || "",
    sellerId: row.seller_id,
    password: row.password,
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
    password: row.password,
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
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customer: row.customer,
    phone: row.phone,
    items: row.items,
    purchasePurpose: row.purchase_purpose || "",
    price: Number(row.price || 0),
    region: row.region || "",
    memo: row.memo || "",
    status: row.status || "open",
    selectedBidId: row.selected_bid_id || null,
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
      "seller-bid-selected": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_BID_SELECTED"),
      "seller-approved": solapiValue(env, "SOLAPI_TEMPLATE_SELLER_APPROVED"),
      "seller-application-received": solapiValue(env, "SOLAPI_TEMPLATE_ADMIN_SELLER_APPLICATION"),
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
  await env.DB.prepare(
    `INSERT INTO alimtalk_queue
      (id, status, type, target_role, target_name, target_phone, title, body, related_id,
       template_id, variables_json, solapi_group_id, solapi_message_id, error_message, solapi_response_json,
       created_at, sent_at, canceled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      message.status || "ready",
      message.type || "notice",
      message.targetRole || "",
      message.targetName || "",
      message.targetPhone || "",
      message.title || "알림",
      message.body || "",
      message.relatedId || "",
      templateId,
      variablesJson,
      "",
      "",
      "",
      "",
      now,
      "",
      ""
    )
    .run();

  let result;
  try {
    result = await sendSolapiAlimtalk(env, message, templateId);
  } catch (error) {
    result = {
      ok: false,
      error: error?.message || "솔라피 발송 처리 중 오류가 발생했습니다.",
    };
  }

  const sentAt = result.ok ? new Date().toISOString() : "";
  await env.DB.prepare(
    `UPDATE alimtalk_queue
     SET status = ?, sent_at = ?, solapi_group_id = ?, solapi_message_id = ?, error_message = ?, solapi_response_json = ?
     WHERE id = ?`
  )
    .bind(
      result.ok ? result.queueStatus || "accepted" : result.skipped ? "ready" : "failed",
      sentAt,
      result.groupId || "",
      result.messageId || "",
      result.error || "",
      JSON.stringify(result.payload || {}),
      id
    )
    .run();

  return { id, ...result };
}

async function queueSellerApplicationAdminAlert(env, row) {
  await ensureAlimtalkColumns(env);
  const existing = await env.DB.prepare(
    "SELECT id FROM alimtalk_queue WHERE type = ? AND target_role = ? AND related_id = ? LIMIT 1"
  )
    .bind("seller-application-received", "admin", row.id)
    .first();
  if (existing) return { skipped: true, id: existing.id };

  return queueAlimtalk(env, {
    type: "seller-application-received",
    targetRole: "admin",
    targetName: "관리자",
    targetPhone: solapiValue(env, "SOLAPI_ADMIN_PHONE") || solapiValue(env, "SOLAPI_FROM"),
    title: "판매자 등록 요청이 접수되었습니다",
    body: `${sellerName(row)} ${row.manager} 매니저의 판매자 등록 요청이 접수되었습니다.`,
    relatedId: row.id,
    variables: {
      "#{채널}": row.channel,
      "#{지점명}": row.branch,
      "#{매니저명}": row.manager,
      "#{연락처}": formatPhoneNumber(row.phone),
    },
  });
}

async function getSellerApplications(env) {
  const result = await env.DB.prepare("SELECT * FROM seller_applications ORDER BY requested_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeSellerApplication) });
}

async function createSellerApplication(env, request) {
  const body = await request.json();
  if (!body.sellerId || !body.branch || !body.manager || !body.phone) {
    return json({ ok: false, message: "판매자 아이디, 지점명, 매니저 이름, 연락처가 필요합니다." }, 400);
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
      body.password || "",
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

  await queueSellerApplicationAdminAlert(env, row);

  return json({ ok: true, row }, 201);
}

async function updateSellerApplication(env, request, id) {
  const body = await request.json();
  const row = normalizeSellerApplication(
    await env.DB.prepare("SELECT * FROM seller_applications WHERE id = ?").bind(id).first()
  );
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
        updated.password,
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

async function getCustomerQuotes(env) {
  await ensureCustomerQuoteColumns(env);
  const result = await env.DB.prepare("SELECT * FROM customer_quotes ORDER BY created_at DESC LIMIT 100").all();
  const rows = [];

  for (const quote of result.results || []) {
    const images = await getQuoteImages(env, quote.id);
    rows.push(normalizeCustomerQuote(quote, images));
  }

  return json({ ok: true, rows });
}

async function getDeletedQuoteLogs(env) {
  await ensureDeletedQuoteLogTable(env);
  const result = await env.DB.prepare("SELECT * FROM deleted_quote_logs ORDER BY deleted_at DESC LIMIT 100").all();
  return json({ ok: true, rows: (result.results || []).map(normalizeDeletedQuoteLog) });
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
    values.push(nextPassword);
  }

  if (Object.prototype.hasOwnProperty.call(body, "managerPosition")) {
    updates.push("manager_position = ?");
    values.push(String(body.managerPosition || "").trim());
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
  const result = await env.DB.prepare("SELECT * FROM alimtalk_queue ORDER BY created_at DESC").all();
  return json({ ok: true, rows: result.results.map(normalizeMessage) });
}

async function createAlimtalk(env, request) {
  const body = await request.json();
  await queueAlimtalk(env, body);
  return getAlimtalk(env);
}

async function updateAlimtalk(env, request, id) {
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
  const sentAt = result.ok ? new Date().toISOString() : "";

  await env.DB.prepare(
    `UPDATE alimtalk_queue
     SET status = ?, sent_at = ?, canceled_at = ?, template_id = ?,
         solapi_group_id = ?, solapi_message_id = ?, error_message = ?, solapi_response_json = ?
     WHERE id = ?`
  )
    .bind(
      result.ok ? result.queueStatus || "accepted" : result.skipped ? "ready" : "failed",
      sentAt,
      "",
      templateId,
      result.groupId || "",
      result.messageId || "",
      result.error || "",
      JSON.stringify(result.payload || {}),
      id
    )
    .run();

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
  if (!env.DB) return json({ ok: false, message: "D1 DB 바인딩(DB)이 필요합니다." }, 500);

  if (path === "seller-applications" && method === "GET") return getSellerApplications(env);
  if (path === "seller-applications" && method === "POST") return createSellerApplication(env, request);
  if (path.startsWith("seller-applications/") && method === "PATCH") {
    return updateSellerApplication(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "approved-sellers" && method === "GET") return getApprovedSellers(env);
  if (path === "customer-quotes" && method === "GET") return getCustomerQuotes(env);
  if (path === "deleted-quote-logs" && method === "GET") return getDeletedQuoteLogs(env);
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
  if (path.startsWith("files/") && method === "GET") return getFile(env, decodeURIComponent(pathParts.slice(1).join("/")));

  if (path === "send-mail" && method === "POST") {
    return json({ ok: false, message: "정식 서비스 메일 발송은 별도 메일 API 연동이 필요합니다." }, 501);
  }

  return json({ ok: false, message: "API를 찾을 수 없습니다." }, 404);
}
