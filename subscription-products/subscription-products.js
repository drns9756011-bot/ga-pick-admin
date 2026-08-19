const TOKEN_KEY = "pickquoteAdminApiToken";
const input = document.querySelector("#subscriptionExcelInput");
const chooseButton = document.querySelector("#chooseExcelBtn");
const uploadButton = document.querySelector("#uploadExcelBtn");
const authButton = document.querySelector("#adminAuthBtn");
const refreshButton = document.querySelector("#refreshStatusBtn");
const selectedName = document.querySelector("#selectedExcelName");
const statusText = document.querySelector("#uploadStatus");
let selectedFile = null;

const CATEGORY_MAP = {
  TV: "TV",
  "스탠바이미": "TV",
  "냉장고 (일반)": "냉장고",
  "냉장고 (상냉장)": "냉장고",
  "냉장고 (양문형)": "냉장고",
  "냉장고 (얼음정수기)": "냉장고",
  "냉장고 (김치냉장고)": "김치냉장고",
  "세탁기 (드럼)": "세탁기·건조기",
  "세탁기 (건조기)": "세탁기·건조기",
  "세탁기 (워시타워)": "세탁기·건조기",
  "세탁기 (워시콤보)": "세탁기·건조기",
  "세탁기 (미니워시)": "세탁기·건조기",
  "세탁기 (통돌이)": "세탁기·건조기",
  정수기: "정수기",
  얼음정수기: "정수기",
  공기청정기: "공기청정기",
  전기레인지: "주방가전",
  식기세척기: "주방가전",
  광파오븐: "주방가전",
  로봇청소기: "청소기",
  청소기: "청소기",
  "에어컨 (스탠드)": "에어컨",
  "에어컨 (2in1)": "에어컨",
  "에어컨 (벽걸이)": "에어컨",
};

function getToken(force = false) {
  if (force) localStorage.removeItem(TOKEN_KEY);
  const current = localStorage.getItem(TOKEN_KEY) || "";
  if (current && !force) return current;
  const next = window.prompt("관리자 API 토큰을 입력해주세요.", "")?.trim() || "";
  if (next) localStorage.setItem(TOKEN_KEY, next);
  return next;
}

function formatDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "등록 전" : date.toLocaleString("ko-KR");
}

async function parseWorkbookProducts(file) {
  if (!window.XLSX?.read || !window.XLSX?.utils?.sheet_to_json) {
    throw new Error("엑셀 분석 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
  }
  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const worksheet = workbook.Sheets["전자랜드"];
  if (!worksheet) throw new Error("전자랜드 시트를 찾을 수 없습니다.");
  const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: "" });
  const groups = new Map();
  rows.slice(1).forEach((row) => {
    const contractMonths = String(row[7] ?? "").trim();
    const bundleType = String(row[8] ?? "").trim();
    const model = String(row[1] ?? "").trim().toUpperCase();
    const monthlyFee72 = Math.round(Number(String(row[12] ?? "").replaceAll(",", "")));
    if (contractMonths !== "72" || bundleType !== "결합없음" || !model || monthlyFee72 <= 0) return;
    const sourceCategory = String(row[0] ?? "").trim();
    const category = CATEGORY_MAP[sourceCategory] || "생활가전";
    let groupModel = model;
    let installationType = "";
    if (category === "TV") {
      const dotIndex = model.indexOf(".");
      const modelBody = dotIndex >= 0 ? model.slice(0, dotIndex) : model;
      const suffix = dotIndex >= 0 ? model.slice(dotIndex) : "";
      const match = /^(.*)([SW])$/.exec(modelBody);
      if (match) {
        groupModel = `${match[1]}${suffix}`;
        installationType = match[2] === "S" ? "스탠드형" : "벽걸이형";
      }
    }
    const careType = String(row[4] ?? "").trim();
    const careDetail = String(row[5] ?? "").trim();
    const visitCycle = String(row[6] ?? "").trim();
    const label = [installationType, careType, careDetail, visitCycle ? `${visitCycle} 주기` : ""].filter(Boolean).join(" · ") || model;
    const option = { label, model, installationType, careType, careDetail, visitCycle, monthlyFee72 };
    const groupKey = `${category}|${groupModel}`;
    if (!groups.has(groupKey)) groups.set(groupKey, {
      brand: "LG전자",
      category,
      sourceCategory,
      model: groupModel,
      name: `LG ${sourceCategory}`,
      optionMap: new Map(),
    });
    const group = groups.get(groupKey);
    const optionKey = `${model}|${installationType}|${careType}|${careDetail}|${visitCycle}`;
    const previous = group.optionMap.get(optionKey);
    if (!previous || monthlyFee72 < previous.monthlyFee72) group.optionMap.set(optionKey, option);
  });
  const items = [...groups.values()].map((group) => {
    const options = [...group.optionMap.values()].sort((a, b) =>
      a.monthlyFee72 - b.monthlyFee72
        || a.installationType.localeCompare(b.installationType, "ko")
        || a.careType.localeCompare(b.careType, "ko")
        || a.model.localeCompare(b.model, "en")
    );
    const primary = options[0];
    return {
      brand: group.brand,
      category: group.category,
      sourceCategory: group.sourceCategory,
      model: group.model,
      name: group.name,
      monthlyFee72: primary.monthlyFee72,
      careType: primary.careType,
      careDetail: primary.careDetail,
      visitCycle: primary.visitCycle,
      imageUrl: "",
      options,
    };
  }).sort((a, b) =>
    a.category.localeCompare(b.category, "ko")
      || a.sourceCategory.localeCompare(b.sourceCategory, "ko")
      || a.model.localeCompare(b.model, "en")
  );
  if (!items.length || items.length > 3000) throw new Error("72개월·결합없음 상품을 1~3,000개 범위에서 찾을 수 없습니다.");
  return items;
}

async function importProductsInChunks(items) {
  const started = await adminFetch("/api/subscription-products/import/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const setId = started.setId;
  const chunkSize = Math.min(60, Math.max(20, Number(started.chunkSize || 60)));
  const imageMap = started.imageMap || {};
  items.forEach((item) => {
    const primaryModel = item.options?.[0]?.model || "";
    item.imageUrl = imageMap[primaryModel] || imageMap[item.model] || "";
  });
  try {
    for (let offset = 0; offset < items.length; offset += chunkSize) {
      const end = Math.min(items.length, offset + chunkSize);
      statusText.textContent = `서버에 상품을 저장하는 중입니다. ${end.toLocaleString("ko-KR")} / ${items.length.toLocaleString("ko-KR")}`;
      await adminFetch(`/api/subscription-products/import/${encodeURIComponent(setId)}/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset, items: items.slice(offset, end) }),
      });
    }
    return adminFetch(`/api/subscription-products/import/${encodeURIComponent(setId)}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedCount: items.length }),
    });
  } catch (error) {
    await adminFetch(`/api/subscription-products/import/${encodeURIComponent(setId)}`, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}

async function adminFetch(path, options = {}, retry = true) {
  const token = getToken(false);
  if (!token) throw new Error("관리자 인증이 필요합니다.");
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "X-Admin-Token": token, ...(options.headers || {}) },
  });
  if (response.status === 401 && retry) {
    if (!getToken(true)) throw new Error("관리자 인증이 취소되었습니다.");
    return adminFetch(path, options, false);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.message || `서버 요청 실패 (${response.status})`);
  return payload;
}

async function refreshStatus() {
  refreshButton.disabled = true;
  try {
    const payload = await adminFetch("/api/subscription-products/status");
    document.querySelector("#activeProductCount").textContent = payload.active ? `${Number(payload.active.count).toLocaleString("ko-KR")}개` : "등록 전";
    document.querySelector("#lastActivatedAt").textContent = payload.active ? formatDate(payload.active.activatedAt) : "등록 전";
    document.querySelector("#missingImageCount").textContent = payload.active ? `${Number(payload.active.missingImages).toLocaleString("ko-KR")}개` : "등록 전";
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

function resetFile() {
  selectedFile = null;
  input.value = "";
  selectedName.textContent = "선택된 파일 없음";
  uploadButton.disabled = true;
}

chooseButton.addEventListener("click", () => input.click());
input.addEventListener("change", () => {
  const file = input.files?.[0] || null;
  if (!file || !/\.(xlsx|xlsm)$/i.test(file.name)) {
    resetFile();
    statusText.textContent = "xlsx 또는 xlsm 파일을 선택해주세요.";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    resetFile();
    statusText.textContent = "15MB 이하 파일만 업로드할 수 있습니다.";
    return;
  }
  selectedFile = file;
  selectedName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB`;
  statusText.textContent = "서버 데이터 교체 준비가 완료됐습니다.";
  uploadButton.disabled = false;
});

uploadButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  if (!window.confirm("현재 구독 상품 목록을 선택한 엑셀의 최신 데이터로 교체할까요?")) return;
  uploadButton.disabled = true;
  chooseButton.disabled = true;
  statusText.textContent = "엑셀에서 72개월 구독 상품을 확인하는 중입니다.";
  try {
    const products = await parseWorkbookProducts(selectedFile);
    statusText.textContent = `${products.length.toLocaleString("ko-KR")}개 상품을 확인했습니다. 서버 저장을 시작합니다.`;
    const payload = await importProductsInChunks(products);
    statusText.textContent = `${Number(payload.count).toLocaleString("ko-KR")}개 상품으로 교체했습니다. 원본 파일은 저장하지 않았습니다.`;
    resetFile();
    await refreshStatus();
  } catch (error) {
    statusText.textContent = error.message;
    uploadButton.disabled = false;
  } finally {
    chooseButton.disabled = false;
  }
});

authButton.addEventListener("click", () => {
  if (getToken(true)) refreshStatus();
});
refreshButton.addEventListener("click", refreshStatus);
refreshStatus();
