// Cart (п. 25) and login (п. 27). BASE=http://127.0.0.1:8890/ node tests/stage4-cart-auth.cjs
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };
const NB = '\u00a0';
const rub = (s) => s.replace(/\s/g, ' ').trim();

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const open = async (ctx, url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(url + ': ' + e.message)); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // ---------- Cart: real flow from the category tile ----------
  let c = await b.newContext(phone);
  let p = await open(c, 'cart.html');
  ok(await p.locator('[data-basket-empty]').isVisible() && (await p.textContent('[data-basket-empty]')).includes('Ваша корзина пуста'), '25: пустая корзина — «Ваша корзина пуста»');
  ok(await p.locator('[data-paybar]').isHidden(), '25: пустая — нижней панели нет');
  await p.goto(base + 'category-ulun.html', { waitUntil: 'networkidle' });
  const g = p.locator('[data-item]:not([hidden]) .good').first();
  await g.locator('.pack__input').nth(2).check({ force: true });
  await g.locator('[data-add]').click(); await p.waitForTimeout(900);
  await p.locator('[data-cart]').first().click(); await p.waitForURL(/cart\.html/); await p.waitForTimeout(300);
  ok(await p.locator('[data-line]').count() === 1, '25: шапка ведёт в корзину, в ней одна строка');
  ok(rub(await p.textContent('[data-line-name]')) === 'Улун Медовая Дыня, 1 кг' && (await p.textContent('[data-line-sku]')) === '01285', '25: «Улун Медовая Дыня, 1 кг», арт: 01285');
  ok((await p.textContent('[data-line-sum]')) === '1' + NB + '294' + NB + '₽' && (await p.textContent('[data-total]')) === '1' + NB + '294' + NB + '₽', '25: сумма строки и итог 1 294 ₽');
  await p.locator('[data-qty-inc]').tap(); await p.waitForTimeout(150);
  ok((await p.inputValue('[data-qty-input]')) === '2' && (await p.textContent('[data-total]')) === '2' + NB + '588' + NB + '₽' && rub(await p.textContent('[data-line-each]')) === '2 × 1 294 ₽', '25: «+» → 2 шт., итог 2 588 ₽, «2 × 1 294 ₽»');
  ok((await p.textContent('[data-cart-count]')).trim() === '2', '25: счётчик в шапке = 2');
  await p.fill('[data-qty-input]', '5'); await p.press('[data-qty-input]', 'Enter'); await p.waitForTimeout(150);
  ok((await p.textContent('[data-total]')) === '6' + NB + '470' + NB + '₽', '25: ввод 5 вручную → 6 470 ₽');
  await p.fill('[data-qty-input]', 'abc'); await p.press('[data-qty-input]', 'Enter'); await p.waitForTimeout(150);
  ok((await p.inputValue('[data-qty-input]')) === '5', '25: мусор в количестве — значение не ломается');
  // pay bar: hidden while the summary's own «Заказать» is on screen
  await p.locator('[data-order]').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  ok(await p.locator('[data-paybar]').isHidden(), '25: кнопка «Заказать» на экране — панель скрыта');
  // More lines push the order button below the first screen: then the bar stands in for it.
  await p.evaluate(() => window.TeaboomCart.fill([...window.TeaboomCart.items(),
    { sku: '01306', name: 'Ананасовый улун', pack: '100 г', price: 326.4, old: 349.2, img: '', url: 'product.html', qty: 1 },
    { sku: '01307', name: 'Ананасовый улун', pack: '500 г', price: 1430, old: 0, img: '', url: 'product.html', qty: 1 }]));
  await p.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' })); await p.waitForTimeout(400);
  const below = await p.evaluate(() => document.querySelector('[data-order]').getBoundingClientRect().top > innerHeight);
  ok(below && await p.locator('[data-paybar]').isVisible() && (await p.textContent('[data-total-bar]')) === '8' + NB + '226,40' + NB + '₽' && rub(await p.textContent('[data-order-bar]')) === 'Перейти к оформлению', '25: кнопка ниже экрана — панель «Итого 8 226,40 ₽ · Перейти к оформлению»');
  ok(await p.locator('.summary__row').count() === 1 && (await p.textContent('.summary__row')).includes('Итого') && rub(await p.textContent('[data-order]')) === 'Перейти к оформлению', '25 (Антон, 23.11): в итоге только «Итого», кнопка «Перейти к оформлению»');
  // Removed: the row stays crossed out with «Вернуть»; «Вернуть» puts it back in place.
  const line = (sku) => p.locator(`[data-line][data-sku="${sku}"]`);
  await line('01306').locator('[data-line-remove]').tap(); await p.waitForTimeout(250);
  ok(await line('01306').evaluate((l) => l.classList.contains('is-gone')) && await line('01306').locator('[data-line-back]').isVisible() && await line('01306').locator('[data-qty]').isHidden() && (await p.textContent('[data-total-bar]')) === '7' + NB + '900' + NB + '₽', '25: удалённый товар остаётся зачёркнутым с «Вернуть», итог без него');
  ok(await p.evaluate(() => document.activeElement?.matches('[data-line-back]')), '25: фокус — на «Вернуть»');
  ok(await line('01306').locator('.line__sum').isVisible() && await line('01306').locator('.line__sum').evaluate((e) => getComputedStyle(e).textDecorationLine.includes('line-through')), '25 (Артём, 24.11): у удалённого цена видна, зачёркнута');
  await line('01306').locator('[data-line-back]').tap(); await p.waitForTimeout(250);
  ok(!(await line('01306').evaluate((l) => l.classList.contains('is-gone'))) && await p.evaluate(() => window.TeaboomCart.items().map((x) => x.sku).join()) === '01285,01306,01307', '25: «Вернуть» — строка снова в корзине и на своём месте');
  // Ticks: an unticked line stays in the cart, out of this order and its total.
  await line('01307').locator('.line__pick').tap(); await p.waitForTimeout(250);
  ok((await p.textContent('[data-picked-count]')) === 'Выбрано 2 из 3' && (await p.textContent('[data-total-bar]')) === '6' + NB + '796,40' + NB + '₽' && await p.evaluate(() => window.TeaboomCart.items().length === 3 && window.TeaboomCart.picked().length === 2), '25: снятая галочка — товар в корзине, но не в заказе и не в итоге');
  ok(await p.locator('[data-pick-all]').evaluate((x) => x.indeterminate), '25: «Выбрать все» — частично');
  await p.locator('.lines__head .pick').tap(); await p.waitForTimeout(250);
  ok((await p.textContent('[data-picked-count]')) === 'Выбрано 3 из 3', '25: «Выбрать все» отмечает всё');
  await p.locator('.lines__head .pick').tap(); await p.waitForTimeout(250);
  ok((await p.textContent('[data-total-bar]')) === '0' + NB + '₽' && await p.locator('[data-none]').isVisible() && (await p.getAttribute('[data-order]', 'aria-disabled')) === 'true', '25: ничего не отмечено — 0 ₽, кнопка ждёт, подсказка «Отметьте товары…»');
  await p.locator('.lines__head .pick').tap(); await p.waitForTimeout(250);
  ok(await overflow(p) <= 0, '25: телефон — без горизонтальной прокрутки');
  ok(await p.evaluate(() => [...document.querySelectorAll('.line__pick, .lines__head .pick, [data-line-back]')].filter((e) => e.getClientRects().length).every((e) => { const r = e.getBoundingClientRect(); return r.width >= 40 && r.height >= 40; })), '25: галочки и «Вернуть» — цель не меньше 40 px');
  await p.locator('[data-coupon] button').tap();
  ok((await p.textContent('[data-coupon-note]')).includes('Введите код купона'), '25: пустой купон — подсказка');
  await p.fill('#coupon', 'TEA10'); await p.locator('[data-coupon] button').tap();
  ok((await p.textContent('[data-coupon-note]')).startsWith('Демо:'), '25: купон в демо честно помечен');
  for (const sku of ['01285', '01306', '01307']) { await line(sku).locator('[data-line-remove]').tap(); await p.waitForTimeout(200); }
  ok((await p.textContent('[data-cart-count]')).trim() === '0' && await p.locator('[data-line].is-gone').count() === 3 && await p.locator('[data-paybar]').isHidden(), '25: всё удалено — счётчик 0, строки с «Вернуть» до ухода со страницы');
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.locator('[data-basket-empty]').isVisible(), '25: после ухода со страницы — «Ваша корзина пуста»');
  await c.close();

  // ---------- Cart: sample + desktop ----------
  c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(c, 'cart.html?demo');
  ok(await p.locator('[data-line]').count() === 2 && (await p.textContent('[data-total]')) === '1' + NB + '946,80' + NB + '₽', '25: cart.html?demo — 2 строки, итог 1 946,80 ₽');
  ok((await p.textContent('[data-basket-count]')).trim() === '3 товара', '25: «3 товара»');
  ok(await p.locator('[data-paybar]').isHidden(), '25: компьютер — нижней панели нет');
  const sticky = await p.evaluate(() => getComputedStyle(document.querySelector('[data-summary]')).position);
  ok(sticky === 'sticky', '25: компьютер — итог закреплён справа');
  await p.locator('[data-qty-dec]').first().click(); await p.locator('[data-qty-dec]').first().click(); await p.waitForTimeout(150);
  ok(await p.locator('[data-line]:not(.is-gone)').count() === 1 && await p.locator('[data-line].is-gone [data-line-back]').count() === 1, '25: «−» на 1 шт. убирает товар, строка остаётся с «Вернуть»');
  await c.close();

  // ---------- Product page and home → cart ----------
  c = await b.newContext(phone);
  p = await open(c, 'product.html');
  await p.locator('.product .pack__input[data-sku="01308"]').check({ force: true });
  await p.locator('.product form button[type="submit"], .product .cta').first().click(); await p.waitForTimeout(900);
  await p.goto(base + 'cart.html', { waitUntil: 'networkidle' });
  ok(rub(await p.textContent('[data-line-name]')) === 'Ананасовый улун, 1 кг' && (await p.textContent('[data-line-sku]')) === '01308' && (await p.textContent('[data-total]')) === '2' + NB + '064' + NB + '₽', '25: страница товара → корзина: «Ананасовый улун, 1 кг», 01308, 2 064 ₽');
  ok((await p.getAttribute('[data-line-name]', 'href')) === 'product.html', '25: строка ведёт обратно на страницу товара');
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.locator('[data-good]').first().locator('[data-add]').click(); await p.waitForTimeout(900);
  await p.goto(base + 'cart.html', { waitUntil: 'networkidle' });
  ok(await p.locator('[data-line]').count() === 2 && await p.evaluate(() => window.TeaboomCart.items().every((x) => x.price > 0 && x.name && x.sku)), '25: главная → корзина: вторая строка, у всех цена, название, артикул');
  await c.close();

  // ---------- Narrow screens and tablet: stepper never runs into the sum ----------
  for (const width of [320, 360, 768]) {
    c = await b.newContext({ viewport: { width, height: 800 }, isMobile: width < 768, hasTouch: width < 768 });
    p = await open(c, 'cart.html');
    await p.evaluate(() => window.TeaboomCart.fill([{ sku: '01309', name: 'Ананасовый улун', pack: '5 кг', price: 6320, old: 8710, img: 'assets/images/products/ananasovij-ulun-280.jpg', url: 'product.html', qty: 10 }]));
    await p.waitForTimeout(200);
    const hit = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const a = r('[data-qty]'), m = r('.line__money'), n = r('.line__info'), x = r('[data-line-remove]');
      const cross = (u, v) => u.left < v.right && v.left < u.right && u.top < v.bottom && v.top < u.bottom;
      return cross(a, m) || cross(n, x) || cross(a, n);
    });
    ok(!hit && await overflow(p) <= 0 && (await p.textContent('[data-total]')) === '63' + NB + '200' + NB + '₽', `25: ${width} px — «− 10 +», 63 200 ₽ и название не пересекаются, без прокрутки вбок`);
    await c.close();
  }

  // ---------- Login ----------
  c = await b.newContext(phone);
  p = await open(c, 'login.html');
  ok((await p.textContent('h1')).trim() === 'Авторизация', '27: заголовок как на сайте — «Авторизация»');
  ok(await p.locator('#pane-link').isVisible() && await p.locator('#pane-login').isHidden(), '27: по умолчанию «Быстрый вход»');
  ok(await p.locator('.how .steps').isHidden(), '27: шаги быстрого входа спрятаны под «как это работает?», как на сайте');
  await p.locator('.how__toggle').tap();
  ok(await p.locator('.how .steps > li').count() === 4 && await p.locator('.how .steps').isVisible(), '27: «как это работает?» раскрывает 4 шага');
  await p.locator('#tab-link').focus(); await p.keyboard.press('ArrowRight');
  ok(await p.locator('#pane-login').isVisible() && (await p.getAttribute('#tab-login', 'aria-selected')) === 'true', '27: стрелка вправо → «Авторизация»');
  await p.keyboard.press('End');
  ok(await p.locator('#pane-register').isVisible(), '27: End → «Регистрация»');
  await p.locator('#pane-register .form__submit').tap();
  ok((await p.textContent('#reg-email-error')).trim() === 'Введите email' && (await p.getAttribute('#reg-email', 'aria-invalid')) === 'true', '27: пустая форма — «Введите email», поле помечено');
  ok(await p.evaluate(() => document.activeElement.id) === 'reg-email', '27: фокус на первом поле с ошибкой');
  await p.fill('#reg-email', 'name@mail'); await p.fill('#reg-password', 'secret12'); await p.fill('#reg-password2', 'secret13');
  await p.locator('#pane-register .form__submit').tap();
  ok((await p.textContent('#reg-email-error')).includes('name@mail.ru') && (await p.textContent('#reg-password2-error')).trim() === 'Пароли не совпадают', '27: неверный email и «Пароли не совпадают»');
  await p.fill('#reg-email', 'name@mail.ru'); await p.fill('#reg-password2', 'secret12');
  await p.locator('#pane-register .form__submit').tap();
  ok((await p.textContent('#pane-register [data-done]')).startsWith('Демо:') && await p.locator('#pane-register [data-error]:visible').count() === 0, '27: верная форма — демо-сообщение, ошибок нет');
  await p.locator('#tab-login').tap();
  await p.locator('#pane-login [data-peek]').tap();
  ok((await p.getAttribute('#login-password', 'type')) === 'text' && (await p.getAttribute('#pane-login [data-peek]', 'aria-pressed')) === 'true', '27: «глаз» показывает пароль');
  const names = await p.$$eval('#pane-login form input', (xs) => xs.map((x) => x.name).filter(Boolean).join(','));
  ok(names === 'username,password,remember,action,next' && (await p.getAttribute('#pane-login form', 'action')) === '/login', '27: поля и адрес формы как на teaboom.ru (+ remember)');
  ok(await p.locator('.social__link').count() === 3 && (await p.getAttribute('.social__link >> nth=2', 'href')) === 'https://teaboom.ru/login/yandex-oauth2/?next=/' && await p.locator('.social__icon').count() === 3, '27: VK, Одноклассники, Яндекс — адреса сайта, у каждой кнопки иконка');
  const soc = await p.$$eval('.social__link', (as) => as.map((a) => { const r = a.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), fit: a.scrollWidth <= a.clientWidth + 1, top: Math.round(r.top) }; }));
  ok(soc.every((x) => x.fit) && soc.every((x) => x.h === soc[0].h && Math.abs(x.w - soc[0].w) <= 1 && x.top === soc[0].top), '27: три кнопки одной ширины и высоты в один ряд, подписи влезают');
  ok(await overflow(p) <= 0, '27: телефон — без горизонтальной прокрутки');
  const tabsOneLine = await p.$$eval('.switch__tab', (ts) => ts.every((t) => t.scrollHeight <= 46));
  ok(tabsOneLine, '27: подписи вкладок в одну строку на 390 px');
  await p.goto(base + 'login.html#register', { waitUntil: 'networkidle' });
  ok(await p.locator('#pane-register').isVisible(), '27: login.html#register открывает регистрацию');
  await p.locator('.dock a[href="login.html"]').tap(); await p.waitForTimeout(300);
  ok(new URL(p.url()).pathname.endsWith('login.html'), '27: «Кабинет» в нижней панели ведёт на вход');
  await c.close();

  // п. 27 (Антон и Ксения, 23.11): what to do and what comes in the letter; help only after sending.
  c = await b.newContext(phone); p = await open(c, 'password-reset.html');
  ok((await p.textContent('h1')).trim() === 'Сброс пароля' && !(await p.textContent('.auth__main')).includes('Форма сброса пароля') && rub(await p.textContent('.form__lead')).startsWith('Введите email, указанный при регистрации'), '27: без «Форма сброса пароля» — подсказка, что делать');
  ok(await p.locator('[data-reset-sent]').first().isHidden() && !rub(await p.locator('body').innerText()).includes('Не пришло письмо?') && rub(await p.textContent('.auth__aside .notice')).includes('Войти и сменить пароль'), '27: до отправки — что придёт в письме, «Не пришло письмо?» не показано');
  ok(await p.locator('a.auth__back').isVisible() && (await p.getAttribute('a.auth__back', 'href')) === 'login.html', '27: сброс пароля — кнопка «Вернуться к авторизации»');
  await p.locator('[data-form="reset"] .form__submit').tap(); await p.waitForTimeout(200);
  ok((await p.textContent('#reset-email-error')).trim() === 'Введите email' && await p.locator('[data-reset-sent]').first().isHidden(), '27: пустой email — ошибка, экран не меняется');
  await p.fill('#reset-email', 'name@mail.ru'); await p.locator('[data-form="reset"] .form__submit').tap(); await p.waitForTimeout(300);
  ok(await p.locator('[data-reset-ask]').first().isHidden() && rub(await p.textContent('[data-reset-sent] .sent__text')).includes('name@mail.ru') && await p.evaluate(() => document.activeElement?.id === 'sent-title'), '27: после отправки — «Письмо отправлено» на name@mail.ru, фокус на заголовке');
  ok(await p.locator('[data-resend]').isDisabled() && rub(await p.textContent('[data-resend]')).startsWith('Отправить ещё раз через') && await p.locator('.sent__login').isVisible(), '27: «Отправить ещё раз» с паузой, «Вернуться ко входу» на месте');
  ok((await p.inputValue('#help-email')) === 'name@mail.ru' && rub(await p.locator('body').innerText()).includes('Не пришло письмо?'), '27: «Не пришло письмо?» и форма обратной связи — после отправки, email подставлен');
  await p.locator('[data-form="help"] button[type="submit"]').tap(); await p.waitForTimeout(200);
  ok((await p.textContent('[data-form="help"] [data-done]')).startsWith('Демо:'), '27: сообщение в магазин — демо честно помечено');
  await p.locator('[data-change-email]').tap(); await p.waitForTimeout(200);
  ok(await p.locator('[data-reset-ask]').first().isVisible() && await p.evaluate(() => document.activeElement?.id === 'reset-email'), '27: «Указать другой email» — обратно к форме, фокус в поле');
  ok(await overflow(p) <= 0, '27: сброс пароля — без горизонтальной прокрутки');
  await c.close();

  // Login: Ксения's text (чат 23.11, 16:58) in place of the old notice.
  c = await b.newContext(phone); p = await open(c, 'login.html');
  const aside = rub(await p.textContent('.auth__aside'));
  ok(aside.includes('Создайте учётную запись, и следующие покупки займут меньше времени') && aside.includes('Вход через Google, Twitter и Facebook больше недоступен') && !aside.includes('Уважаемые посетители'), '27: вход — текст Ксении о пользе учётной записи');
  // Ксения, 24.11: one block under «Уважаемый покупатель!», the «Спам» line below it.
  ok(await p.locator('.auth__aside .notice').count() === 1 && rub(await p.textContent('.auth__aside .notice__title')) === 'Уважаемый покупатель!' && !aside.includes('Зачем учётная запись') && await p.evaluate(() => { const n = document.querySelector('.auth__aside .notice').getBoundingClientRect(); const h = document.querySelector('.auth__aside .auth__hint').getBoundingClientRect(); return h.top >= n.bottom; }), '27: вход — один блок «Уважаемый покупатель!», строка про «Спам» под ним');
  await p.locator('.auth__aside a[href="#pane-link"]').tap(); await p.waitForTimeout(200);
  ok(await p.locator('#pane-link').isVisible(), '27: ссылка «Быстрый вход» в тексте открывает вкладку');
  await c.close();

  c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(c, 'password-reset.html');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.auth__layout')).gridTemplateColumns.split(' ').length) === 2, '27: сброс пароля на компьютере — две колонки, как вход');
  await c.close();

  c = await b.newContext({ ...phone, javaScriptEnabled: false }); p = await c.newPage(); await p.goto(base + 'login.html', { waitUntil: 'load' });
  ok(await p.locator('#pane-link form').isVisible() && await p.locator('#pane-login form').isVisible() && await p.locator('#pane-register form').isVisible() && await p.locator('[data-switch]').isHidden(), 'без JS: все три формы видны, вкладок нет');
  await c.close();

  // Артём, 24.11: an empty cart offers «Вы смотрели» and does not end at the footer on a phone.
  c = await b.newContext(phone); p = await open(c, 'cart.html');
  ok(await p.locator('[data-basket-empty] [data-viewed]').isVisible() && await p.evaluate(() => document.querySelector('.footer').getBoundingClientRect().top >= innerHeight - 1), '25: пустая корзина — «Вы смотрели», футер не на первом экране');
  // «1 шт» says nothing for a piece item — the name alone.
  await p.evaluate(() => window.TeaboomCart.fill([{ sku: '02994', name: 'Чайник «Лотос»', pack: '1 шт', price: 459, img: '', url: '#', qty: 1 }]));
  await p.waitForTimeout(200);
  ok(rub(await p.textContent('[data-line-name]')) === 'Чайник «Лотос»', '25: штучный товар — без «, 1 шт» в названии');
  await c.close();

  // Антон 23.11 / 24.11, вариант C: on a tile — the pack chip «×N», «В корзине: N шт.» on the
  // photo whichever pack is chosen, the chosen pack's button turns into «− в корзине N шт. +».
  c = await b.newContext({ viewport: { width: 1440, height: 900 } }); p = await open(c, 'category-ulun.html');
  const tile = p.locator('[data-good]').first();
  const h0 = await tile.evaluate((g) => g.getBoundingClientRect().height);
  await tile.locator('[data-add]').click(); await p.waitForTimeout(300); await tile.locator('[data-add]').click(); await p.waitForTimeout(2000);
  ok(rub(await tile.locator('.pack.is-in-cart .pack__in').textContent()) === '2 в корзине' && await tile.locator('.pack.is-in-cart .pack__in svg').count() === 1 && rub(await tile.locator('.good__incart').textContent()) === 'В корзине: 2 шт.' && await tile.locator('[data-add]').isHidden() && rub(await tile.locator('[data-step-n]').textContent()) === '2 шт.', '«в корзине»: значок на фасовке, плашка на фото, счётчик вместо кнопки');
  ok(Math.abs(await tile.evaluate((g) => g.getBoundingClientRect().height) - h0) < 0.5, '«в корзине»: высота плитки со счётчиком не меняется');
  await tile.locator('[data-step="1"]').click(); await p.waitForTimeout(900); // the header count follows the flying photo
  ok(rub(await tile.locator('[data-step-n]').textContent()) === '3 шт.' && rub(await p.textContent('[data-cart-count]')) === '3', '«в корзине»: «+» добавляет упаковку');
  await tile.locator('[data-step="-1"]').click(); await p.waitForTimeout(200);
  ok(rub(await tile.locator('[data-step-n]').textContent()) === '2 шт.', '«в корзине»: «−» убирает упаковку');
  await tile.locator('.pack').nth(1).click(); await p.waitForTimeout(200);
  ok(rub(await tile.locator('[data-add]').textContent()) === 'В корзину' && await tile.locator('.good__incart').isVisible(), '«в корзине»: другая фасовка — «В корзину», плашка на фото остаётся');
  await p.goto(base + 'index.html', { waitUntil: 'networkidle' });
  const home = p.locator('.goods [data-good]').first();
  await home.locator('[data-add]').click(); await p.waitForTimeout(2000);
  await p.reload({ waitUntil: 'networkidle' });
  ok(rub(await p.locator('.goods [data-good]').first().locator('.pack.is-in-cart .pack__in').textContent()) === '1 в корзине', '«в корзине»: на главной и после перезагрузки');
  await c.close();

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
