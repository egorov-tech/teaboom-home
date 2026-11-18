// Product page, пп. 44 и 46 (Ксения, 18.11): «Похожие и сопутствующие товары», «Вы смотрели».
// BASE=http://127.0.0.1:8890/ node tests/stage3-more.cjs
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };
const KEY = 'teaboom-viewed-v1';

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const open = async (ctx, url = 'product.html?nointro') => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; };

  // ---------- Computer ----------
  let c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let p = await open(c);
  const tiles = await p.$$eval('[data-rail] .good', (g) => g.map((x) => x.dataset.slug));
  ok(tiles[0] === 'molochnyj-ulun-tajvani-1' && tiles.length === 4, `46: первая плитка — из админки (Молочный улун), всего 4: ${tiles.join(', ')}`);
  ok(!tiles.includes('ananasovij-ulun'), '46: сам товар в блоке не показывается');
  ok(await p.locator('[data-rail] .more__note').isVisible(), '46: пример заполнения помечен');
  ok(await p.locator('[data-rail-arrows]').isHidden(), '46: компьютер — 4 плитки помещаются, стрелок нет');
  ok(await p.evaluate(() => { const rows = [...document.querySelectorAll('[data-rail] .packs__grid')].map((e) => Math.round(e.getBoundingClientRect().top)); return rows.every((y) => y === rows[0]); }), '46: фасовки всех плиток на одной линии');
  const before = await p.evaluate(() => (window.TeaboomCart?.items() || []).length);
  await p.locator('[data-rail] .good').nth(1).locator('[data-add]').click(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => (window.TeaboomCart?.items() || []).length) === before + 1, '46: «В корзину» из плитки кладёт товар в корзину');
  await p.evaluate((k) => { localStorage.clear(); }, KEY);
  await c.close();

  // ---------- Tablet: arrows when the row does not fit ----------
  c = await b.newContext({ viewport: { width: 768, height: 1024 } });
  p = await open(c);
  ok(await p.locator('[data-rail-arrows]').isVisible() && await p.locator('[data-rail-prev]').isDisabled(), '46: планшет — стрелки есть, «Назад» неактивна в начале');
  await p.locator('[data-rail-next]').click(); await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.querySelector('[data-rail-track]').scrollLeft > 100), '46: «Вперёд» листает ряд');
  await c.close();

  // ---------- Phone ----------
  c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p = await open(c);
  ok(await p.locator('[data-rail-arrows]').isHidden(), '46: телефон — без стрелок, листается пальцем');
  ok(await p.evaluate(() => { const t = document.querySelector('[data-rail-track]'); return t.scrollWidth > t.clientWidth && getComputedStyle(t).overflowX === 'auto'; }), '46: телефон — ряд прокручивается вбок');
  // innerWidth grows with an over-wide page on phones — compare with the device width instead.
  ok(await p.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= 390), 'телефон: страница не шире экрана (390)');

  // «Вы смотрели»: empty history → marked example; the page remembers itself
  ok(await p.locator('[data-viewed]').isVisible() && await p.locator('[data-viewed-note]').isVisible() && await p.locator('.seen').count() === 5, '44: истории нет — пример из 5 товаров с пометкой');
  const stored = await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), KEY);
  ok(stored[0]?.slug === 'ananasovij-ulun', '44: открытая карточка запоминается');
  await c.close();

  // History with another product → that one, no example note, never the current product
  c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript((k) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify([
    { slug: 'ananasovij-ulun', name: 'Ананасовый улун', url: 'product.html', img: 'assets/images/products/ananasovij-ulun-280.jpg', price: 326.4, from: true },
    { slug: 'ulun-kola', name: 'Улун Кола', url: 'https://teaboom.ru/product/ulun-kola', img: 'assets/images/products/ulun-kola-280.jpg', price: 316.9, from: true },
  ])); } }, KEY);
  p = await open(c);
  const names = await p.$$eval('.seen__name', (n) => n.map((x) => x.textContent));
  ok(JSON.stringify(names) === '["Улун Кола"]' && await p.locator('[data-viewed-note]').isHidden(), `44: своя история — без пометки и без текущего товара (${names})`);
  ok((await p.textContent('.seen__price')).replace(/ /g, ' ') === 'от 316,90 ₽', '44: цена «от …» как на плитке');
  await c.close();

  // Broken storage must not break the page
  c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript((k) => localStorage.setItem(k, '{oops'), KEY);
  p = await open(c);
  ok(await p.locator('.seen').count() === 5, '44: испорченная запись — показывается пример, без ошибок');
  await c.close();

  ok(!errors.length, `нет ошибок JS ${errors.join(' | ')}`);
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
