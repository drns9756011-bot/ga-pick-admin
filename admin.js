const STORAGE_KEYS = {
  sellerApplications: "pickquoteSellerApplications",
  approvedSellers: "pickquoteApprovedSellers",
  alimtalkQueue: "pickquoteAlimtalkQueue",
  customerQuotes: "pickquoteCustomerQuotes",
};

let applicationFilter = "pending";
let messageFilter = "ready";
let selectedApplicationId = "";
const initialApplicationId = new URLSearchParams(window.location.search).get("application") || "";

const statGrid = document.querySelector("#statGrid");
const applicationList = document.querySelector("#applicationList");
const applicationDetail = document.querySelector("#applicationDetail");
const applicationSearch = document.querySelector("#applicationSearch");
const approvedSellerRows = document.querySelector("#approvedSellerRows");
const messageList = document.querySelector("#messageList");
const toast = document.querySelector("#toast");
const refreshBtn = document.querySelector("#refreshBtn");
document.querySelector(".home-link")?.setAttribute("href", "https://ga-pick.com/");
document.querySelector(".home-link")?.setAttribute("target", "_blank");
document.querySelector(".home-link")?.setAttribute("rel", "noopener");
if (document.querySelector(".home-link")) {
  document.querySelector(".home-link").textContent = "서비스 화면으로";
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
`;
document.querySelector("#statGrid")?.insertAdjacentElement("afterend", customerQuoteSection);
const customerQuoteList = document.querySelector("#customerQuoteList");

function canUseApiServer() {
  return window.location.protocol !== "file:";
}

async function apiJson(path, options = {}) {
  if (!canUseApiServer()) return null;

  try {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!response.ok) throw new Error("api request failed");
    return response.status === 204 ? null : response.json();
  } catch (error) {
    console.warn("API 요청에 실패했습니다.", error);
    return null;
  }
}

async function loadAdminDataFromServer() {
  const [applications, approvedSellers, messages, customerQuotes] = await Promise.all([
    apiJson("/api/seller-applications"),
    apiJson("/api/approved-sellers"),
    apiJson("/api/alimtalk"),
    apiJson("/api/customer-quotes"),
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

function getMessages() {
  return readStorageArray(STORAGE_KEYS.alimtalkQueue);
}

function setMessages(rows) {
  writeStorageArray(STORAGE_KEYS.alimtalkQueue, rows);
}

function getCustomerQuotes() {
  return readStorageArray(STORAGE_KEYS.customerQuotes);
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
  const serverResult = await apiJson("/api/alimtalk", {
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
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;

  statGrid.innerHTML = [
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 계정" },
    { label: "알림톡 상태", value: `${readyMessages}건`, note: `자동 발송 완료 ${sentMessages}건` },
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
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;

  statGrid.innerHTML = [
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청", action: "pending-applications" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 계정", action: "approved-sellers" },
    { label: "알림톡 상태", value: `${readyMessages}건`, note: `자동 발송 완료 ${sentMessages}건`, action: "ready-messages" },
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
        }>반려 알림톡 작성</button>
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

  showToast("판매자 신청을 반려했습니다. 필요 시 반려 알림톡을 수동 작성하세요.");
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
              <td>${escapeHTML(managerName(seller))}</td>
              <td>${escapeHTML(seller.branchRegion || "지역 미등록")}</td>
              <td>${escapeHTML(seller.sellerId)}</td>
              <td>
                <div class="table-actions">
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
        <td colspan="4">아직 승인된 판매자가 없습니다.</td>
      </tr>
    `;
}

function getMessagesForQuote(quoteId) {
  return getMessages().filter((message) => message.relatedId === quoteId);
}

function quoteAlimtalkStatus(quote) {
  const related = getMessagesForQuote(quote.id);
  if (!related.length) return { label: "알림톡 없음", className: "canceled" };
  if (related.some((message) => message.status === "sent")) return { label: "발송완료", className: "sent" };
  if (related.some((message) => message.status === "ready")) return { label: "발송대기", className: "ready" };
  if (related.some((message) => message.status === "canceled")) return { label: "취소", className: "canceled" };
  return { label: "확인필요", className: "pending" };
}

function renderCustomerQuotes() {
  if (!customerQuoteList) return;

  const quotes = getCustomerQuotes();
  customerQuoteList.innerHTML = quotes.length
    ? quotes
        .map((quote) => {
          const status = quoteAlimtalkStatus(quote);
          const imagesCount = Array.isArray(quote.images) ? quote.images.length : 0;
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
                  <span class="status ${status.className}">${status.label}</span>
                </div>
                <div class="quote-admin-meta">
                  <span>견적번호 ${escapeHTML(quote.quoteNumber || "-")}</span>
                  <span>저장 ${escapeHTML(formatDate(quote.createdAt))}</span>
                  <span>제안 가능 ${escapeHTML(formatDate(quote.quoteExpiresAt))}까지</span>
                  <span>전체 이미지 ${imagesCount}장 · 7일 보관</span>
                  <span>대표 이미지/고객 정보 1년 보관</span>
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
}

function renderDashboardStats() {
  const applications = getApplications();
  const approved = getApprovedSellers();
  const messages = getMessages();
  const customerQuotes = getCustomerQuotes();
  const pendingCount = applications.filter((row) => row.status === "pending").length;
  const readyMessages = messages.filter((row) => row.status === "ready").length;
  const sentMessages = messages.filter((row) => row.status === "sent").length;
  const rejectedCount = applications.filter((row) => row.status === "rejected").length;

  statGrid.innerHTML = [
    { label: "고객 견적", value: `${customerQuotes.length}건`, note: "서버 저장된 견적", action: "customer-quotes" },
    { label: "승인 대기", value: `${pendingCount}건`, note: "검토 필요한 판매자 신청", action: "pending-applications" },
    { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 계정", action: "approved-sellers" },
    { label: "알림톡 상태", value: `${readyMessages}건`, note: `자동 발송 완료 ${sentMessages}건`, action: "ready-messages" },
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


function scrollToAdminSection(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openStatAction(action) {
  if (action === "customer-quotes") {
    renderAll();
    scrollToAdminSection("#customerQuotes");
    return;
  }

  if (action === "pending-applications") {
    applicationFilter = "pending";
    selectedApplicationId = "";
    renderAll();
    scrollToAdminSection("#applications");
    return;
  }

  if (action === "approved-sellers") {
    renderAll();
    scrollToAdminSection("#approvedSellers");
    return;
  }

  if (action === "ready-messages") {
    messageFilter = "ready";
    renderAll();
    scrollToAdminSection("#messages");
    return;
  }

  if (action === "rejected-applications") {
    applicationFilter = "rejected";
    selectedApplicationId = "";
    renderAll();
    scrollToAdminSection("#applications");
  }
}

function renderAll() {
  renderDashboardStats();
  renderCustomerQuotes();
  renderApplications();
  renderApprovedSellers();
  renderMessages();

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

  const deleteApprovedSellerButton = event.target.closest("[data-delete-approved-seller]");
  if (deleteApprovedSellerButton) {
    deleteApprovedSeller(deleteApprovedSellerButton.dataset.deleteApprovedSeller);
  }
});

document.addEventListener("keydown", (event) => {
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
