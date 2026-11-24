// Product page, пп. 15/22/23 (by the sheet sketches). BASE=http://127.0.0.1:8890/ node tests/stage3-pdp.cjs
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const errors = [];
  const open = async (ctx, url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; };
  const visible = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => !e.hidden && e.getClientRects().length).map((e) => e.id), sel);
  const shown = (p) => p.evaluate(() => { const t = document.querySelector('[data-gallery-track]'); return Math.round(t.scrollLeft / t.clientWidth); });

  let c = await b.newContext(phone);
  let p = await open(c, 'product.html');
  // Антон, 19.11: on a phone the breadcrumbs open at their tail — the nearest category in view.
  ok(await p.evaluate(() => { const s = document.querySelector('.breadcrumbs__list'); const max = s.scrollWidth - s.clientWidth; return max > 0 && s.scrollLeft >= max - 2 && s.dataset.more === 'start'; }), 'крошки на телефоне показаны с конца — ближайшая категория видна');
  // п. 33: phone — category, name and rating above the photo. The short summary is gone (Антон, 19.11:
  // it repeats «Описание» and «Читать полностью» made the page jump).
  const y = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  ok(await y('.product__title') < await y('.product__media') && await y('.rating') < await y('.product__media'), '33: телефон — название и рейтинг над фото');
  ok(await p.locator('.product__summary, .product__more').count() === 0, '33: краткого описания и «Читать полностью» нет');
  // п. 15: thumbnails under the photo on the phone too, no dots
  ok(await p.locator('.gallery').isVisible() && await p.locator('[data-gallery-thumb]').count() === 4, '15: телефон — ряд из 4 миниатюр под фото');
  ok(await p.locator('[data-gallery-dot]').count() === 0, '15: точек нет');
  await p.locator('[data-gallery-thumb]').nth(2).tap(); await p.waitForTimeout(700);
  ok(await shown(p) === 2 && await p.locator('[data-gallery-thumb]').nth(2).getAttribute('aria-current') === 'true', '15: миниатюра 3 показывает фото 3');
  // п. 22: rating under the title (sketch: 4,8 · 12 отзывов), labelled example in the reviews
  ok((await p.textContent('.rating')).includes('4,8') && (await p.textContent('.rating__link')).trim() === '12 отзывов', '22: под названием 4,8 · 12 отзывов');
  ok(await p.evaluate(() => { const a = document.querySelector('a.rating'); return !!a && a.contains(document.querySelector('.rating__stars')) && getComputedStyle(a.querySelector('.rating__link')).textDecorationThickness === '2px'; }), '34: вся строка рейтинга со звёздами — одна ссылка, подчёркивание 2 px');
  ok(!(await p.content()).includes('"aggregateRating"'), '22: пример не попадает в разметку для поисковиков');
  // п. 23: tabs on phones
  ok(await p.locator('[data-tabs]').isVisible() && JSON.stringify(await visible(p, '[data-panel]')) === '["about"]', '23: вкладки, открыто «Описание»');
  await p.locator('a.rating .rating__stars').tap(); await p.waitForTimeout(800);
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["reviews"]', '22: ссылка открыла вкладку «Отзывы»');
  ok(await p.locator('.reviews__sample').isVisible() && await p.locator('.review:not(.review--all)').count() === 3, '22: пометка «пример оформления» и 3 примера отзывов');
  const top = await p.evaluate(() => ({ h: document.querySelector('[data-masthead]').getBoundingClientRect().bottom, r: document.querySelector('#reviews').getBoundingClientRect().top }));
  ok(top.r >= top.h - 1 && top.r < 844, `22: отзывы видны под шапкой (${Math.round(top.h)} / ${Math.round(top.r)})`);
  await p.goBack(); await p.waitForTimeout(400);
  ok(new URL(p.url()).hash === '', '22: «Назад» убирает #reviews');
  await p.locator('[data-tab="about"]').focus(); await p.keyboard.press('ArrowRight');
  ok(await p.locator('[data-tab="specs"]').getAttribute('aria-selected') === 'true', '23: стрелка вправо → «Характеристики»');
  await p.keyboard.press('End');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["delivery"]' && await p.locator('[data-tab]').count() === 4, '23 (Антон, 23.11): вкладок четыре, End → «Оплата и получение»');
  const specsText = (await p.textContent('.specs')).replace(/\u00a0/g, ' ');
  ok(await p.locator('.specs__row').count() === 11 && specsText.includes('Количество2 ч. л. на 500 мл') && specsText.includes('Заваривать1–3 мин при 80–85 °C'), '36: заваривание двумя строками — «Количество» и «Заваривать» (13 → 11 строк)');
  ok(await p.locator('.brew').count() === 0, '36: блока «Как заваривать» у покупки нет');
  ok((await p.textContent('.review__all')).replace(/\u00a0/g, ' ').trim() === 'Все 12 отзывов', 'отзывы: «Отзывы 12», видно 3 — в конце ленты «Все 12 отзывов»');
  ok(await p.evaluate(() => { const t = document.querySelector('.reviews__list'); return getComputedStyle(t).overflowX === 'auto' && getComputedStyle(t).scrollSnapType.startsWith('x'); }), 'отзывы — лента со свайпом (как «Похожие»)');
  ok(await p.locator('.rates__list > li').count() === 5 && (await p.textContent('.rates')).replace(/\u00a0/g, ' ').includes('свыше 10 000 ₽ — бесплатно'), '47 (Антон, 24.11): короткий текст — 5 строк: способ, условие, цена');
  ok((await p.textContent('[data-tab="delivery"]')).replace(/\u00a0/g, ' ').trim() === 'Оплата и получение' && (await p.textContent('#delivery .delivery h3')).trim() === 'Получение', '47: вкладка «Оплата и получение», внутри «Получение» и «Оплата»');
  ok(await p.locator('.promise').count() === 0 && await p.locator('#delivery .rates').count() === 1, '23 + 35 (Антон, 24.11): условия только во вкладке, строки под кнопкой нет');
  ok(await p.evaluate(() => { const r = [...document.querySelectorAll('[data-tab]')].map((t) => t.getBoundingClientRect()); const l = document.querySelector('[data-tabs]').getBoundingClientRect(); return r.every((x) => x.left >= l.left && x.right <= l.right && x.width > 0) && document.querySelector('[data-tabs]').scrollWidth <= document.querySelector('[data-tabs]').clientWidth; }), 'вкладки (Антон, 24.11): все четыре видны, ряд не прокручивается');
  await p.locator('[data-tab="delivery"]').click(); await p.locator('[data-hint-btn]').click();
  ok(await p.locator('[data-hint-pop]').isVisible() && (await p.textContent('[data-hint-pop]')).replace(/\u00a0/g, ' ').includes('Народного Ополчения'), '47: «Адрес» у самовывоза открывает подсказку с адресом');
  await p.keyboard.press('Escape');
  ok(!(await p.locator('[data-hint-pop]').isVisible()), '47: Esc закрывает подсказку');
  await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const i = document.querySelector('.product__info'); const m = document.querySelector('.product__media'); return getComputedStyle(i).display !== 'contents' && i.getBoundingClientRect().left > m.getBoundingClientRect().right; }), '33: компьютер — название в колонке покупки');
  ok(await p.evaluate(() => { const cols = [...document.querySelectorAll('#delivery .delivery > div')].map((x) => Math.round(x.getBoundingClientRect().top)); return cols.length === 2 && cols[0] === cols[1]; }), '23: компьютер — во вкладке «Доставка» и «Оплата» рядом, двумя колонками');
  await p.evaluate(() => { history.replaceState(null, '', location.pathname + location.search); scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
  ok((await visible(p, '[data-panel]')).length === 4 && !(await p.locator('[data-tabs]').isVisible()), '23: шире 760 px — разделы подряд');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok((await visible(p, '[data-panel]')).length === 1, '23: обратно на телефон — одна вкладка');
  await c.close();

  c = await b.newContext(phone); p = await open(c, 'product.html#delivery');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["delivery"]', '23: адрес #delivery открывает вкладку «Оплата и получение»');
  await c.close();

  c = await b.newContext(phone); p = await open(c, 'product.html#specs');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["specs"]', '23: прямой адрес #specs открывает вкладку');
  await c.close();

  c = await b.newContext({ ...phone, javaScriptEnabled: false }); p = await c.newPage(); await p.goto(base + 'product.html', { waitUntil: 'load' });
  ok((await visible(p, '[data-panel]')).length === 4 && !(await p.locator('[data-tabs]').isVisible()), 'без JS: все разделы видны');
  await c.close();

  c = await b.newContext({ viewport: { width: 1440, height: 900 } }); p = await open(c, 'product.html');
  await p.locator('[data-gallery-thumb]').nth(1).click(); await p.waitForTimeout(800);
  ok(await shown(p) === 1 && (await p.locator('.shot__image').nth(1).getAttribute('src')) !== null, '15: компьютер — миниатюра 2 показывает фото 2');
  await c.close();

  // Reviews arrows (computer, a mouse): on the row, level with the cards — not in the heading (Антон, 19.11).
  c = await b.newContext({ viewport: { width: 1200, height: 900 } });
  p = await open(c, 'product.html');
  ok(await p.evaluate(() => { const n = document.querySelector('.reviews [data-rail-next]'); const l = document.querySelector('.reviews__list'); if (!n || n.closest('[hidden]')) return false; const a = n.getBoundingClientRect(), r = l.getBoundingClientRect(); const mid = a.top + a.height / 2; return mid > r.top && mid < r.bottom; }), 'отзывы: стрелка на уровне карточек, не в шапке (Антон, 19.11)');
  await c.close();

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
