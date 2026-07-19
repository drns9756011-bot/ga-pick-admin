(function () {
  const keys = {
    sellerApplications: "pickquoteSellerApplications",
    approvedSellers: "pickquoteApprovedSellers",
    alimtalkQueue: "pickquoteAlimtalkQueue",
    customerQuotes: "pickquoteCustomerQuotes",
  };

  const $ = (selector) => document.querySelector(selector);

  function rows(key) {
    try {
      const value = localStorage.getItem(key);
      const parsed = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveRows(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function text(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
    });
  }

  function phone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "연락처 미입력";
    if (digits.startsWith("02")) {
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    }
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
  }

  function date(value) {
    if (!value) return "미기록";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function money(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "금액 미입력";
    return `${number.toLocaleString("ko-KR")}원`;
  }

  function statusLabel(status) {
    return {
      pending: "승인 대기",
      approved: "승인 완료",
      rejected: "반려",
      ready: "발송 대기",
      sent: "발송 완료",
      canceled: "취소",
      completed: "완료",
      selected: "선택됨",
      open: "진행중",
      closed: "마감",
    }[status] || status || "상태 없음";
  }

  function sellerTitle(row) {
    const channel = row?.channel || "";
    const branch = row?.branch || "";
    return [channel, branch].filter(Boolean).join(" ") || row?.seller || row?.sellerId || "지점명 미입력";
  }

  function managerTitle(row) {
    return [row?.manager, row?.managerPosition].filter(Boolean).join(" ") || "매니저 미입력";
  }

  function imageSource(row) {
    return row?.thumbnailImage || row?.thumbnail_image || row?.cardImage || row?.card_image || "";
  }

  function getApplicationsClean() {
    return typeof getApplications === "function" ? getApplications() : rows(keys.sellerApplications);
  }

  function getApprovedClean() {
    return typeof getApprovedSellers === "function" ? getApprovedSellers() : rows(keys.approvedSellers);
  }

  function getMessagesClean() {
    return typeof getMessages === "function" ? getMessages() : rows(keys.alimtalkQueue);
  }

  function getQuotesClean() {
    return typeof getCustomerQuotes === "function" ? getCustomerQuotes() : rows(keys.customerQuotes);
  }

  function activeApplications() {
    const query = ($("#applicationSearch")?.value || "").trim().toLowerCase();
    return getApplicationsClean().filter((row) => {
      const currentFilter = typeof applicationFilter === "undefined" ? "pending" : applicationFilter;
      const matchesStatus = currentFilter === "all" || row.status === currentFilter;
      const haystack = [
        row.sellerId,
        row.channel,
        row.branch,
        row.branchRegion,
        row.manager,
        row.managerPosition,
        row.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }

  function selectedApplication() {
    const list = activeApplications();
    if (!list.length) return null;
    const selectedId = typeof selectedApplicationId === "undefined" ? "" : selectedApplicationId;
    return list.find((row) => row.id === selectedId) || list[0];
  }

  window.showToast = function showToastClean(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(window.__gaPickToastTimer);
    window.__gaPickToastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  };

  window.renderDashboardStats = function renderDashboardStatsClean() {
    const statGrid = $("#statGrid");
    if (!statGrid) return;

    const applications = getApplicationsClean();
    const approved = getApprovedClean();
    const messages = getMessagesClean();
    const quotes = getQuotesClean();

    const pending = applications.filter((row) => row.status === "pending").length;
    const rejected = applications.filter((row) => row.status === "rejected").length;
    const ready = messages.filter((row) => row.status === "ready").length;
    const sent = messages.filter((row) => row.status === "sent").length;

    statGrid.innerHTML = [
      { label: "고객 견적", value: `${quotes.length}건`, note: "서버에 저장된 견적", action: "customer-quotes" },
      { label: "승인 대기", value: `${pending}건`, note: "검토 필요한 판매자 신청", action: "pending-applications" },
      { label: "승인 판매자", value: `${approved.length}명`, note: "로그인 가능한 판매자 계정", action: "approved-sellers" },
      { label: "알림톡 대기", value: `${ready}건`, note: `발송 완료 ${sent}건`, action: "ready-messages" },
      { label: "반려 신청", value: `${rejected}건`, note: "반려 이력 보관", action: "rejected-applications" },
    ]
      .map((item) => `
        <article class="stat-card stat-action" data-stat-action="${item.action}" role="button" tabindex="0">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <p>${item.note}</p>
        </article>
      `)
      .join("");
  };

  window.renderApplications = function renderApplicationsClean() {
    const applicationList = $("#applicationList");
    if (!applicationList) return;

    const list = activeApplications();
    const selected = selectedApplication();
    if (selected && typeof selectedApplicationId !== "undefined") selectedApplicationId = selected.id;

    applicationList.innerHTML = list.length
      ? list
          .map((row) => `
            <button class="application-card${selected?.id === row.id ? " is-active" : ""}" type="button" data-application-id="${text(row.id)}">
              <div class="card-top">
                <div>
                  <strong>${text(sellerTitle(row))}</strong>
                  <span>${text(managerTitle(row))} · ${text(phone(row.phone))}</span>
                </div>
                <span class="status ${text(row.status)}">${text(statusLabel(row.status))}</span>
              </div>
              <span>아이디 ${text(row.sellerId || "미입력")} · 담당 지역 ${text(row.branchRegion || "미입력")}</span>
              <span>신청일 ${text(date(row.requestedAt || row.createdAt))}</span>
            </button>
          `)
          .join("")
      : `
        <div class="empty-state">
          <strong>표시할 판매자 신청이 없습니다.</strong>
          <p>상태 필터나 검색어를 바꾸면 다른 신청 내역을 확인할 수 있습니다.</p>
        </div>
      `;

    window.renderApplicationDetail(selected);
  };

  window.renderApplicationDetail = function renderApplicationDetailClean(row) {
    const detail = $("#applicationDetail");
    if (!detail) return;

    if (!row) {
      detail.innerHTML = `
        <div class="empty-state">
          <strong>선택된 신청이 없습니다.</strong>
          <p>왼쪽 목록에서 판매자 신청을 선택하면 상세 정보가 표시됩니다.</p>
        </div>
      `;
      return;
    }

    const isPending = row.status === "pending";
    detail.innerHTML = `
      <div class="detail-top">
        <div>
          <span class="status ${text(row.status)}">${text(statusLabel(row.status))}</span>
          <h2>${text(sellerTitle(row))}</h2>
          <p class="meta-line">${text(managerTitle(row))} · ${text(phone(row.phone))}</p>
        </div>
      </div>
      <div class="card-preview">
        ${imageSource(row) ? `<img src="${text(imageSource(row))}" alt="${text(sellerTitle(row))} 명함 이미지" />` : `<span>등록된 명함 이미지가 없습니다.</span>`}
      </div>
      <dl class="detail-grid">
        <div><dt>판매자 아이디</dt><dd>${text(row.sellerId || "미입력")}</dd></div>
        <div><dt>채널</dt><dd>${text(row.channel || "미입력")}</dd></div>
        <div><dt>지점명</dt><dd>${text(row.branch || "미입력")}</dd></div>
        <div><dt>담당 지역</dt><dd>${text(row.branchRegion || "미입력")}</dd></div>
        <div><dt>신청일</dt><dd>${text(date(row.requestedAt || row.createdAt))}</dd></div>
        <div><dt>검토일</dt><dd>${text(date(row.reviewedAt))}</dd></div>
      </dl>
      <div class="memo-box">
        <span>추가 메모</span>
        <p>${text(row.memo || "추가 메모 없음")}</p>
      </div>
      <div class="review-form">
        <label>
          검토 메모
          <textarea id="reviewMemo" rows="4" placeholder="승인 또는 반려 사유를 입력하세요.">${text(row.reviewMemo || "")}</textarea>
        </label>
      </div>
      <div class="detail-actions">
        <button class="primary-btn" type="button" data-approve-application="${text(row.id)}" ${isPending ? "" : "disabled"}>승인</button>
        <button class="danger-btn" type="button" data-reject-application="${text(row.id)}" ${isPending ? "" : "disabled"}>반려</button>
        <button class="ghost-btn" type="button" data-queue-application-talk="${text(row.id)}">알림톡 작성</button>
      </div>
    `;
  };

  window.renderApprovedSellers = function renderApprovedSellersClean() {
    const tbody = $("#approvedSellerRows");
    if (!tbody) return;

    const headerRow = tbody.closest("table")?.querySelector("thead tr");
    if (headerRow && headerRow.children.length < 5) {
      const th = document.createElement("th");
      th.textContent = "관리";
      headerRow.appendChild(th);
    }

    const sellers = getApprovedClean();
    tbody.innerHTML = sellers.length
      ? sellers
          .map((row) => `
            <tr>
              <td>${text(sellerTitle(row))}<small>${text(phone(row.phone))}</small></td>
              <td>${text(managerTitle(row))}</td>
              <td>${text(row.branchRegion || "지역 미등록")}</td>
              <td>${text(row.sellerId || "미입력")}</td>
              <td>
                <div class="table-actions">
                  <button class="plain-btn small-btn" type="button" data-reset-approved-password="${text(row.id)}">비밀번호 초기화</button>
                  <button class="danger-btn small-btn" type="button" data-delete-approved-seller="${text(row.id)}">삭제</button>
                </div>
              </td>
            </tr>
          `)
          .join("")
      : `<tr><td colspan="5">승인된 판매자가 아직 없습니다.</td></tr>`;
  };

  function quoteTalkStatus(row) {
    const related = getMessagesClean().filter((message) => message.relatedId === row.id);
    if (related.some((message) => message.status === "sent")) return { label: "발송완료", className: "sent" };
    if (related.some((message) => message.status === "ready")) return { label: "발송대기", className: "ready" };
    if (related.some((message) => message.status === "canceled")) return { label: "취소", className: "canceled" };
    return { label: "알림톡 없음", className: "pending" };
  }

  window.renderCustomerQuotes = function renderCustomerQuotesClean() {
    const section = $("#customerQuotes");
    let list = $("#customerQuoteList");

    if (!section) {
      const created = document.createElement("section");
      created.className = "panel";
      created.id = "customerQuotes";
      created.innerHTML = `
        <div class="panel-head">
          <div>
            <p class="eyebrow">Customer Quotes</p>
            <h2>고객 견적 저장 현황</h2>
          </div>
          <p class="panel-note">서버 저장 여부와 알림톡 발송 상태를 확인합니다.</p>
        </div>
        <div class="quote-admin-list" id="customerQuoteList"></div>
      `;
      $("#statGrid")?.insertAdjacentElement("afterend", created);
      list = $("#customerQuoteList");
    }

    if ($("#customerQuotes .panel-head h2")) $("#customerQuotes .panel-head h2").textContent = "고객 견적 저장 현황";
    if ($("#customerQuotes .panel-note")) $("#customerQuotes .panel-note").textContent = "서버 저장 여부와 알림톡 발송 상태를 확인합니다.";
    if (!list) return;

    const quotes = getQuotesClean().slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    list.innerHTML = quotes.length
      ? quotes
          .map((row) => {
            const talk = quoteTalkStatus(row);
            const src = imageSource(row);
            return `
              <article class="quote-admin-card">
                <div class="quote-admin-thumb">
                  ${src ? `<img src="${text(src)}" alt="${text(row.quoteNumber || "견적서")} 대표 이미지" />` : `<span>대표 이미지 없음</span>`}
                </div>
                <div class="quote-admin-body">
                  <div class="card-top">
                    <div>
                      <strong>${text(row.quoteNumber || row.id || "견적번호 없음")}</strong>
                      <span>${text(row.customer || "고객명 미입력")} · ${text(phone(row.phone))}</span>
                    </div>
                    <span class="status ${talk.className}">${talk.label}</span>
                  </div>
                  <p class="panel-note">${text(row.items || "품목 미입력")}</p>
                  <div class="quote-admin-meta">
                    <span>기존 견적 ${text(money(row.currentPrice || row.price))}</span>
                    <span>설치 지역 ${text(row.installRegion || "미입력")}</span>
                    <span>이미지 ${text(row.imageCount || row.images?.length || 0)}장</span>
                    <span>등록 ${text(date(row.createdAt))}</span>
                    <span>제안 마감 ${text(date(row.quoteExpiresAt || row.quote_expires_at))}</span>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")
      : `
        <div class="empty-state">
          <strong>아직 서버에 저장된 고객 견적이 없습니다.</strong>
          <p>노출용 서비스에서 고객님이 견적을 등록하면 이곳에 저장 현황과 알림톡 상태가 표시됩니다.</p>
        </div>
      `;
  };

  window.renderMessages = function renderMessagesClean() {
    const list = $("#messageList");
    if (!list) return;

    const currentFilter = typeof messageFilter === "undefined" ? "ready" : messageFilter;
    const messages = getMessagesClean().filter((row) => currentFilter === "all" || row.status === currentFilter);
    list.innerHTML = messages.length
      ? messages
          .map((row) => {
            const ready = row.status === "ready";
            const sent = row.status === "sent";
            return `
              <article class="message-card">
                <div class="message-top">
                  <div>
                    <strong>${text(row.title || "알림톡")}</strong>
                    <span>${text(row.targetName || "대상자")} · ${text(phone(row.targetPhone))}</span>
                  </div>
                  <span class="status ${text(row.status)}">${text(statusLabel(row.status))}</span>
                </div>
                <p>${text(row.body || "내용 없음")}</p>
                <span class="meta-line">작성 ${text(date(row.createdAt))}${row.sentAt ? ` · 발송 ${text(date(row.sentAt))}` : ""}</span>
                <div class="message-actions">
                  <button class="primary-btn" type="button" data-send-message="${text(row.id)}" ${ready ? "" : "disabled"}>발송 완료 처리</button>
                  <button class="plain-btn" type="button" data-cancel-message="${text(row.id)}" ${ready ? "" : "disabled"}>취소</button>
                  <button class="ghost-btn" type="button" data-resend-message="${text(row.id)}" ${sent ? "" : "disabled"}>재발송 대기</button>
                </div>
              </article>
            `;
          })
          .join("")
      : `
        <div class="empty-state">
          <strong>표시할 알림톡이 없습니다.</strong>
          <p>고객 견적 등록, 판매자 승인, 반려 등의 작업이 발생하면 발송 대기 목록에 추가됩니다.</p>
        </div>
      `;
  };

  window.renderAll = function renderAllClean() {
    window.renderDashboardStats();
    window.renderCustomerQuotes();
    window.renderApplications();
    window.renderApprovedSellers();
    window.renderMessages();

    document.querySelectorAll("[data-application-filter]").forEach((button) => {
      const currentFilter = typeof applicationFilter === "undefined" ? "pending" : applicationFilter;
      button.classList.toggle("is-active", button.dataset.applicationFilter === currentFilter);
    });
    document.querySelectorAll("[data-message-filter]").forEach((button) => {
      const currentFilter = typeof messageFilter === "undefined" ? "ready" : messageFilter;
      button.classList.toggle("is-active", button.dataset.messageFilter === currentFilter);
    });
  };

  document.querySelector(".home-link")?.setAttribute("href", "https://ga-pick.com/");
  document.querySelector(".home-link")?.setAttribute("target", "_blank");
  document.querySelector(".home-link")?.setAttribute("rel", "noopener");

  setTimeout(() => {
    window.renderAll();
  }, 0);
})();
