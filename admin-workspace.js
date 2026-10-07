(() => {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.admin-shell');
  if (!sidebar || !main) return;
  sidebar.id = 'opsSidebar';
  main.id = 'adminShell';
  main.tabIndex = -1;

  const navIcons = {
    '/': 'LayoutDashboard', '/customers': 'Files', '/sellers': 'UserRoundPlus',
    '/approved-sellers': 'UsersRound', '/seller-access': 'History',
    '/brand-hall': 'Store', '/subscription-products': 'Package',
    '/alimtalk': 'Send', '/anonymous-consultation': 'ShieldCheck',
    '/anonymous-chat': 'MessagesSquare',
  };
  function icon(name) {
    const nodes = window.PickAdminIconNodes?.[name];
    if (!nodes) return document.createTextNode('');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'ops-icon' })) svg.setAttribute(key, value);
    for (const [tag, attrs] of nodes) {
      const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attrs)) if (key !== 'key') child.setAttribute(key, value);
      svg.append(child);
    }
    return svg;
  }
  function decorate() {
    sidebar.querySelectorAll('.side-nav a').forEach((link) => {
      const path = new URL(link.href).pathname.replace(/\/+$/, '') || '/';
      if (!link.querySelector('.ops-icon')) link.prepend(icon(navIcons[path]));
    });
    const home = sidebar.querySelector('.home-link');
    if (home && !home.querySelector('.ops-icon')) home.prepend(icon('ExternalLink'));
    const buttons = { adminAuthBtn: 'KeyRound', refreshBtn: 'RefreshCw', refreshStatusBtn: 'RefreshCw', refresh: 'RefreshCw', alimtalkSyncBtn: 'RefreshCw', quotePrevious: 'ChevronLeft', quoteNext: 'ChevronRight', customerQuoteSearchClear: 'X' };
    for (const [id, name] of Object.entries(buttons)) {
      const button = document.getElementById(id);
      if (button && !button.querySelector('.ops-icon')) button.prepend(icon(name));
    }
    document.querySelectorAll('[data-ops-icon]').forEach((holder) => {
      if (!holder.querySelector('.ops-icon')) holder.append(icon(holder.dataset.opsIcon));
    });
  }
  decorate();
  document.addEventListener('ops:render', decorate);

  const bar = document.createElement('div');
  bar.className = 'ops-mobile-bar';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '업무 메뉴 열기');
  toggle.setAttribute('aria-controls', 'opsSidebar');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.title = '업무 메뉴';
  toggle.append(icon('Menu'));
  const label = document.createElement('strong');
  label.textContent = '픽견적';
  const role = document.createElement('small');
  role.textContent = '관리자';
  bar.append(toggle, label, role);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ops-drawer-close';
  close.setAttribute('aria-label', '업무 메뉴 닫기');
  close.title = '메뉴 닫기';
  close.append(icon('X'));
  sidebar.prepend(close);
  const backdrop = document.createElement('button');
  backdrop.className = 'ops-drawer-backdrop';
  backdrop.type = 'button';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label', '업무 메뉴 닫기');
  document.body.prepend(bar, backdrop);
  const mobile = matchMedia('(max-width: 760px)');
  let opened = false;
  function setOpen(value, restoreFocus = true) {
    opened = value && mobile.matches;
    document.body.classList.toggle('ops-menu-open', opened);
    toggle.setAttribute('aria-expanded', String(opened));
    sidebar.inert = mobile.matches && !opened;
    main.inert = opened;
    bar.inert = opened;
    if (opened) close.focus();
    else if (restoreFocus && mobile.matches) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(!opened));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      const wasOpened = opened;
      setOpen(false, false);
      if (wasOpened) requestAnimationFrame(() => main.focus({ preventScroll: true }));
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!opened) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key !== 'Tab') return;
    const items = [...sidebar.querySelectorAll('button,a')].filter((element) => element.getClientRects().length && !element.disabled);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  mobile.addEventListener('change', () => setOpen(false, false));
  setOpen(false, false);
})();
