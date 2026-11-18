/* п. 17: filters, sorting and pages over the whole category. The address is the live site's
   (?f=3__Китай___16__Натуральный&sorting=-effective_price&start=2), so Back/Forward, a shared
   link and — later — the shop's own server all read the same state. Old demo links with
   ?sort= / ?page= still work.
   Filters: values of one group widen the choice (Китай или Тайвань), groups narrow it
   (Китай и Натуральный). Counts next to each value are what you get if you tick it now. */
(() => {
  "use strict";

  const root = document.querySelector("[data-category]");
  if (!root) return;

  const SEP = "___";
  const list = root.querySelector("[data-list]");
  const items = [...list.querySelectorAll("[data-item]")];
  const select = root.querySelector("[data-sort]");
  const count = root.querySelector("[data-count]");
  const pager = root.querySelector("[data-pager]");
  const pagerList = root.querySelector("[data-pager-list]");
  const per = Number(root.dataset.perPage) || 12;
  const sorts = [...select.options].map((o) => o.value);
  const collator = new Intl.Collator("ru");

  const dialog = root.querySelector("[data-facets]");
  const boxes = [...root.querySelectorAll("[data-facet]")];
  const openBtn = root.querySelector("[data-facets-open]");
  const badge = root.querySelector("[data-facets-badge]");
  const resetBtns = [...root.querySelectorAll("[data-facets-reset]")];
  const showBtn = root.querySelector("[data-facets-show]");
  const showTotal = root.querySelector("[data-facets-total]");
  const chips = root.querySelector("[data-chips]");
  const chipsList = root.querySelector("[data-chips-list]");
  const empty = root.querySelector("[data-empty]");

  const groupOf = (key) => key.split("__")[0];
  const valueOf = (key) => key.slice(key.indexOf("__") + 2);
  const known = new Set(boxes.map((b) => b.value));
  const tags = new Map(items.map((li) => [li, new Set((li.dataset.f || "").split(SEP).filter(Boolean))]));

  const compare = {
    effective_price: (a, b) => a.dataset.price - b.dataset.price || a.dataset.order - b.dataset.order,
    "-effective_price": (a, b) => b.dataset.price - a.dataset.price || a.dataset.order - b.dataset.order,
    name: (a, b) => collator.compare(a.dataset.name, b.dataset.name),
    "-name": (a, b) => collator.compare(b.dataset.name, a.dataset.name),
  };

  // { group: Set(keys) } → does the item pass every group (optionally ignoring one)?
  const byGroup = (keys) => {
    const m = new Map();
    keys.forEach((k) => {
      const g = groupOf(k);
      if (!m.has(g)) m.set(g, new Set());
      m.get(g).add(k);
    });
    return m;
  };
  const passes = (li, groups, skip) => {
    const t = tags.get(li);
    for (const [g, keys] of groups) {
      if (g === skip) continue;
      let hit = false;
      for (const k of keys) if (t.has(k)) { hit = true; break; }
      if (!hit) return false;
    }
    return true;
  };

  const read = () => {
    const q = new URLSearchParams(location.search);
    const sortRaw = q.get("sorting") || q.get("sort");
    const sort = sorts.includes(sortRaw) ? sortRaw : sorts[0];
    const f = (q.get("f") || "").split(SEP).filter((k) => known.has(k));
    const page = parseInt(q.get("start") || q.get("page"), 10) || 1;
    return { sort, f: [...new Set(f)], page };
  };

  const href = ({ sort, f, page }) => {
    const q = new URLSearchParams();
    if (f.length) q.set("f", [...f].sort().join(SEP));
    if (sort !== sorts[0]) q.set("sorting", sort);
    if (page > 1) q.set("start", page);
    const s = q.toString().replace(/%5F/g, "_");
    return s ? `?${s}` : location.pathname.split("/").pop() || "./";
  };

  const plural = (n, one, few, many) => {
    const a = n % 10;
    const b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };

  // Pages: 1 … 4 5 6 … 12 with ‹ › around (same shape the generator writes).
  const pageWindow = (cur, total) => {
    const keep = new Set([1, total, cur - 1, cur, cur + 1]);
    const out = [];
    let last = 0;
    for (let n = 1; n <= total; n++) {
      if (!keep.has(n)) continue;
      if (n - last > 1) out.push(null);
      out.push(n);
      last = n;
    }
    return out;
  };

  const drawPager = (state, total) => {
    pager.hidden = total < 2;
    pagerList.textContent = "";
    const add = (n, text, label, cls = "") => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = `pager__link${cls}`;
      a.href = href({ ...state, page: n });
      a.dataset.page = String(n);
      a.textContent = text;
      if (label) a.setAttribute("aria-label", label);
      if (n === state.page && !cls) a.setAttribute("aria-current", "page");
      li.append(a);
      pagerList.append(li);
    };
    if (state.page > 1) add(state.page - 1, "‹", "Предыдущая страница", " pager__link--step");
    pageWindow(state.page, total).forEach((n) => {
      if (n === null) {
        const li = document.createElement("li");
        li.className = "pager__gap";
        li.setAttribute("aria-hidden", "true");
        li.textContent = "…";
        pagerList.append(li);
      } else add(n, String(n), `Страница ${n}`);
    });
    if (state.page < total) add(state.page + 1, "›", "Следующая страница", " pager__link--step");
  };

  const drawChips = (f) => {
    chips.hidden = f.length === 0;
    chipsList.textContent = "";
    f.forEach((k) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chips__chip press";
      b.dataset.key = k;
      b.setAttribute("aria-label", `Убрать фильтр «${valueOf(k)}»`);
      b.innerHTML = '<span></span><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m5 5 10 10M15 5 5 15"/></svg>';
      b.firstChild.textContent = valueOf(k);
      li.append(b);
      chipsList.append(li);
    });
  };

  let state = read();

  const render = () => {
    const groups = byGroup(state.f);
    const matched = items.filter((li) => passes(li, groups));
    const total = matched.length;
    const pages = Math.max(1, Math.ceil(total / per));
    state.page = Math.min(Math.max(state.page, 1), pages);

    select.value = state.sort;
    select.dispatchEvent(new Event("sync"));

    const ordered = [...matched].sort(compare[state.sort]);
    const shown = new Set(ordered.slice((state.page - 1) * per, state.page * per));
    ordered.forEach((li) => list.append(li));
    items.forEach((li) => {
      li.hidden = !shown.has(li);
    });

    // п. 41: how many products — «143 товара», with filters «Найдено 79 товаров»; the page is in the pager.
    const word = plural(total, "товар", "товара", "товаров");
    count.textContent = !total ? "Товаров нет" : state.f.length ? `Найдено ${total} ${word}` : `${total} ${word}`;
    empty.hidden = total > 0;
    list.hidden = total === 0;

    // Live counts: what each value would give with the rest of the choice kept.
    boxes.forEach((box) => {
      const g = groupOf(box.value);
      const n = items.filter((li) => tags.get(li).has(box.value) && passes(li, groups, g)).length;
      box.checked = state.f.includes(box.value);
      box.closest(".facet").querySelector("[data-facet-count]").textContent = String(n);
      box.disabled = n === 0 && !box.checked;
      box.closest(".facet").classList.toggle("is-off", box.disabled);
    });

    const picked = state.f.length;
    badge.hidden = picked === 0;
    badge.textContent = String(picked);
    openBtn.setAttribute("aria-label", picked ? `Фильтры, выбрано: ${picked}` : "Фильтры");
    // Keep «Сбросить» in the layout (disabled when nothing is chosen) — hiding it shoved the heading.
    resetBtns.forEach((btn) => {
      btn.disabled = picked === 0;
    });
    // A chosen value inside a folded group is always shown.
    root.querySelectorAll("[data-extra]").forEach((li) => {
      const group = li.closest(".facets__group");
      const open = group.querySelector("[data-facets-more]")?.getAttribute("aria-expanded") === "true";
      li.hidden = !open && !li.querySelector("[data-facet]").checked;
    });
    showTotal.textContent = `${total} ${plural(total, "товар", "товара", "товаров")}`;
    drawChips(state.f);
    drawPager(state, pages);
  };

  // scroll: true — always back to the bar (a page change); "up" — only when the list has gone
  // above the window (a filter or sorting chosen far down): the shopper sees the new list start.
  // Smooth unless the system asks for less motion (html scroll-behavior, _base.scss).
  const go = ({ push = true, scroll = false } = {}) => {
    render();
    const url = href(state);
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    const bar = root.querySelector(".category__bar");
    const above = bar.getBoundingClientRect().top < 0;
    if (scroll === true || (scroll === "up" && above)) bar.scrollIntoView({ block: "start" });
  };

  // ---------- Filters panel: inline column on wide screens, a modal sheet below 1060 px ----------
  const wide = window.matchMedia("(min-width: 1060px)");
  const place = () => {
    if (wide.matches) {
      if (dialog.open && dialog.matches(":modal")) dialog.close();
      dialog.setAttribute("open", "");
    } else if (dialog.open && !dialog.matches(":modal")) {
      dialog.removeAttribute("open");
    }
  };
  wide.addEventListener("change", place);
  place();

  // Sticky column: top under the compact header, or — when the panel is taller than the
  // window — a negative top so it scrolls with the page and holds once its bottom shows.
  const pin = () => {
    if (!wide.matches) return;
    const css = getComputedStyle(document.documentElement);
    const head = parseFloat(css.getPropertyValue("--pin-h")) - parseFloat(css.getPropertyValue("--pin-trim")) + 16;
    const top = Math.min(head, window.innerHeight - dialog.offsetHeight - 16);
    dialog.style.setProperty("--facets-top", `${Math.round(top)}px`);
  };
  if ("ResizeObserver" in window) new ResizeObserver(pin).observe(dialog);
  window.addEventListener("resize", pin);
  pin();

  // Below 1060 px the panel is a bottom sheet: the same open/close as the catalogue menu
  // (home.js TeaboomSheet — slides up, slides down, Escape too). On a computer it is a column.
  const sheet = window.TeaboomSheet?.(dialog, dialog.querySelector(".facets__panel"));
  let returnFocus = null;
  openBtn.addEventListener("click", () => {
    if (wide.matches) {
      dialog.querySelector("[data-facet]:not(:disabled)")?.focus();
      return;
    }
    returnFocus = openBtn;
    if (sheet) sheet.open();
    else dialog.showModal();
    document.documentElement.classList.add("has-sheet");
  });
  const closeSheet = () => {
    if (!dialog.matches(":modal")) return Promise.resolve();
    if (sheet) return sheet.close();
    dialog.close();
    return Promise.resolve();
  };
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("has-sheet");
    if (!wide.matches) dialog.removeAttribute("open");
    returnFocus?.focus();
    returnFocus = null;
  });
  root.querySelector("[data-facets-close]").addEventListener("click", closeSheet);
  // The list scroll waits for the sheet to close: until then the page is locked (has-sheet).
  showBtn.addEventListener("click", () => {
    closeSheet().then(() => root.querySelector(".category__bar").scrollIntoView({ block: "start" }));
  });
  // Tap on the dimmed backdrop closes the sheet.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeSheet();
  });

  boxes.forEach((box) =>
    box.addEventListener("change", () => {
      state.f = box.checked ? [...state.f, box.value] : state.f.filter((k) => k !== box.value);
      state.page = 1;
      // In the column on a computer the list changes in place; on phones the sheet covers it.
      go({ scroll: wide.matches ? "up" : false });
    })
  );

  const resetAll = () => {
    state.f = [];
    state.page = 1;
    go();
  };
  resetBtns.forEach((btn) => btn.addEventListener("click", resetAll));
  root.querySelectorAll("[data-facets-more]").forEach((btn) => {
    const rest = btn.textContent;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Свернуть" : rest;
      btn.closest(".facets__group").querySelectorAll("[data-extra]").forEach((li) => {
        li.hidden = !open && !li.querySelector("[data-facet]").checked;
      });
      if (open) btn.closest(".facets__group").querySelector("[data-extra] [data-facet]")?.focus();
    });
  });
  root.querySelector("[data-chips-reset]").addEventListener("click", resetAll);
  root.querySelector("[data-empty-reset]").addEventListener("click", resetAll);

  chipsList.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-key]");
    if (!chip) return;
    const next = chip.parentElement.nextElementSibling?.querySelector("button") || root.querySelector("[data-chips-reset]");
    state.f = state.f.filter((k) => k !== chip.dataset.key);
    state.page = 1;
    go();
    (state.f.length ? chipsList.querySelector(`[data-key]`) || next : openBtn).focus();
  });

  select.addEventListener("change", () => {
    state.sort = select.value;
    state.page = 1;
    go({ scroll: "up" });
  });

  pagerList.addEventListener("click", (e) => {
    const a = e.target.closest("[data-page]");
    if (!a) return;
    e.preventDefault();
    state.page = Number(a.dataset.page);
    go({ scroll: true });
  });

  window.addEventListener("popstate", () => {
    state = read();
    render();
  });

  go({ push: false });
})();
