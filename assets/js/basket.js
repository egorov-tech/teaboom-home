/* Cart page (п. 25): lines from TeaboomCart, quantity, remove, coupon, total, phone pay bar.
   Content as on teaboom.ru/cart: name with pack, артикул, «− 1 +», line sum and «1 × price»,
   coupon code. Антон, 23.11: a removed line stays crossed out with «Вернуть» until the page is
   left; ticks choose what goes into this order (the rest stays in the cart); only «Итого»;
   «Перейти к оформлению». cart.html?demo fills a sample. */
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

  // Lines removed on this page: shown crossed out with «Вернуть» where they were.
  const gone = new Map(); // sku → { item, at }

  const fillLine = (li, item, removed = false) => {
    const title = `${item.name}, ${item.pack}`;
    li.dataset.sku = item.sku;
    li.classList.toggle("is-gone", removed);
    li.classList.toggle("is-off", !removed && !!item.off);
    li.querySelector("[data-line-gone]").hidden = !removed;
    li.querySelector("[data-line-back]").setAttribute("aria-label", `Вернуть в корзину: ${title}`);
    const pick = li.querySelector("[data-line-pick]");
    pick.checked = !item.off;
    pick.disabled = removed;
    pick.setAttribute("aria-label", `В заказ: ${title}`);
    li.querySelector("[data-qty]").hidden = removed;
    li.querySelector("[data-line-remove]").hidden = removed;
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

  const pickAll = root.querySelector("[data-pick-all]");
  const pickedLine = root.querySelector("[data-picked-count]");
  const none = root.querySelector("[data-none]");
  const orderLinks = [root.querySelector("[data-order]"), document.querySelector("[data-order-bar]")].filter(Boolean);

  const render = (items = cart.items()) => {
    // A line back in the cart (here or from another tab) is no longer «removed».
    items.forEach((x) => gone.delete(x.sku));
    const rowsData = items.map((item) => ({ item, removed: false }));
    [...gone.values()].sort((a, b) => a.at - b.at).forEach(({ item, at }) => rowsData.splice(Math.min(at, rowsData.length), 0, { item, removed: true }));

    const has = rowsData.length > 0;
    empty.hidden = has;
    full.hidden = !has;
    syncBar(items.length > 0);
    document.body.classList.toggle("is-basket-full", has);

    // Keep existing rows (and focus inside them); add, update or drop by артикул.
    const rows = new Map([...list.querySelectorAll("[data-line]")].map((li) => [li.dataset.sku, li]));
    rowsData.forEach(({ item, removed }, i) => {
      let li = rows.get(item.sku);
      if (!li) li = tpl.content.firstElementChild.cloneNode(true);
      fillLine(li, item, removed);
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
      rows.delete(item.sku);
    });
    rows.forEach((li) => li.remove());

    const picked = items.filter((x) => !x.off);
    const qty = items.reduce((n, x) => n + x.qty, 0);
    const sum = picked.reduce((s, x) => s + x.price * x.qty, 0);
    countLine.textContent = items.length ? `${qty} ${plural(qty, "товар", "товара", "товаров")}` : "";
    pickAll.checked = items.length > 0 && picked.length === items.length;
    pickAll.indeterminate = picked.length > 0 && picked.length < items.length;
    pickAll.disabled = items.length === 0;
    pickedLine.textContent = items.length ? `Выбрано ${picked.length} из ${items.length}` : "";
    root.querySelector("[data-total]").textContent = money(sum);
    const bar = document.querySelector("[data-total-bar]");
    if (bar) bar.textContent = money(sum);
    // Nothing ticked: the order button waits (still in place — no jump), with a hint.
    const off = picked.length === 0;
    none.hidden = !off;
    orderLinks.forEach((a) => {
      a.classList.toggle("is-waiting", off);
      if (off) a.setAttribute("aria-disabled", "true");
      else a.removeAttribute("aria-disabled");
    });
  };

  orderLinks.forEach((a) =>
    a.addEventListener("click", (e) => {
      if (a.getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        none.hidden = false;
        pickAll.focus();
      }
    })
  );

  pickAll.addEventListener("change", () => cart.setAllPicked(pickAll.checked));
  list.addEventListener("change", (e) => {
    const box = e.target.closest("[data-line-pick]");
    if (box) cart.setPicked(skuOf(box), box.checked);
  });

  const skuOf = (el) => el.closest("[data-line]")?.dataset.sku;
  const itemOf = (sku) => cart.items().find((x) => x.sku === sku);
  const say = (text) => {
    if (status) status.textContent = text;
  };

  list.addEventListener("click", (e) => {
    const sku = skuOf(e.target);
    if (!sku) return;
    if (e.target.closest("[data-line-back]")) {
      const g = gone.get(sku);
      if (!g) return;
      // Its place among the lines still in the cart.
      const before = [...list.querySelectorAll("[data-line]")].slice(0, [...list.children].indexOf(e.target.closest("[data-line]"))).filter((li) => !li.classList.contains("is-gone")).length;
      cart.restore(g.item, before);
      say(`${g.item.name}, ${g.item.pack} — снова в корзине.`);
      list.querySelector(`[data-line][data-sku="${CSS.escape(sku)}"] [data-line-name]`)?.focus();
      return;
    }
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

  // п. 25: the row stays, crossed out, with «Вернуть» — a slip of «−» or the bin costs nothing.
  const dropLine = (sku, title) => {
    const li = list.querySelector(`[data-line][data-sku="${CSS.escape(sku)}"]`);
    const item = itemOf(sku);
    if (item) gone.set(sku, { item, at: [...list.children].indexOf(li) });
    cart.remove(sku);
    say(`${title} — удалено из корзины. Можно вернуть.`);
    list.querySelector(`[data-line][data-sku="${CSS.escape(sku)}"] [data-line-back]`)?.focus();
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

  cart.onChange(render);
  render();
  // The cart is drawn: show the page (see .awaits-cart in _base.scss).
  document.body.classList.remove("awaits-cart");
})();
