// Product page behaviour, пп. 15/22/23. Run against a local server:
//   python3 -m http.server 8890  (or the no-cache server) · BASE=http://127.0.0.1:8890/ node tests/stage3-pdp.cjs
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

  // п. 22: rating only where reviews exist
  let c = await b.newContext(phone);
  let p = await open(c, 'product.html');
  ok(await p.locator('.rating').count() === 0, '22: ананас без отзывов — блока рейтинга нет');
  ok((await p.textContent('#reviews')).includes('Ещё никто не оставлял отзывов'), '22: пустое состояние отзывов текстом магазина');
  ok(!(await p.content()).includes('4,8'), '22: нет условной оценки 4,8');
  // п. 15: four photos — dots on phones, thumbnails hidden
  ok(await p.locator('[data-gallery-dot]').count() === 4, '15: 4 фото — 4 точки');
  ok(!(await p.locator('.gallery').isVisible()), '15: на телефоне миниатюры скрыты');
  await p.locator('[data-gallery-dot]').nth(2).click(); await p.waitForTimeout(700);
  ok(await p.locator('[data-gallery-dot]').nth(2).getAttribute('aria-current') === 'true', '15: точка 3 переключает фото');
  // п. 23: tabs on phones
  ok(await p.locator('[data-tabs]').isVisible(), '23: вкладки видны на телефоне');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["about"]', '23: открыта только «Описание»');
  await p.locator('[data-tab="about"]').focus(); await p.keyboard.press('ArrowRight');
  ok(await p.locator('[data-tab="specs"]').getAttribute('aria-selected') === 'true', '23: стрелка вправо → «Характеристики»');
  await p.keyboard.press('End');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["delivery"]', '23: End → «Доставка и оплата»');
  await p.keyboard.press('Home');
  ok(await p.evaluate(() => document.activeElement.dataset.tab) === 'about', '23: Home → фокус на первой вкладке');
  ok(await p.locator('.specs__row').count() === 13, '23: все 13 характеристик ананаса');
  // rotation / desktop width: nothing stays hidden
  await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForTimeout(300);
  ok((await visible(p, '[data-panel]')).length === 4 && !(await p.locator('[data-tabs]').isVisible()), '23: шире 760 px — все разделы подряд, без вкладок');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok((await visible(p, '[data-panel]')).length === 1, '23: обратно на телефон — снова одна вкладка');
  await c.close();

  // п. 22: one real review, link opens the tab and lands below the header
  c = await b.newContext(phone);
  p = await open(c, 'product-dun-din.html');
  ok((await p.textContent('.rating')).includes('5,0') && (await p.textContent('.rating__link')).trim() === '1 отзыв', '22: Дун Дин — 5,0 и «1 отзыв»');
  ok(await p.locator('[data-gallery-dot]').count() === 0 && await p.locator('.gallery').count() === 0, '15: одно фото — ни точек, ни миниатюр');
  await p.click('.rating__link'); await p.waitForTimeout(800);
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["reviews"]', '22: ссылка открыла вкладку «Отзывы»');
  const top = await p.evaluate(() => { const h = document.querySelector('[data-masthead]').getBoundingClientRect().bottom; const r = document.querySelector('#reviews').getBoundingClientRect(); return { h, r: r.top }; });
  ok(top.r >= top.h - 1 && top.r < 844, `22: отзывы видны под шапкой (шапка ${Math.round(top.h)}, отзывы ${Math.round(top.r)})`);
  ok(new URL(p.url()).hash === '#reviews', '22: адрес #reviews');
  await p.goBack(); await p.waitForTimeout(400);
  ok(new URL(p.url()).hash === '', '22: «Назад» убирает #reviews');
  await c.close();

  c = await b.newContext(phone);
  p = await open(c, 'product-dun-din.html#specs');
  ok(JSON.stringify(await visible(p, '[data-panel]')) === '["specs"]', '23: прямой адрес #specs открывает вкладку');
  await c.close();

  // Without JS everything reads, tabs stay hidden
  c = await b.newContext({ ...phone, javaScriptEnabled: false });
  p = await c.newPage(); await p.goto(base + 'product.html', { waitUntil: 'load' });
  ok((await visible(p, '[data-panel]')).length === 4 && !(await p.locator('[data-tabs]').isVisible()), 'без JS: все разделы видны, вкладок нет');
  await c.close();

  // Desktop: thumbnails drive the strip
  c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(c, 'product.html');
  ok(await p.locator('.gallery').isVisible() && !(await p.locator('.photos__dots').isVisible()), '15: компьютер — миниатюры, без точек');
  await p.locator('[data-gallery-thumb]').nth(1).click(); await p.waitForTimeout(800);
  const shown = await p.evaluate(() => { const t = document.querySelector('[data-gallery-track]'); return Math.round(t.scrollLeft / t.clientWidth); });
  ok(shown === 1 && await p.locator('[data-gallery-thumb]').nth(1).getAttribute('aria-current') === 'true', '15: миниатюра 2 показывает фото 2');
  ok((await p.locator('.shot__image').nth(1).getAttribute('src')) !== null, '15: второе фото догрузилось');
  await c.close();

  ok(errors.length === 0, 'нет ошибок JS ' + (errors.join('; ') || ''));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
