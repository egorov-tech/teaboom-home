/* Cart page (п. 25): lines from TeaboomCart, quantity, remove, coupon, totals, phone pay bar.
   Content as on teaboom.ru/cart: name with pack, артикул, «− 1 +», line sum and «1 × price»,
   coupon code, Сумма / Доставка / Оплата / Итого, «Заказать». cart.html?demo fills a sample. */
(() => {
  const root = document.querySelector("[data-basket]");
  const cart = window.TeaboomCart;
  if (!root || !cart) return;

  const money = (v) => window.TeaboomFormat.money(v);
  const list = root.querySelector("[data-lines]");
  const tpl = document.querySelector("[data-line-template]");
  const empty = root.querySelector("[data-basket-empty]");
  const full = root.querySelector("[data-basket-full]");
  const paybar = document.querySelector("[data-paybar]");
  const countLine = root.querySelector("[data-basket-count]");
  const status = document.querySelector("[data-cart-status]");

  const plural = (n, one, few, many) => {
    const a = n % 10;
    const b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };

  // Review link: cart.html?demo puts two real items (ананасовый улун 100 г, медовая дыня 1 кг).
  if (new URLSearchParams(location.search).has("demo") && !cart.items().length) {
    try {
      cart.fill(JSON.parse(document.querySelector("[data-cart-sample]").textContent));
    } catch (e) {}
  }

  const fillLine = (li, item) => {
    const title = `${item.name}, ${item.pack}`;
    li.dataset.sku = item.sku;
    li.querySelectorAll("[data-line-link]").forEach((a) => a.setAttribute("href", item.url || "#"));
    const img = li.querySelector("[data-line-image]");
    if (item.img) img.src = item.img;
    else img.removeAttribute("src");
    li.querySelector("[data-line-name]").textContent = title;
    li.querySelector("[data-line-sku]").textContent = item.sku;
    const input = li.querySelector("[data-qty-input]");
    input.value = String(item.qty);
    input.setAttribute("aria-label", `Количество: ${title}`);
    li.querySelector("[data-qty]").setAttribute("aria-label", `Количество: ${title}`);
    li.querySelector("[data-qty-dec]").setAttribute("aria-label", item.qty > 1 ? `Уменьшить: ${title}` : `Убрать из корзины: ${title}`);
    li.querySelector("[data-qty-inc]").setAttribute("aria-label", `Увеличить: ${title}`);
    li.querySelector("[data-line-remove-label]").textContent = `Удалить: ${title}`;
    li.querySelector("[data-line-sum]").textContent = money(item.price * item.qty);
    li.querySelector("[data-line-each]").textContent = `${item.qty} × ${money(item.price)}`;
  };

  // The pay bar only stands in for «Заказать» while the summary's own button is off screen.
  let orderInView = false;
  const syncBar = (has = cart.items().length > 0) => {
    if (paybar) paybar.hidden = !has || orderInView;
  };
  const order = root.querySelector("[data-order]");
  if (order && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      orderInView = entry.isIntersecting;
      syncBar();
    }).observe(order);
  }

  const render = (items = cart.items()) => {
    const has = items.length > 0;
    empty.hidden = has;
    full.hidden = !has;
    syncBar(has);
    document.body.classList.toggle("is-basket-full", has);

    // Keep existing rows (and focus inside them); add, update or drop by артикул.
    const rows = new Map([...list.querySelectorAll("[data-line]")].map((li) => [li.dataset.sku, li]));
    items.forEach((item, i) => {
      let li = rows.get(item.sku);
      if (!li) li = tpl.content.firstElementChild.cloneNode(true);
      fillLine(li, item);
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
      rows.delete(item.sku);
    });
    rows.forEach((li) => li.remove());

    const qty = items.reduce((n, x) => n + x.qty, 0);
    const sum = items.reduce((s, x) => s + x.price * x.qty, 0);
    countLine.textContent = has ? `${qty} ${plural(qty, "товар", "товара", "товаров")}` : "";
    root.querySelector("[data-sum]").textContent = money(sum);
    root.querySelector("[data-total]").textContent = money(sum);
    const bar = document.querySelector("[data-total-bar]");
    if (bar) bar.textContent = money(sum);
  };

  const skuOf = (el) => el.closest("[data-line]")?.dataset.sku;
  const itemOf = (sku) => cart.items().find((x) => x.sku === sku);
  const say = (text) => {
    if (status) status.textContent = text;
  };

  list.addEventListener("click", (e) => {
    const sku = skuOf(e.target);
    if (!sku) return;
    const item = itemOf(sku);
    if (!item) return;
    const title = `${item.name}, ${item.pack}`;
    if (e.target.closest("[data-qty-inc]")) {
      cart.setQty(sku, item.qty + 1);
      say(`${title}: ${item.qty + 1} шт.`);
    } else if (e.target.closest("[data-qty-dec]")) {
      if (item.qty > 1) {
        cart.setQty(sku, item.qty - 1);
        say(`${title}: ${item.qty - 1} шт.`);
      } else {
        dropLine(sku, title);
      }
    } else if (e.target.closest("[data-line-remove]")) {
      dropLine(sku, title);
    }
  });

  // After a row goes away, focus moves to the next row's name (or the empty-state link).
  const dropLine = (sku, title) => {
    const li = list.querySelector(`[data-line][data-sku="${CSS.escape(sku)}"]`);
    const next = li?.nextElementSibling || li?.previousElementSibling;
    cart.remove(sku);
    say(`${title} — удалено из корзины.`);
    (next?.querySelector("[data-line-name]") || empty.querySelector("a"))?.focus();
  };

  list.addEventListener("change", (e) => {
    const input = e.target.closest("[data-qty-input]");
    if (!input) return;
    const sku = skuOf(input);
    const n = Math.floor(Number(input.value.replace(/\D/g, "")));
    if (!n) {
      const item = itemOf(sku);
      input.value = String(item ? item.qty : 1);
      return;
    }
    cart.setQty(sku, n);
  });

  list.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("[data-qty-input]")) e.target.blur();
  });

  // Coupon: the shop checks the code; the demo has no list of codes, so it says so plainly.
  const coupon = root.querySelector("[data-coupon]");
  coupon?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = coupon.querySelector("input");
    const note = coupon.querySelector("[data-coupon-note]");
    const code = input.value.trim();
    note.hidden = false;
    if (!code) {
      note.textContent = "Введите код купона";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    note.textContent = `Демо: на сайте код «${code}» проверит магазин и пересчитает итог.`;
  });

  cart.onChange(render);
  render();
})();
