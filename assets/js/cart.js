// Shared demo cart: count across pages, bump, fly-to-cart photo.
// Safe without a bundler: attaches to window.TeaboomCart.
(() => {
  const KEY = "teaboom-demo-cart";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const read = () => {
    try {
      const n = Number(sessionStorage.getItem(KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (e) {
      return 0;
    }
  };

  const write = (n) => {
    try {
      sessionStorage.setItem(KEY, String(n));
    } catch (e) {}
  };

  const cartEl = () => document.querySelector("[data-cart]");
  const countEl = () => document.querySelector("[data-cart-count]");
  const wordsEl = () => document.querySelector("[data-cart-words]");
  const statusEl = () => document.querySelector("[data-cart-status]");

  const paint = (n) => {
    const count = countEl();
    const words = wordsEl();
    const cart = cartEl();
    if (count) count.textContent = String(n);
    if (words) words.textContent = `, товаров: ${n}`;
    if (cart) cart.classList.toggle("is-filled", n > 0);
  };

  const bump = () => {
    const cart = cartEl();
    if (!cart) return;
    cart.classList.add("is-filled");
    cart.classList.remove("is-bumped");
    void cart.offsetWidth;
    cart.classList.add("is-bumped");
  };

  // Arc from a product photo into the cart icon (same motion on home and PDP).
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

  const add = ({ photo, label } = {}) => {
    const next = read() + 1;
    write(next);
    if (photo) fly(photo);
    const delay = photo && !reduceMotion.matches ? 620 : 0;
    window.setTimeout(() => {
      paint(next);
      bump();
    }, delay);
    if (label && statusEl()) statusEl().textContent = label;
    return next;
  };

  // Restore count when opening home or product in the same tab.
  paint(read());

  window.TeaboomCart = { read, add, bump, fly, paint };
})();
