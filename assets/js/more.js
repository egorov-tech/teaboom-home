/* Blocks after the product details (п. 44, п. 46):
   — «Похожие и сопутствующие товары»: a row of catalogue tiles; arrows on wide screens appear
     only when the row does not fit, a finger swipes it on phones;
   — «Вы смотрели»: products this shopper opened, kept in this browser. On the shop the module
     gives the list; the demo keeps it the same way so the block behaves for real. */
(() => {
  "use strict";

  // ---------- Row with arrows ----------
  const wireRail = (rail) => {
    const track = rail.querySelector("[data-rail-track]");
    const arrows = rail.querySelector("[data-rail-arrows]");
    const prev = rail.querySelector("[data-rail-prev]");
    const next = rail.querySelector("[data-rail-next]");
    if (!track || !arrows) return;

    const step = () => {
      const item = track.querySelector(":scope > li:not([hidden])");
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return item ? item.getBoundingClientRect().width + gap : track.clientWidth;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      // Phones swipe; the arrows are for a mouse, and only when there is something to scroll to.
      arrows.hidden = max <= 1 || !matchMedia("(hover: hover) and (pointer: fine)").matches;
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= max - 1;
    };
    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
    track.addEventListener("scroll", update, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(track);
    update();
  };
  document.querySelectorAll("[data-rail]").forEach(wireRail);

  // ---------- «Вы смотрели» ----------
  const box = document.querySelector("[data-viewed]");
  if (!box) return;
  const KEY = "teaboom-viewed-v1";
  // Артём 27.11: «Вы смотрели» — длиннее, лента листается (стрелки с мышью, свайп на телефоне).
  const MAX_KEPT = 20;
  const MAX_SHOWN = 16;
  const read = (sel) => {
    try { return JSON.parse(box.querySelector(sel)?.textContent || "null"); } catch (e) { return null; }
  };
  const me = read("[data-viewed-me]");
  const sample = read("[data-viewed-sample]") || [];

  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { seen = []; }
  if (!Array.isArray(seen)) seen = [];

  // Show what was opened before this page, then remember this page at the front.
  const others = seen.filter((p) => p && p.slug && (!me || p.slug !== me.slug)).slice(0, MAX_SHOWN);
  if (me) {
    try { localStorage.setItem(KEY, JSON.stringify([me, ...others].slice(0, MAX_KEPT))); } catch (e) { /* private mode: no memory */ }
  }

  const list = others.length ? others : sample;
  const note = box.querySelector("[data-viewed-note]");
  if (!list.length) return;
  if (note) note.hidden = others.length > 0;

  const money = window.TeaboomFormat?.money || ((v) => `${v} ₽`);
  const ul = box.querySelector("[data-viewed-list]");
  list.forEach((p) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "seen";
    a.href = p.url;
    // Нет фото или оно не открылось (27.11: «Сертификация» с битой картинкой) — светлая плашка с чашкой.
    const blank = () => {
      const ph = document.createElement("span");
      ph.className = "seen__photo seen__photo--none";
      ph.setAttribute("aria-hidden", "true");
      ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M4 9h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H15.6"/><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/></svg>';
      return ph;
    };
    let img;
    if (p.img) {
      img = document.createElement("img");
      img.className = "seen__photo";
      img.src = p.img;
      img.alt = "";
      img.width = 64;
      img.height = 64;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => img.replaceWith(blank()), { once: true });
    } else img = blank();
    const name = document.createElement("span");
    name.className = "seen__name";
    name.textContent = p.name;
    const price = document.createElement("span");
    price.className = "seen__price";
    price.textContent = `${p.from ? "от " : ""}${money(p.price)}`;
    a.append(img, name, price);
    li.append(a);
    ul.append(li);
  });
  box.hidden = false;
  // 27.11: лента длиннее — с мышью нужны стрелки, как у «Похожих» (та же разметка rail; телефон — свайп).
  if (!ul.closest(".rail__frame")) {
    const frame = document.createElement("div");
    frame.className = "rail__frame";
    ul.before(frame);
    frame.append(ul);
    ul.setAttribute("data-rail-track", "");
    const arrow = (dir, label, d) => '<button class="rail__arrow press" type="button" aria-label="' + label + '" data-rail-' + dir + '><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    frame.insertAdjacentHTML("beforeend", '<div class="rail__arrows" data-rail-arrows hidden>' + arrow("prev", "Назад", "M15 5l-7 7 7 7") + arrow("next", "Вперёд", "M9 5l7 7-7 7") + "</div>");
    frame.setAttribute("data-rail", "");
    wireRail(frame);
  }
})();
