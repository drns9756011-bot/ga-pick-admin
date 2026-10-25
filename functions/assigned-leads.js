import { protectCustomerPhone, readCustomerPhone } from './phone-vault.js';

const states = ['new', 'contacted', 'followup', 'won', 'closed'];
const schemas = new WeakMap();
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
class InputError extends Error {}
const fail = (message) => { throw new InputError(message); };
function field(value, max, required = false) {
  if (value != null && typeof value !== 'string') fail('입력 형식을 확인해주세요.');
  const text = (value || '').trim();
  if (text.length > max || (required && !text)) fail('필수 항목과 입력 길이를 확인해주세요.');
  return text;
}
async function bodyOf(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) fail('JSON 요청이 필요합니다.');
  const reader = request.body?.getReader();
  if (!reader) fail('입력 내용을 확인해주세요.');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 131072) { await reader.cancel(); fail('한 번에 100건 이하로 등록해주세요.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const body = JSON.parse(new TextDecoder().decode(bytes)); if (!body || typeof body !== 'object' || Array.isArray(body)) fail('잘못된 입력입니다.'); return body; }
  catch { fail('입력 내용을 확인해주세요.'); }
}
export async function ensureLeadSchema(env) {
  if (!schemas.has(env.DB)) {
    const pending = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS assigned_leads (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, phone_hash TEXT NOT NULL UNIQUE, phone_ciphertext TEXT NOT NULL,
        region TEXT NOT NULL, items TEXT NOT NULL, source TEXT NOT NULL, consent_ref TEXT NOT NULL,
        created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS lead_assignments (
        id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES assigned_leads(id) ON DELETE CASCADE,
        seller_id TEXT NOT NULL, consent_ref TEXT NOT NULL, unit_price INTEGER NOT NULL DEFAULT 8000,
        status TEXT NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '', next_contact_at TEXT NOT NULL DEFAULT '',
        assigned_at TEXT NOT NULL, updated_at TEXT NOT NULL, revoked_at TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
        UNIQUE(lead_id, seller_id))`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS lead_expiry_idx ON assigned_leads(expires_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS lead_seller_idx ON lead_assignments(seller_id, revoked_at, assigned_at)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS lead_phone_access (
        id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES assigned_leads(id) ON DELETE CASCADE,
        actor TEXT NOT NULL, accessed_at TEXT NOT NULL)`),
    ]).catch(error => { schemas.delete(env.DB); throw error; });
    schemas.set(env.DB, pending);
  }
  await schemas.get(env.DB);
}
export async function purgeExpiredLeads(env, now = new Date().toISOString()) {
  await ensureLeadSchema(env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lead_phone_access WHERE lead_id IN (SELECT id FROM assigned_leads WHERE expires_at <= ?)').bind(now),
    env.DB.prepare('DELETE FROM lead_assignments WHERE lead_id IN (SELECT id FROM assigned_leads WHERE expires_at <= ?)').bind(now),
    env.DB.prepare('DELETE FROM assigned_leads WHERE expires_at <= ?').bind(now),
  ]);
}
export async function handleLeads(env, request, path, actor) {
  if (!actor || (!actor.admin && !actor.sellerId)) return reply({ ok: false, message: '로그인이 필요합니다.' }, 401);
  try {
    await purgeExpiredLeads(env);
    const now = new Date().toISOString();
    const parts = path.split('/');
    const method = request.method;
    const url = new URL(request.url);
    if (parts.length === 1 && method === 'GET') {
      const page = Math.min(10000, Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)));
      const search = field(url.searchParams.get('q'), 80);
      const status = field(url.searchParams.get('status'), 20);
      const where = ['l.expires_at > ?']; const args = [now];
      if (!actor.admin) { where.push("a.seller_id = ? AND a.revoked_at = ''"); args.push(actor.sellerId); }
      if (search) { where.push('(l.name LIKE ? OR l.region LIKE ? OR l.items LIKE ?)'); args.push(...Array(3).fill(`%${search}%`)); }
      if (!actor.admin && states.includes(status)) { where.push('a.status = ?'); args.push(status); }
      const from = actor.admin ? 'assigned_leads l' : 'lead_assignments a JOIN assigned_leads l ON l.id = a.lead_id';
      const extra = actor.admin ? ', l.source, l.consent_ref' : ', a.id AS assignment_id, a.status, a.note, a.next_contact_at, a.version, a.unit_price';
      const result = await env.DB.prepare(`SELECT l.id, l.name, l.region, l.items, l.created_at, l.expires_at${extra},
        (SELECT count(*) FROM lead_assignments x WHERE x.lead_id = l.id) AS shared_count
        FROM ${from} WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC, l.id DESC LIMIT 26 OFFSET ?`).bind(...args, (page - 1) * 25).all();
      const rows = result.results.slice(0, 25);
      if (actor.admin && rows.length) {
        const assignments = await env.DB.prepare(`SELECT a.id, a.lead_id, a.seller_id, a.status, a.revoked_at, a.assigned_at,
          s.channel, s.branch, s.manager FROM lead_assignments a LEFT JOIN approved_sellers s ON s.seller_id = a.seller_id
          WHERE a.lead_id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(row => row.id)).all();
        for (const row of rows) row.assignments = assignments.results.filter(a => a.lead_id === row.id);
      }
      return reply({ ok: true, rows, page, hasMore: result.results.length > 25 });
    }
    if (actor.admin && parts[1] === 'managers' && method === 'GET') {
      const result = await env.DB.prepare("SELECT seller_id, channel, branch, manager FROM approved_sellers WHERE status = 'approved' ORDER BY manager LIMIT 1000").all();
      return reply({ ok: true, rows: result.results });
    }
    if (actor.admin && parts.length === 1 && method === 'POST') {
      const body = await bodyOf(request);
      if (body.consentConfirmed !== true) fail('수집·제3자 제공 동의 증빙을 확인해주세요.');
      if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100) fail('1~100건을 등록해주세요.');
      const source = field(body.source, 120, true);
      const consent = field(body.consentRef, 300, true);
      const expiry = new Date(Date.parse(now) + 30 * 86400000).toISOString();
      const validated = body.rows.map(row => {
        if (!row || typeof row !== 'object') fail('고객 정보를 확인해주세요.');
        const phone = field(row.phone, 30, true).replace(/[\s()-]/g, '');
        if (!/^01[016789]\d{7,8}$/.test(phone)) fail('휴대전화번호 형식을 확인해주세요.');
        return { name: field(row.name, 60, true), phone, region: field(row.region, 100, true), items: field(row.items, 300, true) };
      });
      const statements = [];
      for (const row of validated) {
        const phone = await protectCustomerPhone(env, row.phone);
        statements.push(env.DB.prepare(`INSERT INTO assigned_leads (id,name,phone_hash,phone_ciphertext,region,items,source,consent_ref,created_at,expires_at)
          VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(phone_hash) DO NOTHING`).bind(crypto.randomUUID(), row.name, phone.hash, phone.ciphertext, row.region, row.items, source, consent, now, expiry));
      }
      const results = await env.DB.batch(statements);
      const added = results.reduce((sum, r) => sum + Number(r.meta.changes || 0), 0);
      return reply({ ok: true, added, skipped: validated.length - added });
    }
    const id = parts[1];
    if (!id || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) return reply({ ok: false, message: '대상을 찾을 수 없습니다.' }, 404);
    if (actor.admin && parts.length === 2 && method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM lead_phone_access WHERE lead_id = ?').bind(id),
        env.DB.prepare('DELETE FROM lead_assignments WHERE lead_id = ?').bind(id),
        env.DB.prepare('DELETE FROM assigned_leads WHERE id = ?').bind(id),
      ]);
      return reply({ ok: true });
    }
    if (actor.admin && parts[2] === 'assign' && method === 'POST') {
      const body = await bodyOf(request);
      if (body.consentConfirmed !== true) fail('해당 매니저에 대한 제공 동의를 확인해주세요.');
      const seller = field(body.sellerId, 100, true); const consent = field(body.consentRef, 300, true);
      // Capacity and eligibility are checked inside the write, including revoked historical recipients.
      const result = await env.DB.prepare(`INSERT INTO lead_assignments (id,lead_id,seller_id,consent_ref,assigned_at,updated_at)
        SELECT ?,l.id,s.seller_id,?,?,? FROM assigned_leads l JOIN approved_sellers s ON s.seller_id = ? AND s.status = 'approved'
        WHERE l.id = ? AND l.expires_at > ? AND (SELECT count(*) FROM lead_assignments WHERE lead_id = l.id) < 3
        ON CONFLICT(lead_id,seller_id) DO NOTHING`).bind(crypto.randomUUID(), consent, now, now, seller, id, now).run();
      if (!result.meta.changes) return reply({ ok: false, message: '중복 배정, 3명 한도, 만료 또는 판매자 승인 상태를 확인해주세요.' }, 409);
      return reply({ ok: true });
    }
    if (actor.admin && parts[2] === 'revoke' && method === 'POST') {
      const body = await bodyOf(request);
      await env.DB.prepare("UPDATE lead_assignments SET revoked_at = ?, note = '', next_contact_at = '', version = version + 1 WHERE lead_id = ? AND id = ? AND revoked_at = ''").bind(now, id, field(body.assignmentId, 80, true)).run();
      return reply({ ok: true });
    }
    if (parts[2] === 'phone' && method === 'POST') {
      if (actor.admin) {
        const expected = String(env.ADMIN_API_TOKEN || '').trim();
        const supplied = String(request.headers.get('X-Admin-Reauth') || '').trim();
        const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
        const a = await digest(expected), b = await digest(supplied);
        let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        if (!expected || !supplied || diff) return reply({ ok: false, message: '관리자 토큰을 다시 확인해주세요.' }, 403);
      }
      const row = actor.admin
        ? await env.DB.prepare('SELECT l.* FROM assigned_leads l WHERE l.id = ? AND l.expires_at > ?').bind(id, now).first()
        : await env.DB.prepare("SELECT l.* FROM assigned_leads l JOIN lead_assignments a ON a.lead_id = l.id WHERE l.id = ? AND l.expires_at > ? AND a.seller_id = ? AND a.revoked_at = ''").bind(id, now, actor.sellerId).first();
      if (!row) return reply({ ok: false, message: '열람 권한이 없거나 만료된 고객입니다.' }, 404);
      const phone = await readCustomerPhone(env, row);
      if (!phone) return reply({ ok: false, message: '열람 기간이 종료되었습니다.' }, 410);
      const checkedAt = new Date().toISOString();
      const logged = await env.DB.prepare(`INSERT INTO lead_phone_access (id,lead_id,actor,accessed_at)
        SELECT ?,l.id,?,? FROM assigned_leads l WHERE l.id = ? AND l.expires_at > ?
        AND (? = 1 OR EXISTS (SELECT 1 FROM lead_assignments a JOIN approved_sellers s ON s.seller_id = a.seller_id
          WHERE a.lead_id = l.id AND a.seller_id = ? AND a.revoked_at = '' AND s.status = 'approved'))`)
        .bind(crypto.randomUUID(), actor.admin ? 'admin' : actor.sellerId, checkedAt, id, checkedAt, actor.admin ? 1 : 0, actor.sellerId || '').run();
      if (!logged.meta.changes) return reply({ ok: false, message: '열람 권한이 변경되었습니다.' }, 403);
      return reply({ ok: true, phone, expiresAt: row.expires_at });
    }
    if (!actor.admin && parts.length === 2 && method === 'PATCH') {
      const body = await bodyOf(request);
      if (!states.includes(body.status) || !Number.isInteger(body.version)) fail('상담 상태를 확인해주세요.');
      const note = field(body.note, 2000); const next = field(body.nextContactAt, 40);
      if (next && !Number.isFinite(Date.parse(next))) fail('재연락 일시를 확인해주세요.');
      const result = await env.DB.prepare(`UPDATE lead_assignments SET status = ?, note = ?, next_contact_at = ?, updated_at = ?, version = version + 1
        WHERE lead_id = ? AND seller_id = ? AND revoked_at = '' AND version = ? AND EXISTS (SELECT 1 FROM assigned_leads WHERE id = ? AND expires_at > ?)`)
        .bind(body.status, note, next ? new Date(next).toISOString() : '', now, id, actor.sellerId, body.version, id, now).run();
      if (!result.meta.changes) return reply({ ok: false, message: '배정이 변경되었거나 다른 화면에서 수정되었습니다. 새로고침해주세요.' }, 409);
      return reply({ ok: true });
    }
    return reply({ ok: false, message: '지원하지 않는 요청입니다.' }, 404);
  } catch (error) {
    return reply({ ok: false, message: error instanceof InputError ? error.message : '고객 DB 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' }, error instanceof InputError ? 400 : 500);
  }
}
