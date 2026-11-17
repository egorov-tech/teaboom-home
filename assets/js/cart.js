// Shared demo cart: line items across pages, header count, bump, fly-to-cart photo.
// Safe without a bundler: attaches to window.TeaboomCart. On the shop the backend keeps the
// cart; here it lives in localStorage so home → product → cart works in one browser.
(() => {
  const KEY = "teaboom-demo-cart-v2";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = new Set();

  // Item: { sku, name, pack, price, old, img, url, qty }
  const items = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(raw)
        ? raw.filter((x) => x && x.sku && Number(x.qty) > 0 && Number.isFinite(Number(x.price)))
        : [];
    } catch (e) {
      return [];
    }
  };

  const store = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  };

  const count = (list = items()) => list.reduce((n, x) => n + Number(x.qty), 0);
  const read = () => count();

  const cartEl = () => document.querySelector("[data-cart]");
  const countEl = () => document.querySelector("[data-cart-count]");
  const wordsEl = () => document.querySelector("[data-cart-words]");
  const statusEl = () => document.querySelector("[data-cart-status]");

  const paint = (n) => {
    const box = countEl();
    const words = wordsEl();
    const cart = cartEl();
    if (box) box.textContent = String(n);
    if (words) words.textContent = `, товаров: ${n}`;
    if (cart) cart.classList.toggle("is-filled", n > 0);
  };

  const save = (list) => {
    store(list);
    paint(count(list));
    listeners.forEach((fn) => fn(list));
  };

  const bump = () => {
    const cart = cartEl();
    if (!cart) return;
    cart.classList.add("is-filled");
    cart.classList.remove("is-bumped");
    void cart.offsetWidth;
    cart.classList.add("is-bumped");
  };

  // Arc from a product photo into the cart icon (same motion on home, category and PDP).
  const fly = (photo) => {
    const cart = cartEl();
    if (!cart || !photo || reduceMotion.matches) return;

    const from = photo.getBoundingClientRect();
    const to = cart.getBoundingClientRect();
    if (from.width < 2 || to.width < 2) return;

    const size = Math.min(120, Math.max(64, from.width * 0.45));
    const ghost = document.createElement("img");
    ghost.src = photo.currentSrc || photo.src;
    ghost.alt = "";
    ghost.className = "fly";
    ghost.style.left = `${from.left + from.width / 2 - size / 2}px`;
    ghost.style.top = `${from.top + from.height / 2 - size / 2}px`;
    ghost.style.width = `${size}px`;
    ghost.style.height = `${size}px`;
    document.body.append(ghost);

    const shiftX = to.left + to.width / 2 - (from.left + from.width / 2);
    const shiftY = to.top + to.height / 2 - (from.top + from.height / 2);

    const flight = ghost.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${shiftX * 0.6}px, ${shiftY * 0.45 - 60}px) scale(0.6)`,
          opacity: 0.9,
          offset: 0.55,
        },
        { transform: `translate(${shiftX}px, ${shiftY}px) scale(0.12)`, opacity: 0.2 },
      ],
      { duration: 720, easing: "cubic-bezier(0.4, 0, 0.3, 1)" }
    );
    flight.onfinish = () => ghost.remove();
  };

  const add = ({ photo, label, item } = {}) => {
    const list = items();
    if (item && item.sku) {
      const line = list.find((x) => x.sku === item.sku);
      if (line) line.qty = Number(line.qty) + 1;
      else list.push({ ...item, qty: 1 });
      store(list);
    }
    const next = count(list);
    if (photo) fly(photo);
    const delay = photo && !reduceMotion.matches ? 620 : 0;
    window.setTimeout(() => {
      paint(next);
      bump();
    }, delay);
    if (label && statusEl()) statusEl().textContent = label;
    listeners.forEach((fn) => fn(list));
    return next;
  };

  const setQty = (sku, qty) => {
    const q = Math.max(0, Math.min(999, Math.floor(Number(qty) || 0)));
    save(items().map((x) => (x.sku === sku ? { ...x, qty: q } : x)).filter((x) => x.qty > 0));
  };

  const remove = (sku) => save(items().filter((x) => x.sku !== sku));
  const clear = () => save([]);
  const fill = (list) => save(list.map((x) => ({ ...x, qty: Math.max(1, Number(x.qty) || 1) })));
  const onChange = (fn) => listeners.add(fn);

  // Another tab changed the cart: keep the header count honest.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const list = items();
    paint(count(list));
    listeners.forEach((fn) => fn(list));
  });

  paint(count());

  window.TeaboomCart = { read, add, bump, fly, paint, items, setQty, remove, clear, fill, onChange };
})();
