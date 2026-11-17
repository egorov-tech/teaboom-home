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
  // п. 15: thumbnails under the photo on the phone too, no dots
  ok(await p.locator('.gallery').isVisible() && await p.locator('[data-gallery-thumb]').count() === 4, '15: телефон — ряд из 4 миниатюр под фото');
  ok(await p.locator('[data-gallery-dot]').count() === 0, '15: точек нет');
  await p.locator('[data-gallery-thumb]').nth(2).tap(); await p.waitForTimeout(700);
  ok(await shown(p) === 2 && await p.locator('[data-gallery-thumb]').nth(2).getAttribute('aria-current') === 'true', '15: миниатюра 3 показывает фото 3');
  // п. 22: rating under the title (sketch: 4,8 · 12 отзывов), labelled example in the reviews
  ok((await p.textContent('.rating')).includes('4,8') && (await p.textContent('.rating__link')).trim() === '12 отзывов', '22: под названием 4,8 · 12 отзывов');
  ok(!(await p.content()).includes('"aggregateRating"'), '22: пример не попадает в разметку для поисковиков');
  // п. 23: tabs on phones
  ok(await p.locator('[data-tabs]').isVisible() && JSON.stringify(await visible(p, '[data-panel]')) === '["about"]', '23: вкладки, открыто «Описание»');
  await p.locator('.rating__link').tap(); await p.waitForTimeout(800);
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["reviews"]', '22: ссылка открыла вкладку «Отзывы»');
  ok(await p.locator('.reviews__sample').isVisible() && await p.locator('.review').count() === 3, '22: пометка «пример оформления» и 3 примера отзывов');
  const top = await p.evaluate(() => ({ h: document.querySelector('[data-masthead]').getBoundingClientRect().bottom, r: document.querySelector('#reviews').getBoundingClientRect().top }));
  ok(top.r >= top.h - 1 && top.r < 844, `22: отзывы видны под шапкой (${Math.round(top.h)} / ${Math.round(top.r)})`);
  await p.goBack(); await p.waitForTimeout(400);
  ok(new URL(p.url()).hash === '', '22: «Назад» убирает #reviews');
  await p.locator('[data-tab="about"]').focus(); await p.keyboard.press('ArrowRight');
  ok(await p.locator('[data-tab="specs"]').getAttribute('aria-selected') === 'true', '23: стрелка вправо → «Характеристики»');
  await p.keyboard.press('End');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["delivery"]', '23: End → «Доставка и оплата»');
  ok(await p.locator('.specs__row').count() === 13, '23: все 13 характеристик');
  await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForTimeout(300);
  ok((await visible(p, '[data-panel]')).length === 4 && !(await p.locator('[data-tabs]').isVisible()), '23: шире 760 px — разделы подряд');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok((await visible(p, '[data-panel]')).length === 1, '23: обратно на телефон — одна вкладка');
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

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
