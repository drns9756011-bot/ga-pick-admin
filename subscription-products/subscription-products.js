const TOKEN_KEY = "pickquoteAdminApiToken";
const input = document.querySelector("#subscriptionExcelInput");
const chooseButton = document.querySelector("#chooseExcelBtn");
const uploadButton = document.querySelector("#uploadExcelBtn");
const authButton = document.querySelector("#adminAuthBtn");
const refreshButton = document.querySelector("#refreshStatusBtn");
const selectedName = document.querySelector("#selectedExcelName");
const statusText = document.querySelector("#uploadStatus");
let selectedFile = null;

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
  statusText.textContent = "서버에서 엑셀을 검증하고 최신 데이터로 교체하는 중입니다.";
  try {
    const form = new FormData();
    form.append("file", selectedFile, selectedFile.name);
    const payload = await adminFetch("/api/subscription-products/upload", { method: "POST", body: form });
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
