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

  const wholeFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const centsFormat = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatPrice = (value) => {
    const amount = Math.round(value * 100) / 100;
    const formatter = amount % 1 === 0 ? wholeFormat : centsFormat;
    return `${formatter.format(amount)}\u00a0₽`;
  };

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
      rate.textContent = `${wholeFormat.format(Math.round(rates[i]))}\u00a0₽/100\u00a0г`;
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
    out.price.classList.toggle("is-sale", pack.oldPrice > pack.price);
    out.oldPrice.textContent = formatPrice(pack.oldPrice);
    out.discount.textContent = `−${Math.round((1 - pack.price / pack.oldPrice) * 100)}%`;
  };

  renderPacks();

  packs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) render(input);
    });
    if (input.checked) render(input);
  });

  const photo = root.querySelector(".shot__image");
  const galleryWebp = root.querySelector("[data-gallery-webp]");
  const galleryKey = root.querySelector("[data-gallery-key]");
  const galleryCaption = root.querySelector("[data-gallery-caption]");
  const galleryItems = Array.from(root.querySelectorAll("[data-gallery-item]"));
  const media = root.querySelector(".product__media");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let galleryIndex = 0;
  let galleryTimer = 0;

  const showGalleryItem = (button, { fromAuto } = {}) => {
    if (!photo || !button) return;

    const jpg = button.dataset.src;
    const webp = button.dataset.webp;
    const alt = button.dataset.alt || photo.alt;

    if (galleryWebp && webp) galleryWebp.srcset = webp;
    // The first photo ships with a responsive srcset; drop it so the JPEG fallback follows src.
    photo.removeAttribute("srcset");
    photo.src = jpg;
    photo.alt = alt;

    if (galleryKey) galleryKey.textContent = button.dataset.key || "";
    if (galleryCaption) galleryCaption.textContent = button.dataset.caption || "";

    galleryItems.forEach((item) => {
      item.setAttribute("aria-current", item === button ? "true" : "false");
    });
    galleryIndex = galleryItems.indexOf(button);
    if (!fromAuto) armGallery();
  };

  const clearGallery = () => {
    window.clearInterval(galleryTimer);
    galleryTimer = 0;
  };

  // Product photos change only by hand (thumbnails, swipe). Set to a number of ms to bring
  // autoplay back; it would then also need a visible pause control (WCAG 2.2.2).
  const GALLERY_AUTOPLAY = 0;

  const armGallery = () => {
    clearGallery();
    if (!GALLERY_AUTOPLAY || reduceMotion.matches || galleryItems.length < 2) return;
    galleryTimer = window.setInterval(() => {
      if (document.hidden) return;
      const next = galleryItems[(galleryIndex + 1) % galleryItems.length];
      showGalleryItem(next, { fromAuto: true });
    }, GALLERY_AUTOPLAY);
  };

  galleryItems.forEach((button) => {
    button.addEventListener("click", () => showGalleryItem(button));
  });

  if (media && galleryItems.length > 1) {
    media.addEventListener("pointerenter", clearGallery);
    media.addEventListener("pointerleave", armGallery);
    media.addEventListener("focusin", clearGallery);
    media.addEventListener("focusout", (event) => {
      if (!media.contains(event.relatedTarget)) armGallery();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearGallery();
      else armGallery();
    });
    armGallery();
  }

  let resetTimer = null;
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const pack = root.querySelector(".pack__input:checked");
    const name = root.querySelector(".product__title")?.textContent.trim() || "Товар";
    const label = cta.querySelector(".cta__label");

    cta.classList.add("is-added");
    label.textContent = "Добавлено";

    window.TeaboomCart?.add({
      photo,
      label: `${name}, ${pack?.dataset.label || pack?.value || ""} — добавлено в корзину.`,
    });

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      cta.classList.remove("is-added");
      label.textContent = "В корзину";
    }, 1800);
  });
})();
