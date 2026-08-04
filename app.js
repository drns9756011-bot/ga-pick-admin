const requests = [];
const bids = [];
const managerReviews = [];

let selectedRequestId = 0;
let uploadedImages = [];
let businessCardImage = "";
let activeSellerId = "";
let activeSellerTab = "all";
let activeSellerBrandFilter = "all";
let activeSellerRegionFilter = "all";
let pendingQuoteFormData = null;
let pendingBidSelection = null;
let pendingQuoteCloseId = null;
let lookupAccessGranted = false;
let activeLookupRequestIds = [];
let quoteCountdownTimer = 0;
let quoteCountdownRefreshQueued = false;

const ADMIN_EMAIL = "di02013@naver.com";
const STORAGE_KEYS = {
  sellerApplications: "pickquoteSellerApplications",
  approvedSellers: "pickquoteApprovedSellers",
  activeSellerId: "pickquoteActiveSellerId",
};
const registeredSellerPhones = new Set();
const sellerAccounts = new Map();
hydrateApprovedSellerAccounts();
restoreActiveSellerSession();
const money = new Intl.NumberFormat("ko-KR");

const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll("[data-view]");
document.documentElement.classList.add("app-ready");
const ROUTES_BY_VIEW = {
  home: "/",
  customer: "/quote",
  lookup: "/my-quote",
  sellerLogin: "/seller",
  seller: "/seller",
  sellerRegister: "/seller/register",
};
const VIEWS_BY_ROUTE = {
  "/": "home",
  "/quote": "customer",
  "/quote/": "customer",
  "/my-quote": "lookup",
  "/my-quote/": "lookup",
  "/seller/register": "sellerRegister",
  "/seller/register/": "sellerRegister",
};
const requestForm = document.querySelector("#requestForm");
const requestFormMessage = document.querySelector("#requestFormMessage");
const lookupForm = document.querySelector("#lookupForm");
const lookupResults = document.querySelector("#lookupResults");
const sellerLoginForm = document.querySelector("#sellerLoginForm");
const sellerLoginMessage = document.querySelector("#sellerLoginMessage");
const bidForm = document.querySelector("#bidForm");
const bidFormMessage = document.querySelector("#bidFormMessage");
const sellerRegisterForm = document.querySelector("#sellerRegisterForm");
const regionChangeForm = document.querySelector("#regionChangeForm");
const quoteImage = document.querySelector("#quoteImage");
const businessCardInput = document.querySelector("#businessCardImage");
const imagePreview = document.querySelector("#imagePreview");
const businessCardPreview = document.querySelector("#businessCardPreview");
const previewTitle = document.querySelector("#previewTitle");
const previewMeta = document.querySelector("#previewMeta");
const sellerRegisterTitle = document.querySelector("#sellerRegisterTitle");
const sellerRegisterMeta = document.querySelector("#sellerRegisterMeta");
const regionChangePreview = document.querySelector("#regionChangePreview");
const regionChangeMailLink = document.querySelector("#regionChangeMailLink");
const sellerQuoteWorkspace = document.querySelector("#sellerQuoteWorkspace");
const sellerRegionPanel = document.querySelector("#sellerRegionPanel");
const requestList = document.querySelector("#requestList");
const sellerMobileListBack = document.querySelector("#sellerMobileListBack");
const sellerTabs = document.querySelectorAll("[data-seller-tab]");
const selectedStatus = document.querySelector("#selectedStatus");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedInfo = document.querySelector("#selectedInfo");
const sellerImage = document.querySelector("#sellerImage");
const securityBlanket = document.querySelector("#securityBlanket");
const privacyConsentModal = document.querySelector("#privacyConsentModal");
const collectionConsent = document.querySelector("#collectionConsent");
const thirdPartyConsent = document.querySelector("#thirdPartyConsent");
const consentMessage = document.querySelector("#consentMessage");
const cancelConsentBtn = document.querySelector("#cancelConsentBtn");
const confirmConsentBtn = document.querySelector("#confirmConsentBtn");
const bidSelectConfirmModal = document.querySelector("#bidSelectConfirmModal");
const bidSelectConfirmTitle = document.querySelector("#bidSelectConfirmTitle");
const bidSelectConfirmDescription = document.querySelector("#bidSelectConfirmDescription");
const bidSelectConfirmSummary = document.querySelector("#bidSelectConfirmSummary");
const cancelBidSelectBtn = document.querySelector("#cancelBidSelectBtn");
const confirmBidSelectBtn = document.querySelector("#confirmBidSelectBtn");
const sellerRegisterCompleteModal = document.querySelector("#sellerRegisterCompleteModal");
const closeSellerRegisterCompleteModal = document.querySelector("#closeSellerRegisterCompleteModal");
const quoteImageModal = document.querySelector("#quoteImageModal");
const quoteImageModalImg = document.querySelector("#quoteImageModalImg");
const closeQuoteImageModal = document.querySelector("#closeQuoteImageModal");
const openSellerAccountModal = document.querySelector("#openSellerAccountModal");
const sellerAccountModal = document.querySelector("#sellerAccountModal");
const closeSellerAccountModal = document.querySelector("#closeSellerAccountModal");
const accountTabs = document.querySelectorAll("[data-account-tab]");
const accountPanels = document.querySelectorAll("[data-account-panel]");
const sellerFindIdForm = document.querySelector("#sellerFindIdForm");
const sellerResetPasswordForm = document.querySelector("#sellerResetPasswordForm");
const findIdMessage = document.querySelector("#findIdMessage");
const resetPasswordMessage = document.querySelector("#resetPasswordMessage");
const managerReviewModal = document.querySelector("#managerReviewModal");
const closeManagerReviewModalBtn = document.querySelector("#closeManagerReviewModal");
const managerReviewTitle = document.querySelector("#managerReviewTitle");
const managerReviewList = document.querySelector("#managerReviewList");
const serverLoadingModal = document.querySelector("#serverLoadingModal");
const serverLoadingTitle = document.querySelector("#serverLoadingTitle");
const serverLoadingText = document.querySelector("#serverLoadingText");
const homeLiveBoard = document.querySelector(".pick-live-board");
const homeReviewGrid = document.querySelector(".pick-review-grid");
const fallbackHomeLiveHTML = homeLiveBoard?.innerHTML || "";
const fallbackHomeReviewHTML = homeReviewGrid?.innerHTML || "";

let securityBlanketTimer;
let serverLoadingCount = 0;
let serverLoadingSafetyTimer = 0;

function formatPrice(value) {
  return `${money.format(Number(value || 0))}원`;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizeMoney(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function parseMoney(value) {
  return Number(normalizeMoney(value));
}

function parseManwon(value) {
  return parseMoney(value) * 10000;
}

function formatManwonInput(value) {
  const amount = Number(value || 0);
  if (!amount) return "";
  return String(Math.round(amount / 10000));
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function createQuoteNumber() {
  const dateKey = formatDateKey();
  const lastSequence = requests.reduce((max, request) => {
    const quoteNumber = String(request.quoteNumber || "");
    if (!quoteNumber.startsWith(`${dateKey}-`)) return max;
    const sequence = Number(quoteNumber.split("-")[1]);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${dateKey}-${String(lastSequence + 1).padStart(4, "0")}`;
}

const QUOTE_RECEIVE_HOURS = 72;

function getQuoteDeadline(request) {
  if (request?.quoteExpiresAt) return new Date(request.quoteExpiresAt);
  if (request?.quote_expires_at) return new Date(request.quote_expires_at);
  if (!request?.createdAt) return null;
  const deadline = new Date(request.createdAt);
  deadline.setHours(deadline.getHours() + QUOTE_RECEIVE_HOURS);
  return deadline;
}

function getQuoteRemainingParts(request) {
  const deadline = getQuoteDeadline(request);
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  }
  const remainingMs = deadline.getTime() - Date.now();
  const totalSeconds = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalSeconds };
}

function formatQuoteRemainingParts(parts) {
  if (!parts.totalSeconds) return "견적 마감";
  const dayPart = parts.days > 0 ? `${parts.days}일 ` : "";
  return `${dayPart}${parts.hours}시간 ${parts.minutes}분 ${parts.seconds}초`;
}

function getQuoteRemainingLabel(request) {
  const deadline = getQuoteDeadline(request);
  if (!deadline || Number.isNaN(deadline.getTime())) return "남은 시간 확인중";
  return formatQuoteRemainingParts(getQuoteRemainingParts(request));
}

function isQuoteExpired(request) {
  const deadline = getQuoteDeadline(request);
  return Boolean(deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() <= Date.now());
}

function isQuoteClosed(request) {
  return request?.status === "closed" || isQuoteExpired(request) || hasValidSelectedBid(request);
}

function getQuoteRemainingShortLabel(request) {
  return formatQuoteRemainingParts(getQuoteRemainingParts(request));
}

function quoteCountdownMarkup(request, options = {}) {
  const mode = options.mode === "short" ? "short" : "full";
  const prefix = options.prefix || "";
  const expired = isQuoteExpired(request);
  const label = mode === "short" ? getQuoteRemainingShortLabel(request) : getQuoteRemainingLabel(request);
  return `<span data-quote-countdown data-quote-id="${escapeHTML(request.id)}" data-countdown-mode="${mode}" data-countdown-prefix="${escapeHTML(prefix)}" data-countdown-expired="${expired ? "1" : "0"}" class="${expired ? "deadline-expired" : "deadline-live"}">${escapeHTML(prefix + label)}</span>`;
}

function queueQuoteCountdownViewRefresh() {
  if (quoteCountdownRefreshQueued) return;
  quoteCountdownRefreshQueued = true;
  window.setTimeout(() => {
    quoteCountdownRefreshQueued = false;
    if (pendingBidSelection) {
      const pendingRequest = requests.find((request) => sameId(request.id, pendingBidSelection.requestId));
      if (pendingRequest && isQuoteExpired(pendingRequest)) closeBidSelectConfirmModal();
    }
    if (pendingQuoteCloseId) {
      const pendingRequest = requests.find((request) => sameId(request.id, pendingQuoteCloseId));
      if (pendingRequest && isQuoteExpired(pendingRequest)) closeQuoteCloseConfirmModal();
    }
    renderRequests();
    renderSelectedRequest();
    if (lookupAccessGranted && activeLookupRequestIds.length) {
      const activeMatches = requests.filter((request) => activeLookupRequestIds.some((id) => sameId(id, request.id)));
      renderLookupResults(activeMatches);
    }
  }, 0);
}

function updateQuoteCountdowns() {
  let expiryTransitioned = false;
  document.querySelectorAll("[data-quote-countdown]").forEach((element) => {
    const request = requests.find((item) => sameId(item.id, element.dataset.quoteId));
    if (!request) return;
    const expired = isQuoteExpired(request);
    const mode = element.dataset.countdownMode === "short" ? "short" : "full";
    const prefix = element.dataset.countdownPrefix || "";
    const label = mode === "short" ? getQuoteRemainingShortLabel(request) : getQuoteRemainingLabel(request);
    element.textContent = `${prefix}${label}`;
    element.classList.toggle("deadline-live", !expired);
    element.classList.toggle("deadline-expired", expired);
    if (element.dataset.countdownExpired === "0" && expired) expiryTransitioned = true;
    element.dataset.countdownExpired = expired ? "1" : "0";
  });
  if (expiryTransitioned) queueQuoteCountdownViewRefresh();
}

function startQuoteCountdownTimer() {
  if (quoteCountdownTimer) return;
  updateQuoteCountdowns();
  quoteCountdownTimer = window.setInterval(updateQuoteCountdowns, 1000);
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

function formatPhoneNumber(value) {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.startsWith("010") || digits.startsWith("011") || digits.startsWith("016") || digits.startsWith("017") || digits.startsWith("018") || digits.startsWith("019")) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function normalizeName(value) {
  return String(value || "").replace(/\s/g, "").trim();
}

function createLightweightImage(dataUrl, maxWidth = 720, quality = 0.72) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve("");
      return;
    }

    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result || ""));
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

async function createBrowserSafeUploadImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl || !String(file?.type || "").startsWith("image/")) return dataUrl;
  return createLightweightImage(dataUrl, 1800, 0.86);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSellerRequestMemoHtml(value) {
  const memo = String(value || "추가 요청사항 없음").trim();
  if (!memo) return "추가 요청사항 없음";

  const formatted = memo
    .replace(/\s+(\[AI 추천 간이 견적서\])/g, "\n\n$1")
    .replace(/\s+(\[(?:TV|라이프스타일 TV|냉장고|김치냉장고|세탁기\/건조기|의류관리기|에어컨|청소기|식기세척기|공기청정기|오븐\/전자레인지|인덕션|정수기)\])/g, "\n$1")
    .replace(/\s+(- \[(?:LG전자|삼성전자)\])/g, "\n  $1")
    .replace(/\s+(네이버 최저가 기준 합계:)/g, "\n\n$1")
    .replace(/\s+(\[추가 요청사항\])/g, "\n\n$1")
    .replace(/\s+(구매 목적:)/g, "\n구매 목적:")
    .replace(/\s+(가족 구성:)/g, "\n가족 구성:")
    .replace(/\s+(예산:)/g, "\n예산:")
    .replace(/\s+(중요 조건:)/g, "\n중요 조건:")
    .replace(/\s+(추가 상황:)/g, "\n추가 상황:")
    .replace(/기준가\s+([0-9,]+원)/g, "네이버 최저가 기준 $1")
    .replace(/네이버 최저가 기준\s+([0-9,]+원)/g, (match, priceText) => {
      const price = Number(String(priceText).replace(/[^0-9]/g, ""));
      return price >= 300000 ? match : "일반 구매가 확인 필요";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return escapeHTML(formatted);
}

function maskPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length < 8) return "연락처 비공개";
  if (digits.startsWith("02")) return `02-****-${digits.slice(-4)}`;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskCustomerName(value) {
  const name = String(value || "").trim();
  if (name.length <= 1) return name || "고객님";
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}*${name.slice(-1)}`;
}

function formatSellerDisplayName(channel, branch) {
  return [channel, branch].filter(Boolean).join(" ");
}

function formatManagerDisplayName(manager, position) {
  return [manager || "담당 매니저", position].filter(Boolean).join(" ");
}

function maskBranchDisplayName(value) {
  const text = String(value || "").trim();
  if (!text) return "지점 비공개";
  if (text.includes("*")) return text;
  const hasBranchSuffix = text.endsWith("점");
  const core = hasBranchSuffix ? text.slice(0, -1) : text;
  if (!core) return "*점";
  const visible = core.slice(0, 1);
  const masked = "*".repeat(Math.max(2, core.length - 1));
  return `${visible}${masked}${hasBranchSuffix ? "점" : ""}`;
}

function maskManagerDisplayName(value) {
  const text = String(value || "").trim();
  if (!text) return "매니저 비공개";
  if (text.includes("*")) return text;
  return `${text.slice(0, 1)}${"*".repeat(Math.max(1, text.length - 1))}`;
}

function canCustomerSeeBidIdentity(request, bid) {
  return Boolean(request && bid && sameId(request.selectedBidId, bid.id));
}

function getCustomerBidIdentity(request, bid) {
  const isRevealed = canCustomerSeeBidIdentity(request, bid);
  const channel = String(bid?.channel || "판매 채널").trim() || "판매 채널";
  const branch = isRevealed
    ? String(bid?.branch || "등록 지점").trim() || "등록 지점"
    : maskBranchDisplayName(bid?.branch);
  const manager = isRevealed
    ? String(bid?.manager || "담당 매니저").trim() || "담당 매니저"
    : maskManagerDisplayName(bid?.manager);
  const position = isRevealed ? String(bid?.managerPosition || "").trim() : "";
  return {
    isRevealed,
    channel,
    branch,
    manager,
    position,
    sellerDisplayName: isRevealed ? formatSellerDisplayName(channel, branch) : channel,
    managerDisplayName: formatManagerDisplayName(manager, position),
  };
}

function starText(rating) {
  return "★".repeat(Number(rating || 0)) + "☆".repeat(5 - Number(rating || 0));
}

function getReviewsForBid(bid) {
  return managerReviews.filter((review) => {
    if (bid.sellerId && review.sellerId) return review.sellerId === bid.sellerId;
    return review.seller === bid.seller && review.manager === bid.manager;
  });
}

function openManagerReviewModal(bidId) {
  const bid = bids.find((item) => item.id === Number(bidId));
  if (!bid) return;

  const identity = getCustomerBidIdentity(
    requests.find((request) => sameId(request.id, bid.requestId || bid.quoteId)),
    bid
  );
  const sellerDisplayName = identity.sellerDisplayName;
  const managerDisplayName = identity.managerDisplayName;
  const safeSeller = escapeHTML(sellerDisplayName);
  const safeManager = escapeHTML(managerDisplayName);
  const reviews = getReviewsForBid(bid);
  managerReviewTitle.textContent = `${sellerDisplayName} 쨌 ${managerDisplayName}`;
  managerReviewList.innerHTML = reviews.length
    ? reviews
        .map((review) => {
          return `
            <article class="manager-review-item">
              <div class="manager-review-top">
                <strong>${escapeHTML(review.customer)}</strong>
                <span class="review-stars">${starText(review.rating)}</span>
              </div>
              <p>${escapeHTML(review.content)}</p>
              <small>${escapeHTML(review.createdAt || "")}</small>
            </article>
          `;
        })
        .join("")
    : `
      <div class="empty-state compact-empty">
        <strong>아직 등록된 후기가 없습니다.</strong>
        <p>${safeSeller} ${safeManager}의 첫 후기를 기다리고 있습니다.</p>
      </div>
    `;
  managerReviewModal.hidden = false;
}

function closeManagerReviewModal() {
  managerReviewModal.hidden = true;
}

function setRequestFormMessage(message, type = "normal") {
  requestFormMessage.textContent = message;
  requestFormMessage.dataset.type = type;
}

function setSellerLoginMessage(message, type = "normal") {
  sellerLoginMessage.textContent = message;
  sellerLoginMessage.dataset.type = type;
}

function setBidFormMessage(message, type = "normal") {
  bidFormMessage.textContent = message;
  bidFormMessage.dataset.type = type;
}

function setConsentMessage(message, type = "normal") {
  consentMessage.textContent = message;
  consentMessage.dataset.type = type;
}

function setLookupActionMessage(message, type = "error") {
  lookupResults.querySelector(".lookup-action-message")?.remove();
  if (!message) return;
  const notice = document.createElement("p");
  notice.className = "form-message lookup-action-message";
  notice.dataset.type = type;
  notice.textContent = message;
  lookupResults.prepend(notice);
}

function setFindIdMessage(message, type = "normal") {
  findIdMessage.textContent = message;
  findIdMessage.dataset.type = type;
}

function setResetPasswordMessage(message, type = "normal") {
  resetPasswordMessage.textContent = message;
  resetPasswordMessage.dataset.type = type;
}

function showServerLoading(title = "로딩중입니다.", text = "서버와 연결하고 있습니다. 잠시만 기다려주세요.") {
  serverLoadingCount += 1;
  if (serverLoadingTitle) serverLoadingTitle.textContent = title;
  if (serverLoadingText) serverLoadingText.textContent = text;
  if (serverLoadingModal) serverLoadingModal.hidden = false;
  window.clearTimeout(serverLoadingSafetyTimer);
  serverLoadingSafetyTimer = window.setTimeout(() => {
    serverLoadingCount = 0;
    if (serverLoadingTitle) serverLoadingTitle.textContent = "요청 시간이 길어지고 있습니다.";
    if (serverLoadingText) serverLoadingText.textContent = "네트워크 상태를 확인한 뒤 다시 시도해주세요.";
    if (serverLoadingModal) serverLoadingModal.hidden = true;
  }, 22000);
}

function hideServerLoading(force = false) {
  serverLoadingCount = force ? 0 : Math.max(0, serverLoadingCount - 1);
  if (serverLoadingCount === 0 && serverLoadingModal) {
    window.clearTimeout(serverLoadingSafetyTimer);
    serverLoadingSafetyTimer = 0;
    serverLoadingModal.hidden = true;
  }
}

function showSellerRegisterCompleteModal() {
  if (!sellerRegisterCompleteModal) return;
  sellerRegisterCompleteModal.hidden = false;
  closeSellerRegisterCompleteModal?.focus();
}

function hideSellerRegisterCompleteModal() {
  if (!sellerRegisterCompleteModal) return;
  sellerRegisterCompleteModal.hidden = true;
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

function readActiveSellerSession() {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.activeSellerId) || "";
  } catch (error) {
    return "";
  }
}

function writeActiveSellerSession(sellerId) {
  try {
    if (sellerId) {
      sessionStorage.setItem(STORAGE_KEYS.activeSellerId, sellerId);
      return;
    }
    sessionStorage.removeItem(STORAGE_KEYS.activeSellerId);
  } catch (error) {
    // 세션 저장을 사용할 수 없는 브라우저에서도 로그인 흐름은 계속 진행합니다.
  }
}

function restoreActiveSellerSession() {
  const sellerId = readActiveSellerSession();
  if (sellerId && sellerAccounts.has(sellerId)) {
    activeSellerId = sellerId;
  }
}

function canUseApiServer() {
  return window.location.protocol !== "file:";
}

async function apiJson(path, options = {}) {
  if (!canUseApiServer()) return null;
  const { loadingTitle, loadingText, showLoading = true, timeoutMs = 18000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  if (showLoading) {
    showServerLoading(loadingTitle || "로딩중입니다.", loadingText || "서버와 연결하고 있습니다. 잠시만 기다려주세요.");
  }
  try {
    const response = await fetch(path, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
      signal: controller.signal,
      ...fetchOptions,
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: payload?.message || "서버 요청에 실패했습니다.",
      };
    }
    return payload;
  } catch (error) {
    console.warn("API 요청에 실패했습니다.", error);
    return {
      ok: false,
      message: error?.name === "AbortError" ? "서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요." : "서버와 연결하지 못했습니다. 배포 상태 또는 네트워크를 확인해주세요.",
    };
  } finally {
    window.clearTimeout(timeout);
    if (showLoading) hideServerLoading();
  }
}

async function syncApprovedSellersFromServer(options = {}) {
  const showLoading = options.showLoading !== false;
  const result = await apiJson("/api/approved-sellers", {
    showLoading,
    loadingTitle: "판매자 정보를 확인 중입니다.",
    loadingText: "승인된 판매자 계정을 서버에서 불러오고 있습니다.",
  });
  if (!result?.ok || !Array.isArray(result.rows)) return;

  writeStorageArray(STORAGE_KEYS.approvedSellers, result.rows);
  hydrateApprovedSellerAccounts();
}

async function saveSellerApplicationToServer(application) {
  return apiJson("/api/seller-applications", {
    method: "POST",
    loadingTitle: "판매자 등록 요청을 저장 중입니다.",
    loadingText: "입력하신 정보를 서버에 안전하게 저장하고 있습니다.",
    body: JSON.stringify(application),
  });
}

async function loginSellerToServer(sellerId, password, options = {}) {
  return apiJson("/api/seller-login", {
    method: "POST",
    showLoading: options.showLoading !== false,
    loadingTitle: "판매자 로그인을 확인 중입니다.",
    loadingText: "승인된 계정 정보를 서버에서 확인하고 있습니다.",
    body: JSON.stringify({ sellerId, password }),
  });
}

async function findSellerAccountFromServer(payload) {
  return apiJson("/api/seller-account-find", {
    method: "POST",
    loadingTitle: "판매자 계정을 찾는 중입니다.",
    loadingText: "입력한 정보를 승인 판매자 정보와 대조하고 있습니다.",
    body: JSON.stringify(payload),
  });
}

async function resetSellerPasswordOnServer(payload) {
  return apiJson("/api/seller-password-reset", {
    method: "POST",
    loadingTitle: "비밀번호를 재설정하는 중입니다.",
    loadingText: "새 비밀번호를 서버에 안전하게 저장하고 있습니다.",
    body: JSON.stringify(payload),
  });
}

function replaceRequests(rows) {
  requests.splice(0, requests.length, ...rows.map(normalizeQuoteRequest));
  renderHomeFeeds();
}

function mergeRequests(rows) {
  rows.forEach((row) => {
    const normalizedRow = normalizeQuoteRequest(row);
    const index = requests.findIndex((request) => sameId(request.id, row.id));
    if (index >= 0) {
      requests[index] = normalizeQuoteRequest({ ...requests[index], ...normalizedRow });
      return;
    }
    requests.push(normalizedRow);
  });
  renderHomeFeeds();
}

function normalizeQuoteBrand(value) {
  const raw = String(value || "").trim();
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (!compact) return "";
  if (compact.includes("비교") || compact.includes("compare")) return "비교견적";
  if (compact.includes("lg") || compact.includes("엘지")) return "LG전자";
  if (compact.includes("삼성") || compact.includes("samsung")) return "삼성전자";
  return raw;
}

function getQuoteBrand(request) {
  return normalizeQuoteBrand(
    request?.desiredBrand ||
      request?.desired_brand ||
      request?.brand ||
      request?.preferredBrand ||
      request?.preferred_brand ||
      ""
  );
}

function normalizeQuoteRequest(request) {
  if (!request) return request;
  const brand = getQuoteBrand(request);
  return {
    ...request,
    desiredBrand: brand,
    brand,
  };
}

async function syncCustomerQuotesFromServer(options = {}) {
  const showLoading = options.showLoading !== false;
  const result = await apiJson("/api/customer-quotes", {
    showLoading,
    loadingTitle: "고객님 견적을 불러오는 중입니다.",
    loadingText: "서버에 저장된 견적 정보를 확인하고 있습니다.",
  });

  if (!result?.ok || !Array.isArray(result.rows)) return;
  replaceRequests(result.rows);
}

function replaceBids(rows) {
  bids.splice(0, bids.length, ...rows);
  renderHomeFeeds();
}

async function syncBidsFromServer(options = {}) {
  const showLoading = options.showLoading !== false;
  const result = await apiJson("/api/bids", {
    showLoading,
    loadingTitle: "판매자 제안을 불러오는 중입니다.",
    loadingText: "서버에 저장된 제안 금액과 순위를 확인하고 있습니다.",
  });

  if (!result?.ok || !Array.isArray(result.rows)) return;
  replaceBids(result.rows);
}

function normalizeReviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.requestId || row.quoteId || row.quote_id || "",
    quoteId: row.quoteId || row.requestId || row.quote_id || "",
    bidId: row.bidId || row.bid_id || "",
    sellerId: row.sellerId || row.seller_id || "",
    seller: row.seller || "",
    manager: row.manager || "",
    customer: row.customer || "",
    rating: Number(row.rating || 0),
    content: row.content || "",
    createdAt: row.createdAt || row.created_at || "",
  };
}

function replaceReviews(rows) {
  managerReviews.splice(0, managerReviews.length, ...rows.map(normalizeReviewRow).filter(Boolean));
  renderHomeFeeds();
}

async function syncReviewsFromServer(options = {}) {
  const showLoading = options.showLoading === true;
  const result = await apiJson("/api/reviews?limit=40", {
    showLoading,
    loadingTitle: "후기를 불러오는 중입니다.",
    loadingText: "고객님이 작성한 실제 후기를 확인하고 있습니다.",
  });

  if (!result?.ok || !Array.isArray(result.rows)) return;
  replaceReviews(result.rows);
}

async function syncSellerDashboardData(options = {}) {
  const showLoading = options.showLoading === true;
  if (showLoading) {
    showServerLoading(
      options.loadingTitle || "판매자 페이지를 준비 중입니다.",
      options.loadingText || "고객님 견적과 제안 정보를 한 번에 불러오고 있습니다."
    );
  }

  try {
    await Promise.all([
      syncCustomerQuotesFromServer({ showLoading: false }),
      syncBidsFromServer({ showLoading: false }),
      syncReviewsFromServer({ showLoading: false }),
    ]);
    hydrateApprovedSellerAccounts();
    renderRequests();
    renderSelectedRequest();
  } finally {
    if (showLoading) hideServerLoading(true);
  }
}

async function saveReviewToServer(review) {
  return apiJson("/api/reviews", {
    method: "POST",
    loadingTitle: "후기를 저장 중입니다.",
    loadingText: "작성하신 후기를 서버에 저장하고 있습니다.",
    body: JSON.stringify(review),
  });
}

async function lookupCustomerQuotesFromServer(customer, phone, quoteNumber = "") {
  const params = new URLSearchParams({
    scope: "lookup",
    customer,
    phone,
  });
  if (quoteNumber) params.set("quoteNumber", quoteNumber);

  const result = await apiJson(`/api/customer-quotes?${params.toString()}`, {
    loadingTitle: "내 견적을 조회 중입니다.",
    loadingText: "입력하신 성함과 연락처로 견적을 확인하고 있습니다.",
  });

  return result?.ok && Array.isArray(result.rows) ? result.rows : [];
}

async function saveCustomerQuoteToServer(quote) {
  return apiJson("/api/customer-quotes", {
    method: "POST",
    loadingTitle: "견적 요청을 서버에 저장 중입니다.",
    loadingText: "고객님 정보와 견적 내용을 안전하게 저장하고 있습니다.",
    body: JSON.stringify(quote),
  });
}

async function saveBidToServer(bid) {
  return apiJson("/api/bids", {
    method: "POST",
    loadingTitle: "제안을 저장 중입니다.",
    loadingText: "제안 금액과 제공 조건을 서버에 반영하고 있습니다.",
    body: JSON.stringify(bid),
  });
}

async function selectBidOnServer(request, bid, contactReleaseScope) {
  return apiJson("/api/bid-selection", {
    method: "POST",
    loadingTitle: "견적을 선택 중입니다.",
    loadingText: "선택 내용과 연락처 공개 범위를 서버에 저장하고 있습니다.",
    body: JSON.stringify({
      requestId: request.id,
      bidId: bid.id,
      contactReleaseScope,
    }),
  });
}

async function closeQuoteOnServer(request) {
  return apiJson("/api/quote-close", {
    method: "POST",
    loadingTitle: "견적 비교를 종료 중입니다.",
    loadingText: "추가 제안 접수를 마감하고 받은 제안만 확인할 수 있도록 변경하고 있습니다.",
    body: JSON.stringify({
      requestId: request.id,
      customer: request.customer,
      phone: request.phone,
    }),
  });
}

function getSellerApplications() {
  return readStorageArray(STORAGE_KEYS.sellerApplications);
}

function setSellerApplications(rows) {
  writeStorageArray(STORAGE_KEYS.sellerApplications, rows);
}

function getApprovedSellerRows() {
  return readStorageArray(STORAGE_KEYS.approvedSellers);
}

function hydrateApprovedSellerAccounts() {
  getApprovedSellerRows().forEach((seller) => {
    if (!seller?.sellerId) return;
    sellerAccounts.set(seller.sellerId, {
      channel: seller.channel,
      branch: seller.branch,
      branchRegion: seller.branchRegion,
      manager: seller.manager,
      managerPosition: seller.managerPosition,
      phone: seller.phone,
      cardImage: seller.cardImage || "",
      consent: seller.consent,
    });
    registeredSellerPhones.add(normalizePhone(seller.phone));
  });
  if (activeSellerId && !sellerAccounts.has(activeSellerId)) {
    activeSellerId = "";
    writeActiveSellerSession("");
  }
}

function hasPendingSellerApplication(sellerId, phone) {
  const normalizedPhone = normalizePhone(phone);
  return getSellerApplications().some((application) => {
    return (
      application.status === "pending" &&
      (application.sellerId === sellerId || normalizePhone(application.phone) === normalizedPhone)
    );
  });
}

function findSellerByProfile({ channel, branch, manager, phone, sellerId = "" }) {
  const normalizedBranch = normalizeName(branch);
  const normalizedManager = normalizeName(manager);
  const normalizedPhone = normalizePhone(phone);
  const normalizedSellerId = sellerId.trim();

  return Array.from(sellerAccounts.entries()).find(([id, account]) => {
    const isSameProfile =
      account.channel === channel &&
      normalizeName(account.branch) === normalizedBranch &&
      normalizeName(account.manager) === normalizedManager &&
      normalizePhone(account.phone) === normalizedPhone;

    if (!normalizedSellerId) return isSameProfile;
    return isSameProfile && id === normalizedSellerId;
  });
}

function openAccountRecoveryModal() {
  sellerAccountModal.hidden = false;
  setFindIdMessage("");
  setResetPasswordMessage("");
}

function closeAccountRecoveryModal() {
  sellerAccountModal.hidden = true;
  sellerFindIdForm.reset();
  sellerResetPasswordForm.reset();
}

function setAccountTab(tabName) {
  accountTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.accountTab === tabName);
  });
  accountPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.accountPanel === tabName);
  });
  setFindIdMessage("");
  setResetPasswordMessage("");
}

function getSelectedRequest() {
  if (selectedRequestId === null) return null;
  return requests.find((request) => request.id === selectedRequestId) || requests[0] || null;
}

function getBidsForRequest(requestId) {
  return bids
    .filter((bid) => String(bid.requestId) === String(requestId))
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
}

function getLowestBidForRequest(requestId) {
  return getBidsForRequest(requestId)[0] || null;
}

function getBidRankInfo(request, bid) {
  const rows = getBidsForRequest(request.id);
  const index = rows.findIndex((item) => String(item.id) === String(bid?.id));
  return {
    rank: index >= 0 ? index + 1 : 0,
    total: rows.length,
    lowestPrice: rows[0]?.price || 0,
  };
}

function getRepeatQuoteNotice(request) {
  const count = Number(request?.submissionCount || 1);
  if (count <= 1) return "";
  const previousLowest = Number(request.previousLowestPrice || 0);
  return previousLowest
    ? `${count}번째 올린 견적입니다. 이전 견적 최저가는 ${formatPrice(previousLowest)}입니다.`
    : `${count}번째 올린 견적입니다. 이전 견적에는 판매자 제안 최저가가 없었습니다.`;
}

function getReleasedBidIds(request) {
  if (Array.isArray(request.contactReleasedBidIds)) return request.contactReleasedBidIds.map(String);
  return request.selectedBidId ? [String(request.selectedBidId)] : [];
}

function isBidContactReleased(request, bid) {
  if (!request || !bid) return false;
  return getReleasedBidIds(request).includes(String(bid.id));
}

function normalizeAppPath(pathname) {
  return String(pathname || "/").replace(/\/+$/, "") || "/";
}

function getViewFromPath(pathname) {
  const path = normalizeAppPath(pathname);
  if (path === "/seller") return activeSellerId ? "seller" : "sellerLogin";
  return VIEWS_BY_ROUTE[path] || "home";
}

function getPathForView(view) {
  return ROUTES_BY_VIEW[view] || "/";
}

function isMobileSellerLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function setSellerMobileDetailOpen(isOpen) {
  document.documentElement.classList.toggle("seller-mobile-detail-open", Boolean(isOpen));
}

function isSellerMobileDetailOpen() {
  return document.documentElement.classList.contains("seller-mobile-detail-open");
}

function openSellerMobileDetail() {
  if (!isMobileSellerLayout()) return;
  const state = window.history?.state || {};
  if (!isSellerMobileDetailOpen() && !state.sellerMobileDetail) {
    window.history.pushState(
      {
        view: "seller",
        sellerMobileDetail: true,
        selectedRequestId,
      },
      "",
      getPathForView("seller")
    );
  }
  setSellerMobileDetailOpen(true);
  document.querySelector("#sellerPage")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function closeSellerMobileDetail(options = {}) {
  setSellerMobileDetailOpen(false);
  if (options.scroll !== false) {
    document.querySelector("#sellerPage")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function leaveSellerMobileDetail() {
  if (window.history?.state?.sellerMobileDetail) {
    window.history.back();
    return;
  }
  closeSellerMobileDetail();
}

function updateBrowserPath(view, replace = false) {
  if (!window.history || !window.history.pushState) return;

  const nextPath = getPathForView(view);
  const currentPath = normalizeAppPath(window.location.pathname);
  if (currentPath === nextPath) return;

  const state = { view };
  if (replace) {
    window.history.replaceState(state, "", nextPath);
    return;
  }
  window.history.pushState(state, "", nextPath);
}

function applyViewFromCurrentPath(options = {}) {
  const view = getViewFromPath(window.location.pathname);
  setView(view, {
    updatePath: options.updatePath === true,
    replacePath: options.replacePath === true,
    scroll: options.scroll === true,
  });
}

function setView(view, options = {}) {
  const shouldUpdatePath = options.updatePath !== false;
  const shouldScroll = options.scroll !== false;
  const shouldReplacePath = options.replacePath === true;
  if (view === "seller" && !activeSellerId) {
    view = "sellerLogin";
    setSellerLoginMessage("판매자 페이지는 로그인 후 이용할 수 있습니다.", "error");
  }

  document.documentElement.dataset.initialView = view;
  if (view !== "seller") {
    closeSellerMobileDetail({ scroll: false });
  }

  if (view === "lookup") {
    lookupAccessGranted = false;
    renderLookupResults([], "성함과 휴대전화로 등록한 견적을 조회하세요.");
  }

  pages.forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === view);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("is-current", button.dataset.view === view);
  });

  if (shouldUpdatePath) {
    updateBrowserPath(view, shouldReplacePath);
  }

  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function refreshCurrentViewFromServer() {
  if (!canUseApiServer()) return;
  const view = document.documentElement.dataset.initialView || getViewFromPath(window.location.pathname);
  showServerLoading("새로고침 중입니다.", "최신 견적과 제안 정보를 다시 불러오고 있습니다.");

  try {
    if (view === "seller" || view === "sellerLogin" || view === "sellerRegister") {
      await syncApprovedSellersFromServer({ showLoading: false });
    }

    if (view === "seller" && activeSellerId) {
      await syncSellerDashboardData({ showLoading: false });
      return;
    }

    if (view === "lookup" && lookupAccessGranted) {
      await Promise.all([
        syncBidsFromServer({ showLoading: false }),
        syncReviewsFromServer({ showLoading: false }),
      ]);
      return;
    }
  } finally {
    hideServerLoading(true);
  }
}

function installMobilePullRefresh() {
  let startY = 0;
  let tracking = false;
  let refreshing = false;
  const threshold = 86;

  document.addEventListener(
    "touchstart",
    (event) => {
      if (!isMobileSellerLayout() || window.scrollY > 0 || serverLoadingCount > 0) return;
      const target = event.target;
      if (target?.closest?.("input, textarea, select, button, a, .modal-backdrop")) return;
      startY = event.touches[0]?.clientY || 0;
      tracking = true;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (!tracking || refreshing || window.scrollY > 0) return;
      const currentY = event.touches[0]?.clientY || 0;
      if (currentY - startY < threshold) return;
      tracking = false;
      refreshing = true;
      refreshCurrentViewFromServer().finally(() => {
        refreshing = false;
      });
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    () => {
      tracking = false;
    },
    { passive: true }
  );
}

function quoteImageMarkup(request, label) {
  const images = Array.isArray(request.images) && request.images.length ? request.images : request.image ? [request.image] : [];

  if (images.length) {
    const visibleImages = images.slice(0, 4);
    const extraCount = Math.max(0, images.length - visibleImages.length);
    return `
      <div class="quote-image-preview-strip image-count-${Math.min(images.length, 4)}" aria-label="${escapeHTML(label)} 미리보기">
        ${visibleImages
          .map((image, index) => {
            return `
              <button class="quote-thumb-button" type="button" aria-label="${escapeHTML(`${label} ${index + 1} 원본 보기`)}">
                <img src="${image}" alt="${escapeHTML(`${label} ${index + 1}`)}" />
              </button>
            `;
          })
          .join("")}
        ${
          extraCount
            ? `<span class="quote-thumb-count">+${extraCount}</span>`
            : `<span class="quote-thumb-hint">눌러서 원본 보기</span>`
        }
      </div>
    `;
  }

  return "<span>등록된 견적서 이미지가 없습니다.</span>";
}

function canActiveSellerSeeCustomerPhone(request) {
  const sellerBid = getActiveSellerBid(request);
  return Boolean(sellerBid && isBidContactReleased(request, sellerBid));
}

function isActiveSellerSelectedRequest(request) {
  const sellerBid = getActiveSellerBid(request);
  if (!sellerBid) return false;
  return sameId(request?.selectedBidId, sellerBid.id) || isBidContactReleased(request, sellerBid);
}

function getActiveSellerBid(request) {
  return bids.find((bid) => String(bid.requestId) === String(request.id) && bid.sellerId === activeSellerId);
}

function normalizeSellerRegionCategory(region) {
  const text = String(region || "").replace(/\s+/g, " ").trim();
  if (!text) return "기타";

  const compact = text.replace(/\s+/g, "");
  const aliases = [
    ["서울", ["서울", "서울시", "서울특별시"]],
    ["부산", ["부산", "부산시", "부산광역시"]],
    ["대구", ["대구", "대구시", "대구광역시"]],
    ["인천", ["인천", "인천시", "인천광역시"]],
    ["광주", ["광주", "광주시", "광주광역시"]],
    ["대전", ["대전", "대전시", "대전광역시"]],
    ["울산", ["울산", "울산시", "울산광역시"]],
    ["세종", ["세종", "세종시", "세종특별자치시"]],
    ["경기", ["경기", "경기도"]],
    ["강원", ["강원", "강원도", "강원특별자치도"]],
    ["충북", ["충북", "충청북도"]],
    ["충남", ["충남", "충청남도"]],
    ["전북", ["전북", "전라북도", "전북특별자치도"]],
    ["전남", ["전남", "전라남도"]],
    ["경북", ["경북", "경상북도"]],
    ["경남", ["경남", "경상남도"]],
    ["제주", ["제주", "제주도", "제주특별자치도"]],
  ];

  const matched = aliases.find(([, names]) => names.some((name) => compact.includes(name)));
  if (matched) return matched[0];

  return text.split(" ")[0] || "기타";
}

function getSellerBrandValue(request) {
  return getQuoteBrand(request) || "미선택";
}

function getQuoteTypeLabel(request) {
  return request?.quoteType === "without_quote" ? "견적서 없음" : "견적서 있음";
}

function getRequestPriceLabel(request) {
  return isWithoutQuoteRequest(request) ? "희망 견적" : "기존 견적";
}

function isWithoutQuoteRequest(request) {
  return request?.quoteType === "without_quote";
}

function splitTopLevelText(text, separators = [",", "/"]) {
  const rows = [];
  let depth = 0;
  let start = 0;
  const raw = String(text || "");

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(depth - 1, 0);
    if (depth === 0 && separators.includes(char)) {
      const part = raw.slice(start, index).trim();
      if (part) rows.push(part);
      start = index + 1;
    }
  }

  const lastPart = raw.slice(start).trim();
  if (lastPart) rows.push(lastPart);
  return rows;
}

function getWithoutQuoteItems(request) {
  if (!isWithoutQuoteRequest(request)) return [];
  const rawItems = String(request?.items || "").trim();
  const bracketRows = rawItems
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "견적서 없음 · 선택 품목")
    .map((line) => {
      const match = line.match(/^\[(.+?)\]\s*(.*)$/);
      if (!match) return null;

      return {
        name: match[1].trim(),
        options: splitTopLevelText(match[2], ["/", "·"]).map((option) => option.trim()).filter(Boolean),
      };
    })
    .filter(Boolean);

  if (bracketRows.length) return bracketRows;

  return splitTopLevelText(rawItems).map((item) => {
    const match = item.match(/^(.+?)\s*\((.*)\)$/);
    if (!match) {
      return { name: item.trim(), options: [] };
    }

    return {
      name: match[1].trim(),
      options: splitTopLevelText(match[2], ["/"]).map((option) => option.trim()).filter(Boolean),
    };
  });
}

function withoutQuoteItemsMarkup(request) {
  const items = getWithoutQuoteItems(request);
  if (!items.length) return "";

  return `
    <div class="without-quote-items">
      <strong>견적서 없음 · 선택 품목</strong>
      <div class="without-quote-item-list">
        ${items
          .map((item) => {
            const options = item.options.length ? item.options.join(" · ") : "상세 옵션 미입력";
            return `<div class="without-quote-item"><span>[${escapeHTML(item.name)}]</span><em>${escapeHTML(options)}</em></div>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function homeQuoteTitle(request) {
  if (isWithoutQuoteRequest(request)) {
    const items = getWithoutQuoteItems(request)
      .slice(0, 4)
      .map((item) => {
        const optionText = item.options.length ? ` (${item.options.slice(0, 2).join(", ")})` : "";
        return `${item.name}${optionText}`;
      });
    return items.join(", ") || "선택 품목 견적";
  }

  const itemText = String(request?.items || "")
    .replace(/\r?\n/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = splitTopLevelText(itemText, [",", "/"]).slice(0, 4);
  return parts.join(", ") || "견적서 첨부";
}

function duplicateRelayRows(rows, minimum = 8) {
  if (!rows.length) return [];
  const relayRows = [...rows];
  while (relayRows.length < minimum) {
    relayRows.push(...rows);
  }
  return relayRows.slice(0, Math.max(minimum, rows.length));
}

function quoteHomeStatus(request, quoteBids) {
  if (hasValidSelectedBid(request)) return "선택 완료";
  if (isQuoteClosed(request)) return "비교 종료";
  if (quoteBids.length) return `${quoteBids.length}개 제안 비교 중`;
  return "판매자 제안 대기";
}

function renderHomeFeeds() {
  if (homeLiveBoard) {
    const quoteRows = requests
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8);

    if (quoteRows.length) {
      homeLiveBoard.innerHTML = duplicateRelayRows(quoteRows)
        .map((request) => {
          const quoteBids = bids.filter((bid) => sameId(bid.requestId, request.id));
          const bidPrices = quoteBids.map((bid) => Number(bid.price || 0)).filter(Boolean);
          const lowestBidPrice = bidPrices.length ? Math.min(...bidPrices) : 0;
          const priceText = lowestBidPrice
            ? `최저 제안 ${formatPrice(lowestBidPrice)}`
            : request.price
              ? `${getRequestPriceLabel(request)} ${formatPrice(request.price)}`
              : getQuoteTypeLabel(request);
          return `
            <article>
              <span>${escapeHTML(request.purchasePurpose || getQuoteBrand(request) || "가전 견적")}</span>
              <strong>${escapeHTML(priceText)}</strong>
              <p>${escapeHTML(homeQuoteTitle(request))}</p>
              <em>${escapeHTML(quoteHomeStatus(request, quoteBids))}</em>
            </article>
          `;
        })
        .join("");
    } else {
      homeLiveBoard.innerHTML = fallbackHomeLiveHTML;
    }
  }

  if (homeReviewGrid) {
    const reviewRows = managerReviews
      .filter((review) => review.content)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8);

    if (reviewRows.length) {
      homeReviewGrid.innerHTML = duplicateRelayRows(reviewRows)
        .map((review) => `
          <article>
            <span>${escapeHTML(starText(review.rating || 5))}</span>
            <p>${escapeHTML(review.content)}</p>
            <strong>${escapeHTML(maskCustomerName(review.customer || "고객님"))} 고객님</strong>
          </article>
        `)
        .join("");
    } else {
      homeReviewGrid.innerHTML = fallbackHomeReviewHTML;
    }
  }
}

function normalizeSellerBrandFilter(value) {
  if (value === "all") return "all";
  return normalizeQuoteBrand(value) || "미선택";
}

function getSelectedBid(request) {
  return bids.find((bid) => sameId(bid.id, request.selectedBidId)) || null;
}

function hasValidSelectedBid(request) {
  return Boolean(request?.selectedBidId && getSelectedBid(request));
}

function isSaleCompletedForBid(request, bid) {
  return Boolean(request.saleCompletedAt && String(request.saleCompletedBidId || "") === String(bid?.id || ""));
}

function getSellerTabRequests() {
  if (activeSellerTab === "proposed") {
    return requests.filter(
      (request) => !isQuoteClosed(request) && getActiveSellerBid(request) && !isActiveSellerSelectedRequest(request)
    );
  }

  if (activeSellerTab === "selected") {
    return requests.filter((request) => isActiveSellerSelectedRequest(request));
  }

  if (activeSellerTab === "closed") {
    return requests.filter((request) => isQuoteClosed(request));
  }

  return requests.filter((request) => !isQuoteClosed(request));
}

function getAvailableSellerBrands(baseRequests = getSellerTabRequests()) {
  return Array.from(new Set(baseRequests.map((request) => getSellerBrandValue(request)).filter(Boolean)));
}

function getFilteredSellerRequests() {
  const tabRequests = getSellerTabRequests();
  const normalizedBrandFilter = normalizeSellerBrandFilter(activeSellerBrandFilter);

  activeSellerBrandFilter = getAvailableSellerBrands(tabRequests).includes(normalizedBrandFilter)
    ? normalizedBrandFilter
    : "all";

  let filteredRequests = activeSellerBrandFilter === "all"
    ? tabRequests
    : tabRequests.filter((request) => getSellerBrandValue(request) === activeSellerBrandFilter);

  const availableRegions = Array.from(new Set(filteredRequests.map((request) => normalizeSellerRegionCategory(request.region)).filter(Boolean)));
  if (activeSellerRegionFilter !== "all" && !availableRegions.includes(activeSellerRegionFilter)) {
    activeSellerRegionFilter = "all";
  }

  if (activeSellerRegionFilter !== "all") {
    filteredRequests = filteredRequests.filter((request) => normalizeSellerRegionCategory(request.region) === activeSellerRegionFilter);
  }

  return filteredRequests;
}

function getSellerRequestsForDynamicRegion() {
  const tabRequests = getSellerTabRequests();
  const normalizedBrandFilter = normalizeSellerBrandFilter(activeSellerBrandFilter);
  const brandFilter = getAvailableSellerBrands(tabRequests).includes(normalizedBrandFilter) ? normalizedBrandFilter : "all";
  return brandFilter === "all" ? tabRequests : tabRequests.filter((request) => getSellerBrandValue(request) === brandFilter);
}

function getAvailableSellerRegions() {
  return Array.from(new Set(getSellerRequestsForDynamicRegion().map((request) => normalizeSellerRegionCategory(request.region))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
}

function renderSellerFilterBar() {
  if (!requestList) return;

  let filterBar = document.querySelector("#sellerFilterBar");
  if (!filterBar) {
    filterBar = document.createElement("div");
    filterBar.id = "sellerFilterBar";
    filterBar.className = "seller-filter-bar";
  }
  requestList.prepend(filterBar);

  const availableRegions = getAvailableSellerRegions();
  if (activeSellerRegionFilter !== "all" && !availableRegions.includes(activeSellerRegionFilter)) {
    activeSellerRegionFilter = "all";
  }

  const brandOptions = [
    ["all", "전체"],
    ["LG전자", "LG전자"],
    ["삼성전자", "삼성전자"],
    ["비교견적", "비교견적"],
  ];

  const regionOptions = [["all", "전체 지역"], ...availableRegions.map((region) => [region, region])];

  const makeButtons = (items, activeValue, filterName) =>
    items
      .map(([value, label]) => {
        const normalizedActiveValue = filterName === "brand" ? normalizeSellerBrandFilter(activeValue) : activeValue;
        return `
        <button type="button" class="${value === normalizedActiveValue ? "is-active" : ""}" data-seller-filter="${filterName}" data-filter-value="${escapeHTML(value)}">
          ${escapeHTML(label)}
        </button>
      `;
      })
      .join("");

  filterBar.innerHTML = `
    <div class="seller-filter-group">
      <span>브랜드</span>
      <div>${makeButtons(brandOptions, activeSellerBrandFilter, "brand")}</div>
    </div>
    <div class="seller-filter-group">
      <span>지역</span>
      <div>${makeButtons(regionOptions, activeSellerRegionFilter, "region")}</div>
    </div>
  `;
}

function syncSelectedRequestWithTab() {
  const filteredRequests = getFilteredSellerRequests();

  if (!filteredRequests.length) {
    selectedRequestId = null;
    return filteredRequests;
  }

  if (!filteredRequests.some((request) => request.id === selectedRequestId)) {
    selectedRequestId = filteredRequests[0]?.id || 0;
  }

  return filteredRequests;
}

function syncRegionChangeForm() {
  const account = sellerAccounts.get(activeSellerId);
  if (!account) return;

  regionChangeForm.elements.changeBranch.value = account.branch;
  regionChangeForm.elements.changeManager.value = account.manager;
  regionChangeForm.elements.currentRegion.value = account.branchRegion;
}

function setBidFormEnabled(isEnabled) {
  bidForm.hidden = !isEnabled;
  Array.from(bidForm.elements).forEach((element) => {
    if (element.name === "branchName" || element.name === "managerName" || element.name === "managerPhone") {
      element.readOnly = true;
      element.disabled = false;
      return;
    }

    element.disabled = !isEnabled;
  });
}

function syncBidFormForRequest(request) {
  const account = sellerAccounts.get(activeSellerId);
  const sellerBid = request ? getActiveSellerBid(request) : null;

  bidForm.elements.branchName.value = account?.branch || "등록 지점";
  bidForm.elements.managerName.value = account?.manager || "담당 매니저";
  bidForm.elements.managerPhone.value = account?.phone ? formatPhoneNumber(account.phone) : "";
  bidForm.elements.bidPrice.value = sellerBid ? formatManwonInput(sellerBid.price) : "";
  bidForm.elements.benefits.value = sellerBid ? sellerBid.benefits : "";
  bidForm.querySelector("button[type='submit']").textContent = sellerBid
    ? "제안 내용 수정"
    : "고객님에게 제안 보내기";
}


function renderBidCards(request) {
  const rows = getBidsForRequest(request.id);

  if (!rows.length) {
    return `
      <div class="empty-state compact-empty">
        <strong>아직 판매자 제안이 없습니다.</strong>
        <p>판매자가 제안을 보내면 이 영역에 표시됩니다.</p>
      </div>
    `;
  }

  return rows
    .map((bid, index) => {
      const saving = Math.max(0, request.price - bid.price);
      const isSelected = sameId(request.selectedBidId, bid.id);
      const isContactReleased = isBidContactReleased(request, bid);
      const isBusinessCardReleased = isContactReleased;
      const isLockedBySelection = hasValidSelectedBid(request);
      const isSaleCompleted = isSaleCompletedForBid(request, bid);
      const identity = getCustomerBidIdentity(request, bid);
      const sellerDisplayName = identity.sellerDisplayName;
      const managerDisplayName = identity.managerDisplayName;
      const safeSeller = escapeHTML(sellerDisplayName);
      const safeManager = escapeHTML(managerDisplayName);
      const safeBranch = escapeHTML(identity.branch);
      const safeChannel = escapeHTML(identity.channel);
      const safePhone = escapeHTML(identity.isRevealed ? bid.phone || "연락처 확인 필요" : "연락처 비공개");
      const safeBenefits = escapeHTML(bid.benefits);
      const reviews = getReviewsForBid(bid);
      const averageRating = reviews.length
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : 0;
      const selectedReview = managerReviews.find(
        (review) => sameId(review.requestId, request.id) && sameId(review.bidId, bid.id)
      );
      const cardAlt = `${safeSeller} ${safeManager} 명함`;
      const cardButton = identity.isRevealed && bid.cardImage
        ? `<button class="card-image-open-btn" type="button" data-card-image="${escapeHTML(bid.cardImage)}" data-card-alt="${cardAlt}">명함 보기</button>`
        : "";
      const reviewArea = isSelected
        ? selectedReview
          ? `<div class="review-complete-box">
              <span class="review-stars">${starText(selectedReview.rating)}</span>
              <strong>후기가 등록되었습니다.</strong>
              <p>${escapeHTML(selectedReview.content)}</p>
            </div>`
          : isSaleCompleted
            ? `<form class="manager-review-form" data-review-form data-request-id="${request.id}" data-bid-id="${bid.id}">
                <strong>${safeManager} 후기 작성</strong>
                <p class="review-guide">판매 완료 후 고객님이 남기는 후기입니다.</p>
                <label>
                  별점
                  <select name="rating" required>
                    <option value="5">★★★★★ 아주 만족</option>
                    <option value="4">★★★★ 만족</option>
                    <option value="3">★★★ 보통</option>
                    <option value="2">★★ 아쉬움</option>
                    <option value="1">★ 불만족</option>
                  </select>
                </label>
                <label>
                  후기
                  <textarea name="content" rows="3" placeholder="상담, 가격, 배송, 설치 조건에 대한 후기를 남겨주세요." required></textarea>
                </label>
                <button class="secondary-btn full" type="submit">후기 등록</button>
              </form>`
            : `<div class="review-wait-box">
                <strong>판매 완료 후 후기 작성 가능</strong>
                <p>판매자가 판매 완료를 누르면 후기 작성 안내가 진행됩니다.</p>
              </div>`
        : "";

      return `
        <article class="seller-bid-card${isSelected ? " is-selected" : ""}">
          <div class="bid-card-visual${identity.isRevealed ? " is-released" : " is-locked"}">
            <button class="heart-btn" type="button" aria-label="관심 제안">♡</button>
            <div class="bid-card-thumb${identity.isRevealed ? "" : " is-private-card"}">
              <div class="manager-card-placeholder">
                <strong>${identity.isRevealed ? "명함 확인 가능" : "선택 후 지점·매니저 공개"}</strong>
                <span>${identity.isRevealed ? safeManager : safeChannel}</span>
                <small>${identity.isRevealed ? safeSeller : `${safeBranch} · ${safeManager}`}</small>
              </div>
              ${cardButton}
            </div>
          </div>
          <div class="bid-card-body">
            <div class="bid-card-top">
              <span class="status">${isSaleCompleted ? "판매완료" : isSelected ? "선택됨" : index === 0 ? "추천" : "검토"}</span>
              <span class="saving-text">${formatPrice(saving)} 절감</span>
            </div>
            <h3>${safeSeller}</h3>
            <p class="manager-line">${identity.isRevealed ? safeManager : `지점 ${safeBranch} · 매니저 ${safeManager}`}</p>
            <button class="review-summary-btn" type="button" data-review-bid-id="${bid.id}">
              <span class="review-stars">${reviews.length ? starText(Math.round(averageRating)) : "☆☆☆☆☆"}</span>
              <strong>${reviews.length ? averageRating.toFixed(1) : "0.0"}</strong>
              <span>후기 ${reviews.length}개 보기</span>
            </button>
            <p class="bid-price">${formatPrice(bid.price)}</p>
            <p class="original-price-line">${getRequestPriceLabel(request)} ${formatPrice(request.price)}</p>
            <p class="bid-benefits">${safeBenefits}</p>
            <div class="bid-tags">
              <span>${index === 0 ? "최저가" : "비교견적"}</span>
              <span>설치 상담</span>
              <span>조건 확인</span>
              ${isSaleCompleted ? "<span>후기 요청 완료</span>" : ""}
            </div>
            <button class="${isSelected ? "primary-btn" : "secondary-btn"} full select-bid-btn" type="button" data-request-id="${
              request.id
            }" data-bid-id="${bid.id}" ${isLockedBySelection && !isSelected ? "disabled" : ""}>
              ${isSelected ? "선택 완료" : isLockedBySelection ? "선택 변경 불가" : "이 제안 선택"}
            </button>
            ${reviewArea}
          </div>
        </article>
      `;
    })
    .join("");
}

function resetCustomerForm() {
  requestForm.reset();
  requestForm.dispatchEvent(new CustomEvent("pickquote:wizard-reset"));
  uploadedImages = [];
  imagePreview.innerHTML = "<span>이미지 미리보기</span>";
  previewTitle.textContent = "견적 요청서가 여기에 표시됩니다.";
  previewMeta.textContent = "등록 후 판매자 페이지와 내 견적 확인 페이지에서 볼 수 있습니다.";
  setRequestFormMessage("");
}

async function createCustomerRequestOnServer(formData) {
  showServerLoading("견적 요청을 등록 중입니다.", "견적서 이미지와 입력 내용을 처리하고 있습니다.");
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    await createCustomerRequest(formData);
  } finally {
    hideServerLoading();
  }
}

function buildRequestMemo(formData, hasQuoteImage) {
  const memo = String(formData.get("memo") || "").trim();
  const aiSummary = String(formData.get("aiRequestSummary") || "").trim();
  const aiModelRecommendations = String(formData.get("aiModelRecommendations") || "").trim();
  if (hasQuoteImage || (!aiSummary && !aiModelRecommendations)) return memo;
  return [
    aiSummary,
    aiModelRecommendations ? `[AI 추천 간이 견적서]\n${aiModelRecommendations}` : "",
    memo ? `[추가 요청사항]\n${memo}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function openConsentModal(formData) {
  pendingQuoteFormData = formData;
  collectionConsent.checked = false;
  thirdPartyConsent.checked = false;
  setConsentMessage("");
  privacyConsentModal.hidden = false;
}

function closeConsentModal() {
  pendingQuoteFormData = null;
  privacyConsentModal.hidden = true;
}

async function createCustomerRequest(formData) {
  const quoteType = formData.get("quoteType");
  const hasQuoteImage = quoteType === "with_quote";
  const requestImages = hasQuoteImage ? uploadedImages.slice(0, 4) : [];
  const quoteNumber = createQuoteNumber();
  const thumbnailImage = await createLightweightImage(requestImages[0]);
  const newRequest = {
    id: `quote-${Date.now()}`,
    quoteNumber,
    customer: formData.get("customer").trim(),
    phone: formatPhoneNumber(formData.get("phone")),
    items: formData.get("items").trim() || (hasQuoteImage ? "견적서 첨부" : "제품군 미선택"),
    quoteType,
    purchasePurpose: formData.get("purchasePurpose"),
    desiredBrand: normalizeQuoteBrand(formData.get("desiredBrand")),
    price: parseManwon(formData.get("price")),
    region: formData.get("region").trim(),
    installDate: formData.get("installDate").trim(),
    memo: buildRequestMemo(formData, hasQuoteImage),
    image: requestImages[0] || "",
    images: requestImages,
    thumbnailImage,
    selectedBidId: null,
    saleCompletedAt: "",
    saleCompletedBidId: null,
    reviewNotificationSentAt: "",
    consent: {
      collectionUse: true,
      thirdPartyProvision: true,
      agreedAt: new Date().toISOString(),
      retention: {
        fullQuoteImagesDays: 7,
        representativeImageDays: 365,
        customerInfoDays: 365,
        quoteReceiveHours: QUOTE_RECEIVE_HOURS,
      },
    },
  };

  let savedRequest = newRequest;
  if (canUseApiServer()) {
    const serverResult = await saveCustomerQuoteToServer(newRequest);
    if (!serverResult?.ok || !serverResult.row) {
      setRequestFormMessage(serverResult?.message || "견적 요청을 서버에 저장하지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
      return;
    }
    savedRequest = serverResult.row;
  }

  requests.unshift(savedRequest);
  selectedRequestId = savedRequest.id;
  renderHomeFeeds();
  renderRequests();
  renderSelectedRequest();
  resetCustomerForm();
  setView("lookup");
}

function openBidSelectConfirmModal(request, bid) {
  const identity = getCustomerBidIdentity(request, bid);
  const sellerDisplayName = identity.sellerDisplayName;
  const managerDisplayName = identity.managerDisplayName;
  const rankInfo = getBidRankInfo(request, bid);
  const remainingLabel = getQuoteRemainingShortLabel(request);
  const shouldCloseEarly = !isQuoteExpired(request) && request?.status !== "closed";
  pendingBidSelection = {
    requestId: request.id,
    bidId: bid.id,
  };
  if (bidSelectConfirmTitle) {
    bidSelectConfirmTitle.textContent = shouldCloseEarly ? "견적 비교를 종료하고 선택할까요?" : "이 견적을 선택하시겠습니까?";
  }
  if (bidSelectConfirmDescription) {
    bidSelectConfirmDescription.innerHTML = shouldCloseEarly
      ? `견적비교 가능시간이 아직 <strong data-quote-countdown data-quote-id="${escapeHTML(request.id)}" data-countdown-mode="short" data-countdown-prefix="" data-countdown-expired="0">${escapeHTML(remainingLabel)}</strong> 남았습니다.<br />종료하고 선택할까요?`
      : "선택하신 견적은 이후 변경할 수 없습니다. 연락처 공개 범위를 선택한 뒤 확인을 눌러주세요.";
  }
  if (confirmBidSelectBtn) {
    confirmBidSelectBtn.textContent = shouldCloseEarly ? "네 종료하고 선택합니다" : "확인";
  }
  if (cancelBidSelectBtn) {
    cancelBidSelectBtn.textContent = shouldCloseEarly ? "아니오 조금 더 지켜볼게요" : "취소";
  }
  bidSelectConfirmSummary.innerHTML = `
    <div><span>판매 채널</span><strong>${escapeHTML(identity.channel)}</strong></div>
    <div><span>지점</span><strong>${escapeHTML(identity.branch)}</strong></div>
    <div><span>매니저</span><strong>${escapeHTML(managerDisplayName)}</strong></div>
    <div><span>현재 순위</span><strong>${rankInfo.rank ? `${rankInfo.rank}위 / ${rankInfo.total}개 제안` : "순위 확인중"}</strong></div>
    <div><span>제안 금액</span><strong>${formatPrice(bid.price)}</strong></div>
  `;
  const selectedScopeInput = document.querySelector("input[name='contactReleaseScope'][value='selected']");
  if (selectedScopeInput) selectedScopeInput.checked = true;
  bidSelectConfirmModal.hidden = false;
}

function closeBidSelectConfirmModal() {
  pendingBidSelection = null;
  bidSelectConfirmModal.hidden = true;
  bidSelectConfirmSummary.innerHTML = "";
  if (bidSelectConfirmTitle) bidSelectConfirmTitle.textContent = "이 견적을 선택하시겠습니까?";
  if (bidSelectConfirmDescription) {
    bidSelectConfirmDescription.textContent =
      "선택하신 견적은 이후 변경할 수 없습니다. 연락처 공개 범위를 선택한 뒤 확인을 눌러주세요.";
  }
  if (confirmBidSelectBtn) confirmBidSelectBtn.textContent = "확인";
  if (cancelBidSelectBtn) cancelBidSelectBtn.textContent = "취소";
}

function getQuoteCloseModal() {
  let modal = document.querySelector("#quoteCloseConfirmModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "quoteCloseConfirmModal";
  modal.className = "modal-backdrop quote-close-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal-panel compact-modal" role="dialog" aria-modal="true" aria-labelledby="quoteCloseConfirmTitle">
      <button class="modal-close" type="button" data-quote-close-cancel aria-label="닫기">×</button>
      <p class="eyebrow">견적 비교 종료</p>
      <h2 id="quoteCloseConfirmTitle">시간이 남았지만 견적을 종료하시겠습니까?</h2>
      <p class="modal-description" id="quoteCloseConfirmDescription"></p>
      <div class="modal-actions two-actions">
        <button class="secondary-btn" type="button" data-quote-close-cancel>취소</button>
        <button class="primary-btn" type="button" data-quote-close-confirm>종료</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-quote-close-cancel]")) {
      closeQuoteCloseConfirmModal();
      return;
    }
    if (event.target.closest("[data-quote-close-confirm]")) {
      confirmQuoteClose();
    }
  });
  return modal;
}

function openQuoteCloseConfirmModal(request) {
  pendingQuoteCloseId = request.id;
  const modal = getQuoteCloseModal();
  const description = modal.querySelector("#quoteCloseConfirmDescription");
  const remainingLabel = getQuoteRemainingShortLabel(request);
  description.innerHTML = `견적비교 가능시간이 아직 <strong data-quote-countdown data-quote-id="${escapeHTML(request.id)}" data-countdown-mode="short" data-countdown-prefix="" data-countdown-expired="0">${escapeHTML(remainingLabel)}</strong> 남았습니다.<br />종료하면 판매자는 더 이상 제안할 수 없고, 받은 제안만 확인할 수 있습니다.`;
  modal.hidden = false;
}

function closeQuoteCloseConfirmModal() {
  pendingQuoteCloseId = null;
  const modal = document.querySelector("#quoteCloseConfirmModal");
  if (modal) modal.hidden = true;
}

async function confirmQuoteClose() {
  const request = requests.find((item) => sameId(item.id, pendingQuoteCloseId));
  if (!request) {
    closeQuoteCloseConfirmModal();
    return;
  }

  showServerLoading("견적 비교를 종료 중입니다.", "받은 제안은 유지하고 추가 제안 접수만 마감하고 있습니다.");
  try {
    let savedRequest = null;
    if (canUseApiServer()) {
      const serverResult = await closeQuoteOnServer(request);
      if (!serverResult?.ok || !serverResult.row) {
        setLookupActionMessage(serverResult?.message || "견적 비교 종료를 처리하지 못했습니다.");
        closeQuoteCloseConfirmModal();
        return;
      }
      savedRequest = serverResult.row;
      if (serverResult.selectedBid) {
        const selectedBidIndex = bids.findIndex((item) => sameId(item.id, serverResult.selectedBid.id));
        if (selectedBidIndex >= 0) bids[selectedBidIndex] = serverResult.selectedBid;
        else bids.push(serverResult.selectedBid);
      }
    }

    if (savedRequest) {
      Object.assign(request, savedRequest);
    } else {
      request.status = "closed";
      request.quoteExpiresAt = new Date().toISOString();
    }

    closeQuoteCloseConfirmModal();
    setLookupActionMessage("견적 비교가 종료되었습니다. 받은 제안 중 원하는 견적을 선택할 수 있습니다.");
    renderLookupResults([request]);
    renderRequests();
    renderSelectedRequest();
  } catch (error) {
    console.error(error);
    setLookupActionMessage("견적 비교 종료 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    hideServerLoading();
  }
}

async function confirmBidSelection() {
  if (!pendingBidSelection) return;
  if (confirmBidSelectBtn) confirmBidSelectBtn.disabled = true;
  showServerLoading("견적 선택을 저장 중입니다.", "견적 비교를 종료하고 선택 내용을 서버에 반영하고 있습니다.");

  try {
    const request = requests.find((item) => sameId(item.id, pendingBidSelection.requestId));
    const bid = bids.find((item) => sameId(item.id, pendingBidSelection.bidId));
    if (!request || !bid) {
      closeBidSelectConfirmModal();
      return;
    }

    if (hasValidSelectedBid(request) && !sameId(request.selectedBidId, bid.id)) {
      closeBidSelectConfirmModal();
      renderLookupResults([request]);
      return;
    }

    const scope = document.querySelector("input[name='contactReleaseScope']:checked")?.value === "top3" ? "top3" : "selected";
    let savedRequest = null;
    if (canUseApiServer()) {
      const serverResult = await selectBidOnServer(request, bid, scope);
      if (!serverResult?.ok || !serverResult.row) {
        closeBidSelectConfirmModal();
        setLookupActionMessage(serverResult?.message || "견적 선택을 저장하지 못했습니다.");
        return;
      }
      savedRequest = serverResult.row;
    }

    if (savedRequest) {
      Object.assign(request, savedRequest);
    } else {
      const releasedBidIds =
        scope === "top3"
          ? Array.from(new Set([...getBidsForRequest(request.id).slice(0, 3).map((item) => item.id), bid.id]))
          : [bid.id];
      request.selectedBidId = bid.id;
      request.contactReleaseScope = scope;
      request.contactReleasedBidIds = releasedBidIds;
      request.status = "closed";
      request.quoteExpiresAt = new Date().toISOString();
    }
    selectedRequestId = request.id;
    closeBidSelectConfirmModal();
    renderLookupResults([request]);
    renderRequests();
    renderSelectedRequest();
  } catch (error) {
    console.error(error);
    setLookupActionMessage("견적 선택 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    if (confirmBidSelectBtn) confirmBidSelectBtn.disabled = false;
    hideServerLoading();
  }
}

function renderLookupResults(matches, label = "내 견적") {
  setLookupActionMessage("");
  activeLookupRequestIds = lookupAccessGranted ? matches.map((request) => request.id) : [];
  if (!lookupAccessGranted) {
    lookupResults.innerHTML = `
      <div class="empty-state">
        <strong>성함과 휴대전화로 내 견적을 조회하세요.</strong>
        <p>개인정보 보호를 위해 견적 등록 시 입력한 성함과 휴대전화가 일치해야 견적 내용과 판매자 제안을 확인할 수 있습니다.</p>
      </div>
    `;
    return;
  }

  if (!matches.length) {
    lookupResults.innerHTML = `
      <div class="empty-state">
        <strong>조회된 견적이 없습니다.</strong>
        <p>견적 등록 시 입력한 성함과 휴대전화가 정확한지 다시 확인해주세요.</p>
      </div>
    `;
    return;
  }

  lookupResults.innerHTML = matches
    .map((request) => {
      const safeCustomer = escapeHTML(request.customer);
      const safePhone = escapeHTML(request.phone);
      const safeItems = escapeHTML(request.items);
      const safeQuoteType = escapeHTML(getQuoteTypeLabel(request));
      const safePurchasePurpose = escapeHTML(request.purchasePurpose || "미선택");
      const safeRegion = escapeHTML(request.region);
      const safeInstallDate = escapeHTML(request.installDate || "미입력");
      const safeQuoteNumber = escapeHTML(request.quoteNumber || "번호 없음");
      const safeMemo = escapeHTML(request.memo || "추가 요청사항 없음");
      const expired = isQuoteExpired(request);
      const canCloseQuote = !hasValidSelectedBid(request) && request.status !== "closed" && !expired;
      const selectionState = request.selectedBidId
        ? "선택 완료"
        : expired
          ? "견적 비교 마감"
          : "선택 가능";
      return `
        <article class="lookup-card">
          <div class="preview-image lookup-image">
            ${quoteImageMarkup(request, `${request.customer} 고객님의 견적서`)}
          </div>
          <div class="lookup-body">
            <span class="status">${label}</span>
            <h2>${safeItems}</h2>
            <dl class="quote-summary">
              <div><dt>견적번호</dt><dd>${safeQuoteNumber}</dd></div>
              <div><dt>고객님 성함</dt><dd>${safeCustomer}</dd></div>
              <div><dt>연락처</dt><dd>${safePhone}</dd></div>
              <div><dt>견적서</dt><dd>${safeQuoteType}</dd></div>
              <div><dt>구매 목적</dt><dd>${safePurchasePurpose}</dd></div>
              <div><dt>${getRequestPriceLabel(request)}</dt><dd>${formatPrice(request.price)}</dd></div>
              <div><dt>설치 지역</dt><dd>${safeRegion}</dd></div>
              <div><dt>설치 예정일</dt><dd>${safeInstallDate}</dd></div>
              <div><dt>남은 시간</dt><dd>${quoteCountdownMarkup(request)}</dd></div>
              <div><dt>선택 상태</dt><dd>${selectionState}</dd></div>
              <div><dt>요청사항</dt><dd>${safeMemo}</dd></div>
            </dl>
            <div class="bid-card-toolbar">
              <strong>${getBidsForRequest(request.id).length}개 제안</strong>
              <span>낮은 금액순</span>
            </div>
            <div class="seller-bid-grid">
              ${renderBidCards(request)}
            </div>
            ${
              canCloseQuote
                ? `<div class="lookup-close-panel">
                    <strong>견적을 먼저 종료할 수 있습니다.</strong>
                    <p>종료하면 판매자는 더 이상 제안할 수 없고, 현재 받은 제안 중에서만 선택할 수 있습니다.</p>
                    <button class="secondary-btn quote-close-btn" type="button" data-request-id="${request.id}">견적 비교 종료</button>
                  </div>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function showSecurityBlanket(duration = 1800) {
  securityBlanket.classList.add("is-active");
  window.clearTimeout(securityBlanketTimer);

  if (duration) {
    securityBlanketTimer = window.setTimeout(() => {
      securityBlanket.classList.remove("is-active");
    }, duration);
  }
}

function hideSecurityBlanket() {
  window.clearTimeout(securityBlanketTimer);
  securityBlanket.classList.remove("is-active");
}

function isQuoteImageModalOpen() {
  return quoteImageModal && !quoteImageModal.hidden;
}

function openQuoteImageModal(src, alt) {
  quoteImageModalImg.src = src;
  quoteImageModalImg.alt = alt;
  quoteImageModal.hidden = false;

  if (!window.history?.state?.quoteImageModal) {
    window.history.pushState(
      {
        ...(window.history.state || {}),
        view: getViewFromPath(window.location.pathname),
        quoteImageModal: true,
      },
      "",
      window.location.href
    );
  }
}

function closeQuoteImagePreview(options = {}) {
  quoteImageModal.hidden = true;
  quoteImageModalImg.removeAttribute("src");

  if (options.fromHistory !== true && window.history?.state?.quoteImageModal) {
    window.history.back();
  }
}

function buildMailtoLink(subject, body) {
  return `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function sendAdminMail(subject, body, fallbackLink) {
  fallbackLink.href = buildMailtoLink(subject, body);
  fallbackLink.textContent = "메일 앱으로 변경 요청 보내기";
  fallbackLink.hidden = false;
  return false;
}

document.querySelectorAll("input, textarea, select").forEach((field) => {
  field.lang = "ko";
  field.autocapitalize = "off";
  field.spellcheck = false;
});

document.querySelectorAll("[data-phone-input]").forEach((field) => {
  field.type = "text";
  field.addEventListener("input", () => {
    field.value = formatPhoneNumber(field.value);
  });
  field.addEventListener("blur", () => {
    field.value = formatPhoneNumber(field.value);
  });
});

document.querySelectorAll("[data-money-input]").forEach((field) => {
  field.type = "text";
  field.addEventListener("input", () => {
    field.value = normalizeMoney(field.value);
  });
});

const koreanInputNames = new Set([
  "customer",
  "lookupCustomer",
  "items",
  "region",
  "memo",
  "benefits",
  "nextBranch",
  "changeReason",
  "branch",
  "manager",
  "managerPosition",
  "sellerMemo",
  "findBranch",
  "findManager",
  "resetBranch",
  "resetManager",
]);

document.querySelectorAll("input, textarea").forEach((field) => {
  if (!koreanInputNames.has(field.name) || field.readOnly) return;

  field.lang = "ko";
  field.autocomplete = "off";
  field.autocapitalize = "off";
  field.spellcheck = false;
});

navButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const nextView = button.dataset.view === "sellerLogin" && activeSellerId ? "seller" : button.dataset.view;
    setView(nextView);
  });
});

window.addEventListener("popstate", (event) => {
  if (isQuoteImageModalOpen() && !event.state?.quoteImageModal) {
    closeQuoteImagePreview({ fromHistory: true });
    return;
  }

  if (isMobileSellerLayout() && normalizeAppPath(window.location.pathname) === "/seller") {
    if (event.state?.sellerMobileDetail) {
      setSellerMobileDetailOpen(true);
    } else {
      closeSellerMobileDetail({ scroll: false });
    }
  }
  applyViewFromCurrentPath({ scroll: true });
});

document.addEventListener("DOMContentLoaded", () => {
  applyViewFromCurrentPath();
  installMobilePullRefresh();
});

sellerTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeSellerTab = tab.dataset.sellerTab;
    closeSellerMobileDetail();
    setBidFormMessage("");
    renderRequests();
    renderSelectedRequest();
  });
});

document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-seller-filter]");
  if (!filterButton) return;

  const filterType = filterButton.dataset.sellerFilter;
  const filterValue = filterButton.dataset.filterValue || "all";

  if (filterType === "brand") {
    activeSellerBrandFilter = normalizeSellerBrandFilter(filterValue);
    activeSellerRegionFilter = "all";
  }

  if (filterType === "region") {
    activeSellerRegionFilter = filterValue;
  }

  setBidFormMessage("");
  closeSellerMobileDetail();
  renderRequests();
  renderSelectedRequest();
});

sellerMobileListBack?.addEventListener("click", leaveSellerMobileDetail);

quoteImage.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 4);

  if (!files.length) {
    uploadedImages = [];
    imagePreview.innerHTML = "<span>이미지 미리보기</span>";
    return;
  }

  uploadedImages = (await Promise.all(files.map(createBrowserSafeUploadImage))).filter(Boolean);

  imagePreview.innerHTML = `
    <div class="quote-image-grid image-count-${uploadedImages.length}">
      ${uploadedImages
        .map((image, index) => `<img src="${image}" alt="업로드한 견적서 미리보기 ${index + 1}" />`)
        .join("")}
    </div>
  `;

  setRequestFormMessage(
    event.target.files.length > 4 ? "견적서 이미지는 최대 4장까지 등록됩니다. 앞의 4장만 반영했습니다." : ""
  );
});

businessCardInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  businessCardImage = await createBrowserSafeUploadImage(file);
  businessCardPreview.innerHTML = businessCardImage
    ? `<img src="${businessCardImage}" alt="첨부한 지점 명함 미리보기" />`
    : "<span>이미지를 불러오지 못했습니다. JPG 또는 PNG 파일로 다시 선택해주세요.</span>";
});

sellerImage.addEventListener("click", (event) => {
  const image = event.target.closest("img");
  if (!image) return;

  openQuoteImageModal(image.src, image.alt || "견적서 원본 이미지");
});

closeQuoteImageModal.addEventListener("click", closeQuoteImagePreview);

quoteImageModal.addEventListener("click", (event) => {
  if (event.target === quoteImageModal) {
    closeQuoteImagePreview();
  }
});

openSellerAccountModal.addEventListener("click", openAccountRecoveryModal);
closeSellerAccountModal.addEventListener("click", closeAccountRecoveryModal);
closeManagerReviewModalBtn.addEventListener("click", closeManagerReviewModal);

sellerAccountModal.addEventListener("click", (event) => {
  if (event.target === sellerAccountModal) {
    closeAccountRecoveryModal();
  }
});

managerReviewModal.addEventListener("click", (event) => {
  if (event.target === managerReviewModal) {
    closeManagerReviewModal();
  }
});

accountTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setAccountTab(tab.dataset.accountTab);
  });
});

sellerFindIdForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(sellerFindIdForm);
  const result = await findSellerAccountFromServer({
    channel: formData.get("findChannel"),
    branch: formData.get("findBranch"),
    manager: formData.get("findManager"),
    phone: formData.get("findPhone"),
  });

  if (!result?.ok) {
    setFindIdMessage(result?.message || "일치하는 판매자 계정을 찾을 수 없습니다.", "error");
    return;
  }

  setFindIdMessage(`등록된 아이디는 ${result.sellerId} 입니다.`);
});

sellerResetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(sellerResetPasswordForm);
  const nextPassword = formData.get("newPassword");
  if (String(nextPassword).length < 4) {
    setResetPasswordMessage("새 비밀번호는 4자리 이상으로 입력해주세요.", "error");
    return;
  }

  const result = await resetSellerPasswordOnServer({
    channel: formData.get("resetChannel"),
    branch: formData.get("resetBranch"),
    manager: formData.get("resetManager"),
    phone: formData.get("resetPhone"),
    sellerId: formData.get("resetSellerId"),
    newPassword: nextPassword,
  });

  if (!result?.ok) {
    setResetPasswordMessage(result?.message || "입력한 정보와 일치하는 판매자 계정이 없습니다.", "error");
    return;
  }

  sellerResetPasswordForm.reset();
  setResetPasswordMessage(result.message || "비밀번호가 새 비밀번호로 재설정되었습니다.");
});

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(requestForm);
  const checkedQuoteType = requestForm.querySelector('[name="wizardQuoteTypeProxy"]:checked')?.value || "";
  if (checkedQuoteType) formData.set("quoteType", checkedQuoteType);
  const customerPhone = normalizePhone(formData.get("phone"));
  const quoteType = formData.get("quoteType") || "";
  const hasQuoteImage = quoteType === "with_quote";
  const selectedItems = String(formData.get("items") || "").trim();
  const desiredBrand = normalizeQuoteBrand(formData.get("desiredBrand"));
  const recommendationMode = String(formData.get("recommendationMode") || "").trim();
  const enteredPrice = parseManwon(formData.get("price"));
  if (!hasQuoteImage && quoteImage) {
    quoteImage.required = false;
    quoteImage.value = "";
    uploadedImages = [];
  }

  if (!quoteType) {
    setRequestFormMessage("견적서 보유 여부를 선택해주세요.", "error");
    return;
  }

  if (customerPhone.length < 9) {
    setRequestFormMessage("연락처를 정확히 입력해주세요.", "error");
    requestForm.elements.phone.focus();
    return;
  }

  if (hasQuoteImage && !uploadedImages.length) {
    setRequestFormMessage("견적서가 있는 경우 견적서 이미지를 1장 이상 첨부해주세요.", "error");
    return;
  }

  if (hasQuoteImage && enteredPrice <= 0) {
    setRequestFormMessage("기존 견적 금액을 만원 단위로 입력해주세요.", "error");
    return;
  }

  if (!hasQuoteImage && !selectedItems) {
    setRequestFormMessage("견적서가 없는 경우 구매 예정 품목을 1개 이상 선택해주세요.", "error");
    return;
  }

  if (!hasQuoteImage && desiredBrand === "비교견적" && enteredPrice <= 0) {
    setRequestFormMessage("비교견적 예산을 만원 단위로 입력해주세요.", "error");
    return;
  }

  if (!hasQuoteImage && recommendationMode === "manual" && enteredPrice <= 0) {
    setRequestFormMessage("희망 견적 금액을 만원 단위로 입력해주세요.", "error");
    return;
  }

  if (!formData.get("price")) formData.set("price", "0");

  if (registeredSellerPhones.has(customerPhone)) {
    setRequestFormMessage(
      "판매자로 등록된 연락처로는 고객님 견적을 등록할 수 없습니다. 다른 고객님 연락처를 입력해주세요.",
      "error"
    );
    return;
  }

  openConsentModal(formData);
});

cancelConsentBtn.addEventListener("click", closeConsentModal);

privacyConsentModal.addEventListener("click", (event) => {
  if (event.target === privacyConsentModal) {
    closeConsentModal();
  }
});

cancelBidSelectBtn.addEventListener("click", closeBidSelectConfirmModal);
confirmBidSelectBtn.addEventListener("click", confirmBidSelection);
closeSellerRegisterCompleteModal?.addEventListener("click", hideSellerRegisterCompleteModal);

bidSelectConfirmModal.addEventListener("click", (event) => {
  if (event.target === bidSelectConfirmModal) {
    closeBidSelectConfirmModal();
  }
});

sellerRegisterCompleteModal?.addEventListener("click", (event) => {
  if (event.target === sellerRegisterCompleteModal) {
    hideSellerRegisterCompleteModal();
  }
});

confirmConsentBtn.addEventListener("click", () => {
  if (!collectionConsent.checked || !thirdPartyConsent.checked) {
    setConsentMessage("필수 동의 항목을 모두 체크해야 견적 요청을 등록할 수 있습니다.", "error");
    return;
  }

  if (pendingQuoteFormData) {
    createCustomerRequestOnServer(pendingQuoteFormData);
  }

  closeConsentModal();
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(lookupForm);
  const customer = normalizeName(formData.get("lookupCustomer"));
  const phone = normalizePhone(formData.get("lookupPhone"));

  lookupAccessGranted = true;
  if (!customer || !phone) {
    renderLookupResults([]);
    return;
  }

  const serverMatches = canUseApiServer() ? await lookupCustomerQuotesFromServer(formData.get("lookupCustomer").trim(), phone) : [];
  if (serverMatches.length && canUseApiServer()) {
    mergeRequests(serverMatches);
    await Promise.all([
      syncBidsFromServer(),
      syncReviewsFromServer({ showLoading: false }),
    ]);
  }
  const matches = serverMatches.length
    ? serverMatches
    : requests.filter((request) => {
        return normalizeName(request.customer) === customer && normalizePhone(request.phone) === phone;
      });

  renderLookupResults(matches);
});

lookupResults.addEventListener("click", (event) => {
  const lookupImage = event.target.closest(".lookup-image img");
  if (lookupImage) {
    openQuoteImageModal(lookupImage.src, lookupImage.alt || "견적서 원본 이미지");
    return;
  }

  const reviewButton = event.target.closest("[data-review-bid-id]");
  if (reviewButton) {
    openManagerReviewModal(reviewButton.dataset.reviewBidId);
    return;
  }

  const cardImageButton = event.target.closest("[data-card-image]");
  if (cardImageButton) {
    openQuoteImageModal(cardImageButton.dataset.cardImage, cardImageButton.dataset.cardAlt || "판매자 명함 이미지");
    return;
  }

  const closeButton = event.target.closest(".quote-close-btn");
  if (closeButton && !closeButton.disabled) {
    const request = requests.find((item) => sameId(item.id, closeButton.dataset.requestId));
    if (!request) {
      setLookupActionMessage("조회한 견적 정보를 다시 확인해주세요.");
      return;
    }
    if (hasValidSelectedBid(request) || request.status === "closed" || isQuoteExpired(request)) {
      setLookupActionMessage("이미 종료된 견적입니다.");
      renderLookupResults([request]);
      return;
    }
    openQuoteCloseConfirmModal(request);
    return;
  }

  const button = event.target.closest(".select-bid-btn");
  if (!button || button.disabled) return;

  const request = requests.find((item) => sameId(item.id, button.dataset.requestId));
  const bid = bids.find((item) => sameId(item.id, button.dataset.bidId));
  if (!request) {
    setLookupActionMessage("조회한 견적 정보를 다시 확인해주세요. 내 견적 조회를 다시 실행한 뒤 선택해주세요.");
    return;
  }
  if (!bid) {
    setLookupActionMessage("선택한 판매자 제안을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.");
    return;
  }
  if (hasValidSelectedBid(request) && !sameId(request.selectedBidId, bid.id)) return;
  if (sameId(request.selectedBidId, bid.id)) return;

  openBidSelectConfirmModal(request, bid);
});

lookupResults.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-review-form]");
  if (!form) return;
  event.preventDefault();

  const request = requests.find((item) => sameId(item.id, form.dataset.requestId));
  const bid = bids.find((item) => sameId(item.id, form.dataset.bidId));
  if (!request || !bid || String(request.selectedBidId || "") !== String(bid.id)) return;

  const formData = new FormData(form);
  const content = formData.get("content").trim();
  const rating = Number(formData.get("rating"));
  if (!content || !rating) return;

  const existingReview = managerReviews.find(
    (review) => sameId(review.requestId, request.id) && sameId(review.bidId, bid.id)
  );
  const nextReview = {
    id: existingReview?.id || Date.now(),
    requestId: request.id,
    bidId: bid.id,
    sellerId: bid.sellerId,
    seller: bid.seller,
    manager: bid.manager || "담당 매니저",
    customer: maskCustomerName(request.customer),
    rating,
    content,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const savedReview = await saveReviewToServer(nextReview);
  if (savedReview?.ok === false) {
    alert(savedReview.message || "후기 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  const reviewToStore = savedReview?.row ? normalizeReviewRow(savedReview.row) : nextReview;
  if (existingReview) {
    Object.assign(existingReview, reviewToStore);
  } else {
    managerReviews.unshift(reviewToStore);
  }

  renderHomeFeeds();
  renderLookupResults([request]);
});

sellerQuoteWorkspace.addEventListener("click", (event) => {
  const button = event.target.closest(".sale-complete-btn");
  if (!button || button.disabled) return;

  const request = requests.find((item) => sameId(item.id, button.dataset.requestId));
  const selectedBid = request ? getSelectedBid(request) : null;
  if (!request || !selectedBid || selectedBid.sellerId !== activeSellerId) {
    setBidFormMessage("선택받은 견적만 판매완료 처리할 수 있습니다.", "error");
    return;
  }

  const completedAt = new Date().toISOString();
  request.saleCompletedAt = completedAt;
  request.saleCompletedBidId = selectedBid.id;
  request.reviewNotificationSentAt = completedAt;
  setBidFormMessage(
    "판매완료 처리되었습니다. 고객님에게 후기 작성 안내를 발송했습니다."
  );
  renderRequests();
  renderSelectedRequest();
});

sellerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSellerLoginMessage("");
  const formData = new FormData(sellerLoginForm);
  const loginId = formData.get("loginId").trim();
  const loginPassword = formData.get("loginPassword");

  try {
    showServerLoading(
      "판매자 페이지를 준비 중입니다.",
      "로그인 확인 후 고객님 견적과 제안 정보를 한 번에 불러오고 있습니다."
    );

    const loginResult = await loginSellerToServer(loginId, loginPassword, { showLoading: false });

    if (!loginResult?.ok || !loginResult.row) {
      setSellerLoginMessage(loginResult?.message || "아이디 또는 비밀번호가 일치하지 않습니다.", "error");
      return;
    }

    const account = loginResult.row;
    sellerAccounts.set(loginId, {
      channel: account.channel,
      branch: account.branch,
      branchRegion: account.branchRegion,
      manager: account.manager,
      managerPosition: account.managerPosition,
      phone: account.phone,
      cardImage: account.cardImage || "",
      consent: account.consent,
    });
    writeStorageArray(STORAGE_KEYS.approvedSellers, [
      ...getApprovedSellerRows().filter((seller) => seller.sellerId !== loginId),
      account,
    ]);

    activeSellerId = loginId;
    writeActiveSellerSession(loginId);
    activeSellerTab = "all";
    setSellerLoginMessage("");
    setBidFormMessage("");
    sellerLoginForm.reset();
    if (bidForm.elements.branchName) bidForm.elements.branchName.value = account.branch || "";
    if (bidForm.elements.managerName) bidForm.elements.managerName.value = account.manager || "";
    if (bidForm.elements.managerPhone) bidForm.elements.managerPhone.value = formatPhoneNumber(account.phone || "");

    await syncSellerDashboardData({ showLoading: false });
    setView("seller", { replacePath: true });
  } catch (error) {
    activeSellerId = "";
    writeActiveSellerSession("");
    console.warn("판매자 로그인 처리에 실패했습니다.", error);
    setSellerLoginMessage("판매자 페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
  } finally {
    hideServerLoading(true);
  }
});

bidForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedRequestId) return;

  if (canUseApiServer()) {
    await syncApprovedSellersFromServer();
    hydrateApprovedSellerAccounts();
  }

  const formData = new FormData(bidForm);
  const account = sellerAccounts.get(activeSellerId);
  if (!account) {
    activeSellerId = "";
    writeActiveSellerSession("");
    setBidFormMessage("판매자 정보가 변경되었습니다. 다시 로그인해주세요.", "error");
    setView("sellerLogin", { replacePath: true });
    return;
  }

  const branchName = account?.branch || "등록 지점";
  const channelName = account?.channel || "판매처";
  const request = getSelectedRequest();
  const existingBid = request ? getActiveSellerBid(request) : null;
  const bidPrice = parseManwon(formData.get("bidPrice"));
  const benefits = formData.get("benefits").trim();

  if (!request) {
    setBidFormMessage("제안할 고객님 견적을 먼저 선택해주세요.", "error");
    return;
  }

  if (!bidPrice) {
    setBidFormMessage("제안 금액을 만원 단위로 입력해주세요.", "error");
    bidForm.elements.bidPrice.focus();
    return;
  }

  if (!benefits) {
    setBidFormMessage("제공 조건을 입력해주세요.", "error");
    bidForm.elements.benefits.focus();
    return;
  }

  const nextBid = {
    seller: formatSellerDisplayName(channelName, branchName),
    price: bidPrice,
    benefits,
    channel: channelName,
    branch: branchName,
    manager: account?.manager || "담당 매니저",
    managerPosition: account?.managerPosition || "",
    phone: account?.phone ? formatPhoneNumber(account.phone) : "",
    cardImage: account?.cardImage || "",
  };

  const localBid = existingBid || {
    id: `bid-${Date.now()}`,
    requestId: selectedRequestId,
    sellerId: activeSellerId,
  };
  const bidPayload = {
    ...localBid,
    ...nextBid,
  };

  let savedBid = bidPayload;
  if (canUseApiServer()) {
    const serverResult = await saveBidToServer(bidPayload);
    if (!serverResult?.ok || !serverResult.row) {
      setBidFormMessage(serverResult?.message || "제안을 서버에 저장하지 못했습니다.", "error");
      return;
    }
    savedBid = serverResult.row;
  }

  if (existingBid) {
    Object.assign(existingBid, savedBid);
  } else {
    bids.push(savedBid);
  }

  renderHomeFeeds();
  bidForm.reset();
  renderRequests();
  syncBidFormForRequest(getSelectedRequest());
  renderSelectedRequest();
  setBidFormMessage(existingBid ? "제안 내용이 수정되었습니다." : "고객님에게 제안이 전달되었습니다.");
});

sellerRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(sellerRegisterForm);
  const sellerChannel = formData.get("sellerChannel");
  const branch = formData.get("branch").trim();
  const branchRegion = formData.get("branchRegion");
  const sellerId = formData.get("sellerId").trim();
  const sellerPassword = formData.get("sellerPassword");
  const manager = formData.get("manager").trim();
  const managerPosition = formData.get("managerPosition").trim();
  const sellerPhone = formatPhoneNumber(formData.get("sellerPhone"));
  const normalizedSellerPhone = normalizePhone(sellerPhone);
  const sellerMemo = formData.get("sellerMemo").trim() || "추가 메모 없음";

  hydrateApprovedSellerAccounts();

  if (sellerAccounts.has(sellerId)) {
    sellerRegisterTitle.textContent = "이미 사용 중인 판매자 아이디입니다.";
    sellerRegisterMeta.textContent = "다른 아이디로 다시 신청해주세요.";
    return;
  }

  if (registeredSellerPhones.has(normalizedSellerPhone)) {
    sellerRegisterTitle.textContent = "이미 등록된 판매자 연락처입니다.";
    sellerRegisterMeta.textContent = "다른 연락처를 입력하거나 계정 찾기를 이용해주세요.";
    return;
  }

  if (!canUseApiServer() && hasPendingSellerApplication(sellerId, sellerPhone)) {
    sellerRegisterTitle.textContent = "이미 검토 대기 중인 신청입니다.";
    sellerRegisterMeta.textContent = "관리자 승인 또는 반려 후 다시 신청할 수 있습니다.";
    return;
  }

  const submitButton = sellerRegisterForm.querySelector('button[type="submit"]');
  const originalSubmitText = submitButton?.textContent || "판매자 등록 요청";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "서버에 저장 중입니다...";
  }
  sellerRegisterTitle.textContent = "판매자 등록 요청을 저장 중입니다.";
  sellerRegisterMeta.textContent = "잠시만 기다려주세요. 정상 저장 후 관리자 페이지에서 확인할 수 있습니다.";

  try {
    const application = {
      id: `seller-${Date.now()}`,
      status: "pending",
      requestedAt: new Date().toISOString(),
      reviewedAt: "",
      reviewMemo: "",
      sellerId,
      password: sellerPassword,
      channel: sellerChannel,
      branch,
      branchRegion,
      manager,
      managerPosition,
      phone: sellerPhone,
      cardImage: businessCardImage,
      consent: {
        privacyUse: true,
        customerDisclosure: true,
        agreedAt: new Date().toISOString(),
      },
      memo: sellerMemo,
    };

    const serverResult = await saveSellerApplicationToServer(application);

    if (canUseApiServer() && !serverResult?.ok) {
      sellerRegisterTitle.textContent = "판매자 등록 요청을 저장하지 못했습니다.";
      sellerRegisterMeta.textContent =
        serverResult?.message || "잠시 후 다시 시도해주세요. 문제가 계속되면 운영자에게 문의해주세요.";
      return;
    }

    const savedApplication = serverResult?.row || application;
    const applications = getSellerApplications().filter((item) => item.id !== savedApplication.id);
    applications.unshift(savedApplication);
    setSellerApplications(applications);

    sellerRegisterForm.reset();
    businessCardImage = "";
    businessCardPreview.innerHTML = "";
    sellerRegisterTitle.textContent = "정상적으로 완료되었습니다.";
    sellerRegisterMeta.textContent = `${formatSellerDisplayName(sellerChannel, branch)} 등록 요청이 저장되었습니다. 관리자 검토 후 승인 또는 반려 안내가 진행됩니다.`;
    showSellerRegisterCompleteModal();
  } catch (error) {
    console.warn("판매자 등록 처리 중 오류가 발생했습니다.", error);
    sellerRegisterTitle.textContent = "판매자 등록 요청을 처리하지 못했습니다.";
    sellerRegisterMeta.textContent = "잠시 후 다시 시도해주세요. 문제가 계속되면 운영자에게 문의해주세요.";
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitText;
    }
  }
});

regionChangeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const account = sellerAccounts.get(activeSellerId);
  if (!account) {
    setView("sellerLogin");
    return;
  }

  const formData = new FormData(regionChangeForm);
  const branch = account.branch;
  const manager = account.manager;
  const currentRegion = account.branchRegion;
  const nextRegion = formData.get("nextRegion");
  const nextBranch = formData.get("nextBranch").trim();
  const reason = formData.get("changeReason").trim();
  const mailBody = [
    "[픽견적 판매자 매니저 정보 변경 요청]",
    "",
    `판매자 아이디: ${activeSellerId}`,
    `현재 근무지점: ${branch}`,
    `매니저 이름: ${manager}`,
    `현재 지역: ${currentRegion}`,
    `변경 희망 지점: ${nextBranch}`,
    `변경 희망 지역: ${nextRegion}`,
    `변경 사유: ${reason}`,
    "",
    "관리자 검토 및 승인 후 등록 지점과 매니저 정보가 변경됩니다.",
  ].join("\n");

  regionChangePreview.textContent = mailBody;
  regionChangePreview.hidden = false;
  await sendAdminMail("[픽견적] 판매자 매니저 정보 변경 요청", mailBody, regionChangeMailLink);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !privacyConsentModal.hidden) {
    closeConsentModal();
    return;
  }

  if (event.key === "Escape" && !bidSelectConfirmModal.hidden) {
    closeBidSelectConfirmModal();
    return;
  }

  if (event.key === "Escape" && !sellerAccountModal.hidden) {
    closeAccountRecoveryModal();
    return;
  }

  if (event.key === "Escape" && !managerReviewModal.hidden) {
    closeManagerReviewModal();
    return;
  }

  if (event.key === "Escape" && !quoteImageModal.hidden) {
    closeQuoteImagePreview();
    return;
  }

  const key = event.key.toLowerCase();
  const isPrintScreen = event.key === "PrintScreen";
  const isSnippingShortcut = event.metaKey && event.shiftKey && key === "s";
  const isCaptureShortcut = event.ctrlKey && event.shiftKey && (key === "s" || key === "p");

  if (isPrintScreen || isSnippingShortcut || isCaptureShortcut) {
    showSecurityBlanket();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    showSecurityBlanket(0);
    return;
  }

  hideSecurityBlanket();
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener("blur", () => showSecurityBlanket(0));
window.addEventListener("focus", hideSecurityBlanket);
window.addEventListener("beforeprint", () => showSecurityBlanket(0));
window.addEventListener("afterprint", hideSecurityBlanket);

function renderRequests() {
  const isRegionTab = activeSellerTab === "region";
  sellerQuoteWorkspace.hidden = isRegionTab;
  sellerRegionPanel.hidden = !isRegionTab;
  const filterBar = document.querySelector("#sellerFilterBar");
  if (filterBar) filterBar.hidden = isRegionTab;

  if (isRegionTab) {
    sellerTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.sellerTab === activeSellerTab);
    });
    syncRegionChangeForm();
    return;
  }

  requestList.innerHTML = "";
  renderSellerFilterBar();
  const filteredRequests = syncSelectedRequestWithTab();

  sellerTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.sellerTab === activeSellerTab);
  });

  if (!filteredRequests.length) {
    const currentFilterBar = document.querySelector("#sellerFilterBar");
      const emptyLabel =
        activeSellerTab === "proposed"
          ? "선택 대기 중인 제안 견적이 없습니다."
        : activeSellerTab === "selected"
          ? "선택받은 견적이 없습니다."
        : activeSellerTab === "closed"
          ? "종료된 견적이 없습니다."
          : "등록된 고객님 견적이 없습니다.";
    requestList.innerHTML = `
      <div class="empty-state compact-empty">
        <strong>${emptyLabel}</strong>
        <p>해당하는 견적이 생기면 이곳에 표시됩니다.</p>
      </div>
    `;
    if (currentFilterBar) requestList.prepend(currentFilterBar);
    return;
  }

  filteredRequests.forEach((request) => {
    const sellerBid = getActiveSellerBid(request);
    const isSelectedByCustomer = canActiveSellerSeeCustomerPhone(request);
    const isSaleCompleted = Boolean(request.saleCompletedAt && request.saleCompletedBidId === sellerBid?.id);
    const isClosedTab = activeSellerTab === "closed";
    const lowestBid = getLowestBidForRequest(request.id);
    const safeItems = escapeHTML(request.items);
    const safeCustomer = escapeHTML(request.customer);
    const safePhone = escapeHTML(maskPhone(request.phone));
    const safeRegion = escapeHTML(request.region);
    const safeDesiredBrand = escapeHTML(getSellerBrandValue(request));
    const safeQuoteType = escapeHTML(getQuoteTypeLabel(request));
    const safeInstallDate = escapeHTML(request.installDate || "미입력");
    const safePurchasePurpose = escapeHTML(request.purchasePurpose || "미선택");
    const safeQuoteNumber = escapeHTML(request.quoteNumber || "번호 없음");
    const expired = isQuoteExpired(request);
    const item = document.createElement("button");
    item.type = "button";
    item.className = `request-item${request.id === selectedRequestId ? " is-active" : ""}`;
    item.innerHTML = `
      <strong>${safeItems}</strong>
      <span>브랜드 ${safeDesiredBrand}</span>
      <span>견적서 ${safeQuoteType}</span>
      <span>${safeCustomer} · ${isClosedTab ? safePhone : safeRegion}</span>
      <span>견적번호 ${safeQuoteNumber}</span>
      ${quoteCountdownMarkup(request, { prefix: "남은 시간 " })}
      <span>구매 목적 ${safePurchasePurpose}</span>
      <span>설치 예정일 ${safeInstallDate}</span>
      ${
        isClosedTab
          ? `<span>1위 금액 ${lowestBid ? formatPrice(lowestBid.price) : "제안 없음"}</span>`
          : `<span>${getRequestPriceLabel(request)} ${formatPrice(request.price)}</span>`
      }
      ${!isClosedTab && sellerBid ? `<span>내 제안 ${formatPrice(sellerBid.price)}</span>` : ""}
      ${isClosedTab ? `<span class="request-badge done">종료</span>` : ""}
      ${!isClosedTab && isSelectedByCustomer ? `<span class="request-badge">선택받음</span>` : ""}
      ${isSaleCompleted ? `<span class="request-badge done">판매완료</span>` : ""}
    `;
    item.addEventListener("click", () => {
      selectedRequestId = request.id;
      setBidFormMessage("");
      renderRequests();
      renderSelectedRequest();
      openSellerMobileDetail();
    });
    requestList.appendChild(item);
  });
}

function renderSelectedRequest() {
  const request = getSelectedRequest();
  if (!request) {
    selectedStatus.textContent = "선택 대기";
    selectedTitle.textContent = "표시할 견적이 없습니다.";
    selectedInfo.innerHTML = "현재 탭에 해당하는 고객님 견적이 없습니다.";
    sellerImage.innerHTML = "<span>등록된 견적서 이미지가 없습니다.</span>";
    syncBidFormForRequest(null);
    setBidFormEnabled(false);
    return;
  }

  const isClosedTab = activeSellerTab === "closed";
  setBidFormEnabled(!isClosedTab);
  syncBidFormForRequest(request);

  const visiblePhone = isClosedTab ? maskPhone(request.phone) : canActiveSellerSeeCustomerPhone(request) ? request.phone : maskPhone(request.phone);
  const safeCustomer = escapeHTML(request.customer);
  const safePhone = escapeHTML(visiblePhone);
  const safePurchasePurpose = escapeHTML(request.purchasePurpose || "미선택");
  const safeRegion = escapeHTML(request.region);
  const safeDesiredBrand = escapeHTML(getSellerBrandValue(request));
  const safeQuoteType = escapeHTML(getQuoteTypeLabel(request));
  const safeInstallDate = escapeHTML(request.installDate || "미입력");
  const safeQuoteNumber = escapeHTML(request.quoteNumber || "번호 없음");
  const safeMemo = formatSellerRequestMemoHtml(request.memo);
  const expired = isQuoteExpired(request);
  const activeSellerBid = getActiveSellerBid(request);
  const isSelectedSeller = canActiveSellerSeeCustomerPhone(request);
  const isSaleCompleted = isSaleCompletedForBid(request, activeSellerBid);
  const lowestBid = getLowestBidForRequest(request.id);
  const repeatNotice = getRepeatQuoteNotice(request);
  const rankInfo = activeSellerBid ? getBidRankInfo(request, activeSellerBid) : null;
  const rankNotice =
    expired && rankInfo?.rank
      ? `견적 제안 가능 시간이 종료되었습니다. 최저가는 ${formatPrice(rankInfo.lowestPrice)}이며 내 제안은 ${rankInfo.rank}위입니다.`
      : "";

  selectedStatus.textContent = isClosedTab
    ? "종료된 견적"
    : isSaleCompleted
      ? "판매완료"
      : isSelectedSeller
        ? "선택받음"
        : expired
          ? "견적 마감"
          : "응답 가능";
  selectedTitle.textContent = request.items;
  selectedInfo.innerHTML = `
    <div class="seller-summary-grid">
      <div><span>견적번호</span><strong>${safeQuoteNumber}</strong></div>
      <div><span>고객님</span><strong>${safeCustomer}</strong></div>
      <div><span>연락처</span><strong>${safePhone}</strong></div>
      <div><span>구매 목적</span><strong>${safePurchasePurpose}</strong></div>
      <div><span>브랜드</span><strong>${safeDesiredBrand}</strong></div>
      <div><span>견적서</span><strong>${safeQuoteType}</strong></div>
      <div><span>설치 지역</span><strong>${safeRegion}</strong></div>
      <div><span>설치 예정일</span><strong>${safeInstallDate}</strong></div>
      ${
        isClosedTab
          ? `<div><span>1위 금액</span><strong>${lowestBid ? formatPrice(lowestBid.price) : "제안 없음"}</strong></div>`
          : `<div><span>${getRequestPriceLabel(request)}</span><strong>${formatPrice(request.price)}</strong></div>`
      }
      <div><span>견적 가능 시간</span><strong>${quoteCountdownMarkup(request)}</strong></div>
      ${repeatNotice ? `<div><span>재등록 안내</span><strong>${escapeHTML(repeatNotice)}</strong></div>` : ""}
      ${rankNotice ? `<div><span>마감 결과</span><strong>${escapeHTML(rankNotice)}</strong></div>` : ""}
    </div>
    ${withoutQuoteItemsMarkup(request)}
    <div class="seller-request-note">
      <span>요청사항</span>
      <p>${safeMemo}</p>
    </div>
    <p class="privacy-note">${
      isSaleCompleted
        ? `판매완료 처리되었습니다. 고객님 후기 요청 알림톡 발송 상태: ${
            request.reviewNotificationSentAt ? "발송 완료" : "발송 대기"
          }`
        : isClosedTab
        ? "종료된 견적에서는 고객님 연락처가 마스킹 처리되며 1위 금액만 표시됩니다."
        : isSelectedSeller
        ? "고객님이 내 제안을 선택해 연락처가 공개되었습니다."
        : "연락처는 고객님이 제안을 선택한 뒤 공개됩니다."
    }</p>
    ${
      !isClosedTab && isSelectedSeller
        ? `<div class="sale-complete-panel">
            <strong>${isSaleCompleted ? "판매완료 처리됨" : "판매가 완료되었나요?"}</strong>
            <p>${
              isSaleCompleted
                ? "고객님에게 후기 작성 안내가 발송되었습니다."
                : "선택받은 견적에서 판매완료를 누르면 고객님 후기 작성 안내가 열립니다."
            }</p>
            <button class="primary-btn full sale-complete-btn" type="button" data-request-id="${request.id}" ${
              isSaleCompleted ? "disabled" : ""
            }>
              ${isSaleCompleted ? "판매완료 완료" : "판매완료 처리"}
            </button>
          </div>`
        : ""
    }
  `;
  sellerImage.innerHTML = isWithoutQuoteRequest(request)
    ? withoutQuoteItemsMarkup(request)
    : quoteImageMarkup(request, `${request.customer} 고객님이 올린 견적서`);
}


function trackPublicPageVisit() {
  if (window.__gaPickVisitTracked) return;
  window.__gaPickVisitTracked = true;
  const payload = JSON.stringify({
    path: normalizeAppPath(window.location.pathname),
  });

  try {
    if (navigator.sendBeacon) {
      const body = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/site-visit", body)) return;
    }
  } catch (error) {
    // keepalive fetch fallback below
  }

  fetch("/api/site-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    cache: "no-store",
    keepalive: true,
  }).catch(() => {});
}

async function bootApplication() {
  trackPublicPageVisit();
  const initialPath = normalizeAppPath(window.location.pathname);
  const isSellerPath = initialPath === "/seller";
  const isSellerRegisterPath = initialPath === "/seller/register";
  const isHomePath = initialPath === "/";

  if (canUseApiServer()) {
    if (isHomePath) {
      await Promise.all([
        syncCustomerQuotesFromServer({ showLoading: false }),
        syncBidsFromServer({ showLoading: false }),
        syncReviewsFromServer({ showLoading: false }),
      ]);
    }

    if (isSellerPath) {
      showServerLoading("판매자 페이지를 준비 중입니다.", "계정과 견적 데이터를 불러오고 있습니다.");
      await syncApprovedSellersFromServer({ showLoading: false });
      restoreActiveSellerSession();
    } else if (isSellerRegisterPath) {
      await syncApprovedSellersFromServer({ showLoading: false });
    }

    try {
      if (isSellerPath && activeSellerId) {
        await syncSellerDashboardData({ showLoading: false });
      }
    } finally {
      if (isSellerPath) {
        hideServerLoading(true);
      }
    }
  }

  applyViewFromCurrentPath({ replacePath: true });
  renderRequests();
  renderSelectedRequest();
  renderLookupResults([], "성함과 휴대전화로 등록한 견적을 조회하세요.");
  startQuoteCountdownTimer();
}

bootApplication();


