// Checkout, п. 26. BASE=http://127.0.0.1:8890/ node tests/stage4-checkout.cjs
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };
const NB = '\u00a0';
const rub = (s) => (s || '').replace(/\s/g, ' ').trim();
const line = (sku, price, qty) => ({ sku, name: 'Ананасовый улун', pack: '100 г', price, old: price, img: 'assets/images/products/ananasovij-ulun-280.jpg', url: 'product.html', qty });

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const open = async (ctx, url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(url + ': ' + e.message)); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const pick = (p, value) => p.locator(`.choice:has(input[name="shipping_method"][value="${value}"]) .choice__name`).click();
  const visiblePay = (p) => p.$$eval('input[name="payment_method"]', (xs) => xs.filter((x) => !x.closest('[hidden]')).map((x) => x.value));

  try {
    // ---------- Empty cart ----------
    let c = await b.newContext(phone);
    let p = await open(c, 'checkout.html');
    ok((await p.textContent('h1')).trim() === 'Оформление заказа', '26: заголовок «Оформление заказа»');
    ok(await p.locator('[data-checkout-empty]').isVisible() && await p.locator('[data-checkout-full]').isHidden(), '26: пустая корзина — форма скрыта, «Ваша корзина пуста»');

    // ---------- Cart → checkout ----------
    await p.evaluate((l) => window.TeaboomCart.fill([l]), line('01306', 326.4, 2));
    await p.goto(base + 'cart.html', { waitUntil: 'networkidle' });
    ok((await p.getAttribute('[data-order]', 'href')) === 'checkout.html', '26: «Заказать» в корзине ведёт на checkout.html');
    await p.goto(base + 'checkout.html', { waitUntil: 'networkidle' });
    ok(await p.locator('[data-checkout-full]').isVisible() && await p.locator('[data-order-line]').count() === 1, '26: строки заказа из корзины');
    ok(rub(await p.textContent('[data-order-line]')).includes('Ананасовый улун, 100 г') && rub(await p.textContent('[data-order-line]')).includes('2 × 326,40 ₽'), '26: в строке название, фасовка и «2 × 326,40 ₽»');

    // Blocks in the shop's order, texts as on teaboom.ru
    const titles = (await p.$$eval('.step__title', (xs) => xs.map((x) => x.textContent.trim())));
    ok(JSON.stringify(titles) === JSON.stringify(['Оформить заказ как', 'Получатель и адрес доставки', 'Дата доставки', 'Комментарий', 'Доставка', 'Оплата']), '26: блоки по порядку сайта');
    ok((await p.textContent('#step-address')).includes('не обязателен, мы уточним адрес по телефону, если вы не захотите его заполнять'), '26: подсказка к адресу дословно');
    ok(await p.locator('input[name="shipping_method"]').count() === 6, '26: шесть способов доставки');
    ok(await p.locator('input[name="shipping_method"]:checked').getAttribute('value') === 'pickup-opolchenie', '26: по умолчанию самовывоз с Народного Ополчения');
    const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    ok((await p.inputValue('#delivery-date')) === today && (await p.getAttribute('#delivery-date', 'min')) === today, '26: дата — сегодня, раньше нельзя');

    // Totals: 652,80 ₽, pickup free
    ok((await p.textContent('[data-total]')) === '652,80' + NB + '₽' && (await p.textContent('[data-ship-cost]')) === '0' + NB + '₽', '26: самовывоз — итог 652,80 ₽, доставка 0 ₽');
    await pick(p, 'courier');
    ok((await p.textContent('[data-ship-cost]')) === '400' + NB + '₽' && (await p.textContent('[data-total]')) === '1' + NB + '052,80' + NB + '₽', '26: курьер до 3 500 ₽ — +400 ₽, итог 1 052,80 ₽');
    ok(JSON.stringify(await visiblePay(p)) === JSON.stringify(['cash-courier', 'yookassa']), '26: курьер — «Наличные курьеру» и ЮKassa');
    await pick(p, 'cdek');
    ok(JSON.stringify(await visiblePay(p)) === JSON.stringify(['prepay', 'yookassa']) && rub(await p.textContent('[data-ship-how]')).includes('тариф CDEK'), '26: СДЭК — предоплата, тариф СДЭК отдельно');
    await pick(p, 'pickup-opolchenie');
    ok(JSON.stringify(await visiblePay(p)) === JSON.stringify(['cash-pickup', 'yookassa']) && await p.locator('input[name="payment_method"]:checked').getAttribute('value') === 'cash-pickup', '26: самовывоз — «Оплата при самовывозе» выбрана снова');
    await p.locator('input[name="person_type"][value="legal"]').check({ force: true });
    ok((await visiblePay(p)).includes('invoice'), '26: юр. лицо — появляется «Оплата по счету»');
    await p.locator('input[name="person_type"][value="individual"]').check({ force: true });
    ok(!(await visiblePay(p)).includes('invoice'), '26: физ. лицо — без счёта');

    // From 3 500 ₽ courier is free; quantity changes elsewhere reach the page
    await p.evaluate((l) => window.TeaboomCart.fill([l]), line('01306', 326.4, 11));
    await pick(p, 'courier');
    ok((await p.textContent('[data-ship-cost]')) === '0' + NB + '₽' && (await p.textContent('[data-total]')) === '3' + NB + '590,40' + NB + '₽', '26: от 3 500 ₽ курьер бесплатно — итог 3 590,40 ₽');

    // Validation
    await p.locator('.summary__order').click();
    ok((await p.textContent('#first-name-error')).trim() === 'Введите имя' && (await p.textContent('#email-error')).trim() === 'Введите email' && (await p.textContent('#phone-error')).trim() === 'Введите телефон', '26: пустая форма — имя, email, телефон');
    ok(await p.evaluate(() => document.activeElement.id) === 'first-name', '26: фокус на первом поле с ошибкой');
    ok(await p.locator('#last-name-error').isHidden() && await p.locator('#city-error').count() === 0, '26: фамилия и адрес не обязательны');
    await p.fill('#first-name', 'Анна'); await p.fill('#email', 'anna@mail.ru'); await p.fill('#phone', '12-34');
    await p.locator('.summary__order').click();
    ok((await p.textContent('#phone-error')).includes('+7'), '26: короткий телефон — подсказка с примером');
    await p.fill('#phone', '+7 (999) 123-45-67');
    await p.locator('.summary__order').click();
    const done = p.locator('[data-done="order"]');
    ok(await done.isVisible() && (await done.textContent()).startsWith('Демо:'), '26: верная форма — демо-сообщение, заказ не отправлен');
    ok(await p.evaluate(() => window.TeaboomCart.items().length) === 1, '26: корзина после демо-заказа не очищается');

    // Phone pay bar submits the same form
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    ok(await p.locator('[data-paybar]').isVisible() && (await p.textContent('[data-total-bar]')) === '3' + NB + '590,40' + NB + '₽', '26: телефон — панель «Итого · Заказать»');
    ok((await p.getAttribute('[data-paybar] button', 'form')) === 'order' && (await p.getAttribute('[data-paybar] button', 'type')) === 'submit', '26: кнопка панели отправляет ту же форму');
    ok(await overflow(p) <= 0, '26: 390 — без прокрутки вбок');
    await c.close();

    // ---------- Widths ----------
    for (const width of [320, 768, 1440]) {
      c = await b.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
      p = await open(c, 'checkout.html?demo');
      const n = await p.locator('[data-order-line]').count();
      ok(n === 2 && await overflow(p) <= 0, `26: ${width} px — пример из 2 строк, без прокрутки вбок`);
      if (width === 1440) {
        ok(await p.evaluate(() => getComputedStyle(document.querySelector('[data-summary]')).position) === 'sticky', '26: компьютер — «Ваш заказ» закреплён справа');
        ok(await p.locator('[data-paybar]').isHidden(), '26: компьютер — нижней панели нет');
      }
      await c.close();
    }

    ok(errors.length === 0, '26: без ошибок JS' + (errors.length ? ' — ' + errors.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
