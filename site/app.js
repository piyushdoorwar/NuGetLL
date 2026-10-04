/* NuGet LL site — shared behaviour (nav, copy buttons, reveal, hero mock). */
(function () {
  "use strict";

  // Mobile navigation toggle
  const topbar = document.querySelector(".topbar");
  const toggle = document.querySelector(".nav-toggle");
  if (topbar && toggle) {
    const setOpen = (open) => {
      topbar.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!topbar.classList.contains("open")));
    topbar.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  // Copy-to-clipboard buttons
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest(".copy-btn");
    if (!btn) return;
    const text = btn.dataset.copy ?? btn.closest(".cmd")?.querySelector("code")?.innerText ?? "";
    const ok = await copyText(text);
    const label = btn.querySelector("span");
    btn.classList.toggle("done", ok);
    if (label) label.textContent = ok ? "Copied" : "Press Ctrl+C";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove("done");
      if (label) label.textContent = "Copy";
    }, 1800);
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Also reveal anything already scrolled past (anchor jumps, reloads mid-page).
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
            entry.target.classList.add("in");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => obs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  // Hero mock: a small working copy of the dashboard.
  const mock = document.getElementById("mock");
  if (!mock) return;

  const $ = (sel) => mock.querySelector(sel);
  const $$ = (sel) => Array.from(mock.querySelectorAll(sel));
  const toast = $("[data-toast]");
  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  };
  const setCount = (name, n) => {
    const el = $(`[data-count="${name}"]`);
    if (el) el.textContent = String(n);
  };

  // Side nav switches panes.
  const tabs = $$("[data-tab]");
  const selectTab = (name) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    $$("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== name; });
  };
  tabs.forEach((t) => t.addEventListener("click", () => selectTab(t.dataset.tab)));

  // Browse: filter, select, version, projects, install.
  const search = $("[data-search]");
  const rows = $$("[data-browse] button[data-pkg]");
  const empty = $("[data-browse] .pkg-empty");
  const selectedName = $("[data-selected]");
  const version = $("[data-version]");
  const projects = $$("[data-proj]");
  const install = $("[data-install]");
  const installed = $("[data-installed]");

  const installLabel = () => {
    const n = projects.filter((p) => p.getAttribute("aria-pressed") === "true").length;
    install.disabled = n === 0;
    install.classList.remove("done");
    install.textContent = n === 0 ? "Select a project" : `Install into ${n} project${n === 1 ? "" : "s"}`;
  };

  const choose = (row) => {
    rows.forEach((r) => r.classList.toggle("sel", r === row));
    selectedName.textContent = row.dataset.pkg;
    version.innerHTML = "";
    row.dataset.versions.split(",").forEach((v, i) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = i === 0 ? `${v} (latest)` : v;
      version.appendChild(opt);
    });
    installLabel();
  };

  rows.forEach((row) => row.addEventListener("click", () => choose(row)));

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const hit = !q || row.textContent.toLowerCase().includes(q);
      row.parentElement.hidden = !hit;
      if (hit) visible++;
    });
    empty.hidden = visible > 0;
    const current = rows.find((r) => r.classList.contains("sel"));
    if (current?.parentElement.hidden) {
      const first = rows.find((r) => !r.parentElement.hidden);
      if (first) choose(first);
    }
  });

  projects.forEach((p) =>
    p.addEventListener("click", () => {
      p.setAttribute("aria-pressed", String(p.getAttribute("aria-pressed") !== "true"));
      installLabel();
    })
  );

  install.addEventListener("click", () => {
    const id = selectedName.textContent;
    const ver = version.value;
    const targets = projects.filter((p) => p.getAttribute("aria-pressed") === "true").map((p) => p.textContent.trim());
    if (!targets.length) return;

    // Add or refresh the row in Installed.
    let row = Array.from(installed.children).find((li) => li.querySelector("b")?.textContent === id);
    if (!row) {
      row = document.createElement("li");
      row.innerHTML =
        '<span class="pkg-ic"><svg class="ic"><use href="#i-package" /></svg></span>' +
        '<span class="pkg-meta"><b></b><i></i></span><span class="pkg-ver"></span>' +
        '<button type="button" class="row-btn" data-remove>Remove</button>';
      row.querySelector("b").textContent = id;
      installed.prepend(row);
    }
    row.querySelector("i").textContent = targets.join(" · ");
    row.querySelector(".pkg-ver").textContent = ver;
    setCount("installed", installed.children.length);

    install.textContent = `Installed ${id} ${ver}`;
    install.classList.add("done");
    showToast(`dotnet add package ${id} → ${targets.length} project${targets.length === 1 ? "" : "s"}`);
    clearTimeout(install._t);
    install._t = setTimeout(installLabel, 2000);
  });

  // Installed: remove.
  installed.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const li = btn.closest("li");
    const id = li.querySelector("b").textContent;
    li.remove();
    setCount("installed", installed.children.length);
    showToast(`Removed ${id}`);
  });

  // Updates: one at a time or all.
  const updates = $("[data-updates]");
  const updatesEmpty = updates.querySelector(".pkg-empty");
  const updateAll = $("[data-update-all]");
  const pending = () => Array.from(updates.children).filter((li) => !li.classList.contains("pkg-empty"));
  const syncUpdates = () => {
    const n = pending().length;
    setCount("updates", n);
    updatesEmpty.hidden = n > 0;
    updateAll.disabled = n === 0;
  };
  updates.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-update]");
    if (!btn) return;
    const li = btn.closest("li");
    showToast(`Updated ${li.querySelector("b").textContent} to ${li.querySelector("strong").textContent}`);
    li.remove();
    syncUpdates();
  });
  updateAll.addEventListener("click", () => {
    const n = pending().length;
    pending().forEach((li) => li.remove());
    syncUpdates();
    showToast(`Updated ${n} package${n === 1 ? "" : "s"}`);
  });

  choose(rows.find((r) => r.classList.contains("sel")) || rows[0]);
})();
