(() => {
  if (window.__pickquoteServerLoadingInstalled) return;
  window.__pickquoteServerLoadingInstalled = true;

  const originalFetch = window.fetch.bind(window);
  let activeRequests = 0;
  let requestFailed = false;
  let closeTimer = 0;
  let delayTimer = 0;

  function isServerApiRequest(input) {
    try {
      const value = input instanceof Request ? input.url : String(input || "");
      return new URL(value, window.location.href).pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }

  function ensureModal() {
    let modal = document.querySelector("#globalServerLoadingModal");
    if (modal) return modal;

    const style = document.createElement("style");
    style.textContent = `
      .global-server-loading[hidden]{display:none!important}
      .global-server-loading{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(7,25,45,.7);backdrop-filter:blur(2px)}
      .global-server-loading__panel{width:min(390px,100%);padding:30px 26px;text-align:center;background:#fff;border:1px solid #cbd8e4;border-radius:8px;box-shadow:0 24px 70px rgba(4,19,35,.25)}
      .global-server-loading__mark{width:52px;height:52px;margin:0 auto 18px;display:grid;place-items:center;border-radius:50%;background:#174a7c;color:#fff;font-size:22px;font-weight:900}
      .global-server-loading__spinner{width:26px;height:26px;margin:0 auto 18px;border:3px solid #dbe5ee;border-top-color:#174a7c;border-radius:50%;animation:global-server-spin .75s linear infinite}
      .global-server-loading__title{margin:0;color:#102c4c;font-size:20px;line-height:1.45}
      .global-server-loading__text{margin:8px 0 0;color:#65778a;font-size:14px;line-height:1.6}
      .global-server-loading.is-success .global-server-loading__mark{background:#176b55}
      .global-server-loading.is-error .global-server-loading__mark{background:#bd3f36}
      .global-server-loading.is-success .global-server-loading__spinner,.global-server-loading.is-error .global-server-loading__spinner{display:none}
      @keyframes global-server-spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);

    modal = document.createElement("div");
    modal.id = "globalServerLoadingModal";
    modal.className = "global-server-loading";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "globalServerLoadingTitle");
    modal.innerHTML = `
      <div class="global-server-loading__panel">
        <div class="global-server-loading__mark" aria-hidden="true">P</div>
        <div class="global-server-loading__spinner" aria-hidden="true"></div>
        <h2 class="global-server-loading__title" id="globalServerLoadingTitle">서버 정보를 불러오는 중입니다.</h2>
        <p class="global-server-loading__text">잠시만 기다려주세요.</p>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function setModalState(state, title, text) {
    const modal = ensureModal();
    modal.classList.toggle("is-success", state === "success");
    modal.classList.toggle("is-error", state === "error");
    modal.querySelector(".global-server-loading__title").textContent = title;
    modal.querySelector(".global-server-loading__text").textContent = text;
    modal.hidden = false;
  }

  function beginRequest(method) {
    window.clearTimeout(closeTimer);
    activeRequests += 1;
    if (activeRequests === 1) {
      requestFailed = false;
      const sending = !["GET", "HEAD"].includes(String(method || "GET").toUpperCase());
      setModalState("loading", sending ? "서버에 전송하는 중입니다." : "서버 정보를 불러오는 중입니다.", "잠시만 기다려주세요.");
      window.clearTimeout(delayTimer);
      delayTimer = window.setTimeout(() => {
        if (activeRequests > 0) setModalState("loading", "서버 응답을 기다리고 있습니다.", "평소보다 처리가 조금 지연되고 있습니다.");
      }, 8000);
    }
  }

  function finishRequest(failed) {
    requestFailed = requestFailed || failed;
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests > 0) return;

    window.clearTimeout(delayTimer);
    if (requestFailed) {
      setModalState("error", "서버 요청에 실패했습니다.", "잠시 후 다시 시도해주세요.");
      closeTimer = window.setTimeout(() => { ensureModal().hidden = true; }, 1600);
    } else {
      setModalState("success", "처리가 완료되었습니다.", "서버 응답을 정상적으로 받았습니다.");
      closeTimer = window.setTimeout(() => { ensureModal().hidden = true; }, 450);
    }
  }

  window.fetch = async function pickquoteServerFetch(input, init = {}) {
    if (!isServerApiRequest(input)) return originalFetch(input, init);
    const method = String(init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    beginRequest(method);
    try {
      const response = await originalFetch(input, init);
      finishRequest(!response.ok);
      return response;
    } catch (error) {
      finishRequest(true);
      throw error;
    }
  };
})();

