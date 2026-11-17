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
  // A second line pushes «Заказать» below the first screen: then the bar stands in for it.
  await p.evaluate(() => window.TeaboomCart.fill([...window.TeaboomCart.items(), { sku: '01306', name: 'Ананасовый улун', pack: '100 г', price: 326.4, old: 349.2, img: '', url: 'product.html', qty: 1 }]));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
  const below = await p.evaluate(() => document.querySelector('[data-order]').getBoundingClientRect().top > innerHeight);
  ok(below && await p.locator('[data-paybar]').isVisible() && (await p.textContent('[data-total-bar]')) === '6' + NB + '796,40' + NB + '₽', '25: «Заказать» ниже экрана — панель «Итого 6 796,40 ₽ · Заказать»');
  await p.locator('[data-line-remove]').nth(1).tap(); await p.waitForTimeout(200);
  ok(await overflow(p) <= 0, '25: телефон — без горизонтальной прокрутки');
  await p.locator('[data-coupon] button').tap();
  ok((await p.textContent('[data-coupon-note]')).includes('Введите код купона'), '25: пустой купон — подсказка');
  await p.fill('#coupon', 'TEA10'); await p.locator('[data-coupon] button').tap();
  ok((await p.textContent('[data-coupon-note]')).startsWith('Демо:'), '25: купон в демо честно помечен');
  await p.locator('[data-line-remove]').tap(); await p.waitForTimeout(200);
  ok(await p.locator('[data-basket-empty]').isVisible() && (await p.textContent('[data-cart-count]')).trim() === '0', '25: удаление — пустая корзина, счётчик 0');
  ok(await p.evaluate(() => document.activeElement?.closest('[data-basket-empty]') !== null), '25: после удаления фокус не теряется');
  await c.close();

  // ---------- Cart: sample + desktop ----------
  c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(c, 'cart.html?demo');
  ok(await p.locator('[data-line]').count() === 2 && (await p.textContent('[data-total]')) === '1' + NB + '946,80' + NB + '₽', '25: cart.html?demo — 2 строки, итог 1 946,80 ₽');
  ok((await p.textContent('[data-basket-count]')).trim() === '3 товара', '25: «3 товара»');
  ok(await p.locator('[data-paybar]').isHidden(), '25: компьютер — нижней панели нет');
  const sticky = await p.evaluate(() => getComputedStyle(document.querySelector('[data-summary]')).position);
  ok(sticky === 'sticky', '25: компьютер — «Ваш заказ» закреплён справа');
  await p.locator('[data-qty-dec]').first().click(); await p.locator('[data-qty-dec]').first().click(); await p.waitForTimeout(150);
  ok(await p.locator('[data-line]').count() === 1, '25: «−» на 1 шт. убирает строку');
  await c.close();

  // ---------- Login ----------
  c = await b.newContext(phone);
  p = await open(c, 'login.html');
  ok(await p.locator('#pane-link').isVisible() && await p.locator('#pane-login').isHidden(), '27: по умолчанию «Быстрый вход»');
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
  ok(await p.locator('.social__link').count() === 3 && (await p.getAttribute('.social__link >> nth=2', 'href')) === 'https://teaboom.ru/login/yandex-oauth2/?next=/', '27: VK, Одноклассники, Яндекс — адреса сайта');
  ok(await overflow(p) <= 0, '27: телефон — без горизонтальной прокрутки');
  const tabsOneLine = await p.$$eval('.switch__tab', (ts) => ts.every((t) => t.scrollHeight <= 46));
  ok(tabsOneLine, '27: подписи вкладок в одну строку на 390 px');
  await p.goto(base + 'login.html#register', { waitUntil: 'networkidle' });
  ok(await p.locator('#pane-register').isVisible(), '27: login.html#register открывает регистрацию');
  await p.locator('.dock a[href="login.html"]').tap(); await p.waitForTimeout(300);
  ok(new URL(p.url()).pathname.endsWith('login.html'), '27: «Кабинет» в нижней панели ведёт на вход');
  await c.close();

  c = await b.newContext(phone); p = await open(c, 'password-reset.html');
  await p.fill('#reset-email', 'name@mail.ru'); await p.locator('.form__submit').tap();
  ok((await p.textContent('[data-done]')).includes('name@mail.ru'), '27: сброс пароля — демо-сообщение с адресом');
  await c.close();

  c = await b.newContext({ ...phone, javaScriptEnabled: false }); p = await c.newPage(); await p.goto(base + 'login.html', { waitUntil: 'load' });
  ok(await p.locator('#pane-link form').isVisible(), 'без JS: форма быстрого входа видна');
  await c.close();

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
