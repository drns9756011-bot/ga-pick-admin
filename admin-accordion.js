(function () {
  const storageKey = "pickquoteAdminOpenSections";
  const sectionIds = ["customerQuotes", "applications", "applicationDetail", "approvedSellers", "alimtalkControl"];
  let isApplying = false;

  function readOpenSections() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      return new Set();
    }
  }

  function writeOpenSections(openSections) {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(openSections)));
  }

  function titleFor(panel) {
    const heading = panel.querySelector(".panel-head h2, .detail-top h2");
    return heading?.textContent?.trim() || panel.id || "항목";
  }

  function countFor(panel) {
    if (panel.id === "customerQuotes") return document.querySelectorAll("#customerQuoteList .quote-admin-card").length;
    if (panel.id === "applications") return document.querySelectorAll("#applicationList .application-card").length;
    if (panel.id === "approvedSellers") return Math.max(0, document.querySelectorAll("#approvedSellerRows tr").length);
    if (panel.id === "alimtalkControl") return document.querySelectorAll("#messageList .message-card").length;
    return panel.querySelector(".empty-state") ? 0 : 1;
  }

  function makePanelHead(panel) {
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

    if (!head.querySelector(".accordion-toggle")) {
      const button = document.createElement("button");
      button.className = "accordion-toggle";
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = `<span class="accordion-count">0건</span><span class="accordion-icon">⌄</span>`;
      head.appendChild(button);
    }

    return head;
  }

  function ensureBody(panel) {
    let body = panel.querySelector(":scope > .accordion-body");
    if (body) return body;

    body = document.createElement("div");
    body.className = "accordion-body";

    Array.from(panel.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("panel-head")) return;
      body.appendChild(node);
    });

    panel.appendChild(body);
    return body;
  }

  function setOpen(panel, isOpen, openSections) {
    const button = panel.querySelector(".accordion-toggle");
    const body = panel.querySelector(":scope > .accordion-body");

    panel.classList.toggle("is-collapsed", !isOpen);
    panel.classList.toggle("is-open", isOpen);
    if (body) body.hidden = !isOpen;
    if (button) button.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) openSections.add(panel.id);
    else openSections.delete(panel.id);
  }

  function updateCount(panel) {
    const count = countFor(panel);
    const countLabel = panel.querySelector(".accordion-count");
    if (countLabel) countLabel.textContent = `${count}건`;
  }

  function applyAccordions() {
    if (isApplying) return;
    isApplying = true;

    const openSections = readOpenSections();

    sectionIds.forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;

      panel.classList.add("accordion-panel");
      makePanelHead(panel);
      ensureBody(panel);
      updateCount(panel);

      const shouldOpen = openSections.has(id);
      setOpen(panel, shouldOpen, openSections);
    });

    writeOpenSections(openSections);
    isApplying = false;
  }

  function togglePanel(panel) {
    const openSections = readOpenSections();
    const nextOpen = !panel.classList.contains("is-open");
    setOpen(panel, nextOpen, openSections);
    writeOpenSections(openSections);
  }

  function openPanels(panelIds) {
    const ids = Array.isArray(panelIds) ? panelIds : [panelIds];
    const openSections = readOpenSections();

    sectionIds.forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      setOpen(panel, ids.includes(id), openSections);
      updateCount(panel);
    });

    writeOpenSections(openSections);
    const firstPanel = document.getElementById(ids[0]);
    firstPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setAdminFilter(type, value) {
    try {
      if (type === "application") applicationFilter = value;
      if (type === "message") messageFilter = value;
    } catch (error) {
      // The base admin script owns these filters.
    }
  }

  function openStatData(action) {
    if (action === "customer-quotes") {
      window.renderAll?.();
      setTimeout(() => openPanels("customerQuotes"), 30);
      return true;
    }

    if (action === "pending-applications") {
      setAdminFilter("application", "pending");
      window.renderAll?.();
      setTimeout(() => openPanels("applications"), 30);
      return true;
    }

    if (action === "approved-sellers") {
      window.renderAll?.();
      setTimeout(() => openPanels("approvedSellers"), 30);
      return true;
    }

    if (action === "ready-messages") {
      setAdminFilter("message", "ready");
      window.renderAll?.();
      setTimeout(() => openPanels("alimtalkControl"), 30);
      return true;
    }

    if (action === "rejected-applications") {
      setAdminFilter("application", "rejected");
      window.renderAll?.();
      setTimeout(() => openPanels("applications"), 30);
      return true;
    }

    return false;
  }

  window.openAdminDataSection = openPanels;

  document.addEventListener("click", (event) => {
    const stat = event.target.closest("[data-stat-action]");
    if (stat && openStatData(stat.dataset.statAction)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const button = event.target.closest(".accordion-toggle");
    if (button) {
      const panel = button.closest(".accordion-panel");
      if (panel) togglePanel(panel);
      return;
    }

    const head = event.target.closest(".accordion-panel > .panel-head");
    if (!head) return;
    if (event.target.closest("button, a, input, select, textarea, label")) return;
    togglePanel(head.closest(".accordion-panel"));
  });

  document.addEventListener(
    "click",
    (event) => {
      const stat = event.target.closest("[data-stat-action]");
      if (!stat || !openStatData(stat.dataset.statAction)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  const originalRenderAll = window.renderAll;
  if (typeof originalRenderAll === "function") {
    window.renderAll = function renderAllWithAccordion() {
      originalRenderAll();
      setTimeout(applyAccordions, 0);
    };
  }

  window.addEventListener("load", () => {
    setTimeout(applyAccordions, 80);
  });

  setInterval(applyAccordions, 1200);
})();
