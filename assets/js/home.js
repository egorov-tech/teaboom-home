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
      masthead.classList.add("is-searching");
      quickToggle.setAttribute("aria-expanded", "true");
      // preventScroll: the field sits in the sticky bar, and a plain focus() makes the browser
      // scroll the page to clear scroll-padding-top.
      quickField?.focus({ preventScroll: true });
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
    let compact = false;
    let ticking = false;

    const syncCompact = () => {
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
  }

  // ---------- Catalogue panel ----------
  const toggle = document.querySelector("[data-catalog-toggle]");
  const panel = document.querySelector("[data-catalog]");

  if (toggle && panel) {
    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      if (!open && returnFocus) toggle.focus();
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) setOpen(false, { returnFocus: true });
    });

    document.addEventListener("click", (event) => {
      if (panel.hidden) return;
      if (!panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });

    // The panel sits after the search form in the DOM (outside the scrolling menu), so Tab
    // order is wired by hand: toggle → panel links → the menu item after "Каталог".
    const links = [...panel.querySelectorAll("a")];
    const afterToggle = toggle.closest("li").nextElementSibling?.querySelector("a");

    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.shiftKey && !panel.hidden) {
        event.preventDefault();
        links[0].focus();
      }
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
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

  // Autoplay helper: advances while visible, pauses on hover/focus/touch, off with reduced
  // motion. `control` is a visible pause/resume button — WCAG 2.2.2 needs one for anything
  // that moves on its own for longer than five seconds.
  const bindAutoplay = (root, { interval, next, paused, control }) => {
    if (reduceMotion.matches || !interval || interval < 1200) return { stop() {}, nudge() {} };

    let timer = 0;
    let visible = false;
    let held = false;
    let stopped = false;

    const clear = () => {
      window.clearInterval(timer);
      timer = 0;
    };

    const tick = () => {
      if (!visible || held || document.hidden || paused?.()) return;
      next();
    };

    const arm = () => {
      clear();
      if (visible && !held && !stopped && !document.hidden) timer = window.setInterval(tick, interval);
    };

    if (control) {
      const sync = () => {
        control.setAttribute("aria-label", stopped ? "Включить автопрокрутку баннеров" : "Остановить автопрокрутку баннеров");
        control.classList.toggle("is-stopped", stopped);
      };
      control.hidden = false;
      control.addEventListener("click", () => {
        stopped = !stopped;
        sync();
        arm();
      });
      sync();
    }

    const hold = () => {
      held = true;
      clear();
    };

    const release = () => {
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
    document.addEventListener("visibilitychange", arm);

    const inView = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        arm();
      },
      { threshold: 0.35 }
    );
    inView.observe(root);

    return {
      stop() {
        clear();
        inView.disconnect();
      },
      nudge: arm,
    };
  };

  // ---------- Banner carousel ----------
  const banners = document.querySelector("[data-banners]");

  if (banners) {
    const track = banners.querySelector("[data-track]");
    const slides = [...track.querySelectorAll("[data-slide]")];
    const prev = banners.querySelector("[data-prev]");
    const next = banners.querySelector("[data-next]");
    const current = banners.querySelector("[data-current]");
    const status = banners.querySelector("[data-status]");
    const bars = [...banners.querySelectorAll("[data-bars] span")];
    let index = 0;
    let announce = false;
    let autoplay;

    const pad = (n) => String(n).padStart(2, "0");

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

    const render = (i) => {
      index = i;
      hydrate(slides[i]);
      if (announce) {
        hydrate(slides[(i + 1) % slides.length]);
        hydrate(slides[(i - 1 + slides.length) % slides.length]);
      }
      current.textContent = pad(i + 1);
      bars.forEach((bar, n) => bar.classList.toggle("is-current", n === i));
      // Only the banner on screen is reachable with Tab.
      slides.forEach((slide, n) => {
        const link = slide.querySelector("a");
        if (n === i) link.removeAttribute("tabindex");
        else link.setAttribute("tabindex", "-1");
      });
      if (announce) status.textContent = `Баннер ${i + 1} из ${slides.length}`;
    };

    // Arrows wrap around, so neither of them ever turns disabled under the keyboard focus.
    const goTo = (i) => {
      const target = (i + slides.length) % slides.length;
      announce = true;
      track.scrollTo({ left: slides[target].offsetLeft - slides[0].offsetLeft, behavior: scrollBehavior() });
      render(target);
      autoplay?.nudge();
    };

    prev.addEventListener("click", () => goTo(index - 1));
    next.addEventListener("click", () => goTo(index + 1));

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
    // The peeking second banner on phones is fetched once the page itself has loaded.
    const warmNext = () => hydrate(slides[1]);
    if (document.readyState === "complete") warmNext();
    else window.addEventListener("load", warmNext, { once: true });

    autoplay = bindAutoplay(banners, {
      interval: Number(banners.dataset.autoplay) || 5000,
      next: () => goTo(index + 1),
      control: banners.querySelector("[data-play]"),
    });
  }

  // ---------- Product-card photo swipe + autoplay (home grid) ----------
  document.querySelectorAll("[data-gallery]").forEach((gallery) => {
    const track = gallery.querySelector("[data-gallery-track]");
    const frames = [...gallery.querySelectorAll("[data-gallery-frame]")];
    const dots = [...gallery.querySelectorAll("[data-gallery-dot]")];
    const prev = gallery.querySelector("[data-gallery-prev]");
    const next = gallery.querySelector("[data-gallery-next]");
    if (!track || frames.length < 2) return;

    let index = 0;
    let autoplay;

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

    prev?.addEventListener("click", (event) => go(index - 1, event));
    next?.addEventListener("click", (event) => go(index + 1, event));
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

    const markSwiped = () => gallery.classList.add("is-swiped");
    track.addEventListener(
      "scroll",
      () => {
        if (track.scrollLeft > 12) markSwiped();
      },
      { passive: true }
    );
    prev?.addEventListener("click", markSwiped);
    next?.addEventListener("click", markSwiped);
    dots.forEach((dot) => dot.addEventListener("click", markSwiped));

    // Product photos change only by hand; autoplay stays opt-in through data-autoplay.
    autoplay = bindAutoplay(gallery, {
      interval: Number(gallery.dataset.autoplay) || 0,
      next: () => {
        markSwiped();
        render(index + 1);
      },
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

    const show = (input) => {
      const price = Number(input.dataset.price);
      const old = input.dataset.old ? Number(input.dataset.old) : null;
      now.textContent = money(price);
      now.classList.toggle("is-sale", Boolean(old));
      sku.textContent = input.value;
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
  // Appears once the visitor is past the second product card (two cards on phones, the
  // first row on desktop) or, on the product page, past the buy block with its sticky
  // «В корзину». The ring shows how far down the page they are.
  const totop = document.querySelector("[data-totop]");
  if (totop) {
    const marker =
      document.querySelector("[data-totop-after]") ||
      document.querySelectorAll("[data-good]")[1] ||
      document.querySelector(".buy") ||
      document.querySelector("main");
    let shown = false;
    let queued = false;

    const sync = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      totop.style.setProperty("--p", progress.toFixed(3));
      const past = marker ? marker.getBoundingClientRect().bottom < 0 : window.scrollY > window.innerHeight;
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
