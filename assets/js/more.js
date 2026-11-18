/* Blocks after the product details (п. 44, п. 46):
   — «Похожие и сопутствующие товары»: a row of catalogue tiles; arrows on wide screens appear
     only when the row does not fit, a finger swipes it on phones;
   — «Вы смотрели»: products this shopper opened, kept in this browser. On the shop the module
     gives the list; the demo keeps it the same way so the block behaves for real. */
(() => {
  "use strict";

  // ---------- Row with arrows ----------
  document.querySelectorAll("[data-rail]").forEach((rail) => {
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
  });

  // ---------- «Вы смотрели» ----------
  const box = document.querySelector("[data-viewed]");
  if (!box) return;
  const KEY = "teaboom-viewed-v1";
  const MAX_KEPT = 12;
  const MAX_SHOWN = 8;
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
    const img = document.createElement("img");
    img.className = "seen__photo";
    img.src = p.img;
    img.alt = "";
    img.width = 64;
    img.height = 64;
    img.loading = "lazy";
    img.decoding = "async";
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
})();
