// Category page, п. 17. BASE=http://127.0.0.1:8890/ node tests/stage3-category.cjs
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };
const NB = ' ';

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  const shown = () => p.evaluate(() => [...document.querySelectorAll('[data-item]')].filter((li) => !li.hidden).map((li) => ({ price: +li.dataset.price, name: li.dataset.name })));
  await p.goto(base + 'category-ulun.html', { waitUntil: 'networkidle' });

  let s = await shown();
  ok(s.length === 12, 'по 12 товаров на странице');
  ok(s.every((x, i) => i === 0 || s[i - 1].price <= x.price), 'по умолчанию — по возрастанию цены (как на сайте)');
  ok((await p.textContent('[data-count]')).trim().replace(/\u00a0/g, ' ') === '143 товара', '41: счётчик «143 товара»');
  const want = require('fs').existsSync(process.env.LIVE || '') ? JSON.parse(require('fs').readFileSync(process.env.LIVE)).map((x) => x.slug).sort() : null;
  const slugs = (await p.$$eval('[data-item] .good', (gs) => gs.map((g) => g.dataset.slug))).sort();
  ok(slugs.length === 143 && new Set(slugs).size === 143 && (!want || JSON.stringify(want) === JSON.stringify(slugs)), 'в сетке все 143 улуна со страниц 1–12 сайта' + (want ? '' : ' (сверка со снимком пропущена: нет LIVE)'));

  await p.selectOption('[data-sort]', '-effective_price'); await p.waitForTimeout(200);
  s = await shown();
  ok(s.every((x, i) => i === 0 || s[i - 1].price >= x.price), 'по убыванию цены');
  ok(new URL(p.url()).searchParams.get('sorting') === '-effective_price', 'сортировка в адресе (sorting, как на сайте)');
  await p.selectOption('[data-sort]', 'name'); await p.waitForTimeout(200);
  s = await shown();
  ok(s.every((x, i) => i === 0 || s[i - 1].name.localeCompare(x.name, 'ru') <= 0), 'по алфавиту');

  // Window 1 2 … 12: page 3 appears after page 2.
  await p.click('[data-pager] [data-page="2"]:not(.pager__link--step)'); await p.waitForTimeout(300);
  await p.click('[data-pager] [data-page="3"]:not(.pager__link--step)'); await p.waitForTimeout(400);
  ok(new URL(p.url()).searchParams.get('start') === '3' && (await p.getAttribute('[data-page="3"][aria-current]', 'aria-current')) === 'page', 'страница 3, в адресе start=3 (как на сайте)');
  ok((await p.textContent('[data-count]')).trim().replace(/\u00a0/g, ' ') === '143 товара' && (await shown()).length === 12, 'страница 3: счётчик тот же, страница видна в пейджинге');
  const bar = await p.evaluate(() => { const h = document.querySelector('[data-masthead]').getBoundingClientRect().bottom; const r = document.querySelector('.category__bar').getBoundingClientRect().top; return r >= h - 1; });
  ok(bar, 'после смены страницы строка сортировки не под шапкой');
  await p.goBack(); await p.goBack(); await p.waitForTimeout(300);
  ok(new URL(p.url()).searchParams.get('start') === null && (await p.inputValue('[data-sort]')) === 'name', '«Назад» возвращает страницу 1 с той же сортировкой');

  await p.goto(base + 'category-ulun.html?start=99&sorting=bad', { waitUntil: 'networkidle' });
  ok((await shown()).length === 11 && (await p.getAttribute('[data-pager] [aria-current="page"]', 'data-page')) === '12' && (await p.inputValue('[data-sort]')) === 'effective_price', 'start=99 и неизвестная сортировка — безопасно: последняя страница, сортировка по умолчанию');

  await p.goto(base + 'category-ulun.html', { waitUntil: 'networkidle' });
  const hrefs = await p.$$eval('[data-item]:not([hidden]) .good__name a', (as) => as.map((a) => a.getAttribute('href')));
  ok(hrefs.every((h) => h.startsWith('https://teaboom.ru/product/')) && new Set(hrefs).size === hrefs.length, 'плитки ведут на свои живые страницы, без дублей');
  const g = p.locator('[data-item]:not([hidden]) .good').first();
  await g.locator('.pack__input').nth(2).check({ force: true }); await p.waitForTimeout(200);
  ok((await g.locator('.good__name').textContent()).trim() === 'Улун Медовая Дыня' && (await g.locator('[data-now]').textContent()) === '1' + NB + '294' + NB + '₽', 'Медовая дыня, 1 кг — ровно 1 294 ₽');
  ok((await g.locator('[data-sku]').textContent()).trim() === '01285', 'артикул фасовки 1 кг (01285)');
  await g.locator('[data-add]').click();
  ok((await g.locator('[data-add]').textContent()).trim() === 'Добавлено', 'кнопка «В корзину» в плитке категории отвечает');
  await p.waitForTimeout(1500);
  ok(await p.evaluate(() => (document.querySelector('[data-cart-count]')?.textContent || '').trim() !== '0'), 'счётчик корзины вырос');
  ok(new URL(p.url()).pathname.endsWith('category-ulun.html'), 'выбор фасовки и покупка не уводят со страницы');

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
