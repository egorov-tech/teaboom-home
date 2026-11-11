// Home page behaviour: catalogue panel, banner carousel, pack switching, demo cart.
// The page is fully readable without this file; it only adds interaction.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- Fonts ----------
  // Oswald and Open Sans load once the page is up; until then the system grotesque is used.
  const fontsHref = document.currentScript?.dataset.fonts;
  if (fontsHref) {
    const addFonts = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fontsHref;
      document.head.append(link);
    };
    if (document.readyState === "complete") addFonts();
    else window.addEventListener("load", addFonts, { once: true });
  }
  const scrollBehavior = () => (reduceMotion.matches ? "auto" : "smooth");

  // ---------- Reveal: shared open/close for dropdown panels ----------
  // Panel keeps [hidden] only when fully closed. Open: unhide → .is-open.
  // Close: .is-closing → wait for transition → [hidden]. One helper for every dropdown.
  const bindReveal = (panel, { duration = 220 } = {}) => {
    let closing = false;
    let timer = 0;

    const finishClose = () => {
      window.clearTimeout(timer);
      closing = false;
      panel.classList.remove("is-closing", "is-open");
      panel.hidden = true;
    };

    const open = () => {
      if (closing) {
        window.clearTimeout(timer);
        closing = false;
        panel.classList.remove("is-closing");
      }
      panel.hidden = false;
      if (reduceMotion.matches) {
        panel.classList.add("is-open");
        return;
      }
      panel.classList.remove("is-open");
      // Double rAF so the browser paints the closed state before transitioning in.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => panel.classList.add("is-open"));
      });
    };

    const close = () => {
      if (panel.hidden || closing) return;
      if (reduceMotion.matches || !panel.classList.contains("is-open")) {
        finishClose();
        return;
      }
      closing = true;
      panel.classList.remove("is-open");
      panel.classList.add("is-closing");
      const onEnd = (event) => {
        if (event.target !== panel) return;
        panel.removeEventListener("transitionend", onEnd);
        finishClose();
      };
      panel.addEventListener("transitionend", onEnd);
      timer = window.setTimeout(finishClose, duration + 80);
    };

    const isOpen = () => !panel.hidden && !closing;

    return { open, close, isOpen };
  };

  // ---------- Sticky compact masthead (all viewports, hysteresis against jitter) ----------
  const masthead = document.querySelector("[data-masthead]");

  // Phones: the compact header's search icon opens the field over the bar.
  const quickToggle = masthead?.querySelector("[data-quick-toggle]");
  const quickForm = masthead?.querySelector("[data-quick-search]");
  const quickClose = masthead?.querySelector("[data-quick-close]");
  const quickField = quickForm?.querySelector("input");

  function closeQuickSearch({ returnFocus = false } = {}) {
    if (!masthead?.classList.contains("is-searching")) return;
    masthead.classList.remove("is-searching");
    quickToggle?.setAttribute("aria-expanded", "false");
    if (returnFocus) quickToggle?.focus({ preventScroll: true });
  }

  if (quickToggle && quickForm) {
    quickToggle.addEventListener("click", () => {
      // Drop :active scale on the icon before the bar morphs — otherwise the glass jumps.
      quickToggle.style.transform = "none";
      masthead.classList.add("is-searching");
      quickToggle.setAttribute("aria-expanded", "true");
      // preventScroll: the field sits in the sticky bar, and a plain focus() makes the browser
      // scroll the page to clear scroll-padding-top.
      window.requestAnimationFrame(() => {
        quickField?.focus({ preventScroll: true });
        quickToggle.style.removeProperty("transform");
      });
    });
    quickClose?.addEventListener("click", () => closeQuickSearch({ returnFocus: true }));
    quickForm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeQuickSearch({ returnFocus: true });
    });
    // Leaving the opened field (tap elsewhere, Tab out) folds it back.
    quickForm.addEventListener("focusout", (event) => {
      if (!quickForm.contains(event.relatedTarget)) closeQuickSearch();
    });
  }

  if (masthead) {
    const ENTER = 64; // become compact past this
    const EXIT = 16; // expand again only when near the top
    // Phone chrome is already a short floating capsule (logo + search + cart). Shrinking it
    // on scroll only jittered the layout — keep compact for tablet/desktop sticky bars.
    const phoneShell = window.matchMedia(`(max-width: ${760 - 1}px)`);
    let compact = false;
    let ticking = false;

    const syncCompact = () => {
      if (phoneShell.matches) {
        if (compact) {
          compact = false;
          masthead.classList.remove("is-compact");
          closeQuickSearch();
        }
        ticking = false;
        return;
      }
      const y = window.scrollY || window.pageYOffset || 0;
      let next = compact;
      if (!compact && y > ENTER) next = true;
      if (compact && y < EXIT) next = false;
      if (next !== compact) {
        compact = next;
        masthead.classList.toggle("is-compact", compact);
        if (!compact) closeQuickSearch();
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(syncCompact);
    };

    syncCompact();
    window.addEventListener("scroll", onScroll, { passive: true });
    phoneShell.addEventListener("change", syncCompact);
  }

  // ---------- Mobile dock + catalog sheet (п. 19) ----------
  const dockCatalog = document.querySelector("[data-dock-catalog]");
  const dockSheet = document.querySelector("[data-dock-sheet]");
  const dockClose = document.querySelector("[data-dock-close]");

  if (dockCatalog && dockSheet && typeof dockSheet.showModal === "function") {
    let returnFocus = false;
    let closing = false;
    const sheetPanel = dockSheet.querySelector(".sheet__panel");
    let closeTimer;
    let closeEnd;

    const clearClose = () => {
      window.clearTimeout(closeTimer);
      if (closeEnd) sheetPanel?.removeEventListener("animationend", closeEnd);
      closeEnd = null;
    };

    const finishClose = () => {
      clearClose();
      if (!closing && !dockSheet.classList.contains("is-closing")) {
        if (dockSheet.open) dockSheet.close();
        return;
      }
      closing = false;
      dockSheet.classList.remove("is-closing");
      if (dockSheet.open) dockSheet.close();
    };

    const closeSheetAnimated = ({ focusToggle = false } = {}) => {
      if (!dockSheet.open || closing) return;
      returnFocus = focusToggle;
      if (reduceMotion.matches) {
        dockSheet.close();
        return;
      }
      closing = true;
      dockSheet.classList.add("is-closing");
      closeEnd = (event) => {
        if (event.target !== sheetPanel) return;
        finishClose();
      };
      sheetPanel?.addEventListener("animationend", closeEnd);
      // Fallback if animationend is skipped (display:none mid-flight).
      closeTimer = window.setTimeout(() => {
        if (closing) finishClose();
      }, 320);
    };

    const setDockOpen = (open, { focusToggle = false } = {}) => {
      dockCatalog.setAttribute("aria-expanded", String(open));
      dockCatalog.classList.toggle("is-active", open);
      if (open) {
        if (closing) {
          clearClose();
          dockSheet.classList.remove("is-closing");
          closing = false;
        }
        if (!dockSheet.open) dockSheet.showModal();
      } else if (dockSheet.open) {
        closeSheetAnimated({ focusToggle });
      }
    };

    dockCatalog.addEventListener("click", () => {
      setDockOpen(!(dockSheet.open && !closing));
    });

    dockClose?.addEventListener("click", () => setDockOpen(false));

    dockSheet.addEventListener("click", (event) => {
      if (event.target === dockSheet) setDockOpen(false);
    });

    dockSheet.addEventListener("close", () => {
      clearClose();
      dockSheet.classList.remove("is-closing");
      closing = false;
      dockCatalog.setAttribute("aria-expanded", "false");
      dockCatalog.classList.remove("is-active");
      if (returnFocus) {
        dockCatalog.focus({ preventScroll: true });
        returnFocus = false;
      }
    });

    // Escape: animate out, then restore focus to the dock button.
    dockSheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      setDockOpen(false, { focusToggle: true });
    });

    // A hidden modal still makes the page inert. Close it when the desktop menu replaces it.
    window.matchMedia("(min-width: 760px)").addEventListener("change", (event) => {
      if (event.matches && dockSheet.open) {
        returnFocus = false;
        finishClose();
        document.querySelector("[data-catalog-toggle]")?.focus({ preventScroll: true });
      }
    });
  }

  // ---------- Catalogue panel (desktop dropdown via bindReveal) ----------
  const toggle = document.querySelector("[data-catalog-toggle]");
  const panel = document.querySelector("[data-catalog]");

  if (toggle && panel) {
    const reveal = bindReveal(panel);
    let openAtY = 0;
    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute("aria-expanded", String(open));
      if (open) {
        openAtY = window.scrollY || window.pageYOffset || 0;
        reveal.open();
      } else {
        reveal.close();
        if (returnFocus) toggle.focus();
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(!reveal.isOpen());
    });

    // Desktop: scrolling down with the dropdown open dismisses it (same as leaving the menu).
    window.addEventListener(
      "scroll",
      () => {
        if (!reveal.isOpen()) return;
        const y = window.scrollY || window.pageYOffset || 0;
        if (y > openAtY + 12) setOpen(false);
      },
      { passive: true }
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reveal.isOpen()) setOpen(false, { returnFocus: true });
    });

    document.addEventListener("click", (event) => {
      if (!reveal.isOpen()) return;
      if (!panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });

    // The panel sits after the search form in the DOM (outside the scrolling menu), so Tab
    // order is wired by hand: toggle → panel links → the menu item after "Каталог".
    const links = [...panel.querySelectorAll("a")];
    const afterToggle = toggle.closest("li").nextElementSibling?.querySelector("a");

    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.shiftKey && reveal.isOpen()) {
        event.preventDefault();
        links[0]?.focus();
      }
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !links.length) return;
      if (event.shiftKey && document.activeElement === links[0]) {
        event.preventDefault();
        toggle.focus();
      } else if (!event.shiftKey && document.activeElement === links[links.length - 1]) {
        event.preventDefault();
        setOpen(false);
        afterToggle?.focus();
      }
    });

    // Focus that leaves the panel any other way (click, screen reader jump) closes it.
    panel.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (next && !panel.contains(next) && next !== toggle) setOpen(false);
    });
  }

  // ---------- Sideways menu strip (narrow screens) ----------
  // Browsers leave a half-visible item where it is when it gets focus; slide the strip so the
  // focused item is fully on screen, keeping the strip's own side padding.
  // data-more="start|end|both" drives the edge fade that tells the menu scrolls sideways.
  document.querySelectorAll(".menu").forEach((strip) => {
    const syncFade = () => {
      const max = strip.scrollWidth - strip.clientWidth;
      const atStart = strip.scrollLeft <= 2;
      const atEnd = strip.scrollLeft >= max - 2;
      strip.dataset.more = max <= 2 ? "" : atStart ? "end" : atEnd ? "start" : "both";
    };
    strip.addEventListener("scroll", syncFade, { passive: true });
    window.addEventListener("resize", syncFade, { passive: true });
    syncFade();

    strip.addEventListener("focusin", (event) => {
      if (strip.scrollWidth <= strip.clientWidth) return;
      const item = event.target.getBoundingClientRect();
      const box = strip.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
      let shift = 0;
      if (item.right > box.right - pad) shift = item.right - (box.right - pad);
      else if (item.left < box.left + pad) shift = item.left - (box.left + pad);
      if (shift) strip.scrollBy({ left: shift, behavior: scrollBehavior() });
    });
  });

  // Autoplay helper: pauses on hover/focus/touch and when the tab is hidden; off with
  // reduced motion. `control` is the visible pause/resume (WCAG 2.2.2).
  // requireVisible (default true): product galleries stay quiet off-screen.
  // Banners pass false — slide + progress keep going while the user scrolls the page.
  const bindAutoplay = (root, { interval, next, paused, control, onChange, requireVisible = true } = {}) => {
    if (reduceMotion.matches || !interval || interval < 1200) {
      return {
        stop() {},
        nudge() {},
        isStopped: () => true,
      };
    }

    let timer = 0;
    let visible = !requireVisible;
    let held = false;
    let stopped = false;
    // Wall-clock remaining so a hold/tab-hide resumes mid-cycle instead of restarting.
    let remaining = interval;
    let startedAt = 0;

    const stopTimer = ({ preserve = false } = {}) => {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
      if (preserve && startedAt) {
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
      }
      startedAt = 0;
    };

    const arm = ({ reset = false } = {}) => {
      stopTimer({ preserve: !reset });
      if (reset) remaining = interval;
      const canRun =
        (!requireVisible || visible) && !held && !stopped && !document.hidden && !paused?.();
      if (canRun) {
        startedAt = performance.now();
        timer = window.setTimeout(() => {
          timer = 0;
          startedAt = 0;
          remaining = interval;
          next();
        }, remaining || interval);
      }
      onChange?.({ stopped, held, visible, remaining, interval, running: Boolean(timer) });
    };

    if (control) {
      const sync = () => {
        control.setAttribute("aria-label", stopped ? "Включить автопрокрутку баннеров" : "Остановить автопрокрутку баннеров");
        control.classList.toggle("is-stopped", stopped);
        root.classList.toggle("is-autoplay-off", stopped);
        onChange?.({ stopped, held, visible, remaining, interval, running: Boolean(timer) });
      };
      control.hidden = false;
      control.addEventListener("click", () => {
        stopped = !stopped;
        if (!stopped) remaining = interval;
        sync();
        arm({ reset: !stopped });
      });
      sync();
    }

    const hold = () => {
      if (held) return;
      held = true;
      stopTimer({ preserve: true });
      onChange?.({ stopped, held, visible, remaining, interval, running: false });
    };

    const release = () => {
      if (!held) return;
      held = false;
      arm();
    };

    root.addEventListener("pointerenter", hold);
    root.addEventListener("pointerleave", release);
    root.addEventListener("focusin", hold);
    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) release();
    });
    root.addEventListener("pointerdown", hold);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTimer({ preserve: true });
      else arm();
      onChange?.({ stopped, held, visible, remaining, interval, running: Boolean(timer) });
    });

    let inView = null;
    if (requireVisible) {
      inView = new IntersectionObserver(
        ([entry]) => {
          const nextVisible = Boolean(entry?.isIntersecting);
          if (nextVisible === visible) return;
          visible = nextVisible;
          if (!visible) stopTimer({ preserve: true });
          else arm();
        },
        { threshold: 0.35 }
      );
      inView.observe(root);
    }

    arm({ reset: true });

    return {
      stop() {
        stopTimer();
        inView?.disconnect();
      },
      nudge: () => arm({ reset: true }),
      isStopped: () => stopped,
    };
  };

  // ---------- Banner carousel (dots + swipe + pause; progress pill on active) ----------
  const banners = document.querySelector("[data-banners]");

  if (banners) {
    const track = banners.querySelector("[data-track]");
    const slides = [...track.querySelectorAll("[data-slide]")];
    const status = banners.querySelector("[data-status]");
    const dots = [...banners.querySelectorAll("[data-dot]")];
    const interval = Number(banners.dataset.autoplay) || 5000;
    let index = 0;
    let announce = false;
    let autoplay;

    banners.style.setProperty("--pager-ms", `${interval}ms`);

    // Banners after the first carry their sources in data-* until the carousel needs them.
    const hydrate = (slide) => {
      if (!slide) return;
      slide.querySelectorAll("[data-srcset], [data-src]").forEach((el) => {
        if (el.dataset.srcset) el.srcset = el.dataset.srcset;
        if (el.dataset.src) el.src = el.dataset.src;
        el.removeAttribute("data-srcset");
        el.removeAttribute("data-src");
      });
    };

    const restartProgress = () => {
      dots.forEach((dot) => dot.classList.remove("is-progressing", "is-progress-paused"));
      const current = dots[index];
      if (!current || autoplay?.isStopped?.() || reduceMotion.matches) return;
      // Force a fresh animation on the active pill (only on slide change — not on scroll).
      void current.offsetWidth;
      current.classList.add("is-progressing");
    };

    // Hover/focus/tab-hide: freeze the CSS fill in place. Scroll must never restart it.
    const syncProgressPause = ({ held, stopped } = {}) => {
      const current = dots[index];
      if (!current) return;
      if (stopped || reduceMotion.matches) {
        current.classList.remove("is-progressing", "is-progress-paused");
        return;
      }
      current.classList.toggle("is-progress-paused", Boolean(held) || document.hidden);
      if (!current.classList.contains("is-progressing")) {
        void current.offsetWidth;
        current.classList.add("is-progressing");
      }
    };

    const render = (i) => {
      index = i;
      hydrate(slides[i]);
      if (announce) {
        hydrate(slides[(i + 1) % slides.length]);
        hydrate(slides[(i - 1 + slides.length) % slides.length]);
      }
      dots.forEach((dot, n) => {
        if (n === i) dot.setAttribute("aria-current", "true");
        else {
          dot.removeAttribute("aria-current");
          dot.classList.remove("is-progressing");
        }
      });
      // Only the banner on screen is reachable with Tab.
      slides.forEach((slide, n) => {
        const link = slide.querySelector("a");
        if (!link) return;
        if (n === i) link.removeAttribute("tabindex");
        else link.setAttribute("tabindex", "-1");
      });
      if (announce && status) status.textContent = `Баннер ${i + 1} из ${slides.length}`;
      restartProgress();
    };

    const goTo = (i) => {
      const target = (i + slides.length) % slides.length;
      announce = true;
      track.scrollTo({ left: slides[target].offsetLeft - slides[0].offsetLeft, behavior: scrollBehavior() });
      render(target);
      autoplay?.nudge();
    };

    dots.forEach((dot, n) => {
      dot.addEventListener("click", () => goTo(n));
    });

    // A width change (rotation, resized window) keeps the old scroll offset in pixels and
    // leaves the strip parked between two banners; snap it back onto the current one.
    new ResizeObserver(() => {
      track.scrollTo({ left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: "auto" });
    }).observe(track);

    banners.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
    });

    // Swipes and trackpad scrolls settle on a slide; follow whichever one is mostly visible.
    const seen = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = slides.indexOf(entry.target);
            if (i !== index) {
              announce = true;
              render(i);
            }
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    slides.forEach((slide) => seen.observe(slide));

    render(0);
    // Warm the next slide once the page itself has loaded.
    const warmNext = () => hydrate(slides[1]);
    if (document.readyState === "complete") warmNext();
    else window.addEventListener("load", warmNext, { once: true });

    autoplay = bindAutoplay(banners, {
      interval,
      next: () => goTo(index + 1),
      control: banners.querySelector("[data-play]"),
      // Keep ticking off-screen so the pill does not reset when the user scrolls back.
      requireVisible: false,
      onChange: syncProgressPause,
    });
    restartProgress();
  }

  // ---------- Product-card photo swipe + autoplay (home grid) ----------
  document.querySelectorAll("[data-gallery]").forEach((gallery) => {
    const track = gallery.querySelector("[data-gallery-track]");
    const frames = [...gallery.querySelectorAll("[data-gallery-frame]")];
    const dots = [...gallery.querySelectorAll("[data-gallery-dot]")];
    if (!track || frames.length < 2) return;

    let index = 0;
    let autoplay;

    // Only the first photo loads with the page; the rest arrive once the card is touched,
    // hovered or focused (lazy loading does not hold back images in a sideways scroller).
    const hydrate = () => {
      gallery.querySelectorAll("[data-srcset], [data-src]").forEach((el) => {
        if (el.dataset.srcset) el.srcset = el.dataset.srcset;
        if (el.dataset.src) el.src = el.dataset.src;
        el.removeAttribute("data-srcset");
        el.removeAttribute("data-src");
      });
    };
    ["pointerenter", "touchstart", "focusin"].forEach((type) =>
      gallery.addEventListener(type, hydrate, { once: true, passive: true })
    );
    track.addEventListener("scroll", hydrate, { once: true, passive: true });

    const render = (i) => {
      index = (i + frames.length) % frames.length;
      track.scrollTo({
        left: frames[index].offsetLeft - frames[0].offsetLeft,
        behavior: scrollBehavior(),
      });
      dots.forEach((dot, n) => {
        if (n === index) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
      autoplay?.nudge();
    };

    const go = (i, event) => {
      event?.preventDefault();
      event?.stopPropagation();
      render(i);
    };

    // Same as the banners: after a width change, park the strip on the current photo.
    new ResizeObserver(() => {
      track.scrollTo({ left: frames[index].offsetLeft - frames[0].offsetLeft, behavior: "auto" });
    }).observe(track);

    dots.forEach((dot, n) => {
      dot.addEventListener("click", (event) => go(n, event));
    });

    gallery.addEventListener("keydown", (event) => {
      if (!gallery.contains(document.activeElement)) return;
      if (event.key === "ArrowRight") go(index + 1, event);
      else if (event.key === "ArrowLeft") go(index - 1, event);
    });

    const seen = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const i = frames.indexOf(entry.target);
          if (i >= 0 && i !== index) {
            index = i;
            dots.forEach((dot, n) => {
              if (n === index) dot.setAttribute("aria-current", "true");
              else dot.removeAttribute("aria-current");
            });
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    frames.forEach((frame) => seen.observe(frame));

    // Product photos change only by hand; autoplay stays opt-in through data-autoplay.
    autoplay = bindAutoplay(gallery, {
      interval: Number(gallery.dataset.autoplay) || 0,
      next: () => render(index + 1),
    });
  });

  // ---------- Packs and prices ----------
  const money = (value) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);

  document.querySelectorAll("[data-good]").forEach((good) => {
    const now = good.querySelector("[data-now]");
    const was = good.querySelector("[data-was]");
    const wasValue = good.querySelector("[data-was-value]");
    const cut = good.querySelector("[data-cut]");
    const sku = good.querySelector("[data-sku]");
    const rate = good.querySelector("[data-rate-line]");

    const show = (input) => {
      const price = Number(input.dataset.price);
      const old = input.dataset.old ? Number(input.dataset.old) : null;
      now.textContent = money(price);
      now.classList.toggle("is-sale", Boolean(old));
      sku.textContent = input.value;
      if (rate) {
        const isBest = input.hasAttribute("data-best");
        rate.firstChild.nodeValue = input.dataset.rate;
        rate.classList.toggle("is-best", isBest);
        rate.querySelector("[data-best-note]").hidden = !isBest;
      }
      if (old) {
        wasValue.textContent = money(old);
        was.hidden = false;
        // The shop only says "Скидка!"; the percentage comes from its own two prices.
        cut.textContent = `−${Math.round(((old - price) / old) * 100)}%`;
        cut.hidden = false;
      } else {
        was.hidden = true;
        cut.hidden = true;
      }
    };

    good.addEventListener("change", (event) => {
      if (event.target.matches(".pack__input")) show(event.target);
    });
  });

  // ---------- Demo cart (shared with product.html via assets/js/cart.js) ----------
  document.querySelectorAll("[data-add]").forEach((button) => {
    const label = button.textContent;
    let timer;

    button.addEventListener("click", () => {
      const good = button.closest("[data-good]");
      const pack = good.querySelector(".pack__input:checked");
      const name = good.querySelector(".good__name").textContent.trim();
      const gallery = good.querySelector("[data-gallery-track]");
      let photo = good.querySelector(".good__image");
      // Prefer the frame that is currently in view when the card has a swipe gallery.
      if (gallery) {
        const frames = [...gallery.querySelectorAll("[data-gallery-frame]")];
        const visible = frames.find((frame) => {
          const mid = gallery.scrollLeft + gallery.clientWidth / 2;
          return frame.offsetLeft <= mid && mid < frame.offsetLeft + frame.offsetWidth;
        });
        photo = visible?.querySelector(".good__image") || photo;
      }

      if (!window.TeaboomCart) return;

      window.TeaboomCart.add({
        photo,
        label: `${name}, ${pack.dataset.label} — добавлено в корзину.`,
      });

      button.textContent = "Добавлено";
      button.classList.add("is-added");
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = label;
        button.classList.remove("is-added");
      }, 1600);
    });
  });
  // ---------- Back to top ----------
  // Appears when the main menu scrolls away (desktop) or after ¾ of a screen (phones, where
  // the dock stays). The ring shows how far down the page they are.
  const totop = document.querySelector("[data-totop]");
  if (totop) {
    const menuBar = document.querySelector(".masthead__bar");
    let shown = false;
    let queued = false;

    const sync = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      totop.style.setProperty("--p", progress.toFixed(3));
      // Антон 11.11: one navigation tool leaves, the other arrives — on desktop the arrow
      // shows the moment the main menu scrolls out of view. Phones have no top menu (the dock
      // is always there), so they keep the three-quarters-of-a-screen rule.
      // "Gone" = slid under the sticky header, not just off the top edge.
      const past = menuBar && menuBar.offsetParent
        ? menuBar.getBoundingClientRect().bottom <= (masthead ? masthead.getBoundingClientRect().bottom : 0)
        : window.scrollY > window.innerHeight * 0.75;
      if (past !== shown) {
        shown = past;
        totop.classList.toggle("is-shown", shown);
      }
    };

    window.addEventListener(
      "scroll",
      () => {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(sync);
      },
      { passive: true }
    );
    window.addEventListener("resize", sync, { passive: true });
    sync();

    totop.addEventListener("click", (event) => {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      // Keyboard activation (detail 0): put focus back at the top so Tab continues from there.
      if (event.detail === 0) masthead?.querySelector(".brand")?.focus({ preventScroll: true });
    });
  }
})();
