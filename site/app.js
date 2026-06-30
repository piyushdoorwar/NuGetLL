/*
 * Motion for the NuGet LL site — Framer Motion-style effects, vanilla JS.
 *   - top scroll-progress bar (spring-smoothed)
 *   - hero entrance cascade (staggered fade-up, title scale-in)
 *   - scroll-reveal fade-ups with a soft ease
 * All effects are skipped under prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (cb) {
        return setTimeout(function () {
          cb(Date.now());
        }, 16);
      };

  // ---------------------------------------------------------------- progress
  var bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  var prog = { cur: 0, tgt: 0 };

  function computeProgress() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    prog.tgt =
      max > 0 ? Math.min(1, Math.max(0, (window.scrollY || h.scrollTop) / max)) : 0;
  }

  var hero = document.querySelector(".hero");
  var mockup = document.querySelector(".vscode-mockup");

  // --------------------------------------------------------- animation loop
  var running = false;

  function frame() {
    // progress spring
    prog.cur += (prog.tgt - prog.cur) * 0.18;
    var alive = Math.abs(prog.tgt - prog.cur) > 0.0006;
    if (!alive) prog.cur = prog.tgt;
    bar.style.transform = "scaleX(" + prog.cur.toFixed(4) + ")";

    if (alive) {
      raf(frame);
    } else {
      running = false;
    }
  }

  function ensureLoop() {
    if (!running) {
      running = true;
      raf(frame);
    }
  }

  // progress: seed without animation, then track scroll
  computeProgress();
  prog.cur = prog.tgt;
  bar.style.transform = "scaleX(" + prog.cur + ")";
  window.addEventListener(
    "scroll",
    function () {
      computeProgress();
      ensureLoop();
    },
    { passive: true }
  );
  window.addEventListener("resize", function () {
    computeProgress();
    ensureLoop();
  });

  // --------------------------------------------------------- hero cascade
  if (hero && !reduce) {
    var seq = [];
    var copy = hero.querySelector(".hero-copy");
    if (copy) {
      for (var i = 0; i < copy.children.length; i++) {
        seq.push(copy.children[i]);
      }
    }
    if (mockup) seq.push(mockup);

    seq.forEach(function (el, idx) {
      el.classList.add("hero-anim");
      if (el.tagName === "H1") el.classList.add("hero-anim-title");
      if (el === mockup) el.classList.add("hero-anim-mockup");
      el.style.transitionDelay = (0.05 + idx * 0.12).toFixed(2) + "s";
    });

    raf(function () {
      raf(function () {
        seq.forEach(function (el) {
          el.classList.add("is-in");
        });
      });
    });

    // once the entrance has played, drop the delay so hover stays snappy
    setTimeout(function () {
      seq.forEach(function (el) {
        el.style.transitionDelay = "";
      });
    }, 1700);
  }

  // --------------------------------------------------------- scroll reveal
  var items = document.querySelectorAll("[data-reveal]");
  if (items.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      for (var a = 0; a < items.length; a++) items[a].classList.add("revealed");
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12 }
      );
      for (var b = 0; b < items.length; b++) observer.observe(items[b]);
    }
  }

  // ----------------------------------------------------- interactive demo
  initDemo();

  function initDemo() {
    var demo = document.querySelector("[data-demo]");
    if (!demo) return;

    // --- tab switching ---
    var tabs = demo.querySelectorAll("[data-tab]");
    var panes = demo.querySelectorAll("[data-pane]");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        closeMenus();
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panes.forEach(function (p) {
          var on = p.getAttribute("data-pane") === name;
          p.classList.toggle("active", on);
          if (on) p.removeAttribute("hidden");
          else p.setAttribute("hidden", "");
        });
      });
    });

    // --- browse: package selection ---
    var versionMenu = demo.querySelector('[data-select="version"] .select-menu');
    var versionValue = demo.querySelector('[data-select="version"] [data-value]');
    var rows = demo.querySelectorAll("[data-browse] [data-pkg]");

    function selectPkg(li) {
      rows.forEach(function (r) {
        r.classList.toggle("selected", r === li);
      });
      var vers = (li.getAttribute("data-versions") || "").split(",");
      if (vers.length && versionMenu) {
        versionMenu.innerHTML = "";
        vers.forEach(function (v, i) {
          var label = i === 0 ? v + " (latest)" : v;
          var opt = document.createElement("li");
          opt.setAttribute("data-opt", label);
          if (i === 0) opt.className = "sel";
          opt.textContent = label;
          versionMenu.appendChild(opt);
        });
        if (versionValue) versionValue.textContent = vers[0] + " (latest)";
      }
    }
    rows.forEach(function (li) {
      li.addEventListener("click", function () {
        selectPkg(li);
      });
    });

    // --- custom selects (dropdowns) ---
    var selects = demo.querySelectorAll(".select");

    function closeMenus() {
      selects.forEach(function (s) {
        s.classList.remove("open");
        var btn = s.querySelector(".select-fake");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    selects.forEach(function (sel) {
      var btn = sel.querySelector(".select-fake");
      var menu = sel.querySelector(".select-menu");
      if (!btn || !menu) return;

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = !sel.classList.contains("open");
        closeMenus();
        if (willOpen) {
          sel.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });

      // single-select (version): pick an option
      if (!menu.classList.contains("select-menu--check")) {
        menu.addEventListener("click", function (e) {
          var opt = e.target.closest("[data-opt]");
          if (!opt) return;
          e.stopPropagation();
          menu.querySelectorAll("[data-opt]").forEach(function (o) {
            o.classList.toggle("sel", o === opt);
          });
          var val = sel.querySelector("[data-value]");
          if (val) val.textContent = opt.getAttribute("data-opt");
          sel.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
        });
      } else {
        // multi-select (projects): toggle checkboxes, keep menu open
        menu.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        menu.addEventListener("change", function () {
          var checked = [];
          menu.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
            if (cb.checked) checked.push(cb.value);
          });
          var val = sel.querySelector("[data-value]");
          if (val) {
            val.textContent =
              checked.length === 0
                ? "Select projects"
                : checked.length <= 2
                ? checked.join(", ")
                : checked.length + " projects";
          }
          updateInstallLabel(checked.length);
        });
      }
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".select")) closeMenus();
    });

    // --- install button ---
    var installBtn = demo.querySelector("[data-install]");
    var projectCount = 2;

    function updateInstallLabel(count) {
      projectCount = count;
      if (!installBtn || installBtn.classList.contains("busy")) return;
      installBtn.textContent =
        count === 0
          ? "Select a project"
          : "Install into " + count + (count === 1 ? " project" : " projects");
      installBtn.disabled = count === 0;
    }

    if (installBtn) {
      installBtn.addEventListener("click", function () {
        if (installBtn.classList.contains("busy") || projectCount === 0) return;
        installBtn.classList.add("busy");
        installBtn.textContent = "Installing…";
        setTimeout(function () {
          installBtn.classList.remove("busy");
          installBtn.classList.add("done");
          installBtn.textContent = "✓ Installed";
          setTimeout(function () {
            installBtn.classList.remove("done");
            updateInstallLabel(projectCount);
          }, 1500);
        }, 850);
      });
    }

    // --- search filtering ---
    var search = demo.querySelector("[data-search]");
    var empty = demo.querySelector(".pkg-empty");
    if (search) {
      search.addEventListener("input", function () {
        var q = search.value.trim().toLowerCase();
        var any = false;
        rows.forEach(function (li) {
          var name = (li.getAttribute("data-pkg") || "").toLowerCase();
          var desc = (li.getAttribute("data-desc") || "").toLowerCase();
          var match = !q || name.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
          li.hidden = !match;
          if (match) any = true;
        });
        if (empty) empty.hidden = any;
      });
    }

    // --- installed: remove rows ---
    demo.querySelectorAll("[data-installed] [data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var li = btn.closest("li");
        if (!li || li.classList.contains("removing")) return;
        li.classList.add("removing");
        bumpCount("installed", -1);
        setTimeout(function () {
          li.parentNode && li.parentNode.removeChild(li);
        }, 320);
      });
    });

    // --- updates: update one / all ---
    function applyUpdate(btn) {
      var li = btn.closest("li");
      if (!li || li.classList.contains("updated")) return;
      li.classList.add("updated");
      btn.remove();
      var done = document.createElement("span");
      done.className = "row-done";
      done.textContent = "✓ Updated";
      li.appendChild(done);
      bumpCount("updates", -1);
    }
    demo.querySelectorAll("[data-do-update]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyUpdate(btn);
      });
    });
    var updateAll = demo.querySelector("[data-update-all]");
    if (updateAll) {
      updateAll.addEventListener("click", function () {
        demo.querySelectorAll("[data-do-update]").forEach(applyUpdate);
      });
    }

    function bumpCount(name, delta) {
      var el = demo.querySelector('[data-count="' + name + '"]');
      if (!el) return;
      var n = Math.max(0, (parseInt(el.textContent, 10) || 0) + delta);
      el.textContent = n;
      if (n === 0) el.style.display = "none";
    }

    // seed the version menu from the initially-selected package
    var initial = demo.querySelector("[data-browse] .selected");
    if (initial) selectPkg(initial);
  }
})();
