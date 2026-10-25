const schemas = new WeakMap();
const PRICE = 8000;
const origin = 'https://partner.ga-pick.com';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const sha = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
async function equal(a, b) { const x = await sha(String(a)), y = await sha(String(b)); let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; }
function providerReady(env) { return ['live', 'sandbox'].includes(env.NICEPAY_MODE) && Boolean(env.NICEPAY_CLIENT_ID && env.NICEPAY_SECRET_KEY); }
function configured(env) {
  const prefix = env.NICEPAY_MODE === 'live' ? 'R2_' : 'S2_';
  return env.NICEPAY_ENABLED === 'true' && providerReady(env) && env.NICEPAY_CLIENT_ID.startsWith(prefix);
}
async function readBody(request) {
  const reader = request.body?.getReader(); if (!reader) return '';
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 32768) { await reader.cancel(); throw new Error('body limit'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(bytes);
}
export async function ensureLeadPayments(env) {
  if (!schemas.has(env.DB)) schemas.set(env.DB, env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS lead_orders (
      id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, quantity INTEGER NOT NULL, amount INTEGER NOT NULL,
      mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', tid TEXT UNIQUE, callback_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL, checked_at TEXT NOT NULL DEFAULT '', paid_at TEXT NOT NULL DEFAULT '')`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS lead_orders_seller_idx ON lead_orders(seller_id, status)'),
    // No customer identifiers: usage survives the 30-day customer purge so credits cannot be spent twice.
    env.DB.prepare('CREATE TABLE IF NOT EXISTS lead_credit_usage (assignment_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES lead_orders(id), used_at TEXT NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS lead_credit_order_idx ON lead_credit_usage(order_id)'),
  ]).catch(error => { schemas.delete(env.DB); throw error; }));
  await schemas.get(env.DB);
}
export const paidAssignment = alias => `(NOT EXISTS (SELECT 1 FROM lead_credit_usage u WHERE u.assignment_id = ${alias}.id)
  OR EXISTS (SELECT 1 FROM lead_credit_usage u JOIN lead_orders o ON o.id = u.order_id WHERE u.assignment_id = ${alias}.id AND o.status = 'paid' AND o.mode = 'live'))`;
export async function leadEntitlement(env, sellerId) {
  await ensureLeadPayments(env);
  const paid = await env.DB.prepare(`SELECT count(*) AS orders, COALESCE(SUM(quantity - (SELECT count(*) FROM lead_credit_usage u WHERE u.order_id = o.id)),0) AS remaining
    FROM lead_orders o WHERE seller_id = ? AND status = 'paid' AND mode = 'live'`).bind(sellerId).first();
  const legacy = await env.DB.prepare(`SELECT 1 AS allowed FROM lead_assignments a JOIN assigned_leads l ON l.id = a.lead_id
    WHERE a.seller_id = ? AND a.revoked_at = '' AND l.expires_at > ? AND NOT EXISTS (SELECT 1 FROM lead_credit_usage u WHERE u.assignment_id = a.id) LIMIT 1`).bind(sellerId, new Date().toISOString()).first();
  return { access: Boolean(paid?.orders || legacy), remaining: Math.max(0, Number(paid?.remaining || 0)), unitPrice: PRICE };
}
async function nice(env, mode, path, body) {
  if (mode !== env.NICEPAY_MODE) throw new Error('mode mismatch');
  const host = mode === 'live' ? 'https://api.nicepay.co.kr' : 'https://sandbox-api.nicepay.co.kr';
  const response = await fetch(host + path, { method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Basic ${btoa(`${env.NICEPAY_CLIENT_ID}:${env.NICEPAY_SECRET_KEY}`)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = JSON.parse(await readBody(response));
  if (!response.ok) throw new Error('provider unavailable');
  return data;
}
async function applyPayment(env, order, data) {
  if (data.resultCode !== '0000' || data.orderId !== order.id || Number(data.amount) !== order.amount || !/^[a-zA-Z0-9_-]{10,80}$/.test(data.tid || '') || (order.tid && order.tid !== data.tid)) throw new Error('payment mismatch');
  if (!data.ediDate || !data.signature || !await equal(data.signature, await sha(`${data.tid}${data.amount}${data.ediDate}${env.NICEPAY_SECRET_KEY}`))) throw new Error('invalid payment signature');
  if (!['paid', 'cancelled', 'partialCancelled', 'failed', 'expired', 'ready'].includes(data.status)) throw new Error('unknown state');
  if (data.status === 'paid' && (data.payMethod !== 'card' || data.currency !== 'KRW')) throw new Error('unexpected payment method');
  // Revocation is monotonic: a delayed success cannot reopen a cancelled order.
  await env.DB.prepare(`UPDATE lead_orders SET status = ?, tid = ?, checked_at = ?, paid_at = ?
    WHERE id = ? AND status NOT IN ('cancelled','partialCancelled') AND (tid IS NULL OR tid = ?)`)
    .bind(data.status, data.tid, new Date().toISOString(), data.status === 'paid' ? String(data.paidAt || '') : '', order.id, data.tid).run();
}
const redirect = id => new Response(null, { status: 303, headers: { Location: `${origin}/db-checkout?order=${encodeURIComponent(id)}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
export async function handleLeadPayments(env, request, path, actor) {
  const route = path.split('/').slice(1);
  const callback = route[0] === 'return', webhook = route[0] === 'webhook';
  if (!callback && !webhook && !actor?.sellerId && !actor?.admin) return json({ ok: false, message: '로그인이 필요합니다.' }, 401);
  try {
    await ensureLeadPayments(env);
    if (callback || webhook) {
      if (request.method !== 'POST' || !(webhook ? providerReady(env) : configured(env))) return json({ ok: false }, 503);
      const content = await readBody(request);
      const data = request.headers.get('Content-Type')?.includes('application/json') ? JSON.parse(content) : Object.fromEntries(new URLSearchParams(content));
      const order = await env.DB.prepare('SELECT * FROM lead_orders WHERE id = ?').bind(String(data.orderId || '')).first();
      if (!order) return webhook ? new Response('OK', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } }) : json({ ok: false }, 400);
      if (webhook) {
        // Never trust webhook status. Re-read the transaction over authenticated TLS.
        if (!order.tid || data.tid !== order.tid) return json({ ok: false }, 400);
        const lock = await env.DB.prepare('UPDATE lead_orders SET checked_at = ? WHERE id = ? AND checked_at < ?').bind(new Date().toISOString(), order.id, new Date(Date.now() - 10000).toISOString()).run();
        if (!lock.meta.changes) return new Response('Retry', { status: 503 });
        await applyPayment(env, order, await nice(env, order.mode, `/v1/payments/${encodeURIComponent(order.tid)}`));
        return new Response('OK', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } });
      }
      const nonce = new URL(request.url).searchParams.get('state') || '';
      if (!nonce || !await equal(await sha(nonce), order.callback_hash)) return json({ ok: false }, 403);
      if (order.status !== 'pending') return redirect(order.id);
      if (data.authResultCode !== '0000') {
        await env.DB.prepare("UPDATE lead_orders SET status='failed' WHERE id=? AND status='pending'").bind(order.id).run();
        return redirect(order.id);
      }
      if (order.expires_at <= new Date().toISOString() || data.clientId !== env.NICEPAY_CLIENT_ID || Number(data.amount) !== order.amount || !/^[a-zA-Z0-9_-]{10,80}$/.test(data.tid || '') || !data.authToken || !await equal(data.signature || '', await sha(`${data.authToken}${data.clientId}${data.amount}${env.NICEPAY_SECRET_KEY}`))) return json({ ok: false }, 400);
      const seller = await env.DB.prepare("SELECT seller_id FROM approved_sellers WHERE seller_id = ? AND status = 'approved'").bind(order.seller_id).first();
      if (!seller) return json({ ok: false }, 403);
      const claimed = await env.DB.prepare("UPDATE lead_orders SET status='processing',tid=? WHERE id=? AND status='pending'").bind(data.tid, order.id).run();
      if (!claimed.meta.changes) return redirect(order.id);
      try { await applyPayment(env, { ...order, tid: data.tid }, await nice(env, order.mode, `/v1/payments/${encodeURIComponent(data.tid)}`, { amount: order.amount })); }
      catch { /* Retain processing for reconciliation; never retry the charge. */ }
      return redirect(order.id);
    }
    if (!route[0] && request.method === 'GET') {
      const access = actor.admin ? null : await leadEntitlement(env, actor.sellerId);
      return json({ ok: true, ...access, ready: configured(env), mode: env.NICEPAY_MODE === 'sandbox' ? 'sandbox' : 'live' });
    }
    if (route[0] === 'orders' && !route[1] && request.method === 'POST' && actor.sellerId) {
      if (!configured(env)) return json({ ok: false, message: '카드결제 연결을 준비 중입니다. 고객센터로 문의해주세요.' }, 503);
      const body = JSON.parse(await readBody(request));
      if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100 || body.agreed !== true) return json({ ok: false, message: '수량과 이용 안내 동의를 확인해주세요.' }, 400);
      const pending = await env.DB.prepare("SELECT id FROM lead_orders WHERE seller_id=? AND status='processing' LIMIT 1").bind(actor.sellerId).first();
      if (pending) return json({ ok: false, message: '확인 중인 결제가 있습니다. 결제 내역에서 확인해주세요.', orderId: pending.id }, 409);
      const recent = await env.DB.prepare('SELECT count(*) AS n FROM lead_orders WHERE seller_id=? AND created_at>?').bind(actor.sellerId, new Date(Date.now() - 60000).toISOString()).first();
      if (recent.n >= 5) return json({ ok: false, message: '잠시 후 다시 시도해주세요.' }, 429);
      const id = crypto.randomUUID(), state = crypto.randomUUID();
      const now = new Date().toISOString(), amount = body.quantity * PRICE;
      await env.DB.prepare('INSERT INTO lead_orders(id,seller_id,quantity,amount,mode,callback_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
        .bind(id, actor.sellerId, body.quantity, amount, env.NICEPAY_MODE, await sha(state), now, new Date(Date.now() + 1800000).toISOString()).run();
      return json({ ok: true, checkout: { clientId: env.NICEPAY_CLIENT_ID, method: 'card', orderId: id, amount, goodsName: `고객DB ${body.quantity}건`, returnUrl: `${origin}/api/lead-payments/return?state=${state}`, skinType: 'gray' } });
    }
    if (route[0] === 'orders' && request.method === 'GET') {
      if (!route[1]) {
        const result = await env.DB.prepare(`SELECT id,seller_id,quantity,amount,status,mode,created_at FROM lead_orders ${actor.admin ? '' : 'WHERE seller_id=?'} ORDER BY created_at DESC LIMIT 50`).bind(...(actor.admin ? [] : [actor.sellerId])).all();
        return json({ ok: true, rows: result.results });
      }
      const order = await env.DB.prepare(`SELECT * FROM lead_orders WHERE id=? ${actor.admin ? '' : 'AND seller_id=?'}`).bind(route[1], ...(actor.admin ? [] : [actor.sellerId])).first();
      if (!order) return json({ ok: false }, 404);
      if (order.tid && providerReady(env) && order.mode === env.NICEPAY_MODE && ['processing','paid','ready'].includes(order.status) && order.checked_at < new Date(Date.now() - 15000).toISOString()) {
        const locked = await env.DB.prepare('UPDATE lead_orders SET checked_at=? WHERE id=? AND checked_at=?').bind(new Date().toISOString(), order.id, order.checked_at).run();
        if (locked.meta.changes) { try { await applyPayment(env, order, await nice(env, order.mode, `/v1/payments/${encodeURIComponent(order.tid)}`)); } catch { /* Keep the last verified state, not a fabricated success. */ } }
      }
      const current = await env.DB.prepare('SELECT id,quantity,amount,status,mode,created_at FROM lead_orders WHERE id=?').bind(order.id).first();
      return json({ ok: true, order: current });
    }
    return json({ ok: false }, 404);
  } catch { return json({ ok: false, message: '결제를 확인하지 못했습니다. 잠시 후 결제 내역을 확인해주세요.' }, 500); }
}
export async function reconcileLeadPayments(env) {
  if (!providerReady(env)) return;
  await ensureLeadPayments(env);
  const result = await env.DB.prepare("SELECT * FROM lead_orders WHERE mode=? AND tid IS NOT NULL AND status IN ('processing','ready','paid') AND checked_at < ? ORDER BY checked_at LIMIT 25")
    .bind(env.NICEPAY_MODE, new Date(Date.now() - 300000).toISOString()).all();
  for (const order of result.results) {
    const lock = await env.DB.prepare('UPDATE lead_orders SET checked_at=? WHERE id=? AND checked_at=?').bind(new Date().toISOString(), order.id, order.checked_at).run();
    if (!lock.meta.changes) continue;
    try { await applyPayment(env, order, await nice(env, order.mode, `/v1/payments/${encodeURIComponent(order.tid)}`)); }
    catch { console.warn('lead_payment_reconciliation_pending'); }
  }
}
