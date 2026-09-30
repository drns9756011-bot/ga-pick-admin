(() => {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.admin-shell');
  if (!sidebar || !main) return;
  sidebar.id = 'opsSidebar';
  const bar = document.createElement('div');
  bar.className = 'ops-mobile-bar';
  bar.innerHTML = '<button type="button" aria-label="업무 메뉴 열기" title="업무 메뉴" aria-controls="opsSidebar" aria-expanded="false">☰</button><strong>픽견적 · 관리자</strong>';
  const backdrop = document.createElement('button');
  backdrop.className = 'ops-drawer-backdrop';
  backdrop.type = 'button';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label', '업무 메뉴 닫기');
  document.body.prepend(bar, backdrop);
  const toggle = bar.querySelector('button');
  const mobile = matchMedia('(max-width: 760px)');
  let opened = false;
  function setOpen(value, restoreFocus = true) {
    opened = value && mobile.matches;
    document.body.classList.toggle('ops-menu-open', opened);
    toggle.setAttribute('aria-expanded', String(opened));
    sidebar.inert = mobile.matches && !opened;
    main.inert = opened;
    bar.inert = opened;
    if (opened) sidebar.querySelector('a')?.focus();
    else if (restoreFocus && mobile.matches) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(!opened));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false, false); });
  document.addEventListener('keydown', (event) => {
    if (!opened) return;
    if (event.key === 'Escape') setOpen(false);
    if (event.key !== 'Tab') return;
    const links = [...sidebar.querySelectorAll('a[href],button:not([disabled])')];
    const first = links[0], last = links.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  mobile.addEventListener('change', () => setOpen(false, false));
  setOpen(false, false);

  const dashboard = document.querySelector('#dashboardHome');
  const sync = document.querySelector('#lplanSyncPanel');
  if (dashboard && sync) sync.before(dashboard);
  const syncList = document.querySelector('#lplanSyncList');
  if (syncList) {
    const details = document.createElement('details');
    details.className = 'ops-sync-details';
    const summary = document.createElement('summary');
    summary.textContent = '동기화 상세 내역';
    syncList.before(details);
    details.append(summary, syncList);
  }
})();
