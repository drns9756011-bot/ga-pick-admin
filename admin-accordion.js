(function () {
  const panelIds = ["customerQuotes", "applications", "approvedSellers", "alimtalkControl"];
  const detailId = "applicationDetail";
  let activePanelId = "customerQuotes";
  let isApplying = false;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function titleFor(panel) {
    return $(".panel-head h2", panel)?.textContent?.trim() || panel.id;
  }

  function countFor(panel) {
    if (panel.id === "customerQuotes") return document.querySelectorAll("#customerQuoteList .quote-admin-card").length;
    if (panel.id === "applications") return document.querySelectorAll("#applicationList .application-card").length;
    if (panel.id === "approvedSellers") return Math.max(0, document.querySelectorAll("#approvedSellerRows tr").length);
    if (panel.id === "alimtalkControl") return document.querySelectorAll("#messageList .message-card").length;
    return 0;
  }

  function ensureHead(panel) {
    let head = panel.querySelector(":scope > .panel-head");
    if (!head) {
      head = document.createElement("div");
      head.className = "panel-head";
      head.innerHTML = `
        <div>
          <p class="eyebrow">Detail</p>
          <h2>${titleFor(panel)}</h2>
        </div>
      `;
      panel.insertBefore(head, panel.firstChild);
    }

    let button = head.querySelector(".section-open-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "section-open-button";
      head.appendChild(button);
    }

    button.dataset.openAdminPanel = panel.id;
    button.innerHTML = `<span class="section-count">0건</span><span class="section-icon">보기</span>`;
    return head;
  }

  function ensureBody(panel) {
    let body = panel.querySelector(":scope > .section-body");
    if (body) return body;

    body = document.createElement("div");
    body.className = "section-body";

    Array.from(panel.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("panel-head")) return;
      body.appendChild(node);
    });

    panel.appendChild(body);
    return body;
  }

  function refreshCount(panel) {
    const countLabel = panel.querySelector(".section-count");
    if (countLabel) countLabel.textContent = `${countFor(panel)}건`;
  }

  function setAdminFilter(type, value) {
    try {
      if (type === "application") applicationFilter = value;
      if (type === "message") messageFilter = value;
    } catch (error) {
      // Base admin script owns these variables.
    }
  }

  function setActivePanel(panelId, shouldScroll = true) {
    activePanelId = panelId || "customerQuotes";

    panelIds.forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;

      const isActive = id === activePanelId;
      const body = panel.querySelector(":scope > .section-body");
      const button = panel.querySelector(".section-open-button");

      panel.classList.toggle("is-active-section", isActive);
      panel.classList.toggle("is-summary-section", !isActive);
      if (body) body.hidden = !isActive;
      if (button) {
        button.setAttribute("aria-expanded", String(isActive));
        button.querySelector(".section-icon").textContent = isActive ? "열림" : "보기";
      }
      refreshCount(panel);
    });

    const detail = document.getElementById(detailId);
    if (detail) {
      detail.hidden = activePanelId !== "applications";
      detail.classList.toggle("is-active-section", activePanelId === "applications");
    }

    const activePanel = document.getElementById(activePanelId);
    if (shouldScroll) activePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applySections() {
    if (isApplying) return;
    isApplying = true;

    panelIds.forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;

      panel.classList.add("admin-data-section");
      ensureHead(panel);
      ensureBody(panel);
      refreshCount(panel);
    });

    setActivePanel(activePanelId, false);
    isApplying = false;
  }

  function openByStat(action) {
    if (action === "customer-quotes") {
      window.renderAll?.();
      setTimeout(() => setActivePanel("customerQuotes"), 30);
      return true;
    }

    if (action === "pending-applications") {
      setAdminFilter("application", "pending");
      window.renderAll?.();
      setTimeout(() => setActivePanel("applications"), 30);
      return true;
    }

    if (action === "approved-sellers") {
      window.renderAll?.();
      setTimeout(() => setActivePanel("approvedSellers"), 30);
      return true;
    }

    if (action === "ready-messages") {
      setAdminFilter("message", "ready");
      window.renderAll?.();
      setTimeout(() => setActivePanel("alimtalkControl"), 30);
      return true;
    }

    if (action === "rejected-applications") {
      setAdminFilter("application", "rejected");
      window.renderAll?.();
      setTimeout(() => setActivePanel("applications"), 30);
      return true;
    }

    return false;
  }

  window.openAdminDataSection = setActivePanel;

  document.addEventListener("click", (event) => {
    const stat = event.target.closest("[data-stat-action]");
    if (stat && openByStat(stat.dataset.statAction)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const openButton = event.target.closest("[data-open-admin-panel]");
    if (openButton) {
      event.preventDefault();
      setActivePanel(openButton.dataset.openAdminPanel);
      return;
    }

    const navLink = event.target.closest('a[href^="#"]');
    if (!navLink) return;
    const targetId = navLink.getAttribute("href").slice(1);
    if (panelIds.includes(targetId)) {
      event.preventDefault();
      setActivePanel(targetId);
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      const stat = event.target.closest("[data-stat-action]");
      if (!stat || !openByStat(stat.dataset.statAction)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  const originalRenderAll = window.renderAll;
  if (typeof originalRenderAll === "function") {
    window.renderAll = function renderAllWithSingleSection() {
      originalRenderAll();
      setTimeout(applySections, 0);
    };
  }

  window.addEventListener("load", () => {
    setTimeout(applySections, 80);
  });

  setInterval(applySections, 1400);
})();
