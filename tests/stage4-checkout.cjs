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
  // п. 26 (схема Антона): the way first, then the shop's method inside its panel.
  const WAY = { 5: 'pickup', 6: 'pickup', 9: 'pickup', 1: 'courier', 7: 'post', 8: 'post' };
  const pick = async (p, value) => {
    await p.locator(`.way:has(input[value="${WAY[value]}"])`).click();
    const choice = p.locator(`.choice:has(input[name="shipping-method"][value="${value}"])`);
    if (await choice.isVisible()) await choice.locator('.choice__name').click();
  };
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
    const titles = (await p.$$eval('.step__title', (xs) => xs.map((x) => x.textContent.replace(/\u00a0/g, ' ').trim())));
    ok(JSON.stringify(titles) === JSON.stringify(['Кто покупает', 'Как получить заказ', 'Получатель', 'Оплата', 'Комментарий']), `26 (Антон, 23.11): шаги по схеме — кто, как получить, получатель, оплата, комментарий ${JSON.stringify(titles)}`);
    ok(await p.locator('.way').count() === 3 && await p.locator('[data-way-panel="pickup"]').isVisible() && await p.locator('[data-way-panel="courier"]').isHidden() && await p.locator('[data-way-panel="post"]').isHidden(), '26: три способа получения, открыты детали только выбранного (самовывоз)');
    ok(!(await p.textContent('[data-way-panel="courier"]')).includes('не обязателен') && await p.locator('#locality[required], #street[required], #house[required]').count() === 3 && await p.locator('#flat[required]').count() === 0, '26 (владелец 24.11): адрес курьера обязателен — город, улица, дом; квартира — нет');
    ok(await p.locator('input[name="shipping-method"]').count() === 6, '26: шесть способов доставки');
    ok(await p.locator('input[name="shipping-method"]:checked').getAttribute('value') === '5', '26: по умолчанию самовывоз с Народного Ополчения');
    const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    ok((await p.inputValue('#delivery-date')) === today && (await p.getAttribute('#delivery-date', 'min')) === today, '26: дата — сегодня, раньше нельзя');

    // Totals: 652,80 ₽, pickup free
    ok((await p.textContent('[data-total]')) === '652,80' + NB + '₽' && (await p.textContent('[data-ship-cost]')) === '0' + NB + '₽', '26: самовывоз — итог 652,80 ₽, доставка 0 ₽');
    await pick(p, '1');
    ok((await p.textContent('[data-ship-cost]')) === '400' + NB + '₽' && (await p.textContent('[data-total]')) === '1' + NB + '052,80' + NB + '₽', '26: курьер до 3 500 ₽ — +400 ₽, итог 1 052,80 ₽');
    ok(JSON.stringify(await visiblePay(p)) === JSON.stringify(['cash-courier', '4']), '26: курьер — «Наличные курьеру» и ЮKassa');
    ok(await p.locator('[data-way-panel="courier"]').isVisible() && await p.locator('[data-way-panel="pickup"]').isHidden() && await p.locator('#street').isEnabled() && await p.locator('[data-way-panel="pickup"] input').first().isDisabled(), '26: курьер — адрес и дата; поля других способов не уходят в форму');
    ok(rub(await p.textContent('[data-receive-sum]')) === 'Получение: Доставка курьером, 400 ₽' && rub(await p.textContent('[data-way-price="courier"]')) === '400 ₽', '26: в оплате — сводка способа получения; цена на карточке способа');
    await pick(p, '8');
    ok(JSON.stringify(await visiblePay(p)) === JSON.stringify(['prepay', '4']) && rub(await p.textContent('[data-ship-how]')).includes('тариф CDEK'), '26: СДЭК — предоплата, тариф СДЭК отдельно');
    await pick(p, '5');
    ok(JSON.stringify(await visiblePay(p)) === JSON.stringify(['1', '4']) && await p.locator('input[name="payment_method"]:checked').getAttribute('value') === '1', '26: самовывоз — «Оплата при самовывозе» выбрана снова');
    await p.locator('input[name="for_company"][value="legal"]').check({ force: true });
    ok((await visiblePay(p)).includes('invoice'), '26: юр. лицо — появляется «Оплата по счету»');
    await p.locator('input[name="for_company"][value="individual"]').check({ force: true });
    ok(!(await visiblePay(p)).includes('invoice'), '26: физ. лицо — без счёта');

    // From 3 500 ₽ courier is free; quantity changes elsewhere reach the page
    await p.evaluate((l) => window.TeaboomCart.fill([l]), line('01306', 326.4, 11));
    await pick(p, '1');
    ok((await p.textContent('[data-ship-cost]')) === '0' + NB + '₽' && (await p.textContent('[data-total]')) === '3' + NB + '590,40' + NB + '₽', '26: от 3 500 ₽ курьер бесплатно — итог 3 590,40 ₽');

    // Validation
    await p.locator('.summary__order').click();
    ok((await p.textContent('#first-name-error')).trim() === 'Введите имя' && (await p.textContent('#email-error')).trim() === 'Введите email' && (await p.textContent('#phone-error')).trim() === 'Введите телефон', '26: пустая форма — имя, email, телефон');
    ok(await p.evaluate(() => document.activeElement.id) === 'locality', '26: фокус на первом поле с ошибкой (адрес — он выше получателя)');
    ok(await p.locator('#last-name-error').isHidden(), '26: фамилия не обязательна');
    // Владелец, 24.11: no delivery without an address.
    ok(rub(await p.textContent('#locality-error')) === 'Укажите населённый пункт' && rub(await p.textContent('#street-error')) === 'Укажите улицу' && rub(await p.textContent('#house-error')) === 'Укажите дом', '26: курьер без адреса — «Укажите населённый пункт / улицу / дом»');
    await p.fill('#locality', 'Москва'); await p.fill('#street', 'ул. Народного Ополчения'); await p.fill('#house', '47');
    ok(await p.locator('#country + .select__button, .address__country .select__button').count() >= 1, '26: страна — кастомный выпадающий список');
    await p.fill('#first-name', 'Анна'); await p.fill('#email', 'anna@mail.ru');
    await p.focus('#phone'); await p.waitForTimeout(50);
    await p.keyboard.type('1234'); await p.waitForTimeout(50);
    ok((await p.inputValue('#phone')).startsWith('+7'), '26: маска телефона подставляет +7');
    await p.locator('.summary__order').click();
    ok((await p.textContent('#phone-error')).includes('+7'), '26: короткий телефон — подсказка с примером');
    await p.fill('#phone', ''); await p.focus('#phone'); await p.keyboard.type('9991234567'); await p.waitForTimeout(50);
    ok((await p.inputValue('#phone')) === '+7 (999) 123-45-67', '26: маска собирает +7 (999) 123-45-67');
    // Phone pay bar submits the same form. While a field is being typed in, the bar steps aside
    // (Антон, 24.11: the keyboard lifted it off the bottom) — so leave the field first.
    ok(await p.evaluate(() => document.documentElement.classList.contains('is-typing')) && await p.locator('[data-paybar]').isHidden(), '26: телефон — пока вводят текст, панель «Заказать» убрана (клавиатура)');
    await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(250);
    await p.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' })); await p.waitForTimeout(300);
    ok(await p.locator('[data-paybar]').isVisible() && (await p.textContent('[data-total-bar]')) === '3' + NB + '590,40' + NB + '₽', '26: телефон — панель «Итого · Заказать»');
    ok((await p.getAttribute('[data-paybar] button', 'form')) === 'order' && (await p.getAttribute('[data-paybar] button', 'type')) === 'submit', '26: кнопка панели отправляет ту же форму');
    ok(await overflow(p) <= 0, '26: 390 — без прокрутки вбок');
    // Valid form → «Спасибо, заказ оформлен» with the next steps for the way (схема: подтверждение).
    await p.locator('.summary__order').click(); await p.waitForTimeout(400);
    ok(await p.locator('[data-placed]').isVisible() && await p.locator('#order').isHidden() && rub(await p.textContent('[data-placed]')).includes('Демо:') && rub(await p.textContent('[data-placed-body]')).includes('Курьер позвонит'), '26: верная форма — экран «Заказ оформлен» для курьера, честно помечен «Демо»');
    ok(await p.evaluate(() => document.activeElement?.id === 'placed-title') && await p.locator('[data-order]').isHidden() && await p.locator('[data-paybar]').isHidden(), '26: фокус на подтверждении, «Заказать» больше нет');
    ok(await p.evaluate(() => window.TeaboomCart.items().length) === 1, '26: корзина после демо-заказа не очищается');
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

    // Long order on a laptop: totals and «Заказать» always in view; 3 lines + «Ещё N товаров».
  {
    const c = await b.newContext({ viewport: { width: 1440, height: 800 } });
    const p = await c.newPage(); p.on('pageerror', (e) => errors.push('long: ' + e.message));
    await p.goto(base + 'checkout.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => window.TeaboomCart.fill(Array.from({ length: 9 }, (_, i) => ({ sku: 'T' + i, name: 'Чай зелёный ароматизированный «Сокровища Японии» ' + i, pack: '100 г', price: 504, old: null, img: '', url: '#', qty: 2 }))));
    await p.waitForTimeout(300);
    ok(await p.locator('.brief__line:not([hidden])').count() === 3 && (await p.textContent('[data-brief-more]')).trim() === 'Ещё 6 товаров', '26: длинный заказ — 3 строки и «Ещё 6 товаров»');
    const inView = () => p.evaluate(() => { const r = document.querySelector('[data-order]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    let all = true;
    // From the moment the block reaches the header down to the end of the form.
    const start = await p.evaluate(() => document.querySelector('[data-summary]').getBoundingClientRect().top + scrollY);
    const end = await p.evaluate(() => document.querySelector('.checkout__layout').getBoundingClientRect().bottom + scrollY - innerHeight);
    for (const y of [start + 120, (start + end) / 2, end]) { await p.evaluate((y) => scrollTo({ top: y, left: 0, behavior: 'instant' }), Math.round(y)); await p.waitForTimeout(200); all = all && await inView(); }
    ok(all, '26: «Заказать» видна всё время, пока листается форма');
    await p.locator('[data-brief-more]').click(); await p.waitForTimeout(300);
    ok(await p.locator('.brief__line:not([hidden])').count() === 9 && (await p.textContent('[data-brief-more]')).trim() === 'Свернуть', '26: «Ещё» раскрывает весь список');
    await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: 'instant' })); await p.waitForTimeout(300);
    ok(await inView(), '26: раскрытый длинный список — «Заказать» всё равно достижима');
    await c.close();
  }

  // Phone mask: CIS codes and any international number (the site: «+7 … или другой международный номер»).
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage(); p.on('pageerror', (e) => errors.push('phone: ' + e.message));
    await p.goto(base + 'checkout.html?demo', { waitUntil: 'networkidle' });
    const typeIn = async (v) => { await p.fill('#phone', ''); await p.locator('#phone').click(); await p.keyboard.press('Meta+A'); await p.keyboard.press('Backspace'); await p.keyboard.type(v, { delay: 5 }); await p.locator('#email').click(); return p.inputValue('#phone'); };
    const errOf = () => p.evaluate(() => { const e = document.getElementById('phone-error'); return e.hidden ? '' : e.textContent.trim(); });
    ok(await typeIn('89991234567') === '+7 (999) 123-45-67' && !(await errOf()), '26: телефон — «8 999…» → +7 (999) 123-45-67');
    ok(await typeIn('+375291234567') === '+375 (29) 123-45-67' && !(await errOf()), '26: Белоруссия — +375 (29) 123-45-67');
    ok(await typeIn('+380671234567') === '+380 (67) 123-45-67' && !(await errOf()), '26: Украина — +380 (67) 123-45-67');
    ok(await typeIn('+77011234567') === '+7 (701) 123-45-67' && !(await errOf()), '26: Казахстан — +7 (701) 123-45-67');
    ok(await typeIn('+4915123456789') === '+4915123456789' && !(await errOf()), '26: другие страны — международный номер без маски');
    await p.locator('.way:has(input[value="courier"])').click(); await p.waitForTimeout(200);
    await p.fill('#phone', ''); await p.selectOption('#country', 'BY'); await p.locator('#phone').focus();
    ok((await p.inputValue('#phone')).trim() === '+375', '26: страна «Белоруссия» — пустое поле начинается с +375');
    await p.keyboard.type('29123', { delay: 5 }); await p.locator('#email').click();
    ok((await errOf()).startsWith('Проверьте номер'), '26: неполный номер — подсказка с примерами');
    await c.close();
  }

  // п. 25 (Антон, 23.11): only the lines ticked in the cart make the order.
  {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await c.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('teaboom-demo-cart-v2', JSON.stringify([
      { sku: '01285', name: 'Улун Медовая Дыня', pack: '1 кг', price: 1294, img: '', url: 'product.html', qty: 1 },
      { sku: '01306', name: 'Ананасовый улун', pack: '100 г', price: 326.4, img: '', url: 'product.html', qty: 1, off: true }])); } });
    const p = await open(c, 'checkout.html');
    ok(await p.locator('.brief__line').count() === 1 && (await p.textContent('.brief__line')).includes('Медовая Дыня'), '25 → 26: в оформлении только отмеченные в корзине товары');
    await c.close();
  }
  ok(errors.length === 0, '26: без ошибок JS' + (errors.length ? ' — ' + errors.join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
