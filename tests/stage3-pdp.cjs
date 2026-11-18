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
  // п. 33: phone — category, name and rating above the photo; summary 2 lines + link to «Описание»
  const y = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  ok(await y('.product__title') < await y('.product__media') && await y('.rating') < await y('.product__media'), '33: телефон — название и рейтинг над фото');
  ok(await p.evaluate(() => { const s = document.querySelector('.product__summary'); const lh = parseFloat(getComputedStyle(s).lineHeight); return s.getBoundingClientRect().height <= lh * 2 + 1; }), '33: краткое описание — не больше 2 строк');
  await p.locator('.product__more').tap(); await p.waitForTimeout(600);
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["about"]' && new URL(p.url()).hash === '#about', '33: «Читать полностью» → вкладка «Описание»');
  await p.goBack(); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
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
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["reviews"]' && await p.locator('[data-tab]').count() === 3, '23 + 35: вкладок три, End → «Отзывы» (доставка — под кнопкой)');
  const specsText = (await p.textContent('.specs')).replace(/\u00a0/g, ' ');
  ok(await p.locator('.specs__row').count() === 11 && specsText.includes('Количество2 ч. л. на 500 мл') && specsText.includes('Заваривать1–3 мин при 80–85 °C'), '36: заваривание двумя строками — «Количество» и «Заваривать» (13 → 11 строк)');
  ok(await p.locator('.brew').count() === 0, '36: блока «Как заваривать» у покупки нет');
  ok((await p.textContent('.review__all')).replace(/\u00a0/g, ' ').trim() === 'Все 12 отзывов', 'отзывы: «Отзывы 12», видно 3 — в конце ленты «Все 12 отзывов»');
  ok(await p.evaluate(() => { const t = document.querySelector('.reviews__list'); return getComputedStyle(t).overflowX === 'auto' && getComputedStyle(t).scrollSnapType.startsWith('x'); }), 'отзывы — лента со свайпом (как «Похожие»)');
  ok(await p.locator('.rates__list > li').count() === 5 && (await p.textContent('.rates')).replace(/\u00a0/g, ' ').includes('по России от 10 000 ₽ — бесплатно'), '47: доставка — 5 строк по примеру Ксении: способ, условие, цена');
  ok(await p.locator('details.promise#delivery').count() === 1 && await p.locator('.promise__list').count() === 0, '35: «Доставка и оплата» — один раскрывающийся блок под кнопкой');
  await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const i = document.querySelector('.product__info'); const m = document.querySelector('.product__media'); return getComputedStyle(i).display !== 'contents' && i.getBoundingClientRect().left > m.getBoundingClientRect().right; }) && await p.locator('.product__more').isHidden(), '33: компьютер — как было: название в колонке покупки, без «Читать полностью»');
  ok(await p.evaluate(() => { const d = document.getElementById('delivery'); d.open = true; const cols = [...d.querySelectorAll('.delivery > div')].map((x) => Math.round(x.getBoundingClientRect().left)); d.open = false; return cols.length === 2 && cols[0] === cols[1]; }), '35: компьютер — «Доставка» и «Оплата» одна под другой, не двумя узкими колонками');
  // Артём, 18.11: with «Доставка и оплата» open the photo rides along and stops before «Описание»
  const ride = await p.evaluate(async () => {
    const d = document.getElementById('delivery'); d.open = true;
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    scrollTo(0, 500); await new Promise((f) => setTimeout(f, 250));
    const mid = r('.product__media').top;
    scrollTo(0, r('.details').top + scrollY - 200); await new Promise((f) => setTimeout(f, 250));
    const gap = r('.details').top - r('.product__media').bottom;
    d.open = false; scrollTo(0, 0);
    return { mid: Math.round(mid), gap: Math.round(gap) };
  });
  ok(ride.mid > 60 && ride.mid < 120 && ride.gap >= 24, `35: фото едет рядом с открытой доставкой и останавливается до «Описания» (${JSON.stringify(ride)})`);
  ok((await visible(p, '[data-panel]')).length === 3 && !(await p.locator('[data-tabs]').isVisible()), '23: шире 760 px — разделы подряд');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok((await visible(p, '[data-panel]')).length === 1, '23: обратно на телефон — одна вкладка');
  await c.close();

  c = await b.newContext(phone); p = await open(c, 'product.html#delivery');
  ok(await p.evaluate(() => document.getElementById('delivery').open), '35: адрес #delivery открывает «Доставку и оплату»');
  await c.close();

  c = await b.newContext(phone); p = await open(c, 'product.html#specs');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["specs"]', '23: прямой адрес #specs открывает вкладку');
  await c.close();

  c = await b.newContext({ ...phone, javaScriptEnabled: false }); p = await c.newPage(); await p.goto(base + 'product.html', { waitUntil: 'load' });
  ok((await visible(p, '[data-panel]')).length === 3 && !(await p.locator('[data-tabs]').isVisible()), 'без JS: все разделы видны');
  await c.close();

  c = await b.newContext({ viewport: { width: 1440, height: 900 } }); p = await open(c, 'product.html');
  await p.locator('[data-gallery-thumb]').nth(1).click(); await p.waitForTimeout(800);
  ok(await shown(p) === 1 && (await p.locator('.shot__image').nth(1).getAttribute('src')) !== null, '15: компьютер — миниатюра 2 показывает фото 2');
  await c.close();

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
