const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
};

import builtInSubscriptionImageMap from "../data/subscription-image-map.js";

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

function adminTodayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function adminDateKeyDaysAgo(days) {
  const [year, month, day] = adminTodayKey().split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - Number(days || 0));
  return value.toISOString().slice(0, 10);
}

async function ensureSiteVisitTables(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_visit_daily (visit_date TEXT PRIMARY KEY, page_views INTEGER NOT NULL DEFAULT 0, unique_visitors INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_visit_events (event_key TEXT PRIMARY KEY, visit_date TEXT NOT NULL, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_visit_uniques (visit_date TEXT NOT NULL, visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (visit_date, visitor_hash))`),
  ]);
}

async function ensureApprovedSellerOptOutColumn(env) {
  await env.DB.prepare("ALTER TABLE approved_sellers ADD COLUMN quote_alimtalk_opt_out INTEGER NOT NULL DEFAULT 0").run().catch(() => {});
}

async function getSiteVisitStats(env) {
  await ensureSiteVisitTables(env);
  const today = adminTodayKey();
  const sevenDaysAgo = adminDateKeyDaysAgo(6);
  const [todayRow, sevenDayRow, totalRow, dailyRows] = await Promise.all([
    env.DB.prepare(`SELECT page_views, unique_visitors FROM site_visit_daily WHERE visit_date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(page_views), 0) AS page_views, COALESCE(SUM(unique_visitors), 0) AS unique_visitors FROM site_visit_daily WHERE visit_date >= ? AND visit_date <= ?`).bind(sevenDaysAgo, today).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(page_views), 0) AS page_views, COALESCE(SUM(unique_visitors), 0) AS unique_visitors FROM site_visit_daily`).first(),
    env.DB.prepare(`SELECT visit_date, page_views, unique_visitors FROM site_visit_daily ORDER BY visit_date DESC LIMIT 14`).all(),
  ]);
  return json({ ok: true, today: { date: today, pageViews: Number(todayRow?.page_views || 0), uniqueVisitors: Number(todayRow?.unique_visitors || 0) }, last7Days: { from: sevenDaysAgo, to: today, pageViews: Number(sevenDayRow?.page_views || 0), uniqueVisitors: Number(sevenDayRow?.unique_visitors || 0) }, total: { pageViews: Number(totalRow?.page_views || 0), dailyUniqueVisitors: Number(totalRow?.unique_visitors || 0) }, daily: (dailyRows?.results || []).map((row) => ({ date: row.visit_date, pageViews: Number(row.page_views || 0), uniqueVisitors: Number(row.unique_visitors || 0) })) });
}

let sellerAccessAdminTablesReady = false;
async function ensureSellerAccessAdminTables(env) {
  if (sellerAccessAdminTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS seller_access_logs (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, access_type TEXT NOT NULL DEFAULT 'login', access_date TEXT NOT NULL, accessed_at TEXT NOT NULL, ip_masked TEXT DEFAULT '', ip_hash TEXT DEFAULT '', user_agent TEXT DEFAULT '', device_type TEXT DEFAULT '', browser_name TEXT DEFAULT '', created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_access_logs_seller_time ON seller_access_logs(seller_id, accessed_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_access_logs_date ON seller_access_logs(access_date, accessed_at DESC)`),
  ]);
  sellerAccessAdminTablesReady = true;
}

async function getSellerAccessLogsAdmin(env, request) {
  await ensureSellerAccessAdminTables(env);
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get('limit') || 200) || 200));
  const sellerId = String(url.searchParams.get('sellerId') || '').trim();
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') || 30) || 30));
  const fromDate = adminDateKeyDaysAgo(days - 1);
  const today = adminTodayKey();
  const where = ['l.access_date >= ?'];
  const values = [fromDate];
  if (sellerId) { where.push('l.seller_id = ?'); values.push(sellerId); }
  const rows = await env.DB.prepare(`SELECT l.id, l.seller_id, l.access_type, l.access_date, l.accessed_at, l.ip_masked, l.device_type, l.browser_name, s.channel, s.branch, s.branch_region, s.manager, s.manager_position FROM seller_access_logs l LEFT JOIN approved_sellers s ON s.seller_id = l.seller_id WHERE ${where.join(' AND ')} ORDER BY l.accessed_at DESC LIMIT ?`).bind(...values, limit).all();
  const [todaySummary, weekSummary, totalSummary] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS login_count, COUNT(DISTINCT seller_id) AS seller_count FROM seller_access_logs WHERE access_date = ?`).bind(today).first(),
    env.DB.prepare(`SELECT COUNT(*) AS login_count, COUNT(DISTINCT seller_id) AS seller_count FROM seller_access_logs WHERE access_date >= ? AND access_date <= ?`).bind(adminDateKeyDaysAgo(6), today).first(),
    env.DB.prepare(`SELECT COUNT(*) AS login_count, COUNT(DISTINCT seller_id) AS seller_count FROM seller_access_logs`).first(),
  ]);
  return json({ ok: true, summary: { today: { loginCount: Number(todaySummary?.login_count || 0), sellerCount: Number(todaySummary?.seller_count || 0) }, last7Days: { loginCount: Number(weekSummary?.login_count || 0), sellerCount: Number(weekSummary?.seller_count || 0) }, total: { loginCount: Number(totalSummary?.login_count || 0), sellerCount: Number(totalSummary?.seller_count || 0) } }, rows: (rows.results || []).map((row) => ({ id: row.id, sellerId: row.seller_id, accessType: row.access_type, accessDate: row.access_date, accessedAt: row.accessed_at, ipMasked: row.ip_masked || '', deviceType: row.device_type || '기타', browserName: row.browser_name || '기타', channel: row.channel || '', branch: row.branch || '', branchRegion: row.branch_region || '', manager: row.manager || '', managerPosition: row.manager_position || '' })) });
}

let brandAdminTablesReady = false;
async function ensureBrandAdminTables(env) {
  if (brandAdminTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS brand_packages (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, channel TEXT DEFAULT '', branch TEXT DEFAULT '', branch_region TEXT DEFAULT '', manager TEXT DEFAULT '', manager_phone TEXT DEFAULT '', brand TEXT DEFAULT '', title TEXT NOT NULL, items_json TEXT DEFAULT '[]', original_price INTEGER DEFAULT 0, sale_price INTEGER DEFAULT 0, benefits TEXT DEFAULT '', cover_image TEXT DEFAULT '', cover_image_key TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS brand_consultations (id TEXT PRIMARY KEY, package_id TEXT NOT NULL, seller_id TEXT NOT NULL, channel TEXT DEFAULT '', branch TEXT DEFAULT '', manager TEXT DEFAULT '', manager_phone TEXT DEFAULT '', package_title TEXT DEFAULT '', customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_region TEXT DEFAULT '', preferred_time TEXT DEFAULT '', memo TEXT DEFAULT '', consent_json TEXT DEFAULT '{}', status TEXT DEFAULT 'new', delivery_status TEXT DEFAULT 'pending', delivery_error TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
  ]);
  await Promise.all([
    env.DB.prepare("ALTER TABLE brand_consultations ADD COLUMN contract_amount INTEGER DEFAULT 0").run().catch(() => {}),
    env.DB.prepare("ALTER TABLE brand_consultations ADD COLUMN commission_amount INTEGER DEFAULT 0").run().catch(() => {}),
    env.DB.prepare("ALTER TABLE brand_consultations ADD COLUMN settlement_status TEXT DEFAULT 'unsettled'").run().catch(() => {}),
    env.DB.prepare("ALTER TABLE brand_consultations ADD COLUMN admin_memo TEXT DEFAULT ''").run().catch(() => {}),
    env.DB.prepare("ALTER TABLE brand_consultations ADD COLUMN settled_at TEXT DEFAULT ''").run().catch(() => {}),
  ]);
  brandAdminTablesReady = true;
}

function normalizeAdminBrandPackage(row) {
  return { id: row.id, sellerId: row.seller_id || '', channel: row.channel || '', publicChannel: row.channel || '', branch: row.branch || '', branchRegion: row.branch_region || '', manager: row.manager || '', managerPhone: row.manager_phone || '', brand: row.brand || '', title: row.title || '', items: parseJson(row.items_json, []), originalPrice: Number(row.original_price || 0), salePrice: Number(row.sale_price || 0), benefits: row.benefits || '', coverImage: row.cover_image || '', coverImageKey: row.cover_image_key || '', status: row.status || 'active', createdAt: row.created_at || '', updatedAt: row.updated_at || '' };
}

function normalizeAdminBrandConsultation(row) {
  return { id: row.id, packageId: row.package_id || '', sellerId: row.seller_id || '', channel: row.channel || '', branch: row.branch || '', manager: row.manager || '', managerPhone: row.manager_phone || '', packageTitle: row.package_title || '', customerName: row.customer_name || '', customerPhone: normalizePhone(row.customer_phone || ''), customerPhoneFormatted: formatPhoneNumber(row.customer_phone || ''), customerRegion: row.customer_region || '', preferredTime: row.preferred_time || '', memo: row.memo || '', status: row.status || 'new', deliveryStatus: row.delivery_status || 'pending', deliveryError: row.delivery_error || '', contractAmount: Number(row.contract_amount || 0), commissionAmount: Number(row.commission_amount || 0), settlementStatus: row.settlement_status || 'unsettled', adminMemo: row.admin_memo || '', settledAt: row.settled_at || '', createdAt: row.created_at || '', updatedAt: row.updated_at || '' };
}

async function getAdminBrandHall(env) {
  await ensureBrandAdminTables(env);
  const [packages, consultations] = await Promise.all([
    env.DB.prepare("SELECT * FROM brand_packages ORDER BY updated_at DESC LIMIT 300").all(),
    env.DB.prepare("SELECT * FROM brand_consultations ORDER BY created_at DESC LIMIT 500").all(),
  ]);
  return json({ ok: true, packages: (packages.results || []).map(normalizeAdminBrandPackage), consultations: (consultations.results || []).map(normalizeAdminBrandConsultation) });
}

async function saveAdminBrandPackage(env, request, id = '') {
  await ensureBrandAdminTables(env);
  const body = await request.json().catch(() => ({}));
  const payload = body.package || {};
  const sellerId = String(payload.sellerId || '').trim();
  const title = String(payload.title || '').trim().slice(0, 80);
  const brand = String(payload.brand || '').trim().slice(0, 40);
  const items = Array.isArray(payload.items) ? payload.items.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20) : [];
  const originalPrice = Math.max(0, Math.floor(Number(payload.originalPrice || 0)));
  const salePrice = Math.max(0, Math.floor(Number(payload.salePrice || 0)));
  if (!sellerId || !title || !brand || !items.length || !salePrice) return json({ ok: false, message: '판매자, 브랜드, 패키지명, 제품 구성, 판매가는 필수입니다.' }, 400);
  const seller = await env.DB.prepare("SELECT * FROM approved_sellers WHERE seller_id = ? AND status = 'approved' LIMIT 1").bind(sellerId).first();
  if (!seller) return json({ ok: false, message: '승인된 판매자 계정을 찾을 수 없습니다.' }, 404);
  const now = new Date().toISOString();
  const packageId = String(id || createId('brandpkg'));
  const existing = id ? await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? LIMIT 1").bind(packageId).first() : null;
  if (id && !existing) return json({ ok: false, message: '수정할 브랜드관 패키지를 찾을 수 없습니다.' }, 404);
  let coverImage = existing?.cover_image || '';
  let coverImageKey = existing?.cover_image_key || '';
  const coverDataUrl = String(payload.coverImageDataUrl || '');
  if (coverDataUrl) {
    if (!env.FILES) return json({ ok: false, message: '대표 이미지 저장소가 연결되지 않았습니다.' }, 500);
    const saved = await saveDataUrlToR2(env, coverDataUrl, 'brand-packages', `${packageId}-cover-${Date.now()}`);
    if (!saved.key) return json({ ok: false, message: '대표 이미지 저장에 실패했습니다.' }, 500);
    coverImage = saved.url || '';
    coverImageKey = saved.key || '';
    if (existing?.cover_image_key && existing.cover_image_key !== coverImageKey) await env.FILES.delete(existing.cover_image_key).catch(() => {});
  }
  const values = [sellerId, seller.channel || '', seller.branch || '', seller.branch_region || '', seller.manager || '', normalizePhone(seller.phone || ''), brand, title, JSON.stringify(items), originalPrice, salePrice, String(payload.benefits || '').trim().slice(0, 1200), coverImage, coverImageKey, payload.status === 'hidden' ? 'hidden' : 'active', now];
  if (existing) {
    await env.DB.prepare("UPDATE brand_packages SET seller_id = ?, channel = ?, branch = ?, branch_region = ?, manager = ?, manager_phone = ?, brand = ?, title = ?, items_json = ?, original_price = ?, sale_price = ?, benefits = ?, cover_image = ?, cover_image_key = ?, status = ?, updated_at = ? WHERE id = ?").bind(...values, packageId).run();
  } else {
    await env.DB.prepare("INSERT INTO brand_packages (id, seller_id, channel, branch, branch_region, manager, manager_phone, brand, title, items_json, original_price, sale_price, benefits, cover_image, cover_image_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(packageId, ...values.slice(0, 15), now, now).run();
  }
  const savedRow = await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? LIMIT 1").bind(packageId).first();
  return json({ ok: true, row: normalizeAdminBrandPackage(savedRow) });
}

async function deleteAdminBrandPackage(env, id) {
  await ensureBrandAdminTables(env);
  const row = await env.DB.prepare("SELECT * FROM brand_packages WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ ok: false, message: '삭제할 브랜드관 패키지를 찾을 수 없습니다.' }, 404);
  await env.DB.prepare("DELETE FROM brand_packages WHERE id = ?").bind(id).run();
  if (row.cover_image_key && env.FILES) await env.FILES.delete(row.cover_image_key).catch(() => {});
  return json({ ok: true, deletedId: id });
}

async function updateAdminBrandConsultation(env, request, id) {
  await ensureBrandAdminTables(env);
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare("SELECT * FROM brand_consultations WHERE id = ? LIMIT 1").bind(id).first();
  if (!existing) return json({ ok: false, message: '브랜드관 상담을 찾을 수 없습니다.' }, 404);
  const status = ['new', 'contacted', 'negotiating', 'contracted', 'cancelled'].includes(String(body.status)) ? String(body.status) : existing.status || 'new';
  const settlementStatus = ['unsettled', 'pending', 'settled', 'waived'].includes(String(body.settlementStatus)) ? String(body.settlementStatus) : existing.settlement_status || 'unsettled';
  const settledAt = settlementStatus === 'settled' ? (existing.settled_at || new Date().toISOString()) : '';
  await env.DB.prepare("UPDATE brand_consultations SET status = ?, contract_amount = ?, commission_amount = ?, settlement_status = ?, admin_memo = ?, settled_at = ?, updated_at = ? WHERE id = ?").bind(status, Math.max(0, Number(body.contractAmount || 0)), Math.max(0, Number(body.commissionAmount || 0)), settlementStatus, String(body.adminMemo || '').slice(0, 1200), settledAt, new Date().toISOString(), id).run();
  const row = await env.DB.prepare("SELECT * FROM brand_consultations WHERE id = ? LIMIT 1").bind(id).first();
  return json({ ok: true, row: normalizeAdminBrandConsultation(row) });
}

async function deleteAdminBrandConsultation(env, id) {
  await ensureBrandAdminTables(env);
  const existing = await env.DB.prepare("SELECT id FROM brand_consultations WHERE id = ? LIMIT 1").bind(id).first();
  if (!existing) return json({ ok: false, message: '브랜드관 상담을 찾을 수 없습니다.' }, 404);
  await env.DB.prepare("DELETE FROM brand_consultations WHERE id = ?").bind(id).run();
  return json({ ok: true, deletedId: id });
}

let adminChatTablesReady = false;
async function ensureAdminChatTables(env) {
  if (adminChatTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_consultations (id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, bid_id TEXT NOT NULL, seller_id TEXT NOT NULL, started_by TEXT NOT NULL DEFAULT 'customer', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, selected_at TEXT DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_consultation_messages (id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL, sender_role TEXT NOT NULL, sender_id TEXT DEFAULT '', body TEXT NOT NULL, normalized_body TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, block_reason TEXT DEFAULT '', created_at TEXT NOT NULL)`),
  ]);
  adminChatTablesReady = true;
}

async function getAdminAnonymousConsultations(env, request) {
  await ensureAdminChatTables(env);
  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  if (id) {
    const consultation = await env.DB.prepare('SELECT * FROM anonymous_consultations WHERE id = ? LIMIT 1').bind(id).first();
    if (!consultation) return json({ ok: false, message: '채팅방을 찾을 수 없습니다.' }, 404);
    const messages = await env.DB.prepare('SELECT id, sender_role, sender_id, body, blocked, block_reason, created_at FROM anonymous_consultation_messages WHERE consultation_id = ? ORDER BY created_at ASC').bind(id).all();
    return json({ ok: true, consultation, messages: messages.results || [] });
  }
  const rooms = await env.DB.prepare(`SELECT c.*, q.quote_number, q.customer, q.phone, b.price, (SELECT COUNT(*) FROM anonymous_consultation_messages m WHERE m.consultation_id = c.id) AS message_count, (SELECT body FROM anonymous_consultation_messages m WHERE m.consultation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message FROM anonymous_consultations c LEFT JOIN customer_quotes q ON q.id = c.quote_id LEFT JOIN bids b ON b.id = c.bid_id ORDER BY c.updated_at DESC LIMIT 300`).all();
  return json({ ok: true, rooms: rooms.results || [] });
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

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown"
  );
}

function maskClientIp(value) {
  const ip = String(value || "").trim();
  if (!ip || ip === "unknown") return "확인 불가";
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":") || "IPv6"}::****`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : "마스킹됨";
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decryptQuoteAuditValue(env, encryptedValue) {
  const value = String(encryptedValue || "").trim();
  const secret = String(env.QUOTE_AUDIT_ENCRYPTION_KEY || env.ADMIN_API_TOKEN || "").trim();
  if (!value || !secret) return "";
  const [version, ivValue, cipherValue] = value.split(".");
  if (version !== "v1" || !ivValue || !cipherValue) return "";
  try {
    const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivValue) },
      key,
      base64ToBytes(cipherValue)
    );
    return new TextDecoder().decode(decrypted);
  } catch (_) {
    return "";
  }
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
    quoteAlimtalkOptOut: Number(row.quote_alimtalk_opt_out || 0) === 1,
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
    scheduledAt: row.scheduled_at || "",
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
    submissionAudit: {
      recorded: Boolean(row.submission_recorded_at || row.submission_ip_hash),
      ipMasked: row.submission_ip_masked || "",
      country: row.submission_country || "",
      region: row.submission_region || "",
      city: row.submission_city || "",
      deviceType: row.submission_device_type || "",
      browserName: row.submission_browser_name || "",
      userAgent: row.submission_user_agent || "",
      cfRay: row.submission_cf_ray || "",
      consentVersion: row.submission_consent_version || "",
      consentedAt: row.submission_consented_at || "",
      recordedAt: row.submission_recorded_at || "",
      phoneVerified: Number(row.submission_phone_verified || 0) === 1,
      phoneVerificationId: row.submission_phone_verification_id || "",
      phoneVerifiedAt: row.submission_phone_verified_at || "",
      exactIpAvailable: Boolean(row.submission_ip_encrypted),
    },
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
        scheduled_at TEXT DEFAULT '',
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
    "ALTER TABLE alimtalk_queue ADD COLUMN scheduled_at TEXT DEFAULT ''",
    "CREATE INDEX IF NOT EXISTS idx_alimtalk_queue_scheduled ON alimtalk_queue(status, scheduled_at)",
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
    scheduled_at: row.scheduledAt || "",
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
  await ensureApprovedSellerOptOutColumn(env);
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
    "ALTER TABLE customer_quotes ADD COLUMN submission_ip_masked TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_ip_hash TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_ip_encrypted TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_country TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_region TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_city TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_user_agent TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_device_type TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_browser_name TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_cf_ray TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_consent_version TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_consented_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_recorded_at TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_phone_verified INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE customer_quotes ADD COLUMN submission_phone_verification_id TEXT DEFAULT ''",
    "ALTER TABLE customer_quotes ADD COLUMN submission_phone_verified_at TEXT DEFAULT ''",
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

async function ensureQuoteAuditAccessLogTable(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS quote_audit_access_logs (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      admin_token_hash TEXT NOT NULL,
      requester_ip_masked TEXT DEFAULT '',
      requester_ip_hash TEXT DEFAULT '',
      viewed_at TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quote_audit_access_quote_time ON quote_audit_access_logs(quote_id, viewed_at DESC)"),
  ]);
}

async function revealQuoteSubmissionAudit(env, request, quoteId) {
  await ensureCustomerQuoteColumns(env);
  await ensureQuoteAuditAccessLogTable(env);
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (reason.length < 5) {
    return json({ ok: false, message: "원본 IP 조회 사유를 5자 이상 입력해주세요." }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT id, quote_number, submission_ip_masked, submission_ip_hash, submission_ip_encrypted,
            submission_country, submission_region, submission_city, submission_user_agent,
            submission_device_type, submission_browser_name, submission_cf_ray,
            submission_consent_version, submission_consented_at, submission_recorded_at,
            submission_phone_verified
       FROM customer_quotes WHERE id = ? LIMIT 1`
  ).bind(quoteId).first();
  if (!row) return json({ ok: false, message: "고객 견적을 찾을 수 없습니다." }, 404);
  if (!row.submission_recorded_at && !row.submission_ip_hash) {
    return json({ ok: false, message: "감사기록 도입 이전 견적으로 접수기록이 없습니다." }, 404);
  }

  const requesterIp = getClientIp(request);
  const requesterSalt = String(env.QUOTE_AUDIT_HASH_SALT || env.ADMIN_API_TOKEN || "ga-pick-quote-audit-v1");
  const tokenHash = await sha256Hex(String(request.headers.get("X-Admin-Token") || ""));
  const requesterIpHash = await sha256Hex(`${requesterSalt}|${requesterIp}`);
  const viewedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO quote_audit_access_logs
      (id, quote_id, reason, admin_token_hash, requester_ip_masked, requester_ip_hash, viewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    createId("quote-audit-view"),
    quoteId,
    reason,
    tokenHash,
    maskClientIp(requesterIp),
    requesterIpHash,
    viewedAt
  ).run();

  return json({
    ok: true,
    audit: {
      quoteNumber: row.quote_number || "",
      exactIp: await decryptQuoteAuditValue(env, row.submission_ip_encrypted),
      ipMasked: row.submission_ip_masked || "",
      country: row.submission_country || "",
      region: row.submission_region || "",
      city: row.submission_city || "",
      userAgent: row.submission_user_agent || "",
      deviceType: row.submission_device_type || "",
      browserName: row.submission_browser_name || "",
      cfRay: row.submission_cf_ray || "",
      consentVersion: row.submission_consent_version || "",
      consentedAt: row.submission_consented_at || "",
      recordedAt: row.submission_recorded_at || "",
      phoneVerified: Number(row.submission_phone_verified || 0) === 1,
      locationNotice: "IP 기반 접속지역은 참고 정보이며 실제 주소와 다를 수 있습니다.",
      viewedAt,
    },
  });
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
  const branchRows = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(branch, ''), '지점 미기록') AS branch, COUNT(*) AS count, MAX(synced_at) AS latest_synced_at
       FROM lplan_quote_patterns
       GROUP BY COALESCE(NULLIF(branch, ''), '지점 미기록')
       ORDER BY count DESC, latest_synced_at DESC
       LIMIT 20`
  ).all();
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
      branches: (branchRows.results || []).map((row) => ({
        branch: row.branch || "지점 미기록",
        count: Number(row.count || 0),
        latestSyncedAt: row.latest_synced_at || "",
      })),
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

async function deleteManagerBid(env, id) {
  const bid = await env.DB.prepare("SELECT * FROM bids WHERE id = ? LIMIT 1").bind(id).first();
  if (!bid) return json({ ok: false, message: "삭제할 판매자 제안을 찾을 수 없습니다." }, 404);

  const quote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ? LIMIT 1").bind(bid.quote_id).first();
  if (!quote) return json({ ok: false, message: "제안과 연결된 고객 견적을 찾을 수 없습니다." }, 404);

  let releasedBidIds = [];
  try {
    const parsed = JSON.parse(String(quote.contact_released_bid_ids || "[]"));
    releasedBidIds = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    releasedBidIds = [];
  }
  releasedBidIds = releasedBidIds.filter((releasedBidId) => String(releasedBidId) !== String(id));

  await env.DB.batch([
    env.DB.prepare("DELETE FROM reviews WHERE bid_id = ?").bind(id),
    env.DB.prepare("DELETE FROM bids WHERE id = ?").bind(id),
    env.DB.prepare("UPDATE customer_quotes SET selected_bid_id = CASE WHEN selected_bid_id = ? THEN '' ELSE selected_bid_id END, contact_released_bid_ids = ? WHERE id = ?").bind(id, JSON.stringify(releasedBidIds), bid.quote_id),
  ]);

  const updatedQuote = await env.DB.prepare("SELECT * FROM customer_quotes WHERE id = ? LIMIT 1").bind(bid.quote_id).first();
  const bids = await getQuoteBids(env, bid.quote_id);
  const images = await getQuoteImages(env, bid.quote_id);
  return json({ ok: true, quoteId: bid.quote_id, row: normalizeCustomerQuote({ ...updatedQuote, bid_count: bids.length, bids }, images) });
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
  await ensureApprovedSellerOptOutColumn(env);
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

  if (Object.prototype.hasOwnProperty.call(body, "quoteAlimtalkOptOut")) {
    updates.push("quote_alimtalk_opt_out = ?");
    values.push(body.quoteAlimtalkOptOut ? 1 : 0);
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
  if (
    row.status === "scheduled" &&
    row.scheduledAt &&
    new Date(row.scheduledAt).getTime() > Date.now()
  ) {
    return json({
      ok: false,
      message: "오전 9시 예약 발송 전에는 재발송할 수 없습니다.",
      scheduledAt: row.scheduledAt,
    }, 409);
  }

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

const SUBSCRIPTION_CATEGORY_MAP = {
  TV: "TV",
  "스탠바이미": "TV",
  "냉장고 (일반)": "냉장고",
  "냉장고 (상냉장)": "냉장고",
  "냉장고 (양문형)": "냉장고",
  "냉장고 (얼음정수기)": "냉장고",
  "냉장고 (김치냉장고)": "김치냉장고",
  "세탁기 (드럼)": "세탁기·건조기",
  "세탁기 (건조기)": "세탁기·건조기",
  "세탁기 (워시타워)": "세탁기·건조기",
  "세탁기 (워시콤보)": "세탁기·건조기",
  "세탁기 (미니워시)": "세탁기·건조기",
  "세탁기 (통돌이)": "세탁기·건조기",
  "정수기": "정수기",
  "얼음정수기": "정수기",
  "공기청정기": "공기청정기",
  "전기레인지": "주방가전",
  "식기세척기": "주방가전",
  "광파오븐": "주방가전",
  "로봇청소기": "청소기",
  "청소기": "청소기",
  "에어컨 (스탠드)": "에어컨",
  "에어컨 (2in1)": "에어컨",
  "에어컨 (벽걸이)": "에어컨",
};

let subscriptionProductSchemaReady = false;
async function ensureSubscriptionProductSchema(env) {
  if (subscriptionProductSchemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscription_product_sets (
      id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'staging', source_name TEXT NOT NULL DEFAULT '',
      source_date TEXT NOT NULL DEFAULT '', product_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, activated_at TEXT DEFAULT ''
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscription_products (
      id TEXT PRIMARY KEY, set_id TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL,
      source_category TEXT NOT NULL DEFAULT '', model TEXT NOT NULL, name TEXT NOT NULL,
      monthly_fee_72 INTEGER NOT NULL, care_type TEXT DEFAULT '', care_detail TEXT DEFAULT '',
      visit_cycle TEXT DEFAULT '', image_url TEXT DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
      options_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_products_set_model ON subscription_products(set_id, model)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_subscription_product_sets_status ON subscription_product_sets(status, activated_at DESC)"),
  ]);
  const columns = await env.DB.prepare("PRAGMA table_info(subscription_products)").all();
  if (!(columns.results || []).some((column) => column.name === "options_json")) {
    await env.DB.prepare("ALTER TABLE subscription_products ADD COLUMN options_json TEXT NOT NULL DEFAULT '[]'").run();
  }
  subscriptionProductSchemaReady = true;
}

async function getActiveSubscriptionImageMap(env) {
  const active = await env.DB.prepare(
    "SELECT id FROM subscription_product_sets WHERE status = 'active' ORDER BY activated_at DESC LIMIT 1"
  ).first();
  const images = new Map(Object.entries(builtInSubscriptionImageMap || {}));
  if (!active) return images;
  for (let offset = 0; offset < 5000; offset += 500) {
    const result = await env.DB.prepare(
      "SELECT model, image_url, options_json FROM subscription_products WHERE set_id = ? LIMIT 500 OFFSET ?"
    ).bind(active.id, offset).all();
    const rows = result.results || [];
    rows.forEach((row) => {
      if (row.model && row.image_url) images.set(String(row.model).toUpperCase(), String(row.image_url));
      try {
        const options = JSON.parse(row.options_json || "[]");
        if (row.image_url && Array.isArray(options)) options.forEach((option) => {
          if (option?.model) images.set(String(option.model).toUpperCase(), String(row.image_url));
        });
      } catch (_) {}
    });
    if (rows.length < 500) break;
  }
  return images;
}

function findBuiltInSubscriptionImage(model, optionsJson = "[]") {
  const direct = builtInSubscriptionImageMap[String(model || "").trim().toUpperCase()];
  if (direct) return direct;
  try {
    const options = JSON.parse(optionsJson || "[]");
    if (Array.isArray(options)) {
      for (const option of options) {
        const imageUrl = builtInSubscriptionImageMap[String(option?.model || "").trim().toUpperCase()];
        if (imageUrl) return imageUrl;
      }
    }
  } catch (_) {}
  return "";
}

async function repairActiveSubscriptionImages(env) {
  await ensureSubscriptionProductSchema(env);
  const active = await env.DB.prepare(
    "SELECT id FROM subscription_product_sets WHERE status = 'active' ORDER BY activated_at DESC LIMIT 1"
  ).first();
  if (!active) return json({ ok: true, repaired: 0, remaining: 0 });

  let repaired = 0;
  for (;;) {
    const result = await env.DB.prepare(
      "SELECT id, model, options_json FROM subscription_products WHERE set_id = ? AND (image_url IS NULL OR TRIM(image_url) = '') LIMIT 60"
    ).bind(active.id).all();
    const rows = result.results || [];
    const updates = rows.map((row) => ({ row, imageUrl: findBuiltInSubscriptionImage(row.model, row.options_json) }))
      .filter((entry) => entry.imageUrl);
    if (!updates.length) break;
    await env.DB.batch(updates.map(({ row, imageUrl }) => env.DB.prepare(
      "UPDATE subscription_products SET image_url = ? WHERE id = ? AND set_id = ?"
    ).bind(imageUrl, row.id, active.id)));
    repaired += updates.length;
    if (rows.length < 60) break;
  }

  const remainingRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM subscription_products WHERE set_id = ? AND (image_url IS NULL OR TRIM(image_url) = '')"
  ).bind(active.id).first();
  return json({ ok: true, repaired, remaining: Number(remainingRow?.count || 0) });
}

function normalizeSubscriptionImportText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeSubscriptionImportItem(raw, imageMap) {
  const model = normalizeSubscriptionImportText(raw?.model, 100).toUpperCase();
  const category = normalizeSubscriptionImportText(raw?.category, 50);
  const monthlyFee72 = Math.max(0, Math.round(Number(raw?.monthlyFee72 || 0)));
  if (!model || !category || monthlyFee72 <= 0) throw new Error("모델명, 품목, 72개월 구독료가 올바르지 않은 상품이 있습니다.");
  const options = (Array.isArray(raw?.options) ? raw.options : []).slice(0, 40).map((option) => ({
    label: normalizeSubscriptionImportText(option?.label, 240),
    model: normalizeSubscriptionImportText(option?.model, 100).toUpperCase(),
    installationType: normalizeSubscriptionImportText(option?.installationType, 40),
    careType: normalizeSubscriptionImportText(option?.careType, 80),
    careDetail: normalizeSubscriptionImportText(option?.careDetail, 160),
    visitCycle: normalizeSubscriptionImportText(option?.visitCycle, 80),
    monthlyFee72: Math.max(0, Math.round(Number(option?.monthlyFee72 || 0))),
  })).filter((option) => option.model && option.monthlyFee72 > 0);
  if (!options.length) throw new Error(`${model} 모델의 구독 옵션이 없습니다.`);
  const primary = options.reduce((lowest, option) => option.monthlyFee72 < lowest.monthlyFee72 ? option : lowest, options[0]);
  const submittedImageUrl = normalizeSubscriptionImportText(raw?.imageUrl, 1200);
  const safeSubmittedImageUrl = /^(?:https:\/\/|\/api\/files\/)/i.test(submittedImageUrl) ? submittedImageUrl : "";
  return {
    brand: "LG전자",
    category,
    sourceCategory: normalizeSubscriptionImportText(raw?.sourceCategory, 80),
    model,
    name: normalizeSubscriptionImportText(raw?.name, 160) || `LG ${category}`,
    monthlyFee72: primary.monthlyFee72,
    careType: primary.careType,
    careDetail: primary.careDetail,
    visitCycle: primary.visitCycle,
    imageUrl: safeSubmittedImageUrl || imageMap.get(primary.model) || imageMap.get(model) || "",
    options,
  };
}

async function startSubscriptionProductImport(env) {
  await ensureSubscriptionProductSchema(env);
  const staging = await env.DB.prepare("SELECT id FROM subscription_product_sets WHERE status = 'staging'").all();
  for (const row of staging.results || []) {
    await env.DB.prepare("DELETE FROM subscription_products WHERE set_id = ?").bind(row.id).run();
    await env.DB.prepare("DELETE FROM subscription_product_sets WHERE id = ?").bind(row.id).run();
  }
  const setId = createId("subscription-set");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO subscription_product_sets
      (id, status, source_name, source_date, product_count, created_at, activated_at)
     VALUES (?, 'staging', '구독 상품 데이터', ?, 0, ?, '')`
  ).bind(setId, adminTodayKey(), now).run();
  const imageMap = await getActiveSubscriptionImageMap(env);
  return json({ ok: true, setId, chunkSize: 60, imageMap: Object.fromEntries(imageMap), originalFileStored: false });
}

async function appendSubscriptionProductImportChunk(env, request, setId) {
  await ensureSubscriptionProductSchema(env);
  const set = await env.DB.prepare("SELECT id FROM subscription_product_sets WHERE id = ? AND status = 'staging'").bind(setId).first();
  if (!set) return json({ ok: false, message: "진행 중인 구독 상품 갱신 작업을 찾을 수 없습니다." }, 404);
  const body = await request.json().catch(() => ({}));
  const sourceItems = Array.isArray(body.items) ? body.items : [];
  if (!sourceItems.length || sourceItems.length > 60) return json({ ok: false, message: "상품은 한 번에 1~60개씩 전송해야 합니다." }, 400);
  const items = sourceItems.map((item) => normalizeSubscriptionImportItem(item, new Map()));
  const offset = Math.max(0, Math.floor(Number(body.offset || 0)));
  const now = new Date().toISOString();
  await env.DB.batch(items.map((item, index) => env.DB.prepare(
    `INSERT OR REPLACE INTO subscription_products
      (id, set_id, brand, category, source_category, model, name, monthly_fee_72,
       care_type, care_detail, visit_cycle, image_url, options_json, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    createId("subscription-product"), setId, item.brand, item.category, item.sourceCategory,
    item.model, item.name, item.monthlyFee72, item.careType, item.careDetail, item.visitCycle,
    item.imageUrl, JSON.stringify(item.options), offset + index, now
  )));
  return json({ ok: true, setId, received: items.length, nextOffset: offset + items.length });
}

async function commitSubscriptionProductImport(env, request, setId) {
  await ensureSubscriptionProductSchema(env);
  const body = await request.json().catch(() => ({}));
  const expectedCount = Math.max(0, Math.floor(Number(body.expectedCount || 0)));
  const set = await env.DB.prepare("SELECT id FROM subscription_product_sets WHERE id = ? AND status = 'staging'").bind(setId).first();
  if (!set) return json({ ok: false, message: "완료할 구독 상품 갱신 작업을 찾을 수 없습니다." }, 404);
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM subscription_products WHERE set_id = ?").bind(setId).first();
  const count = Number(countRow?.count || 0);
  if (!count || count > 3000 || count !== expectedCount) {
    return json({ ok: false, message: `상품 저장 건수가 일치하지 않습니다. 예정 ${expectedCount}개, 서버 ${count}개` }, 409);
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE subscription_product_sets SET status = 'archived' WHERE status = 'active'"),
    env.DB.prepare("UPDATE subscription_product_sets SET status = 'active', product_count = ?, activated_at = ? WHERE id = ? AND status = 'staging'").bind(count, now, setId),
  ]);
  const archived = await env.DB.prepare("SELECT id FROM subscription_product_sets WHERE status = 'archived'").all();
  for (const row of archived.results || []) {
    await env.DB.prepare("DELETE FROM subscription_products WHERE set_id = ?").bind(row.id).run();
    await env.DB.prepare("DELETE FROM subscription_product_sets WHERE id = ?").bind(row.id).run();
  }
  return json({ ok: true, setId, count, activatedAt: now, originalFileStored: false, previousDataDeleted: true });
}

async function cancelSubscriptionProductImport(env, setId) {
  await ensureSubscriptionProductSchema(env);
  await env.DB.prepare("DELETE FROM subscription_products WHERE set_id = ?").bind(setId).run();
  await env.DB.prepare("DELETE FROM subscription_product_sets WHERE id = ? AND status = 'staging'").bind(setId).run();
  return json({ ok: true, setId });
}

async function handleSubscriptionImport(handler) {
  try {
    return await handler();
  } catch (error) {
    const detail = String(error?.message || "").trim();
    return json({
      ok: false,
      code: "SUBSCRIPTION_IMPORT_FAILED",
      message: detail ? `구독 상품 갱신에 실패했습니다: ${detail}` : "구독 상품 갱신 중 서버 오류가 발생했습니다.",
    }, 500);
  }
}

async function getSubscriptionUploadStatus(env, request) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  await ensureSubscriptionProductSchema(env);
  const row = await env.DB.prepare(
    `SELECT s.product_count, s.source_date, s.activated_at,
      (SELECT COUNT(*) FROM subscription_products p WHERE p.set_id = s.id AND COALESCE(p.image_url, '') = '') AS missing_images
     FROM subscription_product_sets s WHERE s.status = 'active' ORDER BY s.activated_at DESC LIMIT 1`
  ).first();
  return json({ ok: true, active: row ? {
    count: Number(row.product_count || 0),
    sourceDate: row.source_date || "",
    activatedAt: row.activated_at || "",
    missingImages: Number(row.missing_images || 0),
  } : null, originalFileStored: false });
}

let anonymousTablesReady = false;
async function ensureAnonymousTables(env) {
  if (anonymousTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_policy_cases (id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL, message_id TEXT NOT NULL, quote_id TEXT NOT NULL, bid_id TEXT NOT NULL, seller_id TEXT NOT NULL, branch TEXT DEFAULT '', detection_type TEXT NOT NULL, original_message TEXT NOT NULL, normalized_message TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'UNDER_REVIEW', follow_up_action TEXT DEFAULT '', prior_violation_count INTEGER DEFAULT 0, region_violation_count INTEGER DEFAULT 0, reviewed_at TEXT DEFAULT '', reviewed_by TEXT DEFAULT '', review_memo TEXT DEFAULT '', created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_seller_restrictions (seller_id TEXT PRIMARY KEY, branch_key TEXT NOT NULL, seller_status TEXT NOT NULL DEFAULT 'ACTIVE', region_status TEXT NOT NULL DEFAULT 'NORMAL', violation_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, last_case_id TEXT DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anonymous_audit_logs (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, case_id TEXT DEFAULT '', consultation_id TEXT DEFAULT '', seller_id TEXT DEFAULT '', payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`),
  ]);
  anonymousTablesReady = true;
}
async function getAnonymousCases(env) {
  await ensureAnonymousTables(env);
  const rows = await env.DB.prepare('SELECT * FROM anonymous_policy_cases ORDER BY created_at DESC LIMIT 500').all();
  return json({ ok: true, rows: rows.results || [] });
}
async function reviewAnonymousCase(env, request, caseId) {
  await ensureAnonymousTables(env);
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
  if (path.startsWith("files/") && method === "GET") {
    return getFile(env, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (!env.DB) return json({ ok: false, message: "D1 DB 바인딩(DB)이 필요합니다." }, 500);
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  if (path === "subscription-products/status" && method === "GET") return handleSubscriptionImport(() => getSubscriptionUploadStatus(env, request));
  if (path === "subscription-products/images/repair" && method === "POST") return handleSubscriptionImport(() => repairActiveSubscriptionImages(env));
  if (path === "subscription-products/import/start" && method === "POST") return handleSubscriptionImport(() => startSubscriptionProductImport(env));
  if (path.startsWith("subscription-products/import/") && path.endsWith("/chunk") && method === "POST") {
    return handleSubscriptionImport(() => appendSubscriptionProductImportChunk(env, request, decodeURIComponent(pathParts.slice(2, -1).join("/"))));
  }
  if (path.startsWith("subscription-products/import/") && path.endsWith("/commit") && method === "POST") {
    return handleSubscriptionImport(() => commitSubscriptionProductImport(env, request, decodeURIComponent(pathParts.slice(2, -1).join("/"))));
  }
  if (path.startsWith("subscription-products/import/") && method === "DELETE") {
    return handleSubscriptionImport(() => cancelSubscriptionProductImport(env, decodeURIComponent(pathParts.slice(2).join("/"))));
  }
  if (path === "seller-applications" && method === "GET") return getSellerApplications(env);
  if (path.startsWith("seller-applications/") && method === "PATCH") {
    return updateSellerApplication(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }

  if (path === "approved-sellers" && method === "GET") return getApprovedSellers(env);
  if (path === "customer-quotes" && method === "GET") return getCustomerQuotes(env);
  if (path.startsWith("customer-quotes/") && path.endsWith("/submission-audit") && method === "POST") {
    return revealQuoteSubmissionAudit(env, request, decodeURIComponent(pathParts.slice(1, -1).join("/")));
  }
  if (path === "deleted-quote-logs" && method === "GET") return getDeletedQuoteLogs(env);
  if (path === "lplan-training-quotes" && method === "GET") return getLplanTrainingQuotes(env, request);
  if (path === "visit-stats" && method === "GET") return getSiteVisitStats(env);
  if (path === "seller-access-logs" && method === "GET") return getSellerAccessLogsAdmin(env, request);
  if (path === "brand-hall" && method === "GET") return getAdminBrandHall(env);
  if (path === "brand-hall/packages" && method === "POST") return saveAdminBrandPackage(env, request);
  if (path.startsWith("brand-hall/packages/") && method === "PATCH") return saveAdminBrandPackage(env, request, decodeURIComponent(pathParts.slice(2).join("/")));
  if (path.startsWith("brand-hall/packages/") && method === "DELETE") return deleteAdminBrandPackage(env, decodeURIComponent(pathParts.slice(2).join("/")));
  if (path.startsWith("brand-hall/consultations/") && method === "PATCH") return updateAdminBrandConsultation(env, request, decodeURIComponent(pathParts.slice(2).join("/")));
  if (path.startsWith("brand-hall/consultations/") && method === "DELETE") return deleteAdminBrandConsultation(env, decodeURIComponent(pathParts.slice(2).join("/")));
  if (path === "anonymous-consultations" && method === "GET") return getAdminAnonymousConsultations(env, request);
  if (path === "anonymous-policy-cases" && method === "GET") return getAnonymousCases(env);
  if (path.startsWith("anonymous-policy-cases/") && method === "PATCH") return reviewAnonymousCase(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  if (path.startsWith("customer-quotes/") && method === "PATCH") {
    return updateCustomerQuote(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("customer-quotes/") && method === "DELETE") {
    return deleteCustomerQuote(env, request, decodeURIComponent(pathParts.slice(1).join("/")));
  }
  if (path.startsWith("bids/") && method === "DELETE") {
    return deleteManagerBid(env, decodeURIComponent(pathParts.slice(1).join("/")));
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

