(() => {
  const admin = document.currentScript.dataset.role === 'admin';
  const root = document.querySelector('#leadWorkspace');
  if (!root) return;
  const labels = { new: '미상담', contacted: '상담 중', followup: '재연락', won: '계약 완료', closed: '상담 종료' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = value => value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  let page = 1, rows = [], managers = [], uploadRows = [], generation = 0, loading = false;
  let adminToken = '', phoneTimer = 0;
  const input = (name, label, extra = '') => `<label>${label}<input name="${name}" ${extra}></label>`;
  root.innerHTML = `<header class="lead-head"><div><h2>${admin ? '고객 DB 배정' : '배정 고객 관리'}</h2><p>최대 3명 공동 배정 · 등록일부터 30일 보관</p></div>${admin ? '<button type="button" data-action="auth">관리자 인증</button><button type="button" class="lead-primary" data-action="create">고객 등록</button>' : ''}</header>
    <form class="lead-toolbar"><input name="q" aria-label="고객 검색" placeholder="고객명 · 지역 · 관심 품목" maxlength="80">${admin ? '' : `<select name="status" aria-label="상담 상태"><option value="">전체 상태</option>${Object.entries(labels).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`}<button type="submit">검색</button><button type="button" data-action="refresh" aria-label="새로고침" title="새로고침">↻</button></form>
    <p class="lead-message" role="status" aria-live="polite"></p><div class="lead-list"></div>
    <footer class="lead-pager"><button type="button" data-action="prev">이전</button><span></span><button type="button" data-action="next">다음</button></footer>
    <dialog class="lead-dialog"><form method="dialog" class="lead-dialog-close"><button aria-label="닫기" title="닫기">×</button></form><div class="lead-dialog-body"></div></dialog>`;
  const list = root.querySelector('.lead-list'), message = root.querySelector('.lead-message'), dialog = root.querySelector('dialog');
  const say = text => { message.textContent = text; };
  const clearPhones = () => root.querySelectorAll('[data-phone]').forEach(el => { el.textContent = '***-****-****'; el.removeAttribute('href'); });
  const open = html => { dialog.querySelector('.lead-dialog-body').innerHTML = html; if (!dialog.open) dialog.showModal(); };
  async function api(path = '', method = 'GET', body, reauth = '') {
    const token = admin ? adminToken : sessionStorage.getItem('pickquoteSellerSessionToken');
    if (!token) throw new Error(admin ? '관리자 인증 후 이용해주세요.' : '다시 로그인해주세요.');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/assigned-leads${path}`, { method, cache: 'no-store', signal: controller.signal,
        headers: { [admin ? 'X-Admin-Token' : 'X-Seller-Session']: token, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(reauth ? { 'X-Admin-Reauth': reauth } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (token !== (admin ? adminToken : sessionStorage.getItem('pickquoteSellerSessionToken'))) throw new Error('로그인이 변경되었습니다. 다시 조회해주세요.');
      if (!response.ok || !data.ok) { if (response.status === 401) { clearPhones(); rows = []; list.replaceChildren(); adminToken = ''; } throw new Error(data.message || '요청을 처리하지 못했습니다.'); }
      return data;
    } catch (error) { if (error.name === 'AbortError') throw new Error('응답이 지연되고 있습니다. 새로고침 후 등록 여부를 확인해주세요.'); throw error; }
    finally { clearTimeout(timer); }
  }
  function render() {
    list.innerHTML = rows.length ? rows.map(row => `<article class="lead-row" data-id="${esc(row.id)}">
      <div class="lead-customer"><strong>${esc(row.name)}</strong><span>${esc(row.region)}</span><p>${esc(row.items)}</p><div class="lead-phone"><a data-phone>***-****-****</a><button type="button" data-action="phone">번호 열람</button></div><small>삭제 예정 ${date(row.expires_at)} · 공유 ${row.shared_count}/3명</small></div>
      <div class="lead-detail">${admin ? `<p>수집처 ${esc(row.source)}</p><small>동의 증빙 ${esc(row.consent_ref)}</small><ul>${row.assignments.map(a => `<li>${esc([a.channel, a.branch, a.manager || a.seller_id].filter(Boolean).join(' · '))}<span>${a.revoked_at ? '회수됨' : esc(labels[a.status] || a.status)}</span>${a.revoked_at ? '' : `<button type="button" data-action="revoke" data-assignment="${esc(a.id)}">배정 회수</button>`}</li>`).join('')}</ul><div class="lead-actions"><button type="button" data-action="assign" ${row.shared_count >= 3 ? 'disabled' : ''}>매니저 배정</button><button type="button" data-action="delete">영구 삭제</button></div>` : `<div class="lead-status-line"><b>${esc(labels[row.status])}</b>${row.next_contact_at ? `<span>재연락 ${date(row.next_contact_at)}</span>` : ''}</div><p class="lead-note">${esc(row.note || '상담 기록 없음')}</p><button type="button" data-action="edit">상담 기록</button>`}</div></article>`).join('') : '<div class="lead-empty">표시할 고객이 없습니다.</div>';
  }
  async function load() {
    const version = ++generation; loading = true; clearPhones(); root.setAttribute('aria-busy', 'true');
    list.innerHTML = '<div class="lead-empty" role="status">고객 목록을 불러오는 중입니다.</div>'; say('');
    try {
      const fields = new FormData(root.querySelector('.lead-toolbar'));
      const query = new URLSearchParams({ page: String(page), q: fields.get('q') || '', status: fields.get('status') || '' });
      const data = await api(`?${query}`);
      if (version !== generation) return;
      rows = data.rows; render();
      root.querySelector('[data-action="prev"]').disabled = page === 1;
      root.querySelector('[data-action="next"]').disabled = !data.hasMore;
      root.querySelector('.lead-pager span').textContent = `${page} 페이지`;
    } catch (error) { if (version === generation) { rows = []; list.replaceChildren(); say(error.message); } }
    finally { if (version === generation) { loading = false; root.removeAttribute('aria-busy'); } }
  }
  root.querySelector('.lead-toolbar').addEventListener('submit', event => { event.preventDefault(); page = 1; load(); });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    const row = rows.find(r => r.id === button.closest('[data-id]')?.dataset.id);
    if (action === 'auth') { open(`<h3>관리자 인증</h3><form data-form="auth">${input('token', '관리자 토큰', 'type="password" autocomplete="off" required')}<button class="lead-primary">확인</button></form>`); return; }
    if (action === 'create') {
      uploadRows = [];
      open(`<h3>고객 등록</h3><form data-form="create"><div class="lead-form-grid">${input('name', '고객명', 'maxlength="60"')}${input('phone', '휴대전화번호', 'type="tel" maxlength="30"')}${input('region', '지역', 'maxlength="100"')}${input('items', '관심 품목', 'maxlength="300"')}</div><label>엑셀·CSV 업로드<input type="file" name="file" accept=".xlsx,.csv"></label><button type="button" data-action="template">엑셀 양식 다운로드</button><p class="lead-upload-summary"></p>${input('source', '수집처', 'maxlength="120" required')}${input('consentRef', '수집·제3자 제공 동의 증빙 번호', 'maxlength="300" required')}<label class="lead-check"><input type="checkbox" name="consent" required>30일 보관 및 최대 3명 제공에 대한 고객 동의 증빙을 확인했습니다.</label><button class="lead-primary">등록</button></form>`); return;
    }
    if (action === 'template') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['고객명', '휴대전화번호', '지역', '관심품목']]), '고객'); XLSX.writeFile(wb, '고객등록양식.xlsx'); return; }
    if (['refresh', 'prev', 'next'].includes(action)) { if (loading) return; if (action === 'prev') page = Math.max(1, page - 1); if (action === 'next') page++; await load(); return; }
    if (!row) return;
    button.disabled = true;
    try {
      if (action === 'assign') {
        managers = (await api('/managers')).rows;
        open(`<h3>${esc(row.name)} · 매니저 배정</h3><form data-form="assign" data-id="${esc(row.id)}"><label>매니저<select name="sellerId" required><option value="">매니저 선택</option>${managers.map(m => `<option value="${esc(m.seller_id)}">${esc([m.channel, m.branch, m.manager, m.seller_id].join(' · '))}</option>`).join('')}</select></label>${input('consentRef', '해당 매니저 제공 동의 증빙 번호', 'maxlength="300" required')}<label class="lead-check"><input type="checkbox" name="consent" required>선택한 매니저에게 제공할 수 있는 동의를 확인했습니다.</label><p>배정 단가 8,000원 · 결제 미연동</p><button class="lead-primary">배정</button></form>`);
      } else if (action === 'phone') {
        if (admin) { open(`<h3>연락처 열람 인증</h3><form data-form="phone" data-id="${esc(row.id)}">${input('token', '관리자 토큰 재입력', 'type="password" autocomplete="off" required')}<button class="lead-primary">번호 열람</button></form>`); }
        else await reveal(row.id);
      } else if (action === 'edit') {
        const local = row.next_contact_at ? new Date(Date.parse(row.next_contact_at) - new Date(row.next_contact_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
        open(`<h3>${esc(row.name)} · 상담 기록</h3><form data-form="edit" data-id="${esc(row.id)}" data-version="${row.version}"><label>상담 상태<select name="status">${Object.entries(labels).map(([v,t]) => `<option value="${v}" ${row.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${input('nextContactAt', '재연락 일시', `type="datetime-local" value="${esc(local)}"`)}<label>상담 메모<textarea name="note" rows="6" maxlength="2000">${esc(row.note)}</textarea></label><button class="lead-primary">저장</button></form>`);
      } else if (action === 'revoke' && confirm('이 매니저의 접근 권한과 상담 메모를 삭제할까요? 공유 인원은 초기화되지 않습니다.')) { await api(`/${row.id}/revoke`, 'POST', { assignmentId: button.dataset.assignment }); await load(); }
      else if (action === 'delete' && confirm('고객 정보와 모든 배정·상담 기록을 DB에서 영구 삭제할까요?')) { await api(`/${row.id}`, 'DELETE'); await load(); }
    } catch (error) { say(error.message); }
    finally { button.disabled = false; }
  });
  async function reveal(id, token) {
    const data = await api(`/${id}/phone`, 'POST', {}, token);
    const link = root.querySelector(`[data-id="${CSS.escape(id)}"] [data-phone]`);
    if (!link) return;
    link.textContent = data.phone; link.href = `tel:${data.phone}`;
    clearTimeout(phoneTimer); phoneTimer = setTimeout(clearPhones, Math.min(60000, Math.max(0, Date.parse(data.expiresAt) - Date.now())));
  }
  dialog.addEventListener('change', async event => {
    if (event.target.name !== 'file') return;
    uploadRows = []; const summary = dialog.querySelector('.lead-upload-summary'); const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('1MB 이하 파일을 선택해주세요.');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 102, raw: true, codepage: 65001 });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      if (!data.length || data.length > 100) throw new Error('1~100건을 업로드해주세요.');
      uploadRows = data.map(r => ({ name: String(r['고객명'] || ''), phone: String(r['휴대전화번호'] || ''), region: String(r['지역'] || ''), items: String(r['관심품목'] || '') }));
      if (uploadRows.some(r => !r.name || !r.region || !r.items || !/^01[016789]\d{7,8}$/.test(r.phone.replace(/[\s()-]/g, '')))) { uploadRows = []; throw new Error('필수 열과 휴대전화번호를 확인해주세요. 번호의 앞자리 0을 유지해야 합니다.'); }
      summary.textContent = `${uploadRows.length}건 확인됨 · 등록 버튼을 누르면 저장됩니다.`;
    } catch (error) { event.target.value = ''; summary.textContent = error.message; }
  });
  dialog.addEventListener('submit', async event => {
    const form = event.target; if (!form.dataset.form) return; event.preventDefault();
    const button = form.querySelector('button[type="submit"], button.lead-primary'); if (button.disabled) return; button.disabled = true;
    form.querySelector('.lead-form-error')?.remove();
    const values = Object.fromEntries(new FormData(form));
    try {
      let success = '';
      if (form.dataset.form === 'auth') { adminToken = values.token.trim(); await api('?page=1'); }
      if (form.dataset.form === 'create') {
        const result = await api('', 'POST', { rows: uploadRows.length ? uploadRows : [{ name: values.name, phone: values.phone, region: values.region, items: values.items }], source: values.source, consentRef: values.consentRef, consentConfirmed: values.consent === 'on' });
        uploadRows = []; success = `${result.added}건 등록 · 중복 ${result.skipped}건 제외`;
      }
      if (form.dataset.form === 'assign') await api(`/${form.dataset.id}/assign`, 'POST', { sellerId: values.sellerId, consentRef: values.consentRef, consentConfirmed: values.consent === 'on' });
      if (form.dataset.form === 'phone') { await reveal(form.dataset.id, values.token); dialog.close(); return; }
      if (form.dataset.form === 'edit') await api(`/${form.dataset.id}`, 'PATCH', { status: values.status, note: values.note, nextContactAt: values.nextContactAt ? new Date(values.nextContactAt).toISOString() : '', version: Number(form.dataset.version) });
      dialog.close(); await load(); if (success) say(success);
    } catch (error) { const p = document.createElement('p'); p.className = 'lead-form-error'; p.setAttribute('role', 'alert'); p.textContent = error.message; form.append(p); }
    finally { button.disabled = false; }
  });
  dialog.addEventListener('close', () => { uploadRows = []; dialog.querySelector('.lead-dialog-body').replaceChildren(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearPhones(); });
  window.addEventListener('pagehide', clearPhones);
  setInterval(() => {
    const remaining = rows.filter(row => Date.parse(row.expires_at) > Date.now());
    if (remaining.length !== rows.length) { rows = remaining; render(); if (dialog.open) dialog.close(); }
  }, 10000);
  if (admin) { say('관리자 인증 후 고객 DB를 확인할 수 있습니다.'); }
  else {
    document.addEventListener('seller-leads-open', load);
    document.addEventListener('seller-leads-close', () => { generation++; clearPhones(); rows = []; list.replaceChildren(); if (dialog.open) dialog.close(); });
    const sellerPage = document.querySelector('#sellerPage');
    if (sellerPage) new MutationObserver(() => {
      if (!sellerPage.classList.contains('is-active')) document.dispatchEvent(new Event('seller-leads-close'));
    }).observe(sellerPage, { attributes: true, attributeFilter: ['class'] });
  }
})();
