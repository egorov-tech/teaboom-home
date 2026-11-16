/* Product page: pack switching, gallery thumbs, add-to-cart via shared TeaboomCart. */

(() => {
  "use strict";

  const root = document.querySelector(".product");
  if (!root) return;

  const packs = Array.from(root.querySelectorAll(".pack__input"));
  if (!packs.length) return;

  const out = {
    sku: root.querySelector('[data-out="sku"]'),
    price: root.querySelector('[data-out="price"]'),
    oldPrice: root.querySelector('[data-out="old-price"]'),
    discount: root.querySelector('[data-out="discount"]'),
  };

  const form = root.querySelector(".buy");
  const cta = root.querySelector("[data-add-to-cart]");
  const buyAction = root.querySelector("[data-buy-action]");
  const buySlot = root.querySelector("[data-buy-slot]");
  const mobileBuy = window.matchMedia("(max-width: 759px)");
  // Observe the stable in-flow slot, never the button that changes position.
  const updateBuyPosition = () => {
    const box = buySlot.getBoundingClientRect();
    const headerBottom = document.querySelector("[data-masthead]")?.getBoundingClientRect().bottom || 80;
    const dockTop = document.querySelector("[data-dock]")?.getBoundingClientRect().top || innerHeight;
    const visible = box.top >= headerBottom + 8 && box.bottom <= dockTop - 8;
    buyAction.classList.toggle("is-pinned", mobileBuy.matches && !visible);
  };
  let buyFrame = 0;
  const scheduleBuyPosition = () => {
    if (buyFrame) return;
    buyFrame = requestAnimationFrame(() => { buyFrame = 0; updateBuyPosition(); });
  };
  window.addEventListener("scroll", scheduleBuyPosition, { passive: true });
  window.addEventListener("resize", scheduleBuyPosition);
  mobileBuy.addEventListener("change", scheduleBuyPosition);
  new ResizeObserver(scheduleBuyPosition).observe(root);
  updateBuyPosition();

  const { money: formatPrice, whole } = window.TeaboomFormat;

  const read = (input) => ({
    sku: input.dataset.sku,
    price: parseFloat(input.dataset.price),
    oldPrice: parseFloat(input.dataset.oldPrice),
    grams: parseFloat(input.dataset.grams),
  });

  const ratePer100g = (pack) => (pack.price / pack.grams) * 100;

  // Chips show price per 100 g; the cheapest one is marked as the best value.
  const renderPacks = () => {
    const rates = packs.map((input) => ratePer100g(read(input)));
    const best = Math.min(...rates);
    const bestIsCheaper = best < rates[0] - 0.005;

    packs.forEach((input, i) => {
      const rate = input.parentNode.querySelector("[data-pack-rate]");
      if (!rate) return;
      const isBest = bestIsCheaper && rates[i] === best;
      rate.textContent = `${whole(Math.round(rates[i]))}\u00a0₽/100\u00a0г`;
      rate.classList.toggle("pack__rate--best", isBest);
      if (isBest) {
        const note = document.createElement("span");
        note.className = "visually-hidden";
        note.textContent = ", выгоднее всего";
        rate.append(note);
      }
    });
  };

  const render = (input) => {
    const pack = read(input);
    out.sku.textContent = pack.sku;
    out.price.textContent = formatPrice(pack.price);
    const buyPrice = root.querySelector("[data-buy-price]");
    buyPrice.textContent = formatPrice(pack.price);
    buyPrice.classList.toggle("is-sale", pack.oldPrice > pack.price);
    root.querySelector("[data-buy-pack]").textContent = input.dataset.label;
    // A pack without an old price shows no strike-through and no discount.
    const sale = pack.oldPrice > pack.price;
    out.price.classList.toggle("is-sale", sale);
    out.oldPrice.closest(".price__was").hidden = !sale;
    out.discount.hidden = !sale;
    out.oldPrice.textContent = sale ? formatPrice(pack.oldPrice) : "";
    out.discount.textContent = sale ? `−${Math.round((1 - pack.price / pack.oldPrice) * 100)}%` : "";
  };

  renderPacks();

  packs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) render(input);
    });
    if (input.checked) render(input);
  });

  // Photos: gallery.js. The cart flies the photo that is in view.
  const currentPhoto = () => {
    const shots = [...root.querySelectorAll(".shot__image")];
    const track = root.querySelector("[data-gallery-track]");
    if (!track || shots.length < 2) return shots[0];
    const i = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    return shots[Math.min(Math.max(i, 0), shots.length - 1)];
  };

  let resetTimer = null;
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const pack = root.querySelector(".pack__input:checked");
    const name = root.querySelector(".product__title")?.textContent.trim() || "Товар";
    const label = cta.querySelector(".cta__label");

    cta.classList.add("is-added");
    label.textContent = "Добавлено";

    window.TeaboomCart?.add({
      photo: currentPhoto(),
      label: `${name}, ${pack?.dataset.label || pack?.value || ""} — добавлено в корзину.`,
    });

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      cta.classList.remove("is-added");
      label.textContent = "В корзину";
    }, 1800);
  });
})();

/* п. 23: one details block — tabs on phones, sections one under another on wider screens.
   The rating link (п. 22) and any #about/#specs/#reviews/#delivery address open their tab. */
(() => {
  "use strict";

  const details = document.querySelector("[data-details]");
  if (!details) return;

  const tablist = details.querySelector("[data-tabs]");
  const tabs = [...details.querySelectorAll("[data-tab]")];
  const panels = [...details.querySelectorAll("[data-panel]")];
  const phone = window.matchMedia("(max-width: 759px)");
  let current = tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.tab || panels[0].id;

  const show = (name) => {
    if (!panels.some((p) => p.id === name)) return false;
    current = name;
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && phone.matches) tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    panels.forEach((panel) => {
      panel.hidden = phone.matches && panel.id !== name;
    });
    return true;
  };

  // Phones get tabs; from 760 px every panel shows (no hidden content after a rotation).
  const mode = () => {
    details.classList.toggle("is-tabbed", phone.matches);
    tablist.hidden = !phone.matches;
    panels.forEach((panel) => {
      panel.hidden = phone.matches && panel.id !== current;
      if (phone.matches) panel.setAttribute("role", "tabpanel");
      else panel.removeAttribute("role");
    });
    tablist.dispatchEvent(new Event("scroll"));
  };
  phone.addEventListener("change", mode);
  mode();

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => show(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
      show(next.dataset.tab);
      next.focus();
    });
  });

  // The panel must be visible before the browser follows the #hash, so open it on click and
  // let the normal jump (and Back) work.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const name = link.getAttribute("href").slice(1);
    if (panels.some((p) => p.id === name)) link.addEventListener("click", () => show(name));
  });

  const fromHash = () => {
    const name = decodeURIComponent(location.hash.slice(1));
    if (show(name)) details.querySelector(`#${CSS.escape(name)}`)?.scrollIntoView();
  };
  window.addEventListener("hashchange", fromHash);
  if (location.hash) fromHash();
})();
