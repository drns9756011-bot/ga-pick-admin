(() => {
  const form = document.querySelector("#requestForm");
  if (!form) return;

  const field = (name) => form.querySelector(`[name="${name}"]`);
  const fields = {
    quoteType: field("quoteType"),
    items: field("items"),
    aiSituation: field("aiSituation"),
    familyComposition: field("familyComposition"),
    budgetStatus: field("budgetStatus"),
    budgetRange: field("budgetRange"),
    purchasePriority: field("purchasePriority"),
    aiRequestSummary: field("aiRequestSummary"),
    aiModelRecommendations: ensureHiddenField("aiModelRecommendations"),
    image: field("quoteImage"),
    customer: field("customer"),
    phone: field("phone"),
    purpose: field("purchasePurpose"),
    brand: field("desiredBrand"),
    price: field("price"),
    region: field("region"),
    installDate: field("installDate"),
    memo: field("memo"),
  };

  const message = form.querySelector("#requestFormMessage") || document.createElement("p");
  const previewTitle = document.querySelector("#previewTitle");
  const previewMeta = document.querySelector("#previewMeta");
  const imagePreview = document.querySelector("#imagePreview");

  const state = {
    stepIndex: 0,
    selectedProducts: [],
    productOptions: {},
    aiContext: {
      situation: "",
      family: [],
      budgetStatus: "",
      budgetRange: "",
      priorities: [],
      note: "",
    },
    catalogs: {},
    recommendationGroups: [],
    recommending: false,
  };

  const quoteTypes = [
    {
      value: "with_quote",
      title: "견적서가 있어요",
      text: "받은 견적서 사진을 올려 판매자 제안가와 혜택을 비교합니다.",
      badge: "정확한 견적 가능",
    },
    {
      value: "without_quote",
      title: "견적서가 없어요",
      text: "품목과 상황을 선택하면 AI가 브랜드별 후보 모델로 간이 견적서를 정리합니다.",
      badge: "",
    },
  ];

  const purposeOptions = [
    { value: "웨딩,혼수 특별혜택", title: "웨딩,혼수", text: "혼수 패키지 조건과 카드 혜택을 함께 비교합니다.", badge: "특별혜택" },
    { value: "신축입주 특별혜택", title: "신축입주", text: "입주 일정에 맞춘 배송, 설치 조건을 확인합니다.", badge: "특별혜택" },
    { value: "이사", title: "이사", text: "이사 일정에 맞춰 필요한 품목을 비교합니다." },
    { value: "인테리어", title: "인테리어", text: "공간과 빌트인 조건을 기준으로 비교합니다." },
    { value: "일반", title: "일반", text: "교체와 단품 구매 조건을 비교합니다." },
  ];

  const brandOptions = [
    { value: "LG전자", title: "LG전자", text: "LG전자 제품 중심으로 제안을 받고 싶어요." },
    { value: "삼성전자", title: "삼성전자", text: "삼성전자 제품 중심으로 제안을 받고 싶어요." },
    { value: "비교견적", title: "비교견적", text: "LG와 삼성 조건을 함께 비교하고 싶어요." },
  ];

  const productOptions = [
    { value: "TV", title: "TV", icon: "TV", thumb: "tv" },
    { value: "라이프스타일 TV", title: "라이프스타일TV", icon: "LS", thumb: "lifestyle" },
    { value: "냉장고", title: "냉장고", icon: "냉", thumb: "fridge" },
    { value: "김치냉장고", title: "김치냉장고", icon: "김", thumb: "kimchi" },
    { value: "세탁기/건조기", title: "세탁기+건조기", icon: "세", thumb: "washer" },
    { value: "의류관리기", title: "의류 관리기", icon: "의", thumb: "styler" },
    { value: "에어컨", title: "에어컨", icon: "에", thumb: "aircon" },
    { value: "청소기", title: "청소기", icon: "청", thumb: "vacuum" },
    { value: "식기세척기", title: "식기세척기", icon: "식", thumb: "dishwasher" },
    { value: "공기청정기", title: "공기청정기", icon: "공", thumb: "purifier" },
  ];

  const optionSchema = {
    TV: [
      { key: "size", title: "화면 크기", type: "single", values: ["43인치", "55인치", "65인치", "75인치", "85인치", "85인치 ↑"] },
    ],
    냉장고: [
      { key: "type", title: "설치 형태", type: "single", values: ["빌트인(핏앤맥스)", "프리스탠딩(용량이 큼)", "모르겠어요"] },
      { key: "door", title: "도어 수", type: "single", values: ["1도어", "2도어", "4도어", "모르겠어요"] },
    ],
    "세탁기/건조기": [
      { key: "type", title: "설치 형태", type: "single", values: ["분리형(병렬/직렬/분리 설치 가능)", "복합형(콤보)", "일체형(원바디, 워시타워)", "모르겠어요"] },
    ],
    청소기: [
      { key: "type", title: "종류", type: "multi", values: ["무선청소기", "로봇청소기", "유선청소기"] },
    ],
    김치냉장고: [
      { key: "type", title: "형태", type: "single", values: ["뚜껑식", "스탠드", "모르겠어요"] },
      { key: "door", title: "스탠드 도어", type: "single", values: ["4도어", "3도어", "1도어", "모르겠어요"] },
    ],
    에어컨: [
      { key: "type", title: "종류", type: "single", values: ["스탠드", "벽걸이", "2IN1", "천장형", "모르겠어요"] },
      { key: "area", title: "냉방 면적", type: "single", values: ["18평", "24평", "34평", "40평형 이상", "모르겠어요"] },
      { key: "rooms", title: "천장형 실 수", type: "single", values: ["3실", "4실", "5실", "6실", "모르겠어요"] },
    ],
    식기세척기: [
      { key: "install", title: "설치 형태", type: "single", values: ["빌트인", "카운터탑", "프리스탠딩", "모르겠어요"] },
    ],
    "인덕션/전기레인지": [
      { key: "install", title: "설치 형태", type: "single", values: ["빌트인 O", "빌트인 X", "모르겠어요"] },
      { key: "burner", title: "화구 수", type: "single", values: ["2구", "3구", "4구", "모르겠어요"] },
    ],
    정수기: [
      { key: "type", title: "종류", type: "single", values: ["냉온정수기", "얼음정수기", "냉정수기", "직수형", "모르겠어요"] },
    ],
    의류관리기: [
      { key: "size", title: "용량", type: "single", values: ["3벌", "5벌", "대용량", "모르겠어요"] },
    ],
    "오븐/전자레인지": [
      { key: "type", title: "종류", type: "multi", values: ["오븐", "전자레인지"] },
    ],
    공기청정기: [
      { key: "area", title: "사용 면적", type: "single", values: ["10평 이하", "10평대", "20평대", "30평대 이상", "모르겠어요"] },
    ],
    제습기: [
      { key: "capacity", title: "용량", type: "single", values: ["10L 이하", "10L대", "20L 이상", "모르겠어요"] },
    ],
    가습기: [
      { key: "type", title: "종류", type: "single", values: ["초음파식", "가열식", "복합식", "대용량", "모르겠어요"] },
    ],
    "라이프스타일 TV": [
      { key: "type", title: "형태", type: "single", values: ["스탠바이미", "모르겠어요"] },
    ],
  };

  const aiSituations = ["혼수/웨딩", "신축 입주", "이사", "교체", "사업장/B2B"];
  const familyOptions = ["1인", "2인", "3~4인", "5인 이상", "아이 있음", "반려동물 있음"];
  const priorityOptions = ["가격", "설치 일정", "배송", "카드 혜택", "공간 맞춤", "프리미엄"];

  const steps = [
    { key: "quoteType", render: renderQuoteType, validate: validateQuoteType },
    { key: "personal", render: renderPersonal, validate: validatePersonal },
    { key: "purpose", render: renderPurpose, validate: validatePurpose },
    { key: "brand", render: renderBrand, validate: validateBrand },
    { key: "products", render: renderProducts, validate: validateProducts, show: isWithoutQuote },
    { key: "options", render: renderOptions, validate: validateOptions, show: isWithoutQuote },
    { key: "ai", render: renderAiContext, validate: validateAiContext, show: shouldUseAiRecommendation },
    { key: "quoteInfo", render: renderQuoteInfo, validate: validateQuoteInfo },
  ];

  installWizard();

  function installWizard() {
    const wizard = document.createElement("div");
    wizard.className = "customer-wizard quote-wizard";
    form.prepend(wizard);
    form.dataset.wizardReady = "true";
    form._wizardSubmitAllowed = false;

    bindNativeFields();
    hideNativeFields();
    render();
    syncAllFields();
  }

  function ensureHiddenField(name) {
    let input = field(name);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.prepend(input);
    }
    return input;
  }

  function bindNativeFields() {
    fields.phone?.addEventListener("input", () => {
      fields.phone.value = formatPhoneInput(fields.phone.value);
    });

    form.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" || event.target?.tagName === "TEXTAREA") return;
        event.preventDefault();
      },
      true
    );

    form.addEventListener(
      "submit",
      (event) => {
        syncAllFields();
        if (!isFinalVisibleStep()) {
          event.preventDefault();
          move(1);
          return;
        }
        if (!validateCurrentStep()) {
          event.preventDefault();
          return;
        }
        form._wizardSubmitAllowed = true;
      },
      true
    );
  }

  function hideNativeFields() {
    [
      fields.image?.closest(".upload-box"),
      fields.customer?.closest("label"),
      fields.phone?.closest("label"),
      fields.purpose?.closest("label"),
      fields.brand?.closest("label"),
      fields.price?.closest("label"),
      fields.region?.closest("label"),
      fields.installDate?.closest("label"),
      fields.memo?.closest("label"),
    ]
      .filter(Boolean)
      .forEach((element) => {
        element.classList.add("wizard-native-hidden");
      });
  }

  function visibleSteps() {
    return steps.filter((step) => !step.show || step.show());
  }

  function currentStep() {
    const list = visibleSteps();
    state.stepIndex = Math.min(state.stepIndex, list.length - 1);
    return list[state.stepIndex];
  }

  function isFinalVisibleStep() {
    return state.stepIndex === visibleSteps().length - 1;
  }

  function render() {
    const step = currentStep();
    const list = visibleSteps();
    const wizard = form.querySelector(".customer-wizard");
    const busyAttr = state.recommending ? "disabled aria-disabled=\"true\"" : "";
    wizard.innerHTML = `
      <div class="wizard-progress" style="--wizard-step-count:${list.length}" aria-label="견적 등록 진행 단계">
        ${list.map((_, index) => `<span class="${index <= state.stepIndex ? "is-active" : ""}"></span>`).join("")}
      </div>
      <div class="wizard-step-label">Step ${state.stepIndex + 1}</div>
      <div class="wizard-step" data-step="${step.key}">${step.render()}</div>
      <div class="wizard-actions">
        ${state.stepIndex > 0 ? '<button type="button" class="wizard-back">이전</button>' : ""}
        <button type="${isFinalVisibleStep() ? "submit" : "button"}" class="wizard-next primary-btn" ${busyAttr}>${state.recommending ? "AI 추천 중" : isFinalVisibleStep() ? "견적 요청 등록" : "다음"}</button>
      </div>
    `;

    wizard.querySelector(".wizard-back")?.addEventListener("click", () => move(-1));
    wizard.querySelector(".wizard-next")?.addEventListener("click", (event) => {
      if (!isFinalVisibleStep()) {
        event.preventDefault();
        move(1);
      }
    });

    bindStepEvents(wizard, step.key);
    updateNativeRequirement();
    updatePreview();
  }

  function move(delta) {
    if (delta > 0 && !validateCurrentStep()) return;
    state.stepIndex = Math.max(0, Math.min(visibleSteps().length - 1, state.stepIndex + delta));
    render();
  }

  function validateCurrentStep() {
    clearMessage();
    syncAllFields();
    const step = currentStep();
    const ok = step.validate();
    updatePreview();
    return ok;
  }

  function setMessage(text) {
    if (!message) return;
    message.textContent = text;
    message.dataset.type = text ? "error" : "";
  }

  function clearMessage() {
    setMessage("");
  }

  function renderQuoteType() {
    return `
      <h3>견적서가 있는지 먼저 선택해주세요.</h3>
      <p>견적서 유무에 따라 필요한 입력 단계가 달라집니다.</p>
      <div class="wizard-choice-grid wizard-choice-grid-two">
        ${quoteTypes.map((item) => choiceCard(item, "wizardQuoteTypeProxy", fields.quoteType.value)).join("")}
      </div>
    `;
  }

  function renderPersonal() {
    return `
      <h3>고객님 정보를 입력해주세요.</h3>
      <p>내 견적 확인과 알림 안내에 필요한 최소 정보만 받습니다.</p>
      <div class="wizard-field-grid">
        <label>고객님 성함<input type="text" data-wizard-field="customer" value="${escapeHtml(fields.customer.value)}" placeholder="예: 홍길동" /></label>
        <label>연락처<input type="text" data-wizard-field="phone" value="${escapeHtml(fields.phone.value)}" placeholder="010-0000-0000" /></label>
      </div>
    `;
  }

  function renderPurpose() {
    return `
      <h3>구매 목적을 선택해주세요.</h3>
      <p>목적에 따라 비교해야 할 혜택과 일정 조건이 달라집니다.</p>
      <div class="wizard-choice-grid">${purposeOptions.map((item) => choiceCard(item, "wizardPurposeProxy", fields.purpose.value)).join("")}</div>
    `;
  }

  function renderBrand() {
    return `
      <h3>브랜드를 선택해주세요.</h3>
      <p>견적서가 없는 경우에도 LG전자, 삼성전자, 비교견적 모두 카탈로그 후보 모델 기준으로 AI가 간이 견적서를 정리합니다.</p>
      <div class="wizard-choice-grid wizard-choice-grid-three">${brandOptions.map((item) => choiceCard(item, "wizardBrandProxy", fields.brand.value)).join("")}</div>
    `;
  }

  function renderProducts() {
    return `
      <h3>구매 예정 품목을 모두 선택해주세요.</h3>
      <p>견적서가 없는 고객님은 선택한 품목 기준으로 판매자에게 요청이 전달됩니다.</p>
      <div class="wizard-product-list">
        ${productOptions
          .map((product) => {
            const checked = state.selectedProducts.includes(product.value);
            return `
              <button type="button" class="wizard-product-card ${checked ? "is-selected" : ""}" data-product="${escapeHtml(product.value)}">
                <span class="wizard-checkbox" aria-hidden="true">${checked ? "✓" : ""}</span>
                <span class="product-thumb product-thumb-${escapeHtml(product.thumb)}" aria-hidden="true"><span>${escapeHtml(product.icon)}</span></span>
                <strong>${escapeHtml(product.title)}</strong>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderOptions() {
    return `
      <h3>선택한 품목의 옵션을 확인해주세요.</h3>
      <p>옵션을 모르시면 해당 품목은 옵션 미선택 상태로 접수할 수 있습니다.</p>
      <div class="wizard-option-list">
        ${state.selectedProducts
          .map((product) => {
            const summary = productOptionSummary(product);
            return `
              <div class="wizard-option-row">
                <div>
                  <strong>${escapeHtml(product)}</strong>
                  <span>${escapeHtml(summary || "옵션 미선택")}</span>
                </div>
                <button type="button" class="secondary-btn wizard-open-option" data-product="${escapeHtml(product)}">옵션 선택</button>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAiContext() {
    return `
      <h3>AI 추천에 필요한 상황을 알려주세요.</h3>
      <p>선택한 브랜드와 품목에 맞춰 후보 모델을 정리합니다. 비교견적은 LG전자와 삼성전자 후보를 함께 검토합니다.</p>
      <div class="wizard-choice-block">
        <h4>구매 목적</h4>
        <div class="wizard-chip-grid">${aiSituations.map((item) => chip(item, "ai-situation", state.aiContext.situation === item)).join("")}</div>
      </div>
      <div class="wizard-choice-block">
        <h4>가족 구성</h4>
        <div class="wizard-chip-grid">${familyOptions.map((item) => chip(item, "ai-family", state.aiContext.family.includes(item))).join("")}</div>
      </div>
      <div class="wizard-choice-block">
        <h4>예산</h4>
        <div class="wizard-chip-grid">
          ${["예산 확정", "예산 미정"].map((item) => chip(item, "ai-budget-status", state.aiContext.budgetStatus === item)).join("")}
        </div>
        <input class="wizard-inline-input" type="text" data-ai-budget-range value="${escapeHtml(state.aiContext.budgetRange)}" placeholder="예: 1,000만원대, 2,000만원 이하" />
      </div>
      <div class="wizard-choice-block">
        <h4>중요한 조건</h4>
        <div class="wizard-chip-grid">${priorityOptions.map((item) => chip(item, "ai-priority", state.aiContext.priorities.includes(item))).join("")}</div>
      </div>
      <label class="wizard-wide-label">추가 상황
        <textarea data-ai-note rows="4" placeholder="예: 34평 신축 입주, 주방은 핏앤맥스 선호, 11월 설치 예정">${escapeHtml(state.aiContext.note)}</textarea>
      </label>
    `;
  }

  function renderQuoteInfo() {
    const showUpload = isWithQuote();
    const showAiNotice = shouldUseAiRecommendation();
    return `
      <h3>${showUpload ? "견적서 이미지와 설치 정보를 확인해주세요." : "설치 정보와 요청사항을 확인해주세요."}</h3>
      <p>${showAiNotice ? "AI가 추천 모델명을 정리하고 네이버 최저가를 기준가로 저장합니다. 견적서에는 금액 없이 모델명만 표시됩니다." : "판매자가 확인할 설치 일정과 요청사항을 입력해주세요."}</p>
      ${showUpload ? renderUploadBox() : ""}
      ${showAiNotice ? renderRecommendationPanel() : ""}
      <div class="wizard-field-grid">
        <label>설치 지역<input type="text" data-wizard-field="region" value="${escapeHtml(fields.region.value)}" placeholder="서울 송파구" /></label>
        <label>설치 예정일<input type="text" data-wizard-field="installDate" value="${escapeHtml(fields.installDate.value)}" placeholder="예: 8월 말, 2026년 8월 15일" /></label>
      </div>
      <label class="wizard-wide-label">추가 요청사항
        <textarea data-wizard-field="memo" rows="4" placeholder="모델명을 입력해주세요.">${escapeHtml(fields.memo.value)}</textarea>
      </label>
    `;
  }

  function renderUploadBox() {
    const count = fields.image?.files?.length || 0;
    return `
      <label class="upload-box wizard-upload-proxy" for="quoteImage">
        <span class="upload-icon">+</span>
        <strong>견적서 이미지 선택</strong>
        <small>견적서가 있는 경우 최소 1장, 최대 4장까지 등록해야 합니다. 현재 ${count}장 선택됨</small>
      </label>
    `;
  }

  function renderRecommendationPanel() {
    const loading = state.recommending ? "<p>AI가 모델 후보를 정리하고 있습니다.</p>" : "";
    const body = state.recommendationGroups.length
      ? state.recommendationGroups
          .map(
            (group) => `
              <div class="ai-recommendation-group">
                <strong>[${escapeHtml(group.product)}]</strong>
                <span>${escapeHtml(group.optionSummary || "상세 옵션 미입력")}</span>
                <ul>${group.models.map((model) => `<li>${escapeHtml(displayModelName(model))}</li>`).join("")}</ul>
              </div>
            `
          )
          .join("")
      : "<p>마지막 단계에서 AI 추천 모델이 자동으로 정리됩니다.</p>";
    return `<div class="ai-recommendation-panel"><b>AI 추천 간이 견적서</b>${loading || body}</div>`;
  }

  function bindStepEvents(root, key) {
    root.querySelectorAll("input[data-choice-name]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.name === "wizardQuoteTypeProxy") {
          fields.quoteType.value = input.value;
          if (input.value === "with_quote") {
            state.selectedProducts = [];
            state.productOptions = {};
            clearAiRecommendation();
          }
        }
        if (input.name === "wizardPurposeProxy") fields.purpose.value = input.value;
        if (input.name === "wizardBrandProxy") {
          fields.brand.value = input.value;
          clearAiRecommendation();
        }
        syncAllFields();
        render();
      });
    });

    root.querySelectorAll("[data-wizard-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const target = field(input.dataset.wizardField);
        if (!target) return;
        target.value = input.dataset.wizardField === "phone" ? formatPhoneInput(input.value) : input.value;
        if (input.dataset.wizardField === "phone") input.value = target.value;
        updatePreview();
      });
    });

    root.querySelectorAll(".wizard-product-card").forEach((button) => {
      button.addEventListener("click", () => {
        const product = button.dataset.product;
        if (state.selectedProducts.includes(product)) {
          state.selectedProducts = state.selectedProducts.filter((item) => item !== product);
          delete state.productOptions[product];
        } else {
          state.selectedProducts.push(product);
        }
        clearAiRecommendation();
        syncAllFields();
        render();
      });
    });

    root.querySelectorAll(".wizard-open-option").forEach((button) => {
      button.addEventListener("click", () => openOptionModal(button.dataset.product));
    });

    root.querySelectorAll("[data-ai-situation]").forEach((button) => {
      button.addEventListener("click", () => {
        state.aiContext.situation = button.dataset.aiSituation;
        syncAllFields();
        render();
      });
    });

    root.querySelectorAll("[data-ai-family]").forEach((button) => {
      button.addEventListener("click", () => toggleArray(state.aiContext.family, button.dataset.aiFamily));
    });

    root.querySelectorAll("[data-ai-budget-status]").forEach((button) => {
      button.addEventListener("click", () => {
        state.aiContext.budgetStatus = button.dataset.aiBudgetStatus;
        syncAllFields();
        render();
      });
    });

    root.querySelector("[data-ai-budget-range]")?.addEventListener("input", (event) => {
      state.aiContext.budgetRange = event.target.value;
      syncAllFields();
    });

    root.querySelectorAll("[data-ai-priority]").forEach((button) => {
      button.addEventListener("click", () => toggleArray(state.aiContext.priorities, button.dataset.aiPriority));
    });

    root.querySelector("[data-ai-note]")?.addEventListener("input", (event) => {
      state.aiContext.note = event.target.value;
      syncAllFields();
    });

    if (key === "quoteInfo" && shouldUseAiRecommendation() && !state.recommending && !state.recommendationGroups.length) {
      runAiRecommendation();
    }
  }

  function toggleArray(array, value) {
    const index = array.indexOf(value);
    if (index >= 0) array.splice(index, 1);
    else array.push(value);
    syncAllFields();
    render();
  }

  function choiceCard(item, name, currentValue) {
    const checked = currentValue === item.value;
    return `
      <label class="wizard-choice-card ${checked ? "is-selected" : ""}">
        <input type="radio" name="${name}" value="${escapeHtml(item.value)}" ${checked ? "checked" : ""} data-choice-name="${name}" />
        <span class="wizard-radio" aria-hidden="true">${checked ? "✓" : ""}</span>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.text || "")}</small>
        </span>
        ${item.badge ? `<em>${escapeHtml(item.badge)}</em>` : ""}
      </label>
    `;
  }

  function chip(label, name, selected) {
    const attr = `data-${name}="${escapeHtml(label)}"`;
    return `<button type="button" class="wizard-chip ${selected ? "is-selected" : ""}" ${attr}>${escapeHtml(label)}</button>`;
  }

  function openOptionModal(product) {
    const schema = optionSchema[product] || [];
    const draft = { ...(state.productOptions[product] || {}) };
    const modal = document.createElement("div");
    modal.className = "option-modal is-open";
    modal.innerHTML = `
      <div class="option-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(product)} 옵션 선택">
        <button type="button" class="option-close" aria-label="닫기">×</button>
        <h3>${escapeHtml(product)}</h3>
        <div class="option-section-wrap">
          ${schema.map((section) => renderOptionSection(product, section, draft)).join("")}
        </div>
        <div class="option-actions">
          <button type="button" class="secondary-btn option-clear">옵션 초기화</button>
          <button type="button" class="primary-btn option-save">확인</button>
        </div>
      </div>
    `;
    document.body.append(modal);
    document.body.classList.add("modal-open");

    const close = () => {
      modal.remove();
      document.body.classList.remove("modal-open");
    };
    modal.querySelector(".option-close").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    modal.querySelectorAll(".option-row input").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.type === "radio") {
          modal.querySelectorAll(`input[name="${input.name}"]`).forEach((peer) => {
            const mark = peer.closest(".option-row")?.querySelector("b");
            if (mark) mark.textContent = peer.checked ? "✓" : "";
          });
          return;
        }
        const mark = input.closest(".option-row")?.querySelector("b");
        if (mark) mark.textContent = input.checked ? "✓" : "";
      });
    });
    modal.querySelector(".option-clear").addEventListener("click", () => {
      delete state.productOptions[product];
      clearAiRecommendation();
      syncAllFields();
      close();
      render();
    });
    modal.querySelector(".option-save").addEventListener("click", () => {
      const next = {};
      schema.forEach((section) => {
        const checked = [...modal.querySelectorAll(`[name="option-${section.key}"]:checked`)].map((input) => input.value);
        next[section.key] = section.type === "multi" ? checked : checked[0] || "";
      });
      state.productOptions[product] = next;
      clearAiRecommendation();
      syncAllFields();
      close();
      render();
    });
  }

  function renderOptionSection(product, section, draft) {
    const values = Array.isArray(draft[section.key]) ? draft[section.key] : [draft[section.key]].filter(Boolean);
    return `
      <section class="option-section">
        <h4>${escapeHtml(section.title)}</h4>
        ${section.values
          .map((value) => {
            const checked = values.includes(value);
            return `
              <label class="option-row">
                <span>${escapeHtml(value)}</span>
                <input type="${section.type === "multi" ? "checkbox" : "radio"}" name="option-${section.key}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} />
                <b aria-hidden="true">${checked ? "✓" : ""}</b>
              </label>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function validateQuoteType() {
    if (fields.quoteType.value) return true;
    setMessage("견적서 유무를 선택해주세요.");
    return false;
  }

  function validatePersonal() {
    if (!fields.customer.value.trim()) {
      setMessage("고객님 성함을 입력해주세요.");
      return false;
    }
    if (onlyDigits(fields.phone.value).length < 9) {
      setMessage("연락처를 정확히 입력해주세요.");
      return false;
    }
    return true;
  }

  function validatePurpose() {
    if (fields.purpose.value) return true;
    setMessage("구매 목적을 선택해주세요.");
    return false;
  }

  function validateBrand() {
    if (fields.brand.value) return true;
    setMessage("브랜드를 선택해주세요.");
    return false;
  }

  function validateProducts() {
    if (state.selectedProducts.length) return true;
    setMessage("견적서가 없는 경우 구매 예정 품목을 선택해주세요.");
    return false;
  }

  function validateOptions() {
    return true;
  }

  function validateAiContext() {
    if (!shouldUseAiRecommendation()) return true;
    if (!state.aiContext.situation) {
      setMessage("AI 추천을 위해 구매 목적을 선택해주세요.");
      return false;
    }
    if (!state.aiContext.family.length) {
      setMessage("AI 추천을 위해 가족 구성을 선택해주세요.");
      return false;
    }
    if (!state.aiContext.budgetStatus) {
      setMessage("AI 추천을 위해 예산 여부를 선택해주세요.");
      return false;
    }
    return true;
  }

  function validateQuoteInfo() {
    if (state.recommending) {
      setMessage("AI가 추천 모델을 찾고 있습니다. 잠시만 기다려주세요.");
      return false;
    }
    if (shouldUseAiRecommendation() && !state.recommendationGroups.length) {
      setMessage("AI 추천 모델이 아직 정리되지 않았습니다. 잠시 후 다시 시도해주세요.");
      runAiRecommendation();
      return false;
    }
    if (isWithQuote() && (!fields.image.files || !fields.image.files.length)) {
      setMessage("견적서가 있는 경우 견적서 이미지를 최소 1장 첨부해주세요.");
      return false;
    }
    if (!fields.region.value.trim()) {
      setMessage("설치 지역을 입력해주세요.");
      return false;
    }
    if (!fields.installDate.value.trim()) {
      setMessage("설치 예정일을 입력해주세요.");
      return false;
    }
    syncAllFields();
    return true;
  }

  function isWithQuote() {
    return fields.quoteType.value === "with_quote";
  }

  function isWithoutQuote() {
    return fields.quoteType.value === "without_quote";
  }

  function shouldUseAiRecommendation() {
    return isWithoutQuote() && ["LG전자", "삼성전자", "비교견적"].includes(fields.brand.value);
  }

  function updateNativeRequirement() {
    if (fields.image) fields.image.required = isWithQuote();
    if (fields.price) fields.price.required = false;
  }

  function syncAllFields() {
    fields.items.value = buildItemsValue();
    fields.aiSituation.value = state.aiContext.situation;
    fields.familyComposition.value = state.aiContext.family.join(", ");
    fields.budgetStatus.value = state.aiContext.budgetStatus;
    fields.budgetRange.value = state.aiContext.budgetRange;
    fields.purchasePriority.value = state.aiContext.priorities.join(", ");
    fields.aiRequestSummary.value = buildAiSummary();
    if (!shouldUseAiRecommendation()) fields.aiModelRecommendations.value = "";
    if (isWithQuote()) {
      fields.items.value = "견적서 첨부";
      fields.price.value = "0";
    }
    updateNativeRequirement();
  }

  function buildItemsValue() {
    if (isWithQuote()) return "견적서 첨부";
    return state.selectedProducts
      .map((product) => {
        const summary = productOptionSummary(product);
        return summary ? `${product} (${summary})` : product;
      })
      .join(", ");
  }

  function productOptionSummary(product) {
    const options = state.productOptions[product] || {};
    const parts = [];
    Object.values(options).forEach((value) => {
      if (Array.isArray(value)) parts.push(...value.filter(Boolean));
      else if (value) parts.push(value);
    });
    return parts.filter((item) => item !== "모르겠어요").join(" · ");
  }

  function buildAiSummary() {
    if (!shouldUseAiRecommendation()) return "";
    const lines = [
      "고객의 상황에 맞춰 AI가 추천한 모델임을 알려드립니다.",
      state.aiContext.situation ? `구매 목적: ${state.aiContext.situation}` : "",
      state.aiContext.family.length ? `가족 구성: ${state.aiContext.family.join(", ")}` : "",
      state.aiContext.budgetStatus ? `예산: ${state.aiContext.budgetStatus}${state.aiContext.budgetRange ? ` (${state.aiContext.budgetRange})` : ""}` : "",
      state.aiContext.priorities.length ? `중요 조건: ${state.aiContext.priorities.join(", ")}` : "",
      state.aiContext.note ? `추가 상황: ${state.aiContext.note}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function clearAiRecommendation() {
    state.recommendationGroups = [];
    fields.aiModelRecommendations.value = "";
    if (isWithoutQuote()) fields.price.value = "0";
  }

  async function runAiRecommendation() {
    state.recommending = true;
    showAiRecommendationLoading();
    render();
    try {
      const groups = await buildAiModelRecommendations();
      state.recommendationGroups = groups;
      fields.aiModelRecommendations.value = recommendationsToText(groups);
      applyAutoLowestPrice(groups);
    } catch (error) {
      console.warn("AI recommendation failed", error);
      fields.aiModelRecommendations.value = fallbackRecommendationText();
      fields.price.value = "0";
    } finally {
      state.recommending = false;
      hideAiRecommendationLoading();
      syncAllFields();
      render();
    }
  }

  function showAiRecommendationLoading() {
    const modal = document.querySelector("#serverLoadingModal");
    const title = document.querySelector("#serverLoadingTitle");
    const text = document.querySelector("#serverLoadingText");
    const brandLabel = selectedAiBrandLabel();
    if (title) title.textContent = "AI가 추천모델을 찾는 중입니다.";
    if (text) text.textContent = `선택한 품목, 옵션, 예산을 기준으로 판매 가능한 ${brandLabel} 후보 모델을 정리하고 있습니다.`;
    if (modal) modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function hideAiRecommendationLoading() {
    const modal = document.querySelector("#serverLoadingModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function selectedAiBrandLabel() {
    if (fields.brand.value === "삼성전자") return "삼성전자";
    if (fields.brand.value === "비교견적") return "LG전자와 삼성전자";
    return "LG전자";
  }

  async function loadCatalogByBrand(brand) {
    if (state.catalogs[brand]) return state.catalogs[brand];
    const path = brand === "삼성전자" ? "/assets/samsung-catalog-product-model-map.json" : "/assets/pickquote-product-model-map.json";
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error("catalog load failed");
    state.catalogs[brand] = await response.json();
    return state.catalogs[brand];
  }

  async function loadCatalog() {
    if (fields.brand.value === "삼성전자") return loadCatalogByBrand("삼성전자");
    if (fields.brand.value !== "비교견적") return loadCatalogByBrand("LG전자");

    const [lgCatalog, samsungCatalog] = await Promise.all([loadCatalogByBrand("LG전자"), loadCatalogByBrand("삼성전자")]);
    const merged = {};
    productOptions.forEach((product) => {
      const key = product.value;
      const lgModels = Array.isArray(lgCatalog?.[key]?.models) ? lgCatalog[key].models.map((model) => ({ ...model, brand: model.brand || "LG전자" })) : [];
      const samsungModels = Array.isArray(samsungCatalog?.[key]?.models) ? samsungCatalog[key].models.map((model) => ({ ...model, brand: model.brand || "삼성전자" })) : [];
      merged[key] = { brand: "비교견적", source: "merged_lg_samsung_catalogues", models: [...lgModels, ...samsungModels] };
    });
    return merged;
  }

  async function buildAiModelRecommendations() {
    const catalog = await loadCatalog();
    const selectedProducts = state.selectedProducts.filter(Boolean);
    const totalWeight = selectedProducts.reduce((sum, product) => sum + productBudgetWeight(product), 0) || 1;
    const budgetWon = parseBudgetWon(state.aiContext.budgetRange);
    const groups = [];
    for (const product of selectedProducts) {
      const models = Array.isArray(catalog?.[product]?.models) ? catalog[product].models : [];
      const candidates = filterModelsByProductOptions(product, models);
      const targetPrice = budgetWon
        ? Math.round((budgetWon * productBudgetWeight(product)) / totalWeight)
        : defaultTargetPrice(product, candidates);
      const shortlist = rankModelCandidates(product, candidates, targetPrice).slice(0, 14);
      const enriched = [];
      for (const model of shortlist) {
        const lowest = await fetchLowestPrice(model.modelName);
        enriched.push({ ...model, naverLowestPrice: lowest || 0 });
      }
      const chosen = chooseRecommendedModel(product, enriched.length ? enriched : shortlist, targetPrice);
      groups.push({
        product,
        optionSummary: productOptionSummary(product),
        targetPrice,
        models: chosen ? [chosen] : [{ modelName: "판매자 상담 후 모델 확정", normalPrice: 0, naverLowestPrice: 0 }],
      });
    }
    return groups;
  }

  function filterModelsByProductOptions(product, models) {
    const options = state.productOptions[product] || {};
    const normalized = models
      .filter((model) => model && model.modelName)
      .map((model) => ({ ...model, normalPrice: Number(model.normalPrice || 0) }))
      .sort((a, b) => b.normalPrice - a.normalPrice);
    const matchers = [];

    if (product === "TV" && options.size) {
      const selectedSize = Number(options.size.match(/\d+/)?.[0] || 0);
      const isOrAbove = options.size.includes("↑") || options.size.includes("이상");
      if (selectedSize) {
        matchers.push((model) => {
          const inches = extractTvInches(model.modelName);
          if (!inches) return false;
          return isOrAbove ? inches >= selectedSize : inches === selectedSize;
        });
      }
    }

    if (product === "냉장고") {
      if (options.type?.includes("빌트인")) matchers.push((model) => isBuiltInFridgeModel(model));
      if (options.type?.includes("프리스탠딩")) matchers.push((model) => isFreeStandingFridgeModel(model));
      if (options.door === "4도어") matchers.push((model) => isFourDoorFridgeModel(model));
      if (options.door === "2도어") matchers.push((model) => isTwoDoorFridgeModel(model));
    }

    if (product === "세탁기/건조기" && options.type) {
      if (options.type.includes("분리형")) matchers.push((model) => /(F\d{2}|RH|RD|세탁|건조)/i.test(modelSearchText(model)) && !/워시타워|원바디|콤보/i.test(modelSearchText(model)));
      if (options.type.includes("복합형")) matchers.push((model) => /콤보|세탁건조|FX|FH/i.test(modelSearchText(model)) && !/^TR/i.test(modelBody(model)));
      if (options.type.includes("일체형")) matchers.push((model) => /워시|타워|원바디|W\d{2}|WL|WK/i.test(modelSearchText(model)));
    }

    if (product === "청소기" && Array.isArray(options.type) && options.type.length) {
      matchers.push((model) => options.type.some((type) => modelSearchText(model).includes(type.replace("청소기", ""))));
    }
    if (product === "김치냉장고") {
      matchers.push((model) => /김치|Z\d{3}/i.test(modelSearchText(model)));
      if (options.door === "4도어") matchers.push((model) => /4도어|Z4|Z5/i.test(modelSearchText(model)));
      if (options.door === "3도어") matchers.push((model) => /3도어|Z3/i.test(modelSearchText(model)));
      if (options.type === "뚜껑식") matchers.push((model) => /뚜껑|K\d{3}|Z1/i.test(modelSearchText(model)));
    }
    if (product === "에어컨" && options.type) {
      if (options.type === "천장형") matchers.push((model) => /천장|시스템/i.test(modelSearchText(model)));
      if (options.type === "2IN1") matchers.push((model) => /2IN1|2in1|투인원|멀티|FQ.*2/i.test(modelSearchText(model)));
      if (options.type === "스탠드") matchers.push((model) => /스탠드|FQ/i.test(modelSearchText(model)));
      if (options.type === "벽걸이") matchers.push((model) => /벽걸이|SQ|SW/i.test(modelSearchText(model)));
    }
    if (product === "식기세척기") matchers.push((model) => /식기|식세|D[FBE]/i.test(modelSearchText(model)));
    if (product === "인덕션/전기레인지") matchers.push((model) => /인덕션|전기레인지|하이라이트|BE|CB/i.test(modelSearchText(model)));
    if (product === "오븐/전자레인지") matchers.push((model) => /오븐|전자레인지|ML|MW/i.test(modelSearchText(model)));
    if (product === "공기청정기") matchers.push((model) => /공기|퓨리|청정|AS/i.test(modelSearchText(model)));
    if (product === "의류관리기") matchers.push((model) => /스타일러|의류|SC|S5|S3/i.test(modelSearchText(model)));
    if (product === "라이프스타일 TV") matchers.push((model) => /스탠바이미|stanbyme|27LX|32LX|라이프/i.test(modelSearchText(model)));

    const matched = matchers.length ? normalized.filter((model) => matchers.every((matcher) => matcher(model))) : normalized;
    return matched.length ? matched : normalized;
  }

  function modelSearchText(model) {
    return [model?.modelName, model?.productGroup, model?.category, model?.title].filter(Boolean).join(" ");
  }

  function compactModelName(value) {
    return String(value || "").toUpperCase().replace(/\s+/g, "");
  }

  function modelBody(value) {
    const source = typeof value === "object" ? value?.modelName : value;
    return compactModelName(source).split(".")[0];
  }

  function isBuiltInFridgeModel(value) {
    const body = modelBody(value);
    const text = compactModelName(modelSearchText(value));
    if (/^(W|B18|B182|A202|D\d{3})/.test(body)) return false;
    if (/얼음|정수|와인|김치/.test(modelSearchText(value))) return false;
    return /^G\d{3}/.test(body) || /^RF\d{2}/.test(body) || /GBB|핏앤맥스|FIT&?MAX|FIT앤MAX|키친핏|BESPOKE|비스포크/.test(text);
  }

  function isFreeStandingFridgeModel(value) {
    const text = modelSearchText(value);
    return !isBuiltInFridgeModel(value) && !/김치|와인|핏앤맥스|fit\s?&?\s?max|키친핏/i.test(text);
  }

  function isFourDoorFridgeModel(value) {
    const body = modelBody(value);
    const text = compactModelName(modelSearchText(value));
    if (/^(B18|B182|A202|D\d{3})/.test(body)) return false;
    return /4도어|노크온|상냉장|매직스페이스|키친핏/.test(modelSearchText(value)) || /^(G|M|T|W|RF)\d{2,3}/.test(body) || /GBB|BESPOKE/.test(text);
  }

  function isTwoDoorFridgeModel(value) {
    const body = modelBody(value);
    return /2도어|양문형|일반냉장고/i.test(modelSearchText(value)) || /^(B18|B182|D\d{3}|RS|RT|RB)/.test(body);
  }

  function productBudgetWeight(product) {
    return {
      TV: 1.45,
      "라이프스타일 TV": 0.7,
      냉장고: 1.25,
      김치냉장고: 0.95,
      "세탁기/건조기": 1.35,
      의류관리기: 0.75,
      에어컨: 1.25,
      청소기: 0.45,
      식기세척기: 0.55,
      공기청정기: 0.4,
      "인덕션/전기레인지": 0.55,
      "오븐/전자레인지": 0.35,
    }[product] || 0.8;
  }

  function parseBudgetWon(value) {
    const source = String(value || "").replace(/,/g, "").trim();
    if (!source) return 0;
    const numbers = [...source.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])).filter(Boolean);
    if (!numbers.length) return 0;
    const number = Math.max(...numbers);
    if (/억/.test(source)) return Math.round(number * 100000000);
    if (/만원|만/.test(source) || number < 100000) return Math.round(number * 10000);
    return Math.round(number);
  }

  function defaultTargetPrice(product, candidates) {
    const prices = candidates.map((model) => Number(model.normalPrice || 0)).filter(Boolean).sort((a, b) => a - b);
    if (!prices.length) return productBudgetWeight(product) * 1800000;
    const indexRatio = isPremiumAiContext() ? 0.72 : 0.58;
    return prices[Math.min(prices.length - 1, Math.floor(prices.length * indexRatio))];
  }

  function isPremiumAiContext() {
    const text = [state.aiContext.situation, state.aiContext.budgetRange, ...state.aiContext.priorities, state.aiContext.note].join(" ");
    return /혼수|웨딩|신축|입주|프리미엄|하이엔드|오브제|핏앤맥스/i.test(text);
  }

  function estimatedOnlinePrice(model) {
    const normalPrice = Number(model?.normalPrice || 0);
    return normalPrice ? Math.round(normalPrice * 0.62) : 0;
  }

  function rankModelCandidates(product, candidates, targetPrice) {
    const premium = isPremiumAiContext();
    return [...candidates].sort((a, b) => modelPreScore(product, a, targetPrice, premium) - modelPreScore(product, b, targetPrice, premium));
  }

  function modelPreScore(product, model, targetPrice, premium) {
    const price = estimatedOnlinePrice(model) || Number(model.normalPrice || 0) || targetPrice || 1;
    const target = targetPrice || price || 1;
    let score = Math.abs(price - target) / target;
    if (premium && price < target * 0.72) score += 0.9;
    if (!premium && price < target * 0.5) score += 0.35;
    if (price > target * 1.65) score += 0.25;
    return score + modelQualityAdjustment(product, model);
  }

  function chooseRecommendedModel(product, candidates, targetPrice) {
    const premium = isPremiumAiContext();
    return [...candidates]
      .filter((model) => model && model.modelName)
      .sort((a, b) => {
        const aPrice = Number(a.naverLowestPrice || 0) > 100000 ? Number(a.naverLowestPrice) : estimatedOnlinePrice(a);
        const bPrice = Number(b.naverLowestPrice || 0) > 100000 ? Number(b.naverLowestPrice) : estimatedOnlinePrice(b);
        const target = targetPrice || Math.max(aPrice, bPrice, 1);
        let aScore = Math.abs(aPrice - target) / target;
        let bScore = Math.abs(bPrice - target) / target;
        if (premium && aPrice < target * 0.72) aScore += 0.95;
        if (premium && bPrice < target * 0.72) bScore += 0.95;
        if (!premium && aPrice < target * 0.5) aScore += 0.35;
        if (!premium && bPrice < target * 0.5) bScore += 0.35;
        if (aPrice > target * 1.65) aScore += 0.2;
        if (bPrice > target * 1.65) bScore += 0.2;
        if (a.catalogueHit) aScore -= 0.08;
        if (b.catalogueHit) bScore -= 0.08;
        return aScore + modelQualityAdjustment(product, a) - (bScore + modelQualityAdjustment(product, b));
      })[0];
  }

  function modelQualityAdjustment(product, model) {
    const name = String(typeof model === "object" ? model?.modelName : model || "").toUpperCase();
    const text = modelSearchText(typeof model === "object" ? model : { modelName: name }).toUpperCase();
    const brand = typeof model === "object" ? model?.brand || "" : "";
    let score = 0;
    if (product === "TV") {
      if (/OLED|QNED9|QNED8/.test(name)) score -= 0.18;
      if (/^(KQ|QN).*9|OLED|NEO/.test(name) || /NEO QLED|OLED/.test(text)) score -= 0.18;
      if (/QNED70|NANO70/.test(name)) score += 0.22;
      if (/^KU/.test(name)) score += 0.18;
    }
    if (product === "냉장고") {
      const body = modelBody(name);
      if (/^G646|GBB|핏앤맥스|FIT/.test(name) || /^G\d{3}/.test(body)) score -= 0.45;
      if (/^RF\d{2}/.test(body) || /키친핏|BESPOKE|비스포크/.test(text)) score -= 0.35;
      if (/W826|W825|M87|T87|오브제/.test(name)) score -= 0.08;
      if (/^W\d{3}/.test(body)) score += 0.25;
      if (/B18|B182|A202|^D\d{3}|^RT|^RB/.test(name)) score += 0.48;
    }
    if (product === "세탁기/건조기") {
      if (/FX|FH|W2|WL|WK/.test(name)) score -= 0.18;
      if (/WD|WR|BESPOKE|콤보/.test(text)) score -= 0.16;
      if (/TR16|RH9|단품/.test(name)) score += 0.4;
    }
    if (product === "김치냉장고" && /^RQ/.test(name)) score -= 0.15;
    if (product === "청소기" && /B95|B94|A9/.test(name)) score -= 0.12;
    if (product === "청소기" && /^VS/.test(name)) score -= 0.1;
    if (product === "의류관리기" && /SC5|S5/.test(name)) score -= 0.12;
    if (product === "의류관리기" && /^DF/.test(name)) score -= 0.12;
    if (brand === "삼성전자" && fields.brand.value === "삼성전자") score -= 0.03;
    return score;
  }

  function extractTvInches(modelName) {
    const name = String(modelName || "").toUpperCase().replace(/\s+/g, "");
    const patterns = [
      /OLED(\d{2,3})/,
      /(?:KQ|KU|QN|QA|UN|TQ|LH|KMR|MNA)(\d{2,3})/,
      /^(\d{2,3})(?:QNED|NANO)/,
      /(^|[^A-Z0-9])(\d{2,3})(?:QNED|NANO)/,
    ];

    for (const pattern of patterns) {
      const match = name.match(pattern);
      const raw = match?.[2] || match?.[1];
      const inches = Number(raw || 0);
      if (inches >= 20 && inches <= 120) return inches;
    }
    return 0;
  }

  async function fetchLowestPrice(modelName) {
    try {
      const response = await fetch(`/api/naver-shopping-lowest?query=${encodeURIComponent(modelName)}`, { cache: "no-store" });
      if (!response.ok) return 0;
      const data = await response.json();
      if (!data.ok || data.confidence !== "exact-model-filtered") return 0;
      return Number(data.lowestPrice || 0);
    } catch {
      return 0;
    }
  }

  function recommendationsToText(groups) {
    const lines = ["고객의 상황에 맞춰 AI가 추천한 모델임을 알려드립니다."];
    groups.forEach((group) => {
      lines.push("");
      lines.push(`[${group.product}]${group.optionSummary ? ` ${group.optionSummary}` : ""}`);
      group.models.forEach((model) => lines.push(`- ${displayModelName(model)}`));
    });
    return lines.join("\n").trim();
  }

  function displayModelName(model) {
    const brand = model?.brand && fields.brand.value === "비교견적" ? `[${model.brand}] ` : "";
    return `${brand}${model?.modelName || "판매자 상담 후 모델 확정"}`;
  }

  function fallbackRecommendationText() {
    const lines = ["고객의 상황에 맞춰 AI가 추천한 모델임을 알려드립니다."];
    state.selectedProducts.forEach((product) => {
      lines.push("");
      lines.push(`[${product}]${productOptionSummary(product) ? ` ${productOptionSummary(product)}` : ""}`);
      lines.push("- 판매자 상담 후 모델 확정");
    });
    return lines.join("\n").trim();
  }

  function applyAutoLowestPrice(groups) {
    const total = groups.reduce((sum, group) => {
      const model = group.models?.[0];
      const naverPrice = Number(model?.naverLowestPrice || 0);
      const price = naverPrice > 100000 ? naverPrice : estimatedOnlinePrice(model);
      return sum + (price > 100000 ? price : 0);
    }, 0);
    fields.price.value = total ? String(Math.ceil(total / 10000)) : "0";
  }

  function updatePreview() {
    if (previewTitle) previewTitle.textContent = buildItemsValue() || "견적 요청서가 여기에 표시됩니다.";
    if (previewMeta) {
      const brand = fields.brand.value || "브랜드 미선택";
      const region = fields.region.value || "지역 미입력";
      const type = isWithoutQuote() ? "견적서 없음" : isWithQuote() ? "견적서 있음" : "견적서 유무 미선택";
      previewMeta.textContent = `${type} · ${brand} · ${region}`;
    }
    if (imagePreview && isWithoutQuote()) {
      imagePreview.innerHTML = "<span>견적서 없이 AI 추천 정보로 접수됩니다.</span>";
    }
  }

  function formatPhoneInput(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.startsWith("02")) {
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    }
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
