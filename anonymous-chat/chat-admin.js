(() => {
  const tokenKey = 'pickquoteAdminApiToken';
  const rooms = document.querySelector('#rooms');
  const room = document.querySelector('#room');
  const search = document.querySelector('#chatSearch');
  const refresh = document.querySelector('#refresh');
  const auth = document.querySelector('#chatAuthDialog');
  let rows = [], selectedId = '', roomController = null, listController = null;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const placeholder = (value) => `<p class="ops-overview-empty">${esc(value)}</p>`;
  async function request(path, signal) {
    const token = localStorage.getItem(tokenKey) || '';
    if (!token) throw new Error('관리자 인증 후 조회할 수 있습니다.');
    const response = await fetch(path, { headers: { 'X-Admin-Token': token }, cache: 'no-store', signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      if (response.status === 401 && localStorage.getItem(tokenKey) === token) localStorage.removeItem(tokenKey);
      throw new Error(data.message || '채팅을 불러오지 못했습니다. 다시 조회해주세요.');
    }
    return data;
  }
  function renderRooms() {
    const query = search.value.trim().toLowerCase();
    const filtered = rows.filter((row) => !query || [row.customer, row.quote_number].some((value) => String(value || '').toLowerCase().includes(query)));
    document.querySelector('#roomCount').textContent = `${filtered.length}개 채팅방`;
    rooms.innerHTML = filtered.length ? filtered.map((row) => `<button class="chat-room-button${row.id === selectedId ? ' is-active' : ''}" type="button" data-room="${esc(row.id)}" aria-pressed="${row.id === selectedId}"><strong>${esc(row.customer || '고객')} · ${esc(row.quote_number || '-')}</strong><small>${esc(row.last_message || '메시지 없음')}</small><small>${Number(row.message_count || 0)}개 메시지</small></button>`).join('') : placeholder(query ? '검색 결과가 없습니다.' : '채팅방이 없습니다.');
  }
  async function openRoom(id) {
    roomController?.abort();
    const controller = new AbortController();
    roomController = controller;
    selectedId = id;
    renderRooms();
    room.querySelector('.chat-room-head').textContent = '채팅을 불러오는 중입니다.';
    const messages = room.querySelector('.chat-messages');
    messages.innerHTML = '';
    try {
      const data = await request(`/api/anonymous-consultations?id=${encodeURIComponent(id)}`, controller.signal);
      if (controller.signal.aborted || selectedId !== id) return;
      room.querySelector('.chat-room-head').innerHTML = `<strong>${esc(data.consultation?.customer || '고객')} · ${esc(data.consultation?.quote_id || '-')}</strong><small>판매자 ${esc(data.consultation?.seller_id || '-')} · ${esc(data.consultation?.status || '-')}</small>`;
      messages.innerHTML = (data.messages || []).map((message) => `<div class="chat-message ${message.sender_role === 'seller' ? 'seller' : ''}"><small>${message.sender_role === 'seller' ? '판매자' : '고객'} · ${esc(message.created_at)}</small>${esc(Number(message.blocked) ? '개인정보 보호 정책에 의해 차단된 메시지' : message.body)}</div>`).join('') || placeholder('메시지가 없습니다.');
      messages.scrollTop = messages.scrollHeight;
    } catch (error) {
      if (error.name === 'AbortError' || selectedId !== id) return;
      room.querySelector('.chat-room-head').textContent = '조회 실패';
      messages.innerHTML = placeholder(error.message);
    }
  }
  async function loadRooms() {
    listController?.abort();
    const controller = new AbortController();
    listController = controller;
    refresh.disabled = true;
    rooms.setAttribute('aria-busy', 'true');
    try {
      const data = await request('/api/anonymous-consultations', controller.signal);
      if (controller.signal.aborted) return;
      rows = Array.isArray(data.rooms) ? data.rooms : [];
      if (selectedId && !rows.some((row) => row.id === selectedId)) {
        selectedId = '';
        roomController?.abort();
        room.querySelector('.chat-room-head').textContent = '채팅방을 선택하세요.';
        room.querySelector('.chat-messages').innerHTML = '';
      }
      renderRooms();
      if (selectedId) await openRoom(selectedId);
    } catch (error) {
      if (error.name !== 'AbortError') {
        rooms.innerHTML = placeholder(error.message);
        document.querySelector('#roomCount').textContent = '';
      }
    } finally {
      if (listController === controller) {
        refresh.disabled = false;
        rooms.removeAttribute('aria-busy');
      }
    }
  }
  rooms.addEventListener('click', (event) => {
    const button = event.target.closest('[data-room]');
    if (button) void openRoom(button.dataset.room);
  });
  search.addEventListener('input', renderRooms);
  refresh.addEventListener('click', loadRooms);
  document.querySelector('#adminAuthBtn').addEventListener('click', () => {
    document.querySelector('#chatAuthToken').value = '';
    auth.showModal();
  });
  document.querySelector('#cancelChatAuth').addEventListener('click', () => auth.close());
  document.querySelector('#chatAuthForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const token = document.querySelector('#chatAuthToken').value.trim();
    if (!token) return;
    localStorage.setItem(tokenKey, token);
    document.querySelector('#chatAuthToken').value = '';
    auth.close();
    void loadRooms();
  });
  void loadRooms();
})();
