const STORAGE_KEYS = {
  sellerApplications: "pickquoteSellerApplications",
  approvedSellers: "pickquoteApprovedSellers",
  alimtalkQueue: "pickquoteAlimtalkQueue",
  customerQuotes: "pickquoteCustomerQuotes",
  deletedQuoteLogs: "pickquoteDeletedQuoteLogs",
};
const PUBLIC_API_BASE = "https://ga-pick.com";

let applicationFilter = "pending";
let messageFilter = "all";
let selectedApplicationId = "";
let messageSyncError = "";
const initialApplicationId = new URLSearchParams(window.location.search).get("application") || "";
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
const messageList = document.querySelector("#messageList");
const toast = document.querySelector("#toast");
const refreshBtn = document.querySelector("#refreshBtn");
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
    title: "관리 현황",
    heading: "운영 현황을 카테고리별로 확인하세요.",
    copy: "카드를 누르면 고객 견적, 판매자 신청, 승인 판매자, 알림톡 상태 페이지로 이동합니다.",
    visible: ["statGrid", "dashboardHome"],
  },
  customers: {
    path: "/customers",
    title: "고객 견적",
    heading: "고객 견적을 확인하고 필요한 정보를 수정하세요.",
    copy: "서버에 저장된 고객님 견적, 선택 상태, 삭제 이력을 관리합니다.",
    visible: ["customerQuotes"],
  },
  sellers: {
    path: "/sellers",
    title: "판매자 신청",
    heading: "판매자 등록 신청을 검토하세요.",
    copy: "신청 상세 정보를 확인하고 승인 또는 반려 처리를 진행합니다.",
    visible: ["sellerReview", "applications", "applicationDetail"],
  },
  approvedSellers: {
    path: "/approved-sellers",
    title: "승인 판매자",
    heading: "승인된 판매자 계정을 관리하세요.",
    copy: "채널, 지점, 매니저, 직책, 비밀번호 초기화와 계정 삭제를 관리합니다.",
    visible: ["adminSecondaryGrid", "approvedSellers"],
  },
  alimtalk: {
    path: "/alimtalk",
    title: "알림톡 상태",
    heading: "알림톡 발송 상태를 확인하세요.",
    copy: "발송 대기, 성공, 실패 이력을 확인하고 필요한 경우 재발송합니다.",
    visible: ["adminSecondaryGrid", "alimtalkControl"],
  },
};

const ADMIN_SECTION_IDS = [
  "statGrid",
  "dashboardHome",
  "customerQuotes",
  "sellerReview",
  "applications",
  "applicationDetail",
  "adminSecondaryGrid",
  "approvedSellers",
  "alimtalkControl",
];

function getCurrentAdminPageKey() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/customers") return "customers";
  if (pathname === "/sellers") return "sellers";
  if (pathname === "/approved-sellers") return "approvedSellers";
  if (pathname === "/alimtalk") return "alimtalk";
  return "dashboard";
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

function navigateAdminPage(pageKey) {
  const config = ADMIN_PAGE_CONFIG[pageKey] || ADMIN_PAGE_CONFIG.dashboard;
  window.location.href = config.path;
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
customerQuoteSection.className = "panel";
customerQuoteSection.id = "customerQuotes";
customerQuoteSection.innerHTML = `
  <div class="panel-head">
    <div>
      <p class="eyebrow">Customer Quotes</p>
      <h2>고객 견적 서버 저장 현황</h2>
    </div>
    <p class="panel-note">고객님 견적 저장 여부와 알림톡 발송 상태를 확인합니다.</p>
  </div>
  <div class="quote-admin-list" id="customerQuoteList"></div>
  <div class="deleted-quote-log">
    <h3>삭제된 견적 기록</h3>
    <div class="deleted-quote-list" id="deletedQuoteList"></div>
  </div>
`;
document.querySelector("#statGrid")?.insertAdjacentElement("afterend", customerQuoteSection);
const customerQuoteList = document.querySelector("#customerQuoteList");
const deletedQuoteList = document.querySelector("#deletedQuoteList");

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
        <label>구매사유<select name="purchasePurpose"></select></label>
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
        <label>지점 지역<input type="text" name="branchRegion" /></label>
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

function canUseApiServer() {
  return window.location.protocol !== "file:";
}

async function apiJson(path, options = {}) {
  if (!canUseApiServer()) return null;

  const method = String(options.method || "GET").toUpperCase();
  setAdminLoading(
    true,
    method === "GET" ? "관리자 데이터를 불러오는 중입니다." : "서버에 저장하는 중입니다.",
    method === "GET" ? "최신 운영 정보를 확인하고 있습니다." : "요청이 완료될 때까지 잠시만 기다려주세요."
  );

  try {
    const headers = {
      ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    };
    const response = await fetch(path, {
      cache: "no-store",
      headers,
      ...options,
    });
    if (!response.ok) throw new Error(`api request failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  } catch (error) {
    console.warn("API 요청에 실패했습니다.", error);
    return null;
  } finally {
    setAdminLoading(false);
  }
}

async function loadAlimtalkMessagesFromServer() {
  const timestamp = Date.now();
  const publicMessages = await apiJson(`${PUBLIC_API_BASE}/api/alimtalk?ts=${timestamp}`);
  if (publicMessages?.ok && Array.isArray(publicMessages.rows)) {
    messageSyncError = "";
    return publicMessages;
  }

  const localMessages = await apiJson(`/api/alimtalk?ts=${timestamp}`);
  if (localMessages?.ok && Array.isArray(localMessages.rows)) {
    messageSyncError = "";
    return localMessages;
  }

  messageSyncError = "알림톡 기록을 서버에서 불러오지 못했습니다. 새로고침 후에도 반복되면 배포 상태를 확인해주세요.";
  return null;
}

async function loadAdminDataFromServer() {
  const [applications, approvedSellers, messages, customerQuotes, deletedQuoteLogs] = await Promise.all([
    apiJson("/api/seller-applications"),
    apiJson("/api/approved-sellers"),
    loadAlimtalkMessagesFromServer(),
    apiJson("/api/customer-quotes"),
    apiJson("/api/deleted-quote-logs"),
  ]);

  if (applications?.ok && Array.isArray(applications.rows)) {
    writeStorageArray(STORAGE_KEYS.sellerApplications, applications.rows);
  }

  if (approvedSellers?.ok && Array.isArray(approvedSellers.rows)) {
    writeStorageArray(STORAGE_KEYS.approvedSellers, approvedSellers.rows);
  }

  if (messages?.ok && Array.isArray(messages.rows)) {
    writeStorageArray(STORAGE_KEYS.alimtalkQueue, messages.rows);
  }

  if (customerQuotes?.ok && Array.isArray(customerQuotes.rows)) {
    writeStorageArray(STORAGE_KEYS.customerQuotes, customerQuotes.rows);
  }

  if (deletedQuoteLogs?.ok && Array.isArray(deletedQuoteLogs.rows)) {
    writeStorageArray(STORAGE_KEYS.deletedQuoteLogs, deletedQuoteLogs.rows);
  }
}

async function syncApplicationStatusToServer(applicationId, status, reviewMemo) {
  const result = await apiJson(`/api/seller-applications/${encodeURIComponent(applicationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, reviewMemo }),
  });

  if (!result?.ok) return;
  await loadAdminDataFromServer();
  renderAll();
}

async function syncMessageStatusToServer(messageId, payload) {
  await apiJson(`/api/alimtalk/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function resendMessage(messageId) {
  const result = await apiJson(`${PUBLIC_API_BASE}/api/alimtalk/${encodeURIComponent(messageId)}/resend`, {
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
  const result = await apiJson(`${PUBLIC_API_BASE}/api/alimtalk/${encodeURIComponent(messageId)}/refresh`, {
    method: "POST",
  });
  if (result?.row) {
    updateMessage(messageId, (message) => Object.assign(message, result.row));
  } else {
    await loadAdminDataFromServer();
    renderAll();
  }
  showToast(result?.ok ? "솔라피 최종 상태를 확인했습니다." : result?.message || "솔라피 상태 확인에 실패했습니다.");
}

async function deleteMessage(messageId) {
  const result = await apiJson(`${PUBLIC_API_BASE}/api/alimtalk/${encodeURIComponent(messageId)}`, {
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
  const result = await apiJson(`/api/customer-quotes/${encodeURIComponent(quoteId)}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });

  if (!result?.ok) {
    showToast(result?.message || "고객 견적 삭제에 실패했습니다.");
    return false;
  }

  await loadAdminDataFromServer();
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
  const serverResult = await apiJson(`${PUBLIC_API_BASE}/api/alimtalk`, {
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
  const applications = getApplications();
  const approved = getApprovedSellers();
  const messages = getMessages();
  const pendingCount = applications.filter((row) => row.status === "pending").length;
  const readyMessages = messages.filter((row) => row.status === "ready").length;
  const acceptedMessages = messages.filter((row) => row.status === "accepted" || row.status === "sending").length;
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;

  statGrid.innerHTML = [
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 계정" },
    { label: "알림톡 상태", value: `${acceptedMessages + readyMessages}건`, note: `접수 ${acceptedMessages}건 · 완료 ${sentMessages}건` },
    { label: "반려 신청", value: `${rejectedCount}건`, note: "반려 이력 보관" },
  ]
    .map((stat) => {
      return `
        <article class="stat-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
          <p>${stat.note}</p>
        </article>
      `;
    })
    .join("");
}

function renderStats() {
  const applications = getApplications();
  const approved = getApprovedSellers();
  const messages = getMessages();
  const pendingCount = applications.filter((row) => row.status === "pending").length;
  const readyMessages = messages.filter((row) => row.status === "ready").length;
  const acceptedMessages = messages.filter((row) => row.status === "accepted" || row.status === "sending").length;
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;

  statGrid.innerHTML = [
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청", action: "pending-applications" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 계정", action: "approved-sellers" },
    { label: "알림톡 상태", value: `${acceptedMessages + readyMessages}건`, note: `접수 ${acceptedMessages}건 · 완료 ${sentMessages}건`, action: "ready-messages" },
    { label: "반려 신청", value: `${rejectedCount}건`, note: "반려 이력 보관", action: "rejected-applications" },
  ]
    .map((stat) => {
      return `
        <article class="stat-card stat-action" data-stat-action="${stat.action}" role="button" tabindex="0">
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
    ? rows
        .map((application) => {
          return `
            <button class="application-card${application.id === selectedApplicationId ? " is-active" : ""}" type="button" data-application-id="${application.id}">
              <div class="card-top">
                <div>
                  <strong>${escapeHTML(sellerName(application) || application.sellerId)}</strong>
                  <span>${escapeHTML(managerName(application))} · ${escapeHTML(formatPhoneNumber(application.phone))}</span>
                </div>
                <span class="status ${escapeHTML(application.status)}">${statusLabel(application.status)}</span>
              </div>
              <span>아이디 ${escapeHTML(application.sellerId)} · ${escapeHTML(application.branchRegion || "지역 미등록")}</span>
              <span>신청일 ${escapeHTML(formatDate(application.requestedAt))}</span>
            </button>
          `;
        })
        .join("")
    : `
      <div class="empty-state">
        <strong>표시할 판매자 신청이 없습니다.</strong>
        <p>판매자 등록 신청이 접수되면 이 목록에서 승인 또는 반려할 수 있습니다.</p>
      </div>
    `;

  renderApplicationDetail(selected);
}

function renderApplicationDetail(application) {
  if (!application) {
    applicationDetail.innerHTML = `
      <div class="empty-state">
        <strong>선택된 신청이 없습니다.</strong>
        <p>왼쪽 목록에서 판매자 신청을 선택하세요.</p>
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
      ${
        application.cardImage
          ? `<img src="${application.cardImage}" alt="${escapeHTML(sellerName(application))} 명함 이미지" />`
          : "<span>등록된 명함 이미지가 없습니다.</span>"
      }
    </div>

    <dl class="detail-grid">
      <div><dt>판매자 아이디</dt><dd>${escapeHTML(application.sellerId)}</dd></div>
      <div><dt>채널</dt><dd>${escapeHTML(application.channel || "미입력")}</dd></div>
      <div><dt>지점</dt><dd>${escapeHTML(application.branch || "미입력")}</dd></div>
      <div><dt>담당 지역</dt><dd>${escapeHTML(application.branchRegion || "미입력")}</dd></div>
      <div><dt>신청일</dt><dd>${escapeHTML(formatDate(application.requestedAt))}</dd></div>
      <div><dt>검토일</dt><dd>${escapeHTML(formatDate(application.reviewedAt))}</dd></div>
    </dl>

    <div class="memo-box">
      <span>신청 메모</span>
      <p>${escapeHTML(application.memo || "추가 메모 없음")}</p>
    </div>

    <div class="review-form">
      <label>
        검토 메모
        <textarea id="reviewMemo" rows="4" placeholder="승인 또는 반려 사유를 입력하세요.">${escapeHTML(application.reviewMemo || "")}</textarea>
      </label>
      <div class="detail-actions">
        <button class="primary-btn" type="button" data-approve-application="${application.id}" ${isPending ? "" : "disabled"}>승인</button>
        <button class="danger-btn" type="button" data-reject-application="${application.id}" ${isPending ? "" : "disabled"}>반려</button>
        <button class="ghost-btn" type="button" data-queue-application-talk="${application.id}" ${
          application.status === "rejected" ? "" : "disabled"
        }>반려 알림톡 재발송</button>
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
    approvedSellers.unshift({
      ...application,
      status: "approved",
      reviewedAt,
      reviewMemo: memo,
      approvedAt: reviewedAt,
    });
    setApprovedSellers(approvedSellers);
  }

  Object.assign(application, {
    status: "approved",
    reviewedAt,
    reviewMemo: memo,
  });
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
  Object.assign(application, {
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    reviewMemo: memo,
  });
  setApplications(applications);

  showToast("판매자 신청을 반려했습니다. 입력한 반려 사유로 알림톡을 발송합니다.");
  renderAll();
  syncApplicationStatusToServer(application.id, "rejected", memo);
}

async function queueManualApplicationTalk(applicationId) {
  const application = getApplications().find((row) => row.id === applicationId);
  if (!application) return;
  const memo = document.querySelector("#reviewMemo")?.value.trim() || application.reviewMemo || "등록 정보 확인이 필요합니다.";
  if (application.status !== "rejected") {
    showToast("반려 처리된 신청만 수동 알림톡을 작성할 수 있습니다.");
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

  showToast(saved ? "반려 알림톡을 서버 발송 대기에 추가했습니다." : "반려 알림톡을 임시 저장했습니다.");
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
    ? approved
        .map((seller) => {
          return `
            <tr>
              <td>${escapeHTML(sellerName(seller))}<small>${escapeHTML(formatPhoneNumber(seller.phone))}</small></td>
              <td>
                ${escapeHTML(seller.manager || "-")}
                <small>${escapeHTML(seller.managerPosition || "직책 미등록")}</small>
              </td>
              <td>${escapeHTML(seller.branchRegion || "지역 미등록")}</td>
              <td>${escapeHTML(seller.sellerId)}</td>
              <td>
                <div class="table-actions">
                  <button class="plain-btn small-btn" type="button" data-edit-approved-seller="${escapeHTML(seller.id)}">정보 수정</button>
                  <button class="plain-btn small-btn" type="button" data-reset-approved-password="${escapeHTML(seller.id)}">비밀번호 초기화</button>
                  <button class="danger-btn small-btn" type="button" data-delete-approved-seller="${escapeHTML(seller.id)}">삭제</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="5">아직 승인된 판매자가 없습니다.</td>
      </tr>
    `;
}

function isQuoteTimeExpired(quote) {
  const deadline = new Date(quote.quoteExpiresAt || "");
  return Boolean(quote.quoteExpiresAt && !Number.isNaN(deadline.getTime()) && deadline.getTime() <= Date.now());
}

function customerQuoteStatus(quote) {
  if (quote.selectedBidId) {
    return { label: "선택완료", className: "quote-selected", note: "고객님이 판매자 제안을 선택했습니다." };
  }

  const isClosed = quote.status === "closed" || isQuoteTimeExpired(quote);
  const bidCount = Number(quote.bidCount || 0);

  if (isClosed && bidCount > 0) {
    return { label: "제안 선택중", className: "quote-choosing", note: "제안 접수는 종료됐고 고객님 선택을 기다립니다." };
  }

  if (isClosed) {
    return { label: "시간마감", className: "quote-expired", note: "48시간 제안 가능 시간이 종료되었습니다." };
  }

  return { label: "견적제안 중", className: "quote-bidding", note: "판매자가 제안할 수 있는 상태입니다." };
}

function renderCustomerQuotes() {
  if (!customerQuoteList) return;

  const quotes = getCustomerQuotes();
  customerQuoteList.innerHTML = quotes.length
    ? quotes
        .map((quote) => {
          const status = customerQuoteStatus(quote);
          const imagesCount = Array.isArray(quote.images) ? quote.images.length : 0;
          const bidCount = Number(quote.bidCount || 0);
          return `
            <article class="quote-admin-card">
              <div class="quote-admin-thumb">
                ${
                  quote.thumbnailImage || quote.image
                    ? `<img src="${escapeHTML(quote.thumbnailImage || quote.image)}" alt="대표 견적 이미지" />`
                    : `<span>대표 이미지 없음</span>`
                }
              </div>
              <div class="quote-admin-body">
                <div class="message-top">
                  <div>
                    <strong>${escapeHTML(quote.items || "품목 미입력")}</strong>
                    <span>${escapeHTML(quote.customer || "고객님")} · ${escapeHTML(formatPhoneNumber(quote.phone))}</span>
                  </div>
                  <span class="status ${status.className}">견적 상태 · ${status.label}</span>
                </div>
                <div class="quote-admin-meta">
                  <span>견적번호 ${escapeHTML(quote.quoteNumber || "-")}</span>
                  <span>제안 ${bidCount}건</span>
                  <span>브랜드 ${escapeHTML(quote.desiredBrand || "미입력")}</span>
                  <span>지역 ${escapeHTML(quote.region || "미입력")}</span>
                  <span>저장 ${escapeHTML(formatDate(quote.createdAt))}</span>
                  <span>제안 가능 ${escapeHTML(formatDate(quote.quoteExpiresAt))}까지</span>
                  <span>전체 이미지 ${imagesCount}장 · 7일 보관</span>
                  <span>대표 이미지/고객 정보 1년 보관</span>
                </div>
                <p class="quote-admin-state-note">${escapeHTML(status.note)}</p>
                ${quote.memo ? `<p class="quote-admin-memo">${escapeHTML(quote.memo)}</p>` : ""}
                <div class="quote-admin-actions">
                  <button class="plain-btn small-btn" type="button" data-edit-customer-quote="${escapeHTML(quote.id)}">
                    정보 수정
                  </button>
                  <button class="danger-btn small-btn" type="button" data-delete-customer-quote="${escapeHTML(quote.id)}">
                    견적 삭제
                  </button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")
    : `
      <div class="empty-state">
        <strong>아직 서버에 저장된 고객 견적이 없습니다.</strong>
        <p>노출용에서 고객님 견적을 등록하면 여기에 저장 현황과 알림톡 상태가 표시됩니다.</p>
      </div>
    `;

  renderDeletedQuoteLogs();
}

function renderDeletedQuoteLogs() {
  if (!deletedQuoteList) return;

  const logs = getDeletedQuoteLogs();
  deletedQuoteList.innerHTML = logs.length
    ? logs
        .map((log) => {
          return `
            <article class="deleted-quote-row">
              <strong>${escapeHTML(log.customer || "고객명 없음")} · ${escapeHTML(formatPhoneNumber(log.phone))}</strong>
              <span>${escapeHTML(log.reason || "삭제 사유 없음")}</span>
              <small>${escapeHTML(log.quoteNumber || log.quoteId || "-")} · ${escapeHTML(formatDate(log.deletedAt))}</small>
            </article>
          `;
        })
        .join("")
    : `
      <div class="empty-state compact-empty">
        <strong>삭제된 견적 기록이 없습니다.</strong>
        <p>관리자가 견적을 삭제하면 고객명, 연락처, 삭제 사유만 남습니다.</p>
      </div>
    `;
}

function renderDashboardStats() {
  const applications = getApplications();
  const approved = getApprovedSellers();
  const messages = getMessages();
  const customerQuotes = getCustomerQuotes();
  const pendingCount = applications.filter((row) => row.status === "pending").length;
  const readyMessages = messages.filter((row) => row.status === "ready").length;
  const acceptedMessages = messages.filter((row) => row.status === "accepted" || row.status === "sending").length;
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;

  statGrid.innerHTML = [
    { label: "고객 견적", value: `${customerQuotes.length}건`, note: "서버 저장된 견적", action: "customer-quotes" },
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청", action: "pending-applications" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 계정", action: "approved-sellers" },
    { label: "알림톡 상태", value: `${acceptedMessages + readyMessages}건`, note: `접수 ${acceptedMessages}건 · 완료 ${sentMessages}건`, action: "ready-messages" },
    { label: "반려 신청", value: `${rejectedCount}건`, note: "반려 이력 보관", action: "rejected-applications" },
  ]
    .map((stat) => {
      return `
        <article class="stat-card stat-action" data-stat-action="${stat.action}" role="button" tabindex="0">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
          <p>${stat.note}</p>
        </article>
      `;
    })
    .join("");
}

function getFilteredMessages() {
  return getMessages().filter((message) => messageFilter === "all" || message.status === messageFilter);
}

function summarizeSolapiResponse(response) {
  if (!response) return "";
  const group = response.groupInfo || response;
  const firstMessage = response.messageList?.[0] || response.messages?.[0] || {};
  const parts = [
    group.groupId && `그룹 ${group.groupId}`,
    firstMessage.messageId && `메시지 ${firstMessage.messageId}`,
    firstMessage.statusCode && `상태 ${firstMessage.statusCode}`,
    firstMessage.errorCode && `오류코드 ${firstMessage.errorCode}`,
    firstMessage.errorMessage && `오류 ${firstMessage.errorMessage}`,
    response.errorMessage && `오류 ${response.errorMessage}`,
    response.message && `메시지 ${response.message}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

function renderMessages() {
  const messages = getFilteredMessages();
  if (messageSyncError) {
    messageList.innerHTML = `
      <div class="empty-state error-state">
        <strong>알림톡 기록을 불러오지 못했습니다.</strong>
        <p>${escapeHTML(messageSyncError)}</p>
      </div>
    `;
    return;
  }

  messageList.innerHTML = messages.length
    ? messages
        .map((message) => {
          const solapiSummary = summarizeSolapiResponse(message.solapiResponse);
          return `
            <article class="message-card">
              <div class="message-top">
                <div>
                  <strong>${escapeHTML(message.title)}</strong>
                  <span>${escapeHTML(message.targetName || "대상자")} · ${escapeHTML(formatPhoneNumber(message.targetPhone))}</span>
                </div>
                <span class="status ${escapeHTML(message.status)}">${statusLabel(message.status)}</span>
              </div>
              <p>${escapeHTML(message.body)}</p>
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
        })
        .join("")
    : `
      <div class="empty-state">
        <strong>표시할 알림톡이 없습니다.</strong>
        <p>견적 등록, 제안 도착, 판매자 등록 요청 등 자동 발송 기록이 여기에 표시됩니다.</p>
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
    showToast("새 비밀번호는 4자 이상으로 입력해주세요.");
    return;
  }

  const rows = getApprovedSellers();
  const target = rows.find((row) => row.id === sellerId);
  if (target) target.password = String(nextPassword).trim();
  setApprovedSellers(rows);
  renderAll();

  const ok = await syncApprovedSellerPasswordToServer(sellerId, String(nextPassword).trim());
  showToast(ok ? "비밀번호가 초기화되었습니다." : "비밀번호 초기화에 실패했습니다.");
}

async function saveApprovedSellerPosition(sellerId) {
  const input = document.querySelector(`[data-approved-position-input="${CSS.escape(sellerId)}"]`);
  const seller = getApprovedSellers().find((row) => row.id === sellerId);
  if (!input || !seller) return;

  const managerPosition = input.value.trim();
  const rows = getApprovedSellers();
  const target = rows.find((row) => row.id === sellerId);
  if (target) target.managerPosition = managerPosition;
  setApprovedSellers(rows);
  renderAll();

  const ok = await syncApprovedSellerPositionToServer(sellerId, managerPosition);
  showToast(ok ? "판매자 직책을 변경했습니다." : "판매자 직책 변경에 실패했습니다.");
}

async function deleteApprovedSeller(sellerId) {
  const seller = getApprovedSellers().find((row) => row.id === sellerId);
  if (!seller) return;

  const confirmed = window.confirm(`${sellerName(seller) || seller.sellerId} 판매자를 삭제할까요?\n삭제하면 해당 아이디로 판매자 로그인을 할 수 없습니다.`);
  if (!confirmed) return;

  setApprovedSellers(getApprovedSellers().filter((row) => row.id !== sellerId));
  renderAll();

  const ok = await syncApprovedSellerDeleteToServer(sellerId);
  showToast(ok ? "승인 판매자를 삭제했습니다." : "승인 판매자 삭제에 실패했습니다.");
}

async function deleteCustomerQuote(quoteId) {
  const quote = getCustomerQuotes().find((row) => row.id === quoteId);
  if (!quote) return;

  const reason = window.prompt(
    `${quote.customer || "고객"}님의 견적을 삭제합니다.\n삭제 후 견적, 이미지, 제안, 후기는 서버에서 완전히 삭제됩니다.\n삭제 사유를 입력해주세요.`,
    ""
  );
  if (reason === null) return;

  const trimmedReason = String(reason).trim();
  if (trimmedReason.length < 2) {
    showToast("삭제 사유를 입력해야 견적을 삭제할 수 있습니다.");
    return;
  }

  const confirmed = window.confirm(
    `정말 이 견적을 삭제할까요?\n고객명: ${quote.customer || "-"}\n연락처: ${formatPhoneNumber(quote.phone)}\n사유: ${trimmedReason}`
  );
  if (!confirmed) return;

  writeStorageArray(
    STORAGE_KEYS.customerQuotes,
    getCustomerQuotes().filter((row) => row.id !== quoteId)
  );
  renderAll();

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
  renderDashboardStats();
  renderCustomerQuotes();
  renderApplications();
  renderApprovedSellers();
  renderMessages();
  applyAdminPageView();

  document.querySelectorAll("[data-application-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.applicationFilter === applicationFilter);
  });
  document.querySelectorAll("[data-message-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.messageFilter === messageFilter);
  });
}

document.addEventListener("click", (event) => {
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

  const closeModalButton = event.target.closest("[data-close-admin-modal]");
  if (closeModalButton || event.target.classList.contains("admin-modal")) {
    closeAdminModals();
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.matches("[data-phone-edit]")) return;
  event.target.value = formatPhoneNumber(event.target.value);
});

editCustomerQuoteForm?.addEventListener("submit", submitCustomerQuoteEdit);
editApprovedSellerForm?.addEventListener("submit", submitApprovedSellerEdit);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAdminModals();
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") return;

  const statAction = event.target.closest("[data-stat-action]");
  if (!statAction) return;

  event.preventDefault();
  openStatAction(statAction.dataset.statAction);
});

applicationSearch.addEventListener("input", () => {
  selectedApplicationId = "";
  renderApplications();
});

refreshBtn.addEventListener("click", async () => {
  await loadAdminDataFromServer();
  renderAll();
  showToast("관리자 데이터를 다시 불러왔습니다.");
});


window.addEventListener("storage", (event) => {
  if (!Object.values(STORAGE_KEYS).includes(event.key)) return;
  renderAll();
});

if (initialApplicationId) {
  selectedApplicationId = initialApplicationId;
  applicationFilter = "all";
}

loadAdminDataFromServer().finally(renderAll);
