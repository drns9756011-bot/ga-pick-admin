(function () {
  const state = {
    activeType: "",
    customerShown: false,
    sellerShown: false,
  };

  const guides = {
    customer: {
      eyebrow: "견적올리기 사용 안내",
      title: "견적서 사진 한 장으로 가전 조건을 비교하세요.",
      intro:
        "픽견적은 고객님이 받은 견적서 또는 구매 예정 품목을 기준으로 판매자 제안을 비교하는 서비스입니다. 가격만 보지 않고 배송, 설치, 카드 혜택, 사은품 조건까지 함께 확인할 수 있습니다.",
      previewClass: "guide-customer-preview",
      steps: [
        ["1", "견적서 유무 선택", "견적서가 있으면 사진을 올리고, 없으면 품목과 옵션을 선택합니다."],
        ["2", "고객님 정보 입력", "성함과 휴대전화는 내 견적 조회와 본인 확인에 사용됩니다."],
        ["3", "구매사유와 브랜드 선택", "혼수, 입주, 이사 등 상황과 LG전자, 삼성전자, 비교견적 중 원하는 방향을 고릅니다."],
        ["4", "금액과 설치 정보 등록", "금액은 만원 단위로 입력하고 설치 지역, 설치 예정일, 모델명을 남깁니다."],
      ],
      note: "견적 등록 후에는 내 견적 확인에서 판매자 제안을 확인하고 원하는 제안만 선택할 수 있습니다.",
    },
    seller: {
      eyebrow: "판매자 페이지 사용 안내",
      title: "고객님 견적을 확인하고 조건을 제안하세요.",
      intro:
        "판매자 페이지는 승인된 판매자만 이용할 수 있습니다. 고객님이 제안을 선택하기 전까지 연락처는 보호되며, 선택 후 상담이 이어집니다.",
      previewClass: "guide-seller-preview",
      steps: [
        ["1", "견적 목록 확인", "브랜드와 지역 필터로 응답 가능한 고객님 견적을 확인합니다."],
        ["2", "상세 내용 확인", "견적서 이미지 또는 선택 품목, 금액, 설치 지역, 요청사항을 확인합니다."],
        ["3", "제안 금액 입력", "제안 금액은 만원 단위로 입력하고 배송, 설치, 카드 조건을 함께 적습니다."],
        ["4", "선택 후 상담", "고객님이 제안을 선택하면 공개 범위에 따라 연락처와 명함 정보가 공개됩니다."],
      ],
      note: "종료된 견적에는 더 이상 제안할 수 없으며, 선택받은 견적은 선택받은 견적 탭에서 확인할 수 있습니다.",
    },
  };

  function todayKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function storageKey(type) {
    return `pickquoteGuideDismissed:${type}:${todayKey()}`;
  }

  function isDismissedToday(type) {
    return localStorage.getItem(storageKey(type)) === "1";
  }

  function dismissToday(type) {
    localStorage.setItem(storageKey(type), "1");
  }

  async function isServerDismissed(type) {
    if (window.location.protocol === "file:") return isDismissedToday(type);
    try {
      const response = await fetch(`/api/guide-dismissal?guideType=${encodeURIComponent(type)}`, { cache: "no-store" });
      const payload = await response.json();
      return Boolean(payload.ok && payload.dismissed);
    } catch (error) {
      return isDismissedToday(type);
    }
  }

  async function saveDismissal(type) {
    dismissToday(type);
    if (window.location.protocol === "file:") return;
    try {
      await fetch("/api/guide-dismissal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideType: type }),
      });
    } catch (error) {
      // Browser storage still keeps the guide hidden for today.
    }
  }

  function makePreview(type) {
    if (type === "seller") {
      return `
        <div class="guide-screen ${guides[type].previewClass}" aria-label="픽견적 판매자 페이지 예시">
          <div class="guide-topline"><span>픽견적</span><small>판매자</small></div>
          <div class="guide-tabs">
            <span class="is-active">고객님 견적</span>
            <span>제안한 견적</span>
            <span>선택받은 견적</span>
          </div>
          <div class="guide-filter-row">
            <span>전체</span>
            <span>LG전자</span>
            <span>대구</span>
          </div>
          <div class="guide-seller-grid">
            <div>
              <strong>견적번호 20260729-0001</strong>
              <small>대구 · 비교견적 · 47시간 남음</small>
            </div>
            <div>
              <strong>고객님 견적서</strong>
              <small>상세 확인 후 제안 금액 입력</small>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="guide-screen ${guides[type].previewClass}" aria-label="픽견적 견적올리기 페이지 예시">
        <div class="guide-topline"><span>픽견적</span><small>견적올리기</small></div>
        <div class="guide-progress">
          <span class="is-active"></span>
          <span class="is-active"></span>
          <span></span>
          <span></span>
        </div>
        <div class="guide-form-card">
          <strong>견적서가 있으신가요?</strong>
          <p>견적서가 있으면 사진 등록, 없으면 품목 선택으로 진행합니다.</p>
        </div>
        <div class="guide-form-card muted">
          <strong>브랜드와 구매사유 선택</strong>
          <p>혼수, 입주, 이사 상황에 맞춰 제안 조건을 비교합니다.</p>
        </div>
      </div>
    `;
  }

  function openGuide(type) {
    const guide = guides[type];
    if (!guide) return;
    state.activeType = type;

    let modal = document.querySelector("#pageGuideModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pageGuideModal";
      modal.className = "page-guide-modal";
      modal.hidden = true;
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="page-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="pageGuideTitle">
        <button class="page-guide-close" type="button" data-guide-close aria-label="안내 닫기">×</button>
        <div class="page-guide-layout">
          ${makePreview(type)}
          <div class="page-guide-copy">
            <p class="eyebrow">${guide.eyebrow}</p>
            <h2 id="pageGuideTitle">${guide.title}</h2>
            <p>${guide.intro}</p>
            <ol class="page-guide-steps">
              ${guide.steps
                .map(
                  ([number, title, text]) => `
                    <li>
                      <span>${number}</span>
                      <div>
                        <strong>${title}</strong>
                        <p>${text}</p>
                      </div>
                    </li>
                  `
                )
                .join("")}
            </ol>
            <p class="page-guide-note">${guide.note}</p>
            <label class="page-guide-today">
              <input type="checkbox" id="pageGuideTodayDismiss" />
              오늘은 그만보기
            </label>
            <button class="primary-btn full" type="button" data-guide-close>확인하고 시작하기</button>
          </div>
        </div>
      </div>
    `;
    modal.hidden = false;
  }

  async function closeGuide() {
    const type = state.activeType;
    const shouldDismiss = document.querySelector("#pageGuideTodayDismiss")?.checked;
    if (type && shouldDismiss) await saveDismissal(type);

    const modal = document.querySelector("#pageGuideModal");
    if (modal) modal.hidden = true;
  }

  function activePageName() {
    return document.querySelector(".page.is-active")?.dataset.page || "";
  }

  async function maybeOpenGuide() {
    const page = activePageName();

    if (page === "customer" && !state.customerShown) {
      state.customerShown = true;
      if (!(await isServerDismissed("customer"))) window.setTimeout(() => openGuide("customer"), 180);
      return;
    }

    if ((page === "seller" || page === "sellerLogin") && !state.sellerShown) {
      state.sellerShown = true;
      if (!(await isServerDismissed("seller"))) window.setTimeout(() => openGuide("seller"), 180);
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-guide-close]") || event.target.id === "pageGuideModal") closeGuide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeGuide();
  });

  const observer = new MutationObserver(maybeOpenGuide);
  document.querySelectorAll(".page").forEach((page) => {
    observer.observe(page, { attributes: true, attributeFilter: ["class"] });
  });

  window.addEventListener("load", maybeOpenGuide);
})();
