/* Checkout (п. 26): order lines from TeaboomCart, delivery price, payment methods that fit the
   delivery, totals, phone pay bar. Rules from teaboom.ru/shipping/ and /payment/:
   courier, Почта and CDEK — 400 ₽ below 3 500 ₽, free from 3 500 ₽ (Почта and CDEK add their
   own tariff, free across Russia from 10 000 ₽); pickup pays on the spot, Почта and CDEK prepay,
   «Оплата по счету» is for companies. checkout.html?demo fills a sample. */
(() => {
  const root = document.querySelector("[data-checkout]");
  const cart = window.TeaboomCart;
  if (!root || !cart) return;

  const money = (v) => window.TeaboomFormat.money(v);
  const form = root.querySelector("#order");
  const list = root.querySelector("[data-order-lines]");
  const tpl = document.querySelector("[data-brief-template]");
  const paybar = document.querySelector("[data-paybar]");
  const ships = [...form.querySelectorAll("input[name='shipping-method']")];
  const pays = [...form.querySelectorAll("input[name='payment_method']")];

  const FREE_FROM = 3500;
  const RUSSIA_FREE_FROM = 10000;
  const shipCost = (kind, sum) => (kind === "pickup" || sum >= FREE_FROM ? 0 : 400);

  if (new URLSearchParams(location.search).has("demo") && !cart.items().length) {
    try {
      cart.fill(JSON.parse(document.querySelector("[data-cart-sample]").textContent));
    } catch (e) {}
  }

  // The shop's own form shows today; earlier dates make no sense.
  const date = form.querySelector("[data-date]");
  if (date) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    date.min = today;
    if (!date.value) date.value = today;
  }

  const nameOf = (input) => input.closest(".choice").querySelector(".choice__name").textContent.trim();
  const shipInput = () => ships.find((x) => x.checked) || ships[0];

  // Payment methods the chosen delivery and person type allow; a hidden choice is also disabled,
  // so it never reaches the server.
  const syncPay = () => {
    const kind = shipInput().dataset.ship;
    const legal = form.querySelector("[data-person]:checked")?.value === "legal";
    pays.forEach((input) => {
      const when = input.closest(".choice").dataset.payWhen;
      const on = !when || when === kind || (when === "legal" && legal);
      input.closest(".choice").hidden = !on;
      input.disabled = !on;
    });
    if (!pays.some((x) => x.checked && !x.disabled)) {
      const first = pays.find((x) => !x.disabled && x.closest(".choice").dataset.payWhen) || pays.find((x) => !x.disabled);
      first.checked = true;
    }
  };

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

  const fillLine = (li, item) => {
    const img = li.querySelector("[data-brief-image]");
    if (item.img) img.src = item.img;
    else img.removeAttribute("src");
    const name = li.querySelector("[data-brief-name]");
    name.textContent = `${item.name}, ${item.pack}`;
    name.setAttribute("href", item.url || "#");
    li.querySelector("[data-brief-each]").textContent = `${item.qty} × ${money(item.price)}`;
    li.querySelector("[data-brief-sum]").textContent = money(item.price * item.qty);
  };

  const render = (items = cart.items()) => {
    const has = items.length > 0;
    root.querySelector("[data-checkout-empty]").hidden = has;
    root.querySelector("[data-checkout-full]").hidden = !has;
    document.body.classList.toggle("is-basket-full", has);
    syncBar(has);

    list.replaceChildren(
      ...items.map((item) => {
        const li = tpl.content.firstElementChild.cloneNode(true);
        fillLine(li, item);
        return li;
      })
    );

    const sum = items.reduce((s, x) => s + x.price * x.qty, 0);
    ships.forEach((input) => {
      input.closest(".choice").querySelector("[data-ship-price]").textContent = money(shipCost(input.dataset.ship, sum));
    });

    const ship = shipInput();
    const cost = shipCost(ship.dataset.ship, sum);
    let how = nameOf(ship);
    if (ship.dataset.tariff) {
      how += sum >= RUSSIA_FREE_FROM ? ", доставка по России бесплатная" : `, тариф ${ship.dataset.tariff} отдельно`;
    }
    root.querySelector("[data-ship-how]").textContent = how;
    root.querySelector("[data-ship-cost]").textContent = money(cost);
    const pay = pays.find((x) => x.checked && !x.disabled);
    root.querySelector("[data-pay-how]").textContent = pay ? nameOf(pay) : "";
    root.querySelector("[data-sum]").textContent = money(sum);
    root.querySelector("[data-total]").textContent = money(sum + cost);
    const bar = document.querySelector("[data-total-bar]");
    if (bar) bar.textContent = money(sum + cost);
  };

  form.addEventListener("change", (e) => {
    if (e.target.matches("[name='shipping-method'], [data-person]")) syncPay();
    if (e.target.matches("[type='radio']")) render();
  });

  syncPay();
  cart.onChange(render);
  render();
})();
