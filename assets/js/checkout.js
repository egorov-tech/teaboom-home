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

  // п. 26 (Антон, 23.11): first how to get the order, then its details. The way (courier /
  // pick-up point / pickup) shows its own panel; the shop's shipping-method follows it — the
  // last one chosen inside that panel, or its first.
  const ways = [...form.querySelectorAll("[data-way]")];
  const panelOf = (way) => form.querySelector(`[data-way-panel="${way}"]`);
  const syncWay = () => {
    const way = ways.find((x) => x.checked)?.value || "pickup";
    ways.forEach((x) => {
      const panel = panelOf(x.value);
      panel.hidden = x.value !== way;
      panel.querySelectorAll("input, select, textarea").forEach((el) => (el.disabled = x.value !== way));
    });
    const panel = panelOf(way);
    if (!panel.contains(shipInput()) || !shipInput().checked) {
      const first = panel.querySelector("input[name='shipping-method']");
      if (first) first.checked = true;
    }
  };

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
  const syncBar = (has = cart.picked().length > 0) => {
    if (paybar) paybar.hidden = !has || orderInView;
  };
  const order = root.querySelector("[data-order]");
  if (order && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      orderInView = entry.isIntersecting;
      syncBar();
    }).observe(order);
  }

  // Long orders: 3 lines + «Ещё N товаров».
  const BRIEF_SHOWN = 3;
  let briefOpen = false;
  const more = root.querySelector("[data-brief-more]");
  const plural = (n, one, few, many) => {
    const a = n % 10;
    const b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };
  more?.addEventListener("click", () => {
    briefOpen = !briefOpen;
    render();
    if (briefOpen) list.children[BRIEF_SHOWN]?.querySelector("a")?.focus();
  });

  // Sticky summary that never hides «Заказать»: under the header, or — if the block is taller
  // than the window (an opened long list on a short screen) — a negative top so it scrolls with
  // the page and holds once its bottom is in view. Same rule as the category filters.
  const summary = root.querySelector("[data-summary]");
  const wide = window.matchMedia("(min-width: 900px)");
  const pinSummary = () => {
    if (!summary || !wide.matches) return;
    const css = getComputedStyle(document.documentElement);
    const head = parseFloat(css.getPropertyValue("--pin-h")) - parseFloat(css.getPropertyValue("--pin-trim")) + 16;
    summary.style.setProperty("--summary-top", `${Math.round(Math.min(head, window.innerHeight - summary.offsetHeight - 16))}px`);
  };
  if (summary && "ResizeObserver" in window) new ResizeObserver(pinSummary).observe(summary);
  window.addEventListener("resize", pinSummary);

  const fillLine = (li, item) => {
    const img = li.querySelector("[data-brief-image]");
    if (item.img) img.src = item.img;
    else img.removeAttribute("src");
    const name = li.querySelector("[data-brief-name]");
    name.textContent = cart.title(item);
    name.setAttribute("href", item.url || "#");
    li.querySelector("[data-brief-each]").textContent = `${item.qty} × ${money(item.price)}`;
    li.querySelector("[data-brief-sum]").textContent = money(item.price * item.qty);
  };

  // п. 25: only the lines ticked in the cart make the order; the rest wait in the cart.
  const render = (all = cart.items()) => {
    const items = all.filter((x) => !x.off);
    const has = items.length > 0;
    root.querySelector("[data-checkout-empty]").hidden = has;
    root.querySelector("[data-checkout-full]").hidden = !has;
    document.body.classList.toggle("is-basket-full", has);
    syncBar(has);

    list.replaceChildren(
      ...items.map((item, i) => {
        const li = tpl.content.firstElementChild.cloneNode(true);
        fillLine(li, item);
        li.hidden = !briefOpen && i >= BRIEF_SHOWN;
        return li;
      })
    );
    const rest = items.length - BRIEF_SHOWN;
    more.hidden = rest <= 0;
    if (rest > 0) {
      more.setAttribute("aria-expanded", String(briefOpen));
      more.textContent = briefOpen ? "Свернуть" : `Ещё ${rest} ${plural(rest, "товар", "товара", "товаров")}`;
    }
    pinSummary();

    const sum = items.reduce((s, x) => s + x.price * x.qty, 0);
    ships.forEach((input) => {
      input.closest(".choice").querySelector("[data-ship-price]").textContent = money(shipCost(input.dataset.ship, sum));
    });

    const ship = shipInput();
    const cost = shipCost(ship.dataset.ship, sum);
    // Prices on the three ways — the same rules as the delivery list (teaboom.ru/shipping/).
    const free = sum >= FREE_FROM;
    root.querySelector('[data-way-price="courier"]').textContent = free ? "бесплатно" : `${money(400)}`;
    root.querySelector('[data-way-price="post"]').textContent = sum >= RUSSIA_FREE_FROM ? "бесплатно" : `${free ? money(0) : money(400)} + тариф`;
    root.querySelector('[data-way-price="pickup"]').textContent = "бесплатно";
    let how = nameOf(ship);
    if (ship.dataset.tariff) {
      how += sum >= RUSSIA_FREE_FROM ? ", доставка по России бесплатная" : `, тариф ${ship.dataset.tariff} отдельно`;
    }
    root.querySelector("[data-ship-how]").textContent = how;
    // The payment step opens with what was chosen above (схема: «итоговая сводка по способу получения»).
    root.querySelector("[data-receive-sum]").textContent = `Получение: ${how}, ${cost ? money(cost) : "бесплатно"}`;
    root.querySelector("[data-ship-cost]").textContent = money(cost);
    const pay = pays.find((x) => x.checked && !x.disabled);
    root.querySelector("[data-pay-how]").textContent = pay ? nameOf(pay) : "";
    root.querySelector("[data-sum]").textContent = money(sum);
    root.querySelector("[data-total]").textContent = money(sum + cost);
    const bar = document.querySelector("[data-total-bar]");
    if (bar) bar.textContent = money(sum + cost);
  };

  form.addEventListener("change", (e) => {
    if (e.target.matches("[data-way]")) syncWay();
    if (e.target.matches("[name='shipping-method'], [data-person], [data-way]")) syncPay();
    if (e.target.matches("[type='radio']")) render();
  });

  // After «Заказать» (valid form, forms.js): the next steps for the chosen way.
  const placed = root.querySelector("[data-placed]");
  form.addEventListener("demo:sent", () => {
    const ship = shipInput();
    const kind = ship.dataset.ship;
    const body = placed.querySelector("[data-placed-body]");
    const phone = '<a href="tel:+74951201551">+7 (495) 120-15-51</a>';
    const lines = {
      pickup: [`Пункт самовывоза: ${nameOf(ship).replace(/^Самовывоз \(|\)$/g, "")}.`, ship.closest(".choice").querySelector(".choice__desc").textContent.trim(), "Часы работы: пн–пт с 10:00 до 19:00, сб–вс с 12:00 до 16:00."],
      courier: ["Курьер позвонит, чтобы договориться о времени.", "Доставка по Москве в пределах МКАД: до 3 500 ₽ — 400 ₽, от 3 500 ₽ — бесплатно. За МКАД: до 3 500 ₽ — 400 ₽ + 25 ₽ за каждый км от МКАД, от 3 500 ₽ — только 25 ₽ за км."],
      post: [`Отправим через ${{ CDEK: "СДЭК", "Почты России": "Почту России" }[ship.dataset.tariff] || ship.dataset.tariff} в выбранный пункт выдачи.`, "Ссылку на оплату и трек-номер пришлём на почту."],
    }[kind] || [];
    body.innerHTML = lines.map((t) => `<p>${t}</p>`).join("") + `<p>Вопросы по заказу: ${phone}.</p>`;
    form.hidden = true;
    placed.hidden = false;
    // Placed: nothing left to press in the summary.
    root.querySelector("[data-order]").hidden = true;
    orderInView = true;
    if (paybar) paybar.hidden = true;
    const done = root.querySelector('[data-done="order"]');
    if (done) done.hidden = true;
    placed.querySelector("#placed-title").focus();
    placed.scrollIntoView({ block: "start" });
  });

  syncWay();
  syncPay();
  cart.onChange(render);
  render();
  // The cart is drawn: show the page (see .awaits-cart in _base.scss).
  document.body.classList.remove("awaits-cart");
})();
