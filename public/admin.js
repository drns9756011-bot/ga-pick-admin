const STORAGE_KEYS = {
  sellerApplications: "pickquoteSellerApplications",
  approvedSellers: "pickquoteApprovedSellers",
  alimtalkQueue: "pickquoteAlimtalkQueue",
  customerQuotes: "pickquoteCustomerQuotes",
  deletedQuoteLogs: "pickquoteDeletedQuoteLogs",
  lplanTrainingQuotes: "pickquoteLplanTrainingQuotes",
  visitStats: "pickquoteVisitStats",
  sellerAccessLogs: "pickquoteSellerAccessLogs",
  sellerAccessSummary: "pickquoteSellerAccessSummary",
  adminLastRefreshedAt: "pickquoteAdminLastRefreshedAt",
  adminApiToken: "pickquoteAdminApiToken",
};
const PUBLIC_API_BASE = "https://ga-pick.com";

let applicationFilter = "pending";
let messageFilter = "all";
let selectedApplicationId = "";
let messageSyncError = "알림톡 기록을 서버에서 불러오지 못했습니다. 새로고침 후에도 반복되면 배포 상태를 확인해주세요.";
let customerQuoteSyncError = "";
let lplanSyncError = "";
let lplanSyncing = false;
let lplanLastCheckedAt = "";
let adminQuoteCountdownTimer = 0;
let adminQuoteSummaryKey = "";
let customerQuoteSearchTerm = "";
const SELLER_CHANNELS = [
  "LG전자 BEST SHOP",
  "롯데하이마트",
  "삼성스토어",
  "이마트(LG)",
  "이마트(삼성)",
  "전자랜드(LG)",
  "전자랜드(삼성)",
];
const QUOTE_PURPOSES = ["웨딩,혼수", "신축입주", "이사", "인테리어", "일반"];
const QUOTE_BRANDS = ["LG전자", "삼성전자", "비교견적"];
const statGrid = document.querySelector("#statGrid");
const applicationList = document.querySelector("#applicationList");
const applicationDetail = document.querySelector("#applicationDetail");
const applicationSearch = document.querySelector("#applicationSearch");
const approvedSellerRows = document.querySelector("#approvedSellerRows");
const sellerAccessRows = document.querySelector("#sellerAccessRows");
const sellerAccessSummary = document.querySelector("#sellerAccessSummary");
const sellerAccessSearch = document.querySelector("#sellerAccessSearch");
const sellerAccessDays = document.querySelector("#sellerAccessDays");
const messageList = document.querySelector("#messageList");
const toast = document.querySelector("#toast");
const refreshBtn = document.querySelector("#refreshBtn");
const adminAuthBtn = document.querySelector("#adminAuthBtn");
const adminActions = document.querySelector(".admin-actions");
const adminLastUpdated = document.createElement("span");
adminLastUpdated.className = "admin-last-updated";
adminLastUpdated.setAttribute("aria-live", "polite");
refreshBtn?.insertAdjacentElement("beforebegin", adminLastUpdated);
const adminShell = document.querySelector(".admin-shell");
const adminHeaderTitle = document.querySelector(".admin-header h1");
const adminHeaderCopy = document.querySelector(".header-copy");
const adminLoadingModal = document.querySelector("#adminLoadingModal");
const adminLoadingTitle = document.querySelector("#adminLoadingTitle");
const adminLoadingText = document.querySelector("#adminLoadingText");
let adminLoadingCount = 0;
document.querySelector(".home-link")?.setAttribute("href", "https://ga-pick.com/");
document.querySelector(".home-link")?.setAttribute("target", "_blank");
document.querySelector(".home-link")?.setAttribute("rel", "noopener");
if (document.querySelector(".home-link")) {
  document.querySelector(".home-link").textContent = "서비스 화면으로";
}

const ADMIN_PAGE_CONFIG = {
  dashboard: {
    path: "/",
    title: "관리자 대시보드",
    heading: "운영 현황을 한눈에 확인하세요.",
    copy: "카드를 누르면 고객 견적, 판매자 신청, 승인 판매자, 알림톡 상태 페이지로 이동합니다.",
    visible: ["statGrid", "lplanSyncPanel", "dashboardHome"],
  },
  customers: {
    path: "/customers",
    title: "고객 견적",
    heading: "고객 견적을 확인하고 필요한 정보를 수정하세요.",
    copy: "서버에 저장된 고객 견적, 선택 상태, 삭제 이력을 관리합니다.",
    visible: ["statGrid", "customerQuotePanel"],
  },
  sellers: {
    path: "/sellers",
    title: "판매자 신청",
    heading: "판매자 등록 요청을 검토하세요.",
    copy: "신청 상세 정보를 확인하고 승인 또는 반려 처리를 진행합니다.",
    visible: ["statGrid", "sellerReview", "applications", "applicationDetail"],
  },
  approvedSellers: {
    path: "/approved-sellers",
    title: "승인 판매자",
    heading: "승인된 판매자 계정을 관리하세요.",
    copy: "채널, 지점, 매니저, 직책, 비밀번호 초기화와 계정 삭제를 관리합니다.",
    visible: ["statGrid", "adminSecondaryGrid", "approvedSellers"],
  },
  sellerAccess: {
    path: "/seller-access",
    title: "판매자 접속 기록",
    heading: "판매자 로그인과 접속 기기를 확인하세요.",
    copy: "성공한 로그인 기록을 날짜, 지점, 매니저, 기기별로 확인합니다.",
    visible: ["statGrid", "sellerAccessPanel"],
  },
  alimtalk: {
    path: "/alimtalk",
    title: "알림톡 상태",
    heading: "알림톡 발송 상태를 확인하세요.",
    copy: "발송 대기, 성공, 실패 이력을 확인하고 필요 시 재발송합니다.",
    visible: ["statGrid", "adminSecondaryGrid", "alimtalkControl"],
  },
};

const ADMIN_SECTION_IDS = [
  "statGrid",
  "lplanSyncPanel",
  "dashboardHome",
  "customerQuotePanel",
  "sellerReview",
  "applications",
  "applicationDetail",
  "adminSecondaryGrid",
  "approvedSellers",
  "sellerAccessPanel",
  "alimtalkControl",
];

function adminPageKeyFromPath(pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (normalized === "/customers") return "customers";
  if (normalized === "/sellers") return "sellers";
  if (normalized === "/approved-sellers") return "approvedSellers";
  if (normalized === "/seller-access") return "sellerAccess";
  if (normalized === "/alimtalk") return "alimtalk";
  return "dashboard";
}

function updateLastRefreshedDisplay(value = "") {
  const timestamp = value || localStorage.getItem(STORAGE_KEYS.adminLastRefreshedAt) || "";
  if (!timestamp) {
    adminLastUpdated.textContent = "최초 데이터 확인 전";
    return;
  }
  const date = new Date(timestamp);
  adminLastUpdated.textContent = Number.isNaN(date.getTime())
    ? "갱신 시간 확인 불가"
    : `마지막 갱신 ${date.toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

function getCurrentAdminPageKey() {
  return adminPageKeyFromPath(window.location.pathname);
}

function setAdminLoading(isVisible, title = "서버와 연결 중입니다.", text = "잠시만 기다려주세요.") {
  if (!adminLoadingModal) return;
  if (isVisible) {
    adminLoadingCount += 1;
    if (adminLoadingTitle) adminLoadingTitle.textContent = title;
    if (adminLoadingText) adminLoadingText.textContent = text;
    adminLoadingModal.hidden = false;
    document.body.classList.add("is-admin-loading");
    return;
  }

  adminLoadingCount = Math.max(0, adminLoadingCount - 1);
  if (adminLoadingCount > 0) return;
  adminLoadingModal.hidden = true;
  document.body.classList.remove("is-admin-loading");
}

function navigateAdminPage(pageKey, options = {}) {
  const config = ADMIN_PAGE_CONFIG[pageKey] || ADMIN_PAGE_CONFIG.dashboard;
  if (window.location.pathname !== config.path) {
    const historyMethod = options.replace ? "replaceState" : "pushState";
    window.history[historyMethod]({ adminPage: pageKey }, "", config.path);
  }
  renderAll();
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "auto" });
}

function applyAdminPageView() {
  const pageKey = getCurrentAdminPageKey();
  const config = ADMIN_PAGE_CONFIG[pageKey] || ADMIN_PAGE_CONFIG.dashboard;
  document.body.dataset.adminPage = pageKey;
  document.title = `픽견적 관리자 · ${config.title}`;
  if (adminShell) adminShell.id = pageKey;
  if (adminHeaderTitle) adminHeaderTitle.textContent = config.heading;
  if (adminHeaderCopy) adminHeaderCopy.textContent = config.copy;

  const visible = new Set(config.visible);
  ADMIN_SECTION_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.hidden = !visible.has(id);
  });

  document.querySelectorAll("[data-admin-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.adminNav === pageKey);
    if (link.dataset.adminNav === pageKey) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

const customerQuoteSection = document.createElement("section");
customerQuoteSection.className = "admin-panel customer-quote-admin-panel";
customerQuoteSection.id = "customerQuotePanel";
customerQuoteSection.innerHTML = `
  <div class="panel-head">
    <div>
      <p class="eyebrow">Customer Quotes</p>
      <h2>고객 견적 서버 저장 현황</h2>
    </div>
    <p class="panel-note">고객 견적 저장 여부와 알림톡 발송 상태를 확인합니다.</p>
  </div>
  <div class="customer-quote-search" role="search" aria-label="고객 견적 검색">
    <label for="customerQuoteSearch">견적 검색</label>
    <div class="customer-quote-search-row">
      <input id="customerQuoteSearch" type="search" inputmode="search" autocomplete="off" placeholder="견적번호, 고객명, 휴대전화번호 검색" />
      <button class="plain-btn" id="customerQuoteSearchClear" type="button" hidden>검색 초기화</button>
    </div>
    <p id="customerQuoteSearchSummary" aria-live="polite">전체 견적을 표시합니다.</p>
  </div>
  <div class="quote-admin-list" id="customerQuoteList"></div>
  <div class="deleted-quote-log">
    <h3>삭제된 견적 기록</h3>
    <div class="deleted-quote-list" id="deletedQuoteList"></div>
  </div>
`;
document.querySelector("#statGrid")?.insertAdjacentElement("afterend", customerQuoteSection);
const customerQuoteList = document.querySelector("#customerQuoteList");
const customerQuoteSearch = document.querySelector("#customerQuoteSearch");
const customerQuoteSearchClear = document.querySelector("#customerQuoteSearchClear");
const customerQuoteSearchSummary = document.querySelector("#customerQuoteSearchSummary");
const deletedQuoteList = document.querySelector("#deletedQuoteList");

const lplanSyncSection = document.createElement("section");
lplanSyncSection.className = "admin-panel lplan-sync-panel";
lplanSyncSection.id = "lplanSyncPanel";
lplanSyncSection.innerHTML = `
  <div class="panel-head">
    <div>
      <p class="eyebrow">LPLAN SYNC</p>
      <h2>엘플랜 견적 학습 동기화</h2>
    </div>
    <div class="panel-actions">
      <button class="plain-btn small-btn" type="button" data-force-lplan-sync>엘플랜 학습동기화</button>
      <p class="panel-note">엘플랜에서 개인정보를 제외하고 넘어온 모델 구성 데이터를 확인합니다.</p>
    </div>
  </div>
  <div class="lplan-sync-summary" id="lplanSyncSummary"></div>
  <div class="lplan-branch-summary" id="lplanBranchSummary"></div>
  <div class="lplan-sync-list" id="lplanSyncList"></div>
`;
customerQuoteSection.insertAdjacentElement("afterend", lplanSyncSection);
const lplanSyncSummary = document.querySelector("#lplanSyncSummary");
const lplanBranchSummary = document.querySelector("#lplanBranchSummary");
const lplanSyncList = document.querySelector("#lplanSyncList");

const editCustomerQuoteModal = document.createElement("div");
editCustomerQuoteModal.className = "admin-modal";
editCustomerQuoteModal.id = "editCustomerQuoteModal";
editCustomerQuoteModal.hidden = true;
editCustomerQuoteModal.innerHTML = `
  <div class="admin-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="editCustomerQuoteTitle">
    <div class="admin-modal-head">
      <div>
        <p class="eyebrow">Customer Quote</p>
        <h2 id="editCustomerQuoteTitle">고객 견적 정보 수정</h2>
      </div>
      <button class="modal-close-btn" type="button" data-close-admin-modal aria-label="닫기">×</button>
    </div>
    <form class="admin-edit-form" id="editCustomerQuoteForm">
      <input type="hidden" name="quoteId" />
      <div class="form-grid">
        <label>고객명<input type="text" name="customer" required /></label>
        <label>연락처<input type="text" name="phone" data-phone-edit required /></label>
        <label>구매 사유<select name="purchasePurpose"></select></label>
        <label>브랜드<select name="desiredBrand"></select></label>
        <label class="span-2">품목<input type="text" name="items" required /></label>
        <label>기존 견적금액(원)<input type="number" name="price" min="0" step="1" /></label>
        <label>설치 지역<input type="text" name="region" /></label>
        <label class="span-2">고객 작성 내용<textarea name="memo" rows="5"></textarea></label>
      </div>
      <div class="modal-actions">
        <button class="ghost-btn" type="button" data-close-admin-modal>취소</button>
        <button class="primary-btn" type="submit">서버에 저장</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(editCustomerQuoteModal);

const editApprovedSellerModal = document.createElement("div");
editApprovedSellerModal.className = "admin-modal";
editApprovedSellerModal.id = "editApprovedSellerModal";
editApprovedSellerModal.hidden = true;
editApprovedSellerModal.innerHTML = `
  <div class="admin-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="editApprovedSellerTitle">
    <div class="admin-modal-head">
      <div>
        <p class="eyebrow">Approved Seller</p>
        <h2 id="editApprovedSellerTitle">승인 판매자 정보 수정</h2>
      </div>
      <button class="modal-close-btn" type="button" data-close-admin-modal aria-label="닫기">×</button>
    </div>
    <form class="admin-edit-form" id="editApprovedSellerForm">
      <input type="hidden" name="sellerId" />
      <div class="form-grid">
        <label>채널<select name="channel" required></select></label>
        <label>지점명<input type="text" name="branch" required /></label>
        <label>담당 지역<input type="text" name="branchRegion" /></label>
        <label>매니저명<input type="text" name="manager" required /></label>
        <label>직책<input type="text" name="managerPosition" placeholder="예: 선임, 프로" /></label>
        <label>연락처<input type="text" name="phone" data-phone-edit required /></label>
        <label class="span-2">관리 메모<textarea name="memo" rows="4"></textarea></label>
      </div>
      <div class="modal-actions">
        <button class="ghost-btn" type="button" data-close-admin-modal>취소</button>
        <button class="primary-btn" type="submit">서버에 저장</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(editApprovedSellerModal);

const editCustomerQuoteForm = document.querySelector("#editCustomerQuoteForm");
const editApprovedSellerForm = document.querySelector("#editApprovedSellerForm");

const adminTextModal = document.createElement("div");
adminTextModal.className = "admin-modal admin-text-modal";
adminTextModal.id = "adminTextModal";
adminTextModal.hidden = true;
adminTextModal.innerHTML = `
  <div class="admin-modal-dialog admin-text-dialog" role="dialog" aria-modal="true" aria-labelledby="adminTextModalTitle">
    <div class="admin-modal-head">
      <div>
        <p class="eyebrow" id="adminTextModalEyebrow">Admin Confirm</p>
        <h2 id="adminTextModalTitle">입력 확인</h2>
      </div>
      <button class="modal-close-btn" type="button" data-admin-text-cancel aria-label="닫기">×</button>
    </div>
    <form class="admin-edit-form" id="adminTextModalForm">
      <p class="admin-modal-description" id="adminTextModalDescription"></p>
      <label class="admin-text-input-label" id="adminTextModalLabel">
        <span>입력</span>
        <input type="text" id="adminTextModalInput" autocomplete="off" />
        <textarea id="adminTextModalTextarea" rows="5"></textarea>
      </label>
      <div class="modal-actions">
        <button class="ghost-btn" type="button" data-admin-text-cancel>취소</button>
        <button class="primary-btn" type="submit" id="adminTextModalConfirm">확인</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(adminTextModal);

const adminTextModalForm = document.querySelector("#adminTextModalForm");
const adminTextModalTitle = document.querySelector("#adminTextModalTitle");
const adminTextModalEyebrow = document.querySelector("#adminTextModalEyebrow");
const adminTextModalDescription = document.querySelector("#adminTextModalDescription");
const adminTextModalLabelText = document.querySelector("#adminTextModalLabel span");
const adminTextModalInput = document.querySelector("#adminTextModalInput");
const adminTextModalTextarea = document.querySelector("#adminTextModalTextarea");
const adminTextModalConfirm = document.querySelector("#adminTextModalConfirm");
let adminTextModalResolver = null;

function canUseApiServer() {
  return window.location.protocol !== "file:";
}

function readAdminApiToken() {
  return localStorage.getItem(STORAGE_KEYS.adminApiToken) || "";
}

function closeAdminTextModal(value = null) {
  if (adminTextModalResolver) {
    adminTextModalResolver(value);
    adminTextModalResolver = null;
  }
  adminTextModal.hidden = true;
  adminTextModalInput.value = "";
  adminTextModalTextarea.value = "";
}

function openAdminTextModal(options = {}) {
  const {
    eyebrow = "Admin Confirm",
    title = "입력 확인",
    description = "",
    label = "입력",
    value = "",
    multiline = false,
    inputType = "text",
    confirmText = "확인",
    danger = false,
  } = options;

  return new Promise((resolve) => {
    adminTextModalResolver = resolve;
    adminTextModalEyebrow.textContent = eyebrow;
    adminTextModalTitle.textContent = title;
    adminTextModalDescription.textContent = description;
    adminTextModalDescription.hidden = !description;
    adminTextModalLabelText.textContent = label;
    adminTextModalConfirm.textContent = confirmText;
    adminTextModalConfirm.classList.toggle("danger-action", Boolean(danger));
    adminTextModalInput.hidden = multiline;
    adminTextModalTextarea.hidden = !multiline;
    adminTextModalInput.type = inputType;
    adminTextModalInput.value = value;
    adminTextModalTextarea.value = value;
    adminTextModal.hidden = false;
    setTimeout(() => (multiline ? adminTextModalTextarea : adminTextModalInput).focus(), 0);
  });
}

let adminTokenRequestPromise = null;

async function requestAdminApiToken(force = false) {
  const current = readAdminApiToken();
  if (current && !force) return current;
  if (force) localStorage.removeItem(STORAGE_KEYS.adminApiToken);
  if (adminTokenRequestPromise) return adminTokenRequestPromise;

  adminTokenRequestPromise = (async () => {
    const next = await openAdminTextModal({
      eyebrow: "Admin Token",
      title: "관리자 인증 토큰 입력",
      description: "관리자 데이터 조회와 저장을 위해 발급받은 API 토큰을 입력해주세요.",
      label: "관리자 API 토큰",
      inputType: "password",
      confirmText: "토큰 저장",
    });
    if (!next) return "";
    const token = next.trim();
    localStorage.setItem(STORAGE_KEYS.adminApiToken, token);
    return token;
  })();

  try {
    return await adminTokenRequestPromise;
  } finally {
    adminTokenRequestPromise = null;
  }
}

async function apiJson(path, options = {}) {
  if (!canUseApiServer()) return null;

  const method = String(options.method || "GET").toUpperCase();
  const silent = Boolean(options.silent);
  const { silent: _silent, ...fetchOptions } = options;
  const adminToken = await requestAdminApiToken();
  if (!adminToken) {
    showToast("관리자 API 토큰이 필요합니다.");
    return null;
  }

  if (!silent) {
    setAdminLoading(
      true,
      method === "GET" ? "관리자 데이터를 불러오는 중입니다." : "서버에 저장하는 중입니다.",
      method === "GET" ? "최신 운영 정보를 확인하고 있습니다." : "요청이 완료될 때까지 잠시만 기다려주세요."
    );
  }

  try {
    const headers = {
      ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      "X-Admin-Token": adminToken,
      ...(options.headers || {}),
    };
    const response = await fetch(path, {
      cache: "no-store",
      headers,
      ...fetchOptions,
    });
    const payload = response.status === 204
      ? null
      : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(STORAGE_KEYS.adminApiToken);
        if (!options.__retriedAfterAuth) {
          setAdminLoading(false);
          const renewedToken = await requestAdminApiToken(true);
          if (renewedToken) {
            return apiJson(path, { ...options, __retriedAfterAuth: true });
          }
        }
      }
      return {
        ok: false,
        status: response.status,
        message: payload?.message || `서버 요청에 실패했습니다. (${response.status})`,
      };
    }
    return payload;
  } catch (error) {
    console.warn("API 요청에 실패했습니다.", error);
    return { ok: false, message: "관리자 서버에 연결하지 못했습니다." };
  } finally {
    if (!silent) setAdminLoading(false);
  }
}

async function loadAlimtalkMessagesFromServer(options = {}) {
  const timestamp = Date.now();
  const requestOptions = options.silent ? { silent: true } : {};
  const result = await apiJson(`/api/alimtalk?ts=${timestamp}`, requestOptions);
  if (result?.ok && Array.isArray(result.rows)) {
    messageSyncError = "";
    return result;
  }
  messageSyncError = result?.message || "알림톡 기록을 관리자 서버에서 불러오지 못했습니다.";
  return result || null;
}

async function loadCustomerQuotesFromServer(options = {}) {
  const timestamp = Date.now();
  const requestOptions = options.silent ? { silent: true } : {};
  const result = await apiJson(`/api/customer-quotes?ts=${timestamp}`, requestOptions);
  if (result?.ok && Array.isArray(result.rows)) {
    customerQuoteSyncError = "";
    return result;
  }
  customerQuoteSyncError = result?.message || "고객 견적을 관리자 서버에서 불러오지 못했습니다.";
  return result || null;
}

async function loadSellerApplicationsFromServer(options = {}) {
  const timestamp = Date.now();
  const requestOptions = options.silent ? { silent: true } : {};
  return apiJson(`/api/seller-applications?ts=${timestamp}`, requestOptions);
}

async function loadApprovedSellersFromServer(options = {}) {
  const timestamp = Date.now();
  const requestOptions = options.silent ? { silent: true } : {};
  return apiJson(`/api/approved-sellers?ts=${timestamp}`, requestOptions);
}

async function loadVisitStatsFromServer(options = {}) {
  const timestamp = Date.now();
  const requestOptions = options.silent ? { silent: true } : {};
  return apiJson(`/api/visit-stats?ts=${timestamp}`, requestOptions);
}

async function loadSellerAccessLogsFromServer(options = {}) {
  const timestamp = Date.now();
  const days = Math.min(365, Math.max(1, Number(options.days || sellerAccessDays?.value || 30) || 30));
  const requestOptions = options.silent ? { silent: true } : {};
  return apiJson(`/api/seller-access-logs?days=${days}&limit=500&ts=${timestamp}`, requestOptions);
}

async function loadLplanTrainingFromServer(options = {}) {
  const timestamp = Date.now();
  const limit = Math.min(100, Math.max(1, Number(options.limit || 50) || 50));
  const requestOptions = options.silent ? { silent: true } : {};
  const result = await apiJson(`/api/lplan-training-quotes?limit=${limit}&ts=${timestamp}`, requestOptions);
  lplanLastCheckedAt = new Date().toISOString();
  if (result?.ok && Array.isArray(result.rows)) {
    lplanSyncError = "";
    return result;
  }
  lplanSyncError = result?.message || "엘플랜 동기화 데이터를 관리자 서버에서 불러오지 못했습니다.";
  return result || null;
}

async function forceLplanTrainingSync() {
  if (lplanSyncing) return;
  lplanSyncing = true;
  renderLplanSyncPanel();
  const result = await loadLplanTrainingFromServer({ limit: 100 });
  if (result?.ok && Array.isArray(result.rows)) {
    writeStorageArray(STORAGE_KEYS.lplanTrainingQuotes, result.rows);
    if (result.summary) {
      localStorage.setItem(`${STORAGE_KEYS.lplanTrainingQuotes}:summary`, JSON.stringify(result.summary));
    }
    showToast(`엘플랜 학습 데이터 ${result.summary?.total ?? result.rows.length}건을 확인했습니다.`);
  } else {
    showToast(lplanSyncError || "엘플랜 학습 데이터를 확인하지 못했습니다.");
  }
  lplanSyncing = false;
  renderAll();
}

async function loadAdminDataFromServer(options = {}) {
  const silent = Boolean(options.silent);
  const token = await requestAdminApiToken();
  if (!token) {
    updateLastRefreshedDisplay();
    return;
  }
  if (!silent) {
    setAdminLoading(true, "관리자 데이터를 한 번에 불러오는 중입니다.", "최신 운영 정보와 방문자 통계를 확인하고 있습니다.");
  }
  try {
    const requestOptions = { silent: true };
    const [applications, approvedSellers, messages, customerQuotes, deletedQuoteLogs, lplanTraining, visitStats, sellerAccess] = await Promise.all([
      loadSellerApplicationsFromServer(requestOptions),
      loadApprovedSellersFromServer(requestOptions),
      loadAlimtalkMessagesFromServer(requestOptions),
      loadCustomerQuotesFromServer(requestOptions),
      apiJson("/api/deleted-quote-logs", requestOptions),
      loadLplanTrainingFromServer({ silent: true, limit: 100 }),
      loadVisitStatsFromServer(requestOptions),
      loadSellerAccessLogsFromServer({ silent: true }),
    ]);

    if (applications?.ok && Array.isArray(applications.rows)) writeStorageArray(STORAGE_KEYS.sellerApplications, applications.rows);
    if (approvedSellers?.ok && Array.isArray(approvedSellers.rows)) {
      let approvedRows = approvedSellers.rows;
      if (!approvedRows.length && applications?.ok && Array.isArray(applications.rows)) {
        approvedRows = applications.rows
          .filter((row) => ["approved", "active", "승인"].includes(String(row.status || "").trim().toLowerCase()))
          .map((row) => ({ ...row, status: "approved" }));
      }
      writeStorageArray(STORAGE_KEYS.approvedSellers, approvedRows);
    }
    if (messages?.ok && Array.isArray(messages.rows)) writeStorageArray(STORAGE_KEYS.alimtalkQueue, messages.rows);
    if (customerQuotes?.ok && Array.isArray(customerQuotes.rows)) writeStorageArray(STORAGE_KEYS.customerQuotes, customerQuotes.rows);
    if (deletedQuoteLogs?.ok && Array.isArray(deletedQuoteLogs.rows)) writeStorageArray(STORAGE_KEYS.deletedQuoteLogs, deletedQuoteLogs.rows);
    if (visitStats?.ok) localStorage.setItem(STORAGE_KEYS.visitStats, JSON.stringify(visitStats));
    if (sellerAccess?.ok && Array.isArray(sellerAccess.rows)) {
      writeStorageArray(STORAGE_KEYS.sellerAccessLogs, sellerAccess.rows);
      localStorage.setItem(STORAGE_KEYS.sellerAccessSummary, JSON.stringify(sellerAccess.summary || {}));
    }
    if (lplanTraining?.ok && Array.isArray(lplanTraining.rows)) {
      writeStorageArray(STORAGE_KEYS.lplanTrainingQuotes, lplanTraining.rows);
      if (lplanTraining.summary) {
        localStorage.setItem(`${STORAGE_KEYS.lplanTrainingQuotes}:summary`, JSON.stringify(lplanTraining.summary));
      }
    }

    const refreshedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.adminLastRefreshedAt, refreshedAt);
    updateLastRefreshedDisplay(refreshedAt);
  } finally {
    if (!silent) setAdminLoading(false);
  }
}

async function syncApplicationStatusToServer(applicationId, status, reviewMemo) {
  const result = await apiJson(`/api/seller-applications/${encodeURIComponent(applicationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, reviewMemo }),
  });

  if (!result?.ok) {
    showToast(result?.message || "판매자 신청 상태 변경에 실패했습니다.");
    return;
  }
  await loadAdminDataFromServer();
  renderAll();
}

async function syncMessageStatusToServer(messageId, payload) {
  const result = await apiJson(`/api/alimtalk/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!result?.ok) {
    showToast(result?.message || "알림톡 상태 저장에 실패했습니다.");
    return false;
  }
  if (result.row) updateMessage(messageId, (message) => Object.assign(message, result.row));
  return true;
}

async function resendMessage(messageId) {
  const result = await apiJson(`/api/alimtalk/${encodeURIComponent(messageId)}/resend`, {
    method: "POST",
  });
  if (result?.row) {
    updateMessage(messageId, (message) => Object.assign(message, result.row));
  } else {
    await loadAdminDataFromServer();
    renderAll();
  }
  showToast(result?.message || (result?.ok ? "알림톡을 재발송했습니다." : "알림톡 재발송에 실패했습니다."));
}

async function refreshMessageStatus(messageId) {
  const result = await apiJson(`/api/alimtalk/${encodeURIComponent(messageId)}/refresh`, {
    method: "POST",
  });
  if (result?.row) {
    updateMessage(messageId, (message) => Object.assign(message, result.row));
  } else {
    await loadAdminDataFromServer();
    renderAll();
  }
  showToast(result?.ok ? "알림톡 최종 상태를 확인했습니다." : result?.message || "알림톡 상태 확인에 실패했습니다.");
}

async function deleteMessage(messageId) {
  const result = await apiJson(`/api/alimtalk/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
  if (!result?.ok) return;

  setMessages(getMessages().filter((message) => message.id !== messageId));
  renderAll();
}

function readStorageArray(key) {
  try {
    const value = localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeStorageArray(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function getApplications() {
  return readStorageArray(STORAGE_KEYS.sellerApplications);
}

function setApplications(rows) {
  writeStorageArray(STORAGE_KEYS.sellerApplications, rows);
}

function getApprovedSellers() {
  return readStorageArray(STORAGE_KEYS.approvedSellers);
}

function setApprovedSellers(rows) {
  writeStorageArray(STORAGE_KEYS.approvedSellers, rows);
}

async function syncApprovedSellerPasswordToServer(sellerId, password) {
  const result = await apiJson(`/api/approved-sellers/${encodeURIComponent(sellerId)}`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });

  if (!result?.ok) {
    showToast(result?.message || "비밀번호 초기화에 실패했습니다.");
    return false;
  }

  await loadAdminDataFromServer();
  renderAll();
  return true;
}

async function syncApprovedSellerPositionToServer(sellerId, managerPosition) {
  const result = await apiJson(`/api/approved-sellers/${encodeURIComponent(sellerId)}`, {
    method: "PATCH",
    body: JSON.stringify({ managerPosition }),
  });

  if (!result?.ok) {
    showToast(result?.message || "직책 변경에 실패했습니다.");
    return false;
  }

  const sellers = getApprovedSellers().map((seller) =>
    seller.id === sellerId ? { ...seller, managerPosition: result.row?.managerPosition || managerPosition } : seller
  );
  setApprovedSellers(sellers);
  renderAll();
  return true;
}

async function syncApprovedSellerUpdateToServer(sellerId, payload) {
  const result = await apiJson(`/api/approved-sellers/${encodeURIComponent(sellerId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  if (!result?.ok) {
    showToast(result?.message || "판매자 정보 변경에 실패했습니다.");
    return false;
  }

  const sellers = getApprovedSellers().map((seller) => (seller.id === sellerId ? { ...seller, ...result.row } : seller));
  setApprovedSellers(sellers);
  renderAll();
  return true;
}

async function syncApprovedSellerDeleteToServer(sellerId) {
  const result = await apiJson(`/api/approved-sellers/${encodeURIComponent(sellerId)}`, {
    method: "DELETE",
  });

  if (!result?.ok) {
    showToast(result?.message || "승인 판매자 삭제에 실패했습니다.");
    return false;
  }

  await loadAdminDataFromServer();
  renderAll();
  return true;
}

function readAdminFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

function convertAdminImageToJpeg(dataUrl, maxWidth = 1800, quality = 0.86) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const ratio = Math.min(1, maxWidth / Math.max(1, image.width));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return resolve("");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (error) {
        resolve("");
      }
    };
    image.onerror = () => resolve("");
    image.src = dataUrl;
  });
}

async function replaceCustomerQuoteImage(quoteId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  input.multiple = true;
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []).slice(0, 4);
    if (!files.length) return;
    const raw = await Promise.all(files.map(readAdminFileAsDataUrl));
    const converted = await Promise.all(raw.map((dataUrl) => convertAdminImageToJpeg(dataUrl)));
    if (converted.some((item) => !item)) {
      showToast("이미지를 변환하지 못했습니다. JPG 또는 PNG 파일을 선택해주세요.");
      return;
    }
    const thumbnailImage = await convertAdminImageToJpeg(converted[0], 720, 0.72);
    const result = await apiJson(`/api/customer-quotes/${encodeURIComponent(quoteId)}/images`, {
      method: "POST",
      body: JSON.stringify({ images: converted, thumbnailImage }),
    });
    if (!result?.ok) {
      showToast(result?.message || "견적 이미지 교체에 실패했습니다.");
      return;
    }
    const quotes = getCustomerQuotes().map((quote) => quote.id === quoteId ? { ...quote, ...result.row } : quote);
    writeStorageArray(STORAGE_KEYS.customerQuotes, quotes);
    renderAll();
    showToast("견적 이미지를 교체했습니다.");
  }, { once: true });
  input.click();
}

async function syncCustomerQuoteUpdateToServer(quoteId, payload) {
  const result = await apiJson(`/api/customer-quotes/${encodeURIComponent(quoteId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  if (!result?.ok) {
    showToast(result?.message || "고객 견적 수정에 실패했습니다.");
    return false;
  }

  const quotes = getCustomerQuotes().map((quote) => (quote.id === quoteId ? { ...quote, ...result.row } : quote));
  writeStorageArray(STORAGE_KEYS.customerQuotes, quotes);
  renderAll();
  return true;
}

async function syncCustomerQuoteDeleteToServer(quoteId, reason) {
  const encodedId = encodeURIComponent(quoteId);
  const request = {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  };

  const result = await apiJson(`/api/customer-quotes/${encodedId}`, request);

  if (!result?.ok) {
    showToast(result?.message || "고객 견적 삭제에 실패했습니다.");
    return false;
  }

  writeStorageArray(
    STORAGE_KEYS.customerQuotes,
    getCustomerQuotes().filter((quote) => String(quote.id) !== String(quoteId))
  );

  const deletedLogs = await apiJson(`/api/deleted-quote-logs?ts=${Date.now()}`, { silent: true });
  if (deletedLogs?.ok && Array.isArray(deletedLogs.rows)) {
    writeStorageArray(STORAGE_KEYS.deletedQuoteLogs, deletedLogs.rows);
  }
  renderAll();
  return true;
}

function getMessages() {
  return readStorageArray(STORAGE_KEYS.alimtalkQueue);
}

function setMessages(rows) {
  writeStorageArray(STORAGE_KEYS.alimtalkQueue, rows);
}

function getCustomerQuotes() {
  return readStorageArray(STORAGE_KEYS.customerQuotes);
}

function getDeletedQuoteLogs() {
  return readStorageArray(STORAGE_KEYS.deletedQuoteLogs);
}

function getLplanTrainingQuotes() {
  return readStorageArray(STORAGE_KEYS.lplanTrainingQuotes);
}

function getVisitStats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.visitStats) || "null") || {};
  } catch (error) {
    return {};
  }
}

function getLplanTrainingSummary() {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEYS.lplanTrainingQuotes}:summary`) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function getLplanBranchSummary(rows, summary) {
  if (Array.isArray(summary?.branches) && summary.branches.length) return summary.branches;
  const branchMap = new Map();
  rows.forEach((row) => {
    const branch = row.branch || "지점 미기록";
    const current = branchMap.get(branch) || { branch, count: 0, latestSyncedAt: "" };
    current.count += 1;
    if (!current.latestSyncedAt || String(row.syncedAt || "") > current.latestSyncedAt) {
      current.latestSyncedAt = row.syncedAt || "";
    }
    branchMap.set(branch, current);
  });
  return Array.from(branchMap.values()).sort((a, b) => b.count - a.count);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function formatPhoneNumber(value) {
  const digits = normalizePhone(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function formatWon(value) {
  const amount = Number(value || 0);
  if (!amount) return "금액 미입력";
  return `${amount.toLocaleString("ko-KR")}원`;
}

function createOptions(options, selectedValue = "") {
  return options
    .map((option) => `<option value="${escapeHTML(option)}"${option === selectedValue ? " selected" : ""}>${escapeHTML(option)}</option>`)
    .join("");
}

function fillSelect(select, options, selectedValue = "") {
  if (!select) return;
  select.innerHTML = createOptions(options, selectedValue);
}

function closeAdminModals() {
  editCustomerQuoteModal.hidden = true;
  editApprovedSellerModal.hidden = true;
}

function openEditCustomerQuoteModal(quoteId) {
  const quote = getCustomerQuotes().find((row) => row.id === quoteId);
  if (!quote || !editCustomerQuoteForm) return;

  editCustomerQuoteForm.quoteId.value = quote.id;
  editCustomerQuoteForm.customer.value = quote.customer || "";
  editCustomerQuoteForm.phone.value = formatPhoneNumber(quote.phone);
  editCustomerQuoteForm.items.value = quote.items || "";
  editCustomerQuoteForm.price.value = Number(quote.price || 0) || "";
  editCustomerQuoteForm.region.value = quote.region || "";
  editCustomerQuoteForm.memo.value = quote.memo || "";
  fillSelect(editCustomerQuoteForm.purchasePurpose, QUOTE_PURPOSES, quote.purchasePurpose || "");
  fillSelect(editCustomerQuoteForm.desiredBrand, QUOTE_BRANDS, quote.desiredBrand || "");
  editCustomerQuoteModal.hidden = false;
  editCustomerQuoteForm.customer.focus();
}

function openEditApprovedSellerModal(sellerId) {
  const seller = getApprovedSellers().find((row) => row.id === sellerId);
  if (!seller || !editApprovedSellerForm) return;

  editApprovedSellerForm.sellerId.value = seller.id;
  fillSelect(editApprovedSellerForm.channel, SELLER_CHANNELS, seller.channel || "");
  editApprovedSellerForm.branch.value = seller.branch || "";
  editApprovedSellerForm.branchRegion.value = seller.branchRegion || "";
  editApprovedSellerForm.manager.value = seller.manager || "";
  editApprovedSellerForm.managerPosition.value = seller.managerPosition || "";
  editApprovedSellerForm.phone.value = formatPhoneNumber(seller.phone);
  editApprovedSellerForm.memo.value = seller.memo || "";
  editApprovedSellerModal.hidden = false;
  editApprovedSellerForm.branch.focus();
}

function formatDate(value) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status) {
  return {
    pending: "승인 대기",
    approved: "승인",
    rejected: "반려",
    ready: "발송 대기",
    accepted: "접수됨",
    sending: "전송중",
    sent: "발송완료",
    failed: "발송실패",
    canceled: "취소",
  }[status] || status;
}

function sellerName(row) {
  return [row.channel, row.branch].filter(Boolean).join(" ");
}

function managerName(row) {
  return [row.manager, row.managerPosition].filter(Boolean).join(" ");
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

async function queueAlimtalk(message) {
  const serverResult = await apiJson(`/api/alimtalk`, {
    method: "POST",
    body: JSON.stringify(message),
  });
  if (serverResult?.ok && Array.isArray(serverResult.rows)) {
    setMessages(serverResult.rows);
    return true;
  }

  const messages = getMessages();
  messages.unshift({
    ...message,
    id: `talk-${Date.now()}`,
    status: "ready",
    createdAt: new Date().toISOString(),
    sentAt: "",
    canceledAt: "",
  });
  setMessages(messages);
  return false;
}

function getFilteredMessages() {
  return getMessages().filter((message) => {
    if (messageFilter === "all") return true;
    if (messageFilter === "accepted") {
      return message.status === "accepted" || message.status === "sending";
    }
    return message.status === messageFilter;
  });
}

function getFilteredApplications() {
  const query = applicationSearch.value.trim().toLowerCase();
  return getApplications().filter((application) => {
    const matchesStatus = applicationFilter === "all" || application.status === applicationFilter;
    const haystack = [
      application.sellerId,
      application.channel,
      application.branch,
      application.branchRegion,
      application.manager,
      application.managerPosition,
      application.phone,
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!query || haystack.includes(query));
  });
}

function getSelectedApplication() {
  const applications = getFilteredApplications();
  if (!applications.length) return null;
  const selected = applications.find((application) => application.id === selectedApplicationId);
  return selected || applications[0];
}

function renderStatsCards() {
  renderStats();
}

function summarizeCustomerQuotes(quotes) {
  return quotes.reduce((summary, quote) => {
    const status = quoteStatusMeta(quote);
    const isSelected = status.className === "quote-selected";
    const isClosed = status.className === "quote-closed";

    summary.total += 1;
    if (isSelected || isClosed) summary.closed += 1;
    else summary.active += 1;
    if (isClosed && !isSelected) summary.unselected += 1;

    return summary;
  }, {
    total: 0,
    active: 0,
    closed: 0,
    unselected: 0,
  });
}

function getSellerAccessLogs() {
  return readStorageArray(STORAGE_KEYS.sellerAccessLogs);
}

function getSellerAccessSummary() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.sellerAccessSummary) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function renderSellerAccessLogs() {
  if (!sellerAccessRows || !sellerAccessSummary) return;
  const summary = getSellerAccessSummary();
  const search = String(sellerAccessSearch?.value || "").trim().toLowerCase();
  const rows = getSellerAccessLogs().filter((row) => {
    if (!search) return true;
    return [row.sellerId, row.channel, row.branch, row.manager, row.deviceType, row.browserName]
      .some((value) => String(value || "").toLowerCase().includes(search));
  });

  sellerAccessSummary.innerHTML = [
    ["오늘 접속 판매자", `${Number(summary.today?.sellerCount || 0).toLocaleString("ko-KR")}명`],
    ["오늘 로그인", `${Number(summary.today?.loginCount || 0).toLocaleString("ko-KR")}회`],
    ["최근 7일 접속", `${Number(summary.last7Days?.sellerCount || 0).toLocaleString("ko-KR")}명`],
    ["누적 로그인", `${Number(summary.total?.loginCount || 0).toLocaleString("ko-KR")}회`],
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");

  sellerAccessRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td><strong>${escapeHTML(formatDate(row.accessedAt))}</strong></td>
        <td>${escapeHTML(row.channel || "-")}</td>
        <td>${escapeHTML(row.branch || "-")}</td>
        <td>${escapeHTML([row.manager, row.managerPosition].filter(Boolean).join(" ") || "-")}</td>
        <td><code>${escapeHTML(row.sellerId || "-")}</code></td>
        <td>${escapeHTML([row.deviceType, row.browserName].filter(Boolean).join(" · ") || "-")}</td>
        <td>${escapeHTML(row.ipMasked || "확인 불가")}</td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty-table-cell">조건에 해당하는 판매자 접속 기록이 없습니다.</td></tr>`;
}

function renderStats() {
  const applications = getApplications();
  const approved = getApprovedSellers();
  const messages = getMessages();
  const customerQuotes = getCustomerQuotes();
  const quoteSummary = summarizeCustomerQuotes(customerQuotes);
  const pendingCount = applications.filter((row) => row.status === "pending").length;
  const readyMessages = messages.filter((row) => row.status === "ready" || row.status === "sending" || row.status === "accepted").length;
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;
  const visitStats = getVisitStats();
  const todayVisitors = Number(visitStats.today?.uniqueVisitors || 0);
  const todayViews = Number(visitStats.today?.pageViews || 0);
  const sevenDayVisitors = Number(visitStats.last7Days?.uniqueVisitors || 0);
  const totalViews = Number(visitStats.total?.pageViews || 0);
  const sellerAccessStats = getSellerAccessSummary();
  const todaySellerAccess = Number(sellerAccessStats.today?.sellerCount || 0);
  const todaySellerLogins = Number(sellerAccessStats.today?.loginCount || 0);
  const weekSellerAccess = Number(sellerAccessStats.last7Days?.sellerCount || 0);

  statGrid.innerHTML = [
    {
      label: "노출용 방문자",
      value: `오늘 ${todayVisitors.toLocaleString("ko-KR")}명`,
      note: `오늘 조회 ${todayViews.toLocaleString("ko-KR")}회 · 최근 7일 ${sevenDayVisitors.toLocaleString("ko-KR")}명 · 누적 조회 ${totalViews.toLocaleString("ko-KR")}회`,
      className: "visitor-summary-card",
    },
    {
      label: "고객 견적",
      value: `누적 ${quoteSummary.total}건`,
      note: `진행중 ${quoteSummary.active}건 · 종료견적 ${quoteSummary.closed}건 · 미선택견적 ${quoteSummary.unselected}건`,
      action: "customer-quotes",
      className: "quote-summary-card",
    },
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청", action: "pending-applications" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 판매자 계정", action: "approved-sellers" },
    { label: "판매자 접속", value: `오늘 ${todaySellerAccess}명`, note: `오늘 로그인 ${todaySellerLogins}회 · 최근 7일 ${weekSellerAccess}명`, action: "seller-access" },
    { label: "알림톡 대기", value: `${readyMessages}건`, note: `발송 완료 ${sentMessages}건`, action: "ready-messages" },
    { label: "반려 신청", value: `${rejectedCount}건`, note: "반려 이력 보관", action: "rejected-applications" },
  ]
    .map((stat) => {
      const interactive = Boolean(stat.action);
      return `
        <article class="stat-card${interactive ? " stat-action" : ""} ${stat.className || ""}"${
          interactive ? ` data-stat-action="${stat.action}" role="button" tabindex="0"` : ""
        }>
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
          <p>${stat.note}</p>
        </article>
      `;
    })
    .join("");
}

function renderApplications() {
  const rows = getFilteredApplications();
  const selected = getSelectedApplication();
  selectedApplicationId = selected?.id || "";

  applicationList.innerHTML = rows.length
    ? rows.map((application) => `
      <button class="application-card${application.id === selectedApplicationId ? " is-active" : ""}" type="button" data-application-id="${escapeHTML(application.id)}">
        <div class="card-top">
          <div>
            <strong>${escapeHTML(sellerName(application) || application.sellerId)}</strong>
            <span>${escapeHTML(managerName(application))} · ${escapeHTML(formatPhoneNumber(application.phone))}</span>
          </div>
          <span class="status ${escapeHTML(application.status)}">${statusLabel(application.status)}</span>
        </div>
        <span>아이디 ${escapeHTML(application.sellerId)} · ${escapeHTML(application.branchRegion || "지역 미등록")}</span>
        <span>요청일 ${escapeHTML(formatDate(application.requestedAt))}</span>
      </button>
    `).join("")
    : `
      <div class="empty-state">
        <strong>표시할 판매자 신청이 없습니다.</strong>
        <p>판매자 등록 요청이 접수되면 이 목록에서 승인 또는 반려할 수 있습니다.</p>
      </div>
    `;

  renderApplicationDetail(selected);
}

function renderApplicationDetail(application) {
  if (!application) {
    applicationDetail.innerHTML = `
      <div class="empty-state">
        <strong>선택한 신청이 없습니다.</strong>
        <p>왼쪽 목록에서 판매자 신청을 선택해주세요.</p>
      </div>
    `;
    return;
  }

  const isPending = application.status === "pending";
  applicationDetail.innerHTML = `
    <div class="detail-top">
      <div>
        <span class="status ${escapeHTML(application.status)}">${statusLabel(application.status)}</span>
        <h2>${escapeHTML(sellerName(application) || application.sellerId)}</h2>
        <p class="meta-line">${escapeHTML(managerName(application))} · ${escapeHTML(formatPhoneNumber(application.phone))}</p>
      </div>
    </div>
    <div class="card-preview">
      ${application.cardImage ? `<img src="${application.cardImage}" alt="${escapeHTML(sellerName(application))} 명함 이미지" />` : "<span>등록된 명함 이미지가 없습니다.</span>"}
    </div>
    <dl class="detail-grid">
      <div><dt>판매자 아이디</dt><dd>${escapeHTML(application.sellerId)}</dd></div>
      <div><dt>채널</dt><dd>${escapeHTML(application.channel || "미입력")}</dd></div>
      <div><dt>지점명</dt><dd>${escapeHTML(application.branch || "미입력")}</dd></div>
      <div><dt>담당 지역</dt><dd>${escapeHTML(application.branchRegion || "미입력")}</dd></div>
      <div><dt>요청일</dt><dd>${escapeHTML(formatDate(application.requestedAt))}</dd></div>
      <div><dt>검토일</dt><dd>${escapeHTML(formatDate(application.reviewedAt))}</dd></div>
    </dl>
    <div class="memo-box">
      <span>요청 메모</span>
      <p>${escapeHTML(application.memo || "추가 메모 없음")}</p>
    </div>
    <div class="review-form">
      <label>
        검토 메모
        <textarea id="reviewMemo" rows="4" placeholder="승인 또는 반려 사유를 입력하세요.">${escapeHTML(application.reviewMemo || "")}</textarea>
      </label>
      <div class="detail-actions">
        <button class="primary-btn" type="button" data-approve-application="${escapeHTML(application.id)}" ${isPending ? "" : "disabled"}>승인</button>
        <button class="danger-btn" type="button" data-reject-application="${escapeHTML(application.id)}" ${isPending ? "" : "disabled"}>반려</button>
        <button class="ghost-btn" type="button" data-queue-application-talk="${escapeHTML(application.id)}" ${application.status === "rejected" ? "" : "disabled"}>반려 알림 재발송</button>
      </div>
    </div>
  `;
}

function approveApplication(applicationId) {
  const applications = getApplications();
  const application = applications.find((row) => row.id === applicationId);
  if (!application || application.status !== "pending") return;

  const memo = document.querySelector("#reviewMemo")?.value.trim() || "승인되었습니다.";
  const approvedSellers = getApprovedSellers();
  const exists = approvedSellers.some((seller) => seller.sellerId === application.sellerId);
  const reviewedAt = new Date().toISOString();

  if (!exists) {
    const { password, ...safeApplication } = application;
    approvedSellers.unshift({
      ...safeApplication,
      status: "approved",
      reviewedAt,
      reviewMemo: memo,
      approvedAt: reviewedAt,
    });
    setApprovedSellers(approvedSellers);
  }

  Object.assign(application, { status: "approved", reviewedAt, reviewMemo: memo });
  setApplications(applications);
  showToast("판매자 신청을 승인했습니다.");
  renderAll();
  syncApplicationStatusToServer(application.id, "approved", memo);
}

function rejectApplication(applicationId) {
  const applications = getApplications();
  const application = applications.find((row) => row.id === applicationId);
  if (!application || application.status !== "pending") return;

  const memo = document.querySelector("#reviewMemo")?.value.trim() || "등록 정보 확인이 필요합니다.";
  Object.assign(application, { status: "rejected", reviewedAt: new Date().toISOString(), reviewMemo: memo });
  setApplications(applications);
  showToast("판매자 신청을 반려했습니다. 반려 알림은 필요 시 수동 발송하세요.");
  renderAll();
  syncApplicationStatusToServer(application.id, "rejected", memo);
}

async function queueManualApplicationTalk(applicationId) {
  const application = getApplications().find((row) => row.id === applicationId);
  if (!application) return;
  const memo = document.querySelector("#reviewMemo")?.value.trim() || application.reviewMemo || "등록 정보 확인이 필요합니다.";
  if (application.status !== "rejected") {
    showToast("반려 처리된 신청만 반려 알림톡을 발송할 수 있습니다.");
    return;
  }

  const saved = await queueAlimtalk({
    type: "seller-rejected",
    targetRole: "seller",
    targetName: application.manager,
    targetPhone: application.phone,
    title: "판매자 등록 반려 안내",
    body: `${sellerName(application)} 등록 신청이 반려되었습니다. 사유: ${memo}`,
    relatedId: application.id,
    variables: {
      "#{판매자명}": sellerName(application),
      "#{채널}": application.channel || "",
      "#{지점명}": application.branch || "",
      "#{매니저명}": application.manager || "",
      "#{반려사유}": memo,
    },
  });

  showToast(saved ? "반려 알림톡을 서버 발송 대기열에 추가했습니다." : "반려 알림톡을 임시 저장했습니다.");
  renderAll();
}

function renderApprovedSellers() {
  const approved = getApprovedSellers();
  const headerRow = approvedSellerRows.closest("table")?.querySelector("thead tr");
  if (headerRow && headerRow.children.length < 5) {
    const manageHeader = document.createElement("th");
    manageHeader.textContent = "관리";
    headerRow.appendChild(manageHeader);
  }

  approvedSellerRows.innerHTML = approved.length
    ? approved.map((seller) => `
      <tr>
        <td>${escapeHTML(sellerName(seller))}<small>${escapeHTML(formatPhoneNumber(seller.phone))}</small></td>
        <td>${escapeHTML(seller.manager || "-")}<small>${escapeHTML(seller.managerPosition || "직책 미등록")}</small></td>
        <td>${escapeHTML(seller.branchRegion || "지역 미등록")}</td>
        <td>${escapeHTML(seller.sellerId || "-")}</td>
        <td>
          <div class="table-actions">
            <button class="plain-btn small-btn" type="button" data-edit-approved-seller="${escapeHTML(seller.id)}">정보 수정</button>
            <button class="plain-btn small-btn" type="button" data-reset-approved-password="${escapeHTML(seller.id)}">비밀번호 초기화</button>
            <button class="danger-btn small-btn" type="button" data-delete-approved-seller="${escapeHTML(seller.id)}">삭제</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">아직 승인된 판매자가 없습니다.</td></tr>`;
}

const ADMIN_QUOTE_RECEIVE_HOURS = 72;

function getAdminQuoteDeadline(quote) {
  if (quote?.quoteExpiresAt) return new Date(quote.quoteExpiresAt);
  if (!quote?.createdAt) return null;
  const deadline = new Date(quote.createdAt);
  deadline.setHours(deadline.getHours() + ADMIN_QUOTE_RECEIVE_HOURS);
  return deadline;
}

function getAdminQuoteRemainingLabel(quote) {
  if (quote?.selectedBidId) return "선택 완료";
  const deadline = getAdminQuoteDeadline(quote);
  if (!deadline || Number.isNaN(deadline.getTime())) return "시간 확인 중";
  const remainingMs = deadline.getTime() - Date.now();
  if (remainingMs <= 0 || quote.status === "closed") return "견적 종료";
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days > 0 ? `${days}일 ` : ""}${hours}시간 ${minutes}분 ${seconds}초`;
}

function updateAdminQuoteCountdowns() {
  const quotes = getCustomerQuotes();
  document.querySelectorAll("[data-admin-quote-countdown]").forEach((element) => {
    const quote = quotes.find((item) => String(item.id || "") === String(element.dataset.quoteId || ""));
    if (!quote) return;
    const status = quoteStatusMeta(quote);
    element.textContent = `남은 시간 ${getAdminQuoteRemainingLabel(quote)}`;
    element.classList.toggle("quote-expired", status.className === "quote-closed");
  });
  document.querySelectorAll("[data-admin-quote-status]").forEach((element) => {
    const quote = quotes.find((item) => String(item.id || "") === String(element.dataset.quoteId || ""));
    if (!quote) return;
    const status = quoteStatusMeta(quote);
    element.textContent = `견적 상태 · ${status.label}`;
    element.className = `status ${status.className}`;
    element.dataset.adminQuoteStatus = "";
    element.dataset.quoteId = quote.id;
  });
  const summary = summarizeCustomerQuotes(quotes);
  const nextSummaryKey = `${summary.total}:${summary.active}:${summary.closed}:${summary.unselected}`;
  if (adminQuoteSummaryKey && adminQuoteSummaryKey !== nextSummaryKey) renderStatsCards();
  adminQuoteSummaryKey = nextSummaryKey;
}

function startAdminQuoteCountdownTimer() {
  if (adminQuoteCountdownTimer) return;
  updateAdminQuoteCountdowns();
  adminQuoteCountdownTimer = window.setInterval(updateAdminQuoteCountdowns, 1000);
}

function quoteStatusMeta(quote) {
  const now = Date.now();
  const deadline = getAdminQuoteDeadline(quote);
  const expiresAt = deadline && !Number.isNaN(deadline.getTime()) ? deadline.getTime() : 0;
  if (quote.selectedBidId || quote.status === "selected") {
    return { label: "선택완료", className: "quote-selected", note: "고객님이 판매자 제안을 선택했습니다." };
  }
  if (quote.status === "closed" || (expiresAt && expiresAt <= now)) {
    return { label: "시간마감", className: "quote-closed", note: "견적 제안 시간이 종료되었습니다." };
  }
  if (Number(quote.bidCount || quote.bidsCount || 0) > 0 || quote.hasBids || (Array.isArray(quote.bids) && quote.bids.length)) {
    return { label: "제안 선택중", className: "quote-choosing", note: "고객님이 받은 제안을 검토 중입니다." };
  }
  return { label: "견적제안 중", className: "quote-bidding", note: "판매자가 제안할 수 있는 상태입니다." };
}

function renderQuoteBidSummary(quote) {
  const bids = Array.isArray(quote.bids) ? quote.bids : [];
  const sortedBids = [...bids].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  const lowestBid = sortedBids[0];
  const selectedBid = sortedBids.find((bid) => bid.id === quote.selectedBidId);
  const summaryText = sortedBids.length
    ? `제안 ${sortedBids.length}건 · 최저 ${formatWon(lowestBid?.price)}`
    : "제안 0건";

  return `
    <details class="quote-bid-summary">
      <summary>
        <span>${escapeHTML(summaryText)}</span>
        ${selectedBid ? `<strong>선택 매니저 ${escapeHTML(selectedBid.manager || selectedBid.seller || "-")}</strong>` : ""}
      </summary>
      ${
        sortedBids.length
          ? `<div class="quote-bid-list">
              ${sortedBids
                .map((bid, index) => {
                  const isSelected = bid.id === quote.selectedBidId;
                  const managerLabel = [bid.manager, bid.managerPosition].filter(Boolean).join(" ");
                  const branchLabel = [bid.channel, bid.branch].filter(Boolean).join(" ");
                  return `
                    <article class="quote-bid-row ${isSelected ? "is-selected" : ""}">
                      <div>
                        <strong>${index + 1}위 · ${escapeHTML(formatWon(bid.price))}</strong>
                        <p>${escapeHTML(branchLabel || bid.seller || "판매자 정보 없음")}</p>
                      </div>
                      <div>
                        <span>${escapeHTML(managerLabel || "매니저 미입력")}</span>
                        <small>${escapeHTML(formatPhoneNumber(bid.phone) || "연락처 미입력")}</small>
                      </div>
                      <p>${escapeHTML(bid.benefits || "제공 조건 미입력")}</p>
                      ${isSelected ? `<em>고객님 선택</em>` : ""}
                    </article>
                  `;
                })
                .join("")}
            </div>`
          : `<p class="quote-bid-empty">아직 판매자 제안이 없습니다.</p>`
      }
    </details>
  `;
}

function normalizeCustomerQuoteSearchValue(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s-]+/g, "");
}

function customerQuoteMatchesSearch(quote, searchTerm) {
  const normalizedSearch = normalizeCustomerQuoteSearchValue(searchTerm);
  if (!normalizedSearch) return true;

  const textCandidates = [
    quote.quoteNumber,
    quote.customer,
    quote.phone,
    quote.id,
  ].map(normalizeCustomerQuoteSearchValue);

  if (textCandidates.some((candidate) => candidate.includes(normalizedSearch))) return true;

  const phoneDigits = String(searchTerm || "").replace(/\D/g, "");
  return Boolean(phoneDigits) && normalizePhone(quote.phone).includes(phoneDigits);
}

function renderCustomerQuotes() {
  if (!customerQuoteList) return;
  const allQuotes = getCustomerQuotes();
  const searchTerm = customerQuoteSearchTerm.trim();
  const quotes = searchTerm
    ? allQuotes.filter((quote) => customerQuoteMatchesSearch(quote, searchTerm))
    : allQuotes;

  if (customerQuoteSearch && customerQuoteSearch.value !== customerQuoteSearchTerm) {
    customerQuoteSearch.value = customerQuoteSearchTerm;
  }
  if (customerQuoteSearchClear) customerQuoteSearchClear.hidden = !searchTerm;
  if (customerQuoteSearchSummary) {
    customerQuoteSearchSummary.textContent = searchTerm
      ? `검색 결과 ${quotes.length}건 · 전체 ${allQuotes.length}건`
      : `전체 ${allQuotes.length}건`;
  }

  customerQuoteList.innerHTML = quotes.length
    ? quotes.map((quote) => {
      const status = quoteStatusMeta(quote);
      const imagesCount = Number(quote.imagesCount || quote.quoteImageCount || (quote.image ? 1 : 0));
      const quoteTypeLabel = quote.quoteType === "without_quote"
        ? "견적서 없음"
        : quote.quoteType === "with_quote"
          ? "견적서 있음"
          : "유형 미입력";
      return `
        <article class="quote-admin-card">
          <div class="quote-admin-thumb">
            ${quote.image || quote.thumbnailImage ? `<img src="${escapeHTML(quote.image || quote.thumbnailImage)}" alt="대표 견적 이미지" data-admin-quote-image data-fallback-src="${escapeHTML(quote.thumbnailImage || "")}" />` : `<span>이미지 없음</span>`}
          </div>
          <div class="quote-admin-body">
            <div class="quote-admin-head">
              <div>
                <strong>${escapeHTML(quote.items || "품목 미입력")}</strong>
                <p>${escapeHTML(quote.customer || "-")} · ${escapeHTML(formatPhoneNumber(quote.phone))}</p>
              </div>
              <span class="status ${status.className}" data-admin-quote-status data-quote-id="${escapeHTML(quote.id)}">견적 상태 · ${status.label}</span>
            </div>
            <div class="quote-admin-meta">
              <span>견적번호 ${escapeHTML(quote.quoteNumber || "-")}</span>
              <span>${escapeHTML(quoteTypeLabel)}</span>
              <span>브랜드 ${escapeHTML(quote.desiredBrand || "미입력")}</span>
              <span>지역 ${escapeHTML(quote.region || "미입력")}</span>
              <span>등록 ${escapeHTML(formatDate(quote.createdAt))}</span>
              <span>전체 이미지 ${imagesCount}장 · 7일 보관</span>
              <span>제안 ${escapeHTML(String(quote.bidCount || quote.bidsCount || 0))}건</span>
              <span data-admin-quote-countdown data-quote-id="${escapeHTML(quote.id)}">남은 시간 ${escapeHTML(getAdminQuoteRemainingLabel(quote))}</span>
            </div>
            <p>${escapeHTML(quote.memo || "추가 요청 없음")}</p>
            ${renderQuoteBidSummary(quote)}
            <div class="quote-admin-actions">
              <button class="plain-btn small-btn" type="button" data-replace-customer-quote-image="${escapeHTML(quote.id)}">견적 이미지 교체</button>
              <button class="plain-btn small-btn" type="button" data-edit-customer-quote="${escapeHTML(quote.id)}">정보 수정</button>
              <button class="danger-btn small-btn" type="button" data-delete-customer-quote="${escapeHTML(quote.id)}">견적 삭제</button>
            </div>
          </div>
        </article>
      `;
    }).join("")
    : searchTerm && allQuotes.length
      ? `
        <div class="empty-state">
          <strong>검색 결과가 없습니다.</strong>
          <p>견적번호, 고객명 또는 휴대전화번호를 다시 확인해주세요.</p>
        </div>
      `
      : `
        <div class="empty-state">
          <strong>아직 서버에 저장된 고객 견적이 없습니다.</strong>
          <p>${escapeHTML(customerQuoteSyncError || "노출용에서 고객 견적이 등록되면 이곳에 저장 현황과 알림톡 상태가 표시됩니다.")}</p>
        </div>
      `;
  renderDeletedQuoteLogs();
}

function renderLplanSyncPanel() {
  if (!lplanSyncSummary || !lplanSyncList) return;
  const rows = getLplanTrainingQuotes();
  const summary = getLplanTrainingSummary();
  const latestSyncedAt = summary.latestSyncedAt || rows[0]?.syncedAt || "";
  const total = Number(summary.total || rows.length || 0);
  const branchRows = getLplanBranchSummary(rows, summary);
  const checkedAtText = lplanLastCheckedAt ? formatDate(lplanLastCheckedAt) : "자동 확인 대기";

  lplanSyncSummary.innerHTML = `
    <article>
      <span>현재 엘플랜 저장 견적</span>
      <strong>${escapeHTML(String(total))}건</strong>
    </article>
    <article>
      <span>최근 동기화</span>
      <strong>${escapeHTML(latestSyncedAt ? formatDate(latestSyncedAt) : "기록 없음")}</strong>
    </article>
    <article>
      <span>실시간 확인</span>
      <strong>${escapeHTML(lplanSyncing ? "확인 중" : checkedAtText)}</strong>
    </article>
  `;

  if (lplanBranchSummary) {
    lplanBranchSummary.innerHTML = branchRows.length
      ? `
        <div class="lplan-branch-head">
          <strong>지점별 학습 데이터</strong>
          <span>서버에 동기화된 엘플랜 견적 기준입니다.</span>
        </div>
        <div class="lplan-branch-chips">
          ${branchRows.map((item) => `
            <span>
              ${escapeHTML(item.branch || "지점 미기록")}
              <b>${escapeHTML(String(item.count || 0))}건</b>
            </span>
          `).join("")}
        </div>
      `
      : `
        <div class="lplan-branch-head">
          <strong>지점별 학습 데이터</strong>
          <span>아직 서버에 동기화된 엘플랜 견적이 없습니다.</span>
        </div>
      `;
  }

  if (lplanSyncError && !rows.length) {
    lplanSyncList.innerHTML = `
      <div class="empty-state">
        <strong>엘플랜 동기화 확인이 필요합니다.</strong>
        <p>${escapeHTML(lplanSyncError)}</p>
      </div>
    `;
    return;
  }

  lplanSyncList.innerHTML = rows.length
    ? rows.map((row) => {
      const modelRows = Array.isArray(row.rows) ? row.rows : [];
      const previewModels = modelRows
        .map((item) => item.model)
        .filter(Boolean)
        .slice(0, 6);
      return `
        <article class="lplan-sync-card">
          <div>
            <strong>${escapeHTML(row.title || row.comboKey || row.sourceQuoteId || "엘플랜 저장 견적")}</strong>
            <p><b>${escapeHTML(row.branch || "지점 미기록")}</b> · ${escapeHTML(row.membershipType || "구분 미기록")} · 품목 ${escapeHTML(String(row.itemCount || modelRows.length || 0))}개</p>
          </div>
          <dl>
            <div><dt>지점</dt><dd>${escapeHTML(row.branch || "지점 미기록")}</dd></div>
            <div><dt>저장일</dt><dd>${escapeHTML(formatDate(row.sourceSavedAt))}</dd></div>
            <div><dt>동기화</dt><dd>${escapeHTML(formatDate(row.syncedAt))}</dd></div>
          </dl>
          <p class="lplan-models">${escapeHTML(previewModels.length ? previewModels.join(" · ") : "모델명 미기록")}</p>
        </article>
      `;
    }).join("")
    : `
      <div class="empty-state">
        <strong>아직 엘플랜 동기화 자료가 없습니다.</strong>
        <p>엘플랜에서 견적 저장 시 개인정보를 제외한 모델 구성 데이터가 전송되면 이곳에 표시됩니다.</p>
      </div>
    `;
}

function renderDeletedQuoteLogs() {
  if (!deletedQuoteList) return;
  const logs = getDeletedQuoteLogs();
  deletedQuoteList.innerHTML = logs.length
    ? logs.map((log) => `
      <article class="deleted-log-row">
        <strong>${escapeHTML(log.customer || "-")} · ${escapeHTML(formatPhoneNumber(log.phone))}</strong>
        <span>${escapeHTML(log.reason || "삭제 사유 없음")}</span>
        <small>${escapeHTML(formatDate(log.deletedAt || log.createdAt))}</small>
      </article>
    `).join("")
    : `
      <div class="empty-state small">
        <strong>삭제된 견적 기록이 없습니다.</strong>
        <p>관리자가 견적을 삭제하면 고객명, 연락처, 삭제 사유만 남습니다.</p>
      </div>
    `;
}

function summarizeSolapiResponse(message) {
  if (!message?.solapiResponseJson) return "";
  try {
    const response = JSON.parse(message.solapiResponseJson);
    const firstMessage = Array.isArray(response.messageList) ? response.messageList[0] : null;
    return [
      response.groupId && `그룹 ${response.groupId}`,
      firstMessage?.messageId && `메시지 ${firstMessage.messageId}`,
      firstMessage?.statusCode && `상태 ${firstMessage.statusCode}`,
      response.message && `메시지 ${response.message}`,
    ].filter(Boolean).join(" · ");
  } catch (error) {
    return String(message.solapiResponseJson).slice(0, 140);
  }
}

function renderMessages() {
  const messages = getFilteredMessages();
  messageList.innerHTML = messages.length
    ? messages.map((message) => {
      const solapiSummary = summarizeSolapiResponse(message);
      return `
        <article class="message-card">
          <div class="message-top">
            <div>
              <strong>${escapeHTML(message.title || "알림톡")}</strong>
              <span>${escapeHTML(message.targetName || message.targetRole || "-")} · ${escapeHTML(formatPhoneNumber(message.targetPhone))}</span>
            </div>
            <span class="status ${escapeHTML(message.status)}">${statusLabel(message.status)}</span>
          </div>
          <p>${escapeHTML(message.body || "")}</p>
          <p class="meta-line">템플릿 ${escapeHTML(message.templateId || "미지정")}</p>
          ${message.errorMessage ? `<p class="error-line">실패 사유: ${escapeHTML(message.errorMessage)}</p>` : ""}
          ${solapiSummary ? `<p class="meta-line">솔라피 응답: ${escapeHTML(solapiSummary)}</p>` : ""}
          <span class="meta-line">작성 ${escapeHTML(formatDate(message.createdAt))}${message.sentAt ? ` · 발송 ${escapeHTML(formatDate(message.sentAt))}` : ""}</span>
          <div class="message-actions">
            <button class="ghost-btn" type="button" data-resend-message="${escapeHTML(message.id)}">재발송 요청</button>
            <button class="ghost-btn" type="button" data-refresh-message="${escapeHTML(message.id)}">상태 확인</button>
            <button class="danger-btn small-btn" type="button" data-delete-message="${escapeHTML(message.id)}">삭제</button>
          </div>
        </article>
      `;
    }).join("")
    : `
      <div class="empty-state">
        <strong>표시할 알림톡이 없습니다.</strong>
        <p>견적 등록, 제안 도착, 판매자 등록 요청 등 자동 발송 기록이 이곳에 표시됩니다.</p>
      </div>
    `;
}

function updateMessage(messageId, updater) {
  const messages = getMessages();
  const message = messages.find((row) => row.id === messageId);
  if (!message) return;
  updater(message, messages);
  setMessages(messages);
  renderAll();
}

async function resetApprovedSellerPassword(sellerId) {
  const seller = getApprovedSellers().find((row) => row.id === sellerId);
  if (!seller) return;
  const nextPassword = window.prompt(`${sellerName(seller) || seller.sellerId} 새 비밀번호를 입력해주세요.`, "");
  if (nextPassword === null) return;
  if (String(nextPassword).trim().length < 4) {
    showToast("새 비밀번호는 4자리 이상으로 입력해주세요.");
    return;
  }
  const ok = await syncApprovedSellerPasswordToServer(sellerId, String(nextPassword).trim());
  if (ok) await loadAdminDataFromServer();
  showToast(ok ? "비밀번호가 초기화되었습니다." : "비밀번호 초기화에 실패했습니다.");
  renderAll();
}

async function saveApprovedSellerPosition(sellerId) {
  const input = document.querySelector(`[data-approved-position-input="${CSS.escape(sellerId)}"]`);
  const seller = getApprovedSellers().find((row) => row.id === sellerId);
  if (!input || !seller) return;
  const managerPosition = input.value.trim();
  const ok = await syncApprovedSellerPositionToServer(sellerId, managerPosition);
  showToast(ok ? "판매자 직책을 변경했습니다." : "판매자 직책 변경에 실패했습니다.");
}

async function deleteApprovedSeller(sellerId) {
  const seller = getApprovedSellers().find((row) => row.id === sellerId);
  if (!seller) return;
  const confirmed = window.confirm(`${sellerName(seller) || seller.sellerId} 판매자를 삭제할까요?\n삭제하면 해당 아이디로 판매자 로그인을 할 수 없습니다.`);
  if (!confirmed) return;
  const ok = await syncApprovedSellerDeleteToServer(sellerId);
  showToast(ok ? "승인 판매자를 삭제했습니다." : "승인 판매자 삭제에 실패했습니다.");
}

async function deleteCustomerQuote(quoteId) {
  const quote = getCustomerQuotes().find((row) => row.id === quoteId);
  if (!quote) return;
  const reason = await openAdminTextModal({
    eyebrow: "Delete Quote",
    title: "고객 견적 삭제",
    description: `${quote.customer || "고객"}님의 견적을 서버에서 완전히 삭제합니다. 삭제 후에는 견적, 이미지, 제안, 후기를 복구할 수 없고 고객명, 연락처, 삭제 사유만 기록됩니다.`,
    label: "삭제 사유",
    multiline: true,
    confirmText: "견적 삭제",
    danger: true,
  });
  if (reason === null) return;
  const trimmedReason = String(reason).trim();
  if (trimmedReason.length < 2) {
    showToast("삭제 사유를 입력해야 견적을 삭제할 수 있습니다.");
    return;
  }
  const ok = await syncCustomerQuoteDeleteToServer(quoteId, trimmedReason);
  showToast(ok ? "고객 견적을 삭제하고 사유를 기록했습니다." : "고객 견적 삭제에 실패했습니다.");
}

async function submitCustomerQuoteEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const quoteId = form.quoteId.value;
  const payload = {
    customer: form.customer.value.trim(),
    phone: form.phone.value,
    items: form.items.value.trim(),
    purchasePurpose: form.purchasePurpose.value,
    desiredBrand: form.desiredBrand.value,
    price: Number(form.price.value || 0),
    region: form.region.value.trim(),
    memo: form.memo.value.trim(),
  };
  if (!payload.customer || !normalizePhone(payload.phone) || !payload.items) {
    showToast("고객명, 연락처, 품목은 필수입니다.");
    return;
  }
  const ok = await syncCustomerQuoteUpdateToServer(quoteId, payload);
  if (ok) {
    closeAdminModals();
    showToast("고객 견적 정보를 서버에 저장했습니다.");
  }
}

async function submitApprovedSellerEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const sellerId = form.sellerId.value;
  const payload = {
    channel: form.channel.value,
    branch: form.branch.value.trim(),
    branchRegion: form.branchRegion.value.trim(),
    manager: form.manager.value.trim(),
    managerPosition: form.managerPosition.value.trim(),
    phone: form.phone.value,
    memo: form.memo.value.trim(),
  };
  if (!payload.channel || !payload.branch || !payload.manager || !normalizePhone(payload.phone)) {
    showToast("채널, 지점명, 매니저명, 연락처는 필수입니다.");
    return;
  }
  const ok = await syncApprovedSellerUpdateToServer(sellerId, payload);
  if (ok) {
    closeAdminModals();
    showToast("승인 판매자 정보를 서버에 저장했습니다.");
  }
}

function scrollToAdminSection(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openStatAction(action) {
  if (action === "customer-quotes") {
    navigateAdminPage("customers");
    return;
  }

  if (action === "pending-applications") {
    applicationFilter = "pending";
    selectedApplicationId = "";
    navigateAdminPage("sellers");
    return;
  }

  if (action === "approved-sellers") {
    navigateAdminPage("approvedSellers");
    return;
  }

  if (action === "seller-access") {
    navigateAdminPage("sellerAccess");
    return;
  }

  if (action === "ready-messages") {
    messageFilter = "all";
    navigateAdminPage("alimtalk");
    return;
  }

  if (action === "rejected-applications") {
    applicationFilter = "rejected";
    selectedApplicationId = "";
    navigateAdminPage("sellers");
  }
}

function renderAll() {
  renderStatsCards();
  renderLplanSyncPanel();
  renderCustomerQuotes();
  renderApplications();
  renderApprovedSellers();
  renderSellerAccessLogs();
  renderMessages();
  applyAdminPageView();
  startAdminQuoteCountdownTimer();

  document.querySelectorAll("[data-application-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.applicationFilter === applicationFilter);
  });
  document.querySelectorAll("[data-message-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.messageFilter === messageFilter);
  });
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-admin-text-cancel]") || event.target === adminTextModal) {
    closeAdminTextModal(null);
    return;
  }

  if (event.target.closest("#customerQuoteSearchClear")) {
    customerQuoteSearchTerm = "";
    if (customerQuoteSearch) {
      customerQuoteSearch.value = "";
      customerQuoteSearch.focus();
    }
    renderCustomerQuotes();
    return;
  }

  const statAction = event.target.closest("[data-stat-action]");
  if (statAction) {
    openStatAction(statAction.dataset.statAction);
    return;
  }

  const applicationCard = event.target.closest("[data-application-id]");
  if (applicationCard) {
    selectedApplicationId = applicationCard.dataset.applicationId;
    renderApplications();
    return;
  }

  const applicationFilterButton = event.target.closest("[data-application-filter]");
  if (applicationFilterButton) {
    applicationFilter = applicationFilterButton.dataset.applicationFilter;
    selectedApplicationId = "";
    renderAll();
    return;
  }

  const messageFilterButton = event.target.closest("[data-message-filter]");
  if (messageFilterButton) {
    messageFilter = messageFilterButton.dataset.messageFilter;
    renderAll();
    return;
  }

  const resendMessageButton = event.target.closest("[data-resend-message]");
  if (resendMessageButton) {
    resendMessage(resendMessageButton.dataset.resendMessage);
    return;
  }

  const refreshMessageButton = event.target.closest("[data-refresh-message]");
  if (refreshMessageButton) {
    refreshMessageStatus(refreshMessageButton.dataset.refreshMessage);
    return;
  }

  const deleteMessageButton = event.target.closest("[data-delete-message]");
  if (deleteMessageButton) {
    deleteMessage(deleteMessageButton.dataset.deleteMessage);
    return;
  }

  const approveButton = event.target.closest("[data-approve-application]");
  if (approveButton) {
    approveApplication(approveButton.dataset.approveApplication);
    return;
  }

  const rejectButton = event.target.closest("[data-reject-application]");
  if (rejectButton) {
    rejectApplication(rejectButton.dataset.rejectApplication);
    return;
  }

  const queueTalkButton = event.target.closest("[data-queue-application-talk]");
  if (queueTalkButton) {
    queueManualApplicationTalk(queueTalkButton.dataset.queueApplicationTalk);
    return;
  }

  const resetApprovedPasswordButton = event.target.closest("[data-reset-approved-password]");
  if (resetApprovedPasswordButton) {
    resetApprovedSellerPassword(resetApprovedPasswordButton.dataset.resetApprovedPassword);
    return;
  }

  const saveApprovedPositionButton = event.target.closest("[data-save-approved-position]");
  if (saveApprovedPositionButton) {
    saveApprovedSellerPosition(saveApprovedPositionButton.dataset.saveApprovedPosition);
    return;
  }

  const editApprovedSellerButton = event.target.closest("[data-edit-approved-seller]");
  if (editApprovedSellerButton) {
    openEditApprovedSellerModal(editApprovedSellerButton.dataset.editApprovedSeller);
    return;
  }

  const deleteApprovedSellerButton = event.target.closest("[data-delete-approved-seller]");
  if (deleteApprovedSellerButton) {
    deleteApprovedSeller(deleteApprovedSellerButton.dataset.deleteApprovedSeller);
    return;
  }

  const replaceCustomerQuoteImageButton = event.target.closest("[data-replace-customer-quote-image]");
  if (replaceCustomerQuoteImageButton) {
    replaceCustomerQuoteImage(replaceCustomerQuoteImageButton.dataset.replaceCustomerQuoteImage);
    return;
  }

  const deleteCustomerQuoteButton = event.target.closest("[data-delete-customer-quote]");
  if (deleteCustomerQuoteButton) {
    deleteCustomerQuote(deleteCustomerQuoteButton.dataset.deleteCustomerQuote);
    return;
  }

  const editCustomerQuoteButton = event.target.closest("[data-edit-customer-quote]");
  if (editCustomerQuoteButton) {
    openEditCustomerQuoteModal(editCustomerQuoteButton.dataset.editCustomerQuote);
    return;
  }

  const forceLplanSyncButton = event.target.closest("[data-force-lplan-sync]");
  if (forceLplanSyncButton) {
    forceLplanTrainingSync();
    return;
  }

  const closeModalButton = event.target.closest("[data-close-admin-modal]");
  if (closeModalButton || event.target.classList.contains("admin-modal")) {
    closeAdminModals();
  }
});

document.addEventListener("input", (event) => {
  if (event.target === customerQuoteSearch) {
    customerQuoteSearchTerm = event.target.value;
    renderCustomerQuotes();
    return;
  }
  if (!event.target.matches("[data-phone-edit]")) return;
  event.target.value = formatPhoneNumber(event.target.value);
});

editCustomerQuoteForm?.addEventListener("submit", submitCustomerQuoteEdit);
editApprovedSellerForm?.addEventListener("submit", submitApprovedSellerEdit);
adminTextModalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = adminTextModalTextarea.hidden ? adminTextModalInput.value : adminTextModalTextarea.value;
  closeAdminTextModal(value);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!adminTextModal.hidden) {
      closeAdminTextModal(null);
      return;
    }
    closeAdminModals();
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") return;

  const statAction = event.target.closest("[data-stat-action]");
  if (!statAction) return;

  event.preventDefault();
  openStatAction(statAction.dataset.statAction);
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-admin-nav], .dashboard-link-card");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  event.preventDefault();
  navigateAdminPage(link.dataset.adminNav || adminPageKeyFromPath(url.pathname));
});

window.addEventListener("popstate", () => {
  renderAll();
  window.scrollTo({ top: 0, behavior: "auto" });
});

applicationSearch.addEventListener("input", () => {
  selectedApplicationId = "";
  renderApplications();
});

sellerAccessSearch?.addEventListener("input", renderSellerAccessLogs);
sellerAccessDays?.addEventListener("change", async () => {
  const token = await requestAdminApiToken();
  if (!token) return;
  setAdminLoading(true, "판매자 접속 기록을 불러오는 중입니다.", "선택한 기간의 로그인 기록을 확인하고 있습니다.");
  try {
    const result = await loadSellerAccessLogsFromServer({ silent: true, days: sellerAccessDays.value });
    if (result?.ok && Array.isArray(result.rows)) {
      writeStorageArray(STORAGE_KEYS.sellerAccessLogs, result.rows);
      localStorage.setItem(STORAGE_KEYS.sellerAccessSummary, JSON.stringify(result.summary || {}));
      renderAll();
    } else {
      showToast(result?.message || "판매자 접속 기록을 불러오지 못했습니다.");
    }
  } finally {
    setAdminLoading(false);
  }
});

adminAuthBtn?.addEventListener("click", async () => {
  const token = await requestAdminApiToken(true);
  if (!token) return;
  const status = await apiJson("/api/auth-status", { silent: true });
  showToast(status?.ok
    ? `관리자 인증이 완료되었습니다. (${status.tokenSource === "cloudflare-secret" ? "Cloudflare Secret" : "기본 보안 토큰"})`
    : status?.message || "관리자 인증에 실패했습니다.");
  if (status?.ok) {
    await loadAdminDataFromServer();
    renderAll();
  }
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "갱신 중";
  try {
    await loadAdminDataFromServer();
    renderAll();
    showToast("관리자 데이터를 한 번에 다시 불러왔습니다.");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "새로고침";
  }
});


window.addEventListener("storage", (event) => {
  if (!Object.values(STORAGE_KEYS).includes(event.key)) return;
  renderAll();
});

const initialApplicationIdFromUrl = new URLSearchParams(window.location.search).get("applicationId") || "";
if (initialApplicationIdFromUrl) {
  selectedApplicationId = initialApplicationIdFromUrl;
  applicationFilter = "all";
}

updateLastRefreshedDisplay();
renderAll();
loadAdminDataFromServer().finally(renderAll);







document.addEventListener(
  "error",
  (event) => {
    const image = event.target?.closest?.("img[data-admin-quote-image]");
    if (!image) return;
    const fallback = image.dataset.fallbackSrc || "";
    if (fallback && image.src !== new URL(fallback, window.location.href).href && image.dataset.fallbackTried !== "true") {
      image.dataset.fallbackTried = "true";
      image.src = fallback;
      return;
    }
    const holder = image.closest(".quote-admin-thumb");
    if (holder) holder.innerHTML = "<span>이미지 형식을 표시하지 못했습니다.</span>";
  },
  true
);
