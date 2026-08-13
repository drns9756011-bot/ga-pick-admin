(() => {
  const state = { rows: [], brand: "", channel: "", selected: null, detailSelected: null };
  const grid = document.querySelector("#packageGrid");
  const count = document.querySelector("#packageCount");
  const brandFilters = document.querySelector("#brandFilters");
  const channelFilter = document.querySelector("#channelFilter");
  const modal = document.querySelector("#consultModal");
  const form = document.querySelector("#consultForm");
  const summary = document.querySelector("#consultPackageSummary");
  const message = document.querySelector("#consultMessage");
  const detailModal = document.querySelector("#packageDetailModal");
  const detailContent = document.querySelector("#packageDetailContent");
  const detailConsultButton = document.querySelector("#packageDetailConsult");
  const money = new Intl.NumberFormat("ko-KR");
  const heroPreview = document.querySelector("#heroPackagePreview");
  const heroBrowse = document.querySelector("#heroBrowsePackages");
  const heroConsult = document.querySelector("#heroConsultFirst");
  const heroSeeMore = document.querySelector("#heroSeeMore");
  const packageToolbar = document.querySelector(".brand-hall-toolbar");

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const formatPrice = (value) => `${money.format(Number(value || 0))}원`;
  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" }).format(date);
  };
  const formatPhoneInput = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
    return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  };

  let serverLoadingDepth = 0;
  let serverLoadingHideTimer = null;

  function ensureServerLoadingModal() {
    let loading = document.querySelector("#brandServerLoading");
    if (loading) return loading;
    loading = document.createElement("div");
    loading.id = "brandServerLoading";
    loading.className = "brand-server-loading";
    loading.hidden = true;
    loading.setAttribute("role", "status");
    loading.setAttribute("aria-live", "polite");
    loading.setAttribute("aria-label", "서버 요청 처리 중");
    loading.innerHTML = `<div class="brand-server-loading-backdrop"></div><div class="brand-server-loading-card"><span class="brand-server-loading-spinner" aria-hidden="true"></span><strong>로딩 중입니다.</strong><p>서버와 통신하고 있습니다.<br />잠시만 기다려주세요.</p></div>`;
    document.body.appendChild(loading);
    return loading;
  }

  function showServerLoading() {
    serverLoadingDepth += 1;
    if (serverLoadingHideTimer) { clearTimeout(serverLoadingHideTimer); serverLoadingHideTimer = null; }
    const loading = ensureServerLoadingModal();
    loading.hidden = false;
    document.body.classList.add("brand-server-is-loading");
    document.body.setAttribute("aria-busy", "true");
  }

  function hideServerLoading() {
    serverLoadingDepth = Math.max(0, serverLoadingDepth - 1);
    if (serverLoadingDepth > 0) return;
    if (serverLoadingHideTimer) clearTimeout(serverLoadingHideTimer);
    serverLoadingHideTimer = setTimeout(() => {
      if (serverLoadingDepth > 0) return;
      const loading = document.querySelector("#brandServerLoading");
      if (loading) loading.hidden = true;
      document.body.classList.remove("brand-server-is-loading");
      document.body.removeAttribute("aria-busy");
      serverLoadingHideTimer = null;
    }, 140);
  }

  async function apiJson(path, options = {}) {
    showServerLoading();
    try {
      const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.message || "서버 요청을 처리하지 못했습니다.");
      return payload;
    } finally {
      hideServerLoading();
    }
  }

  const PUBLIC_CHANNELS = ["전자랜드", "하이마트", "삼성스토어", "LG전자 BEST SHOP"];

  function populateFilters() {
    const available = new Set(state.rows.map((row) => row.channel).filter(Boolean));
    const channels = PUBLIC_CHANNELS.filter((channel) => available.has(channel));
    channelFilter.innerHTML = `<option value="">전체 채널</option>${channels.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}`;
  }

  function filteredRows() {
    return state.rows.filter((row) => {
      const brandOk = !state.brand || row.brand === state.brand || (state.brand === "기타" && !["LG전자", "삼성전자"].includes(row.brand));
      const channelOk = !state.channel || row.channel === state.channel;
      return brandOk && channelOk;
    });
  }

  function renderHeroPreview() {
    if (!heroPreview) return;
    const rows = state.rows.slice(0, 3);
    if (!rows.length) {
      heroPreview.innerHTML = `<div class="brand-hero-preview-empty">등록된 패키지를 준비 중입니다.</div>`;
      if (heroConsult) heroConsult.disabled = true;
      return;
    }
    if (heroConsult) heroConsult.disabled = false;
    heroPreview.innerHTML = rows.map((row) => {
      const image = row.coverImage
        ? `<img src="${escapeHtml(row.coverImage)}" alt="${escapeHtml(row.title)}" loading="eager" />`
        : `<div class="brand-hero-preview-fallback">${escapeHtml((row.brand || "P").slice(0,1))}</div>`;
      return `<article class="brand-hero-preview-card" data-hero-package-id="${escapeHtml(row.id)}">
        <div class="brand-hero-preview-media">${image}</div>
        <div class="brand-hero-preview-copy"><strong>${escapeHtml(row.title)}</strong><b>${formatPrice(row.salePrice)}~</b><small>${escapeHtml(row.channel || "픽견적 브랜드관")}</small></div>
      </article>`;
    }).join("");
  }

  function render() {
    renderHeroPreview();
    const rows = filteredRows();
    count.textContent = rows.length ? `현재 ${rows.length}개의 패키지를 확인할 수 있습니다.` : "조건에 맞는 패키지가 없습니다.";
    if (!rows.length) {
      grid.innerHTML = `<div class="brand-empty"><b>P</b><h3>등록된 패키지가 아직 없습니다.</h3><p>픽견적에서 새로운 제휴 패키지를 등록하면 이곳에 바로 표시됩니다.</p></div>`;
      return;
    }
    grid.innerHTML = rows.map((row) => {
      const image = row.coverImage ? `<img src="${escapeHtml(row.coverImage)}" alt="${escapeHtml(row.title)} 패키지 이미지" loading="lazy" />` : `<div class="brand-package-fallback"><b>${escapeHtml((row.brand || "P").slice(0,1))}</b><span>패키지 이미지 준비중</span></div>`;
      return `<article class="brand-package-card brand-package-card-visual">
        <button class="brand-package-image brand-package-image-button" type="button" data-detail-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.title)} 상세보기">${image}</button>
        <div class="brand-package-price brand-package-price-only">${Number(row.originalPrice || 0) > 0 ? `<del>${formatPrice(row.originalPrice)}</del>` : ""}<strong>${formatPrice(row.salePrice)}<small>~</small></strong></div>
      </article>`;
    }).join("");
  }


  function openDetail(id) {
    const row = state.rows.find((item) => String(item.id) === String(id));
    if (!row || !detailModal || !detailContent) return;
    state.detailSelected = row;
    const items = Array.isArray(row.items) ? row.items : [];
    const image = row.coverImage
      ? `<img class="brand-detail-image" src="${escapeHtml(row.coverImage)}" alt="${escapeHtml(row.title)} 패키지 이미지" />`
      : `<div class="brand-detail-fallback"><b>${escapeHtml((row.brand || "P").slice(0,1))}</b><span>패키지 이미지 준비중</span></div>`;
    detailContent.innerHTML = `
      <div class="brand-detail-media">${image}</div>
      <div class="brand-detail-meta"><span>${escapeHtml(row.channel || "판매 채널")}</span><span>${escapeHtml(row.brand || "가전 패키지")}</span></div>
      <h2 class="brand-detail-title">${escapeHtml(row.title || "가전 패키지")}</h2>
      <div class="brand-detail-section"><strong>제품 구성</strong><div class="brand-detail-pre">${escapeHtml(items.length ? items.join("\n") : "제품 구성은 상담 시 확인해주세요.")}</div></div>
      ${row.benefits ? `<div class="brand-detail-section"><strong>혜택 안내</strong><div class="brand-detail-pre">${escapeHtml(row.benefits)}</div></div>` : ""}
      <div class="brand-detail-price">${Number(row.originalPrice || 0) > 0 ? `<del>${formatPrice(row.originalPrice)}</del>` : ""}<strong>${formatPrice(row.salePrice)}<small>~</small></strong></div>
      <p class="brand-detail-date">${formatDate(row.updatedAt)} 기준 · 상담 시 최종 조건 확인</p>`;
    if (detailConsultButton) detailConsultButton.dataset.consultId = row.id;
    detailModal.hidden = false;
    document.documentElement.style.overflow = "hidden";
  }

  function closeDetail() {
    if (!detailModal) return;
    detailModal.hidden = true;
    state.detailSelected = null;
    document.documentElement.style.overflow = "";
  }

  function openConsult(id) {
    const row = state.rows.find((item) => String(item.id) === String(id));
    if (!row) return;
    state.selected = row;
    form.reset();
    form.elements.packageId.value = row.id;
    message.textContent = "";
    message.classList.remove("is-success");
    summary.innerHTML = `<span>${escapeHtml(row.channel || "판매 채널")}</span><strong>${escapeHtml(row.title)}</strong><b>${formatPrice(row.salePrice)}~</b>`;
    modal.hidden = false;
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => form.elements.customerName?.focus(), 30);
  }

  function closeConsult() {
    modal.hidden = true;
    document.documentElement.style.overflow = "";
    state.selected = null;
  }

  async function loadPackages() {
    grid.innerHTML = `<div class="brand-empty"><b>P</b><h3>패키지를 불러오고 있습니다.</h3><p>잠시만 기다려주세요.</p></div>`;
    try {
      const result = await apiJson("/api/brand-packages");
      state.rows = Array.isArray(result.rows) ? result.rows : [];
      populateFilters();
      render();
    } catch (error) {
      count.textContent = "패키지 조회 실패";
      grid.innerHTML = `<div class="brand-empty"><b>!</b><h3>브랜드관 정보를 불러오지 못했습니다.</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  const scrollToPackages = () => packageToolbar?.scrollIntoView({ behavior: "smooth", block: "start" });
  heroBrowse?.addEventListener("click", scrollToPackages);
  heroSeeMore?.addEventListener("click", scrollToPackages);
  heroConsult?.addEventListener("click", () => { if (state.rows[0]) openConsult(state.rows[0].id); else scrollToPackages(); });
  heroPreview?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-hero-package-id]");
    if (card) openConsult(card.dataset.heroPackageId);
  });

  brandFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-brand]");
    if (!button) return;
    state.brand = button.dataset.brand || "";
    brandFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });
  document.querySelectorAll("[data-showcase-brand]").forEach((card) => card.addEventListener("click", () => {
    const brand = card.dataset.showcaseBrand || "";
    state.brand = brand;
    brandFilters?.querySelectorAll("button[data-brand]").forEach((button) => button.classList.toggle("is-active", button.dataset.brand === brand));
    render();
    scrollToPackages();
  }));
  channelFilter?.addEventListener("change", () => { state.channel = channelFilter.value; render(); });
  grid?.addEventListener("click", (event) => {
    const detail = event.target.closest("[data-detail-id]");
    if (detail) openDetail(detail.dataset.detailId);
  });
  detailModal?.addEventListener("click", (event) => { if (event.target.closest("[data-close-detail]")) closeDetail(); });
  detailConsultButton?.addEventListener("click", () => {
    const id = detailConsultButton.dataset.consultId;
    closeDetail();
    if (id) openConsult(id);
  });
  modal?.addEventListener("click", (event) => { if (event.target.closest("[data-close-consult]")) closeConsult(); });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (detailModal && !detailModal.hidden) closeDetail();
    else if (modal && !modal.hidden) closeConsult();
  });
  form?.elements.customerPhone?.addEventListener("input", (event) => { event.target.value = formatPhoneInput(event.target.value); });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selected) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "상담 요청 전달 중...";
    message.textContent = "";
    try {
      const result = await apiJson("/api/brand-consultations", {
        method: "POST",
        body: JSON.stringify({
          packageId: data.packageId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerRegion: data.customerRegion,
          preferredTime: data.preferredTime,
          memo: data.memo,
          website: data.website,
          consent: { privacy: data.consent === "on", agreedAt: new Date().toISOString() },
        }),
      });
      message.classList.add("is-success");
      message.textContent = "상담 요청이 정상적으로 접수되었습니다. 픽견적 담당자가 확인 후 직접 연락드립니다.";
      submit.textContent = "상담 신청 완료";
      setTimeout(closeConsult, 1700);
    } catch (error) {
      message.classList.remove("is-success");
      message.textContent = error.message;
      submit.disabled = false;
      submit.textContent = "상담 신청하기";
    }
  });

  loadPackages();
})();
