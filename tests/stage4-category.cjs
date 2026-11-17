// Category filters, п. 17 (полный шаблон). BASE=http://127.0.0.1:8890/ node tests/stage4-category.cjs
// Numbers come from data/categories.json (live teaboom.ru, 17.11): Натуральный 75, with it
// Китай 20 / Тайвань 54 / Вьетнам 1, «С жасмином» 0; Китай + Ароматизированный 58.
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const open = async (ctx, url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(url + ': ' + e.message)); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; };
  const countText = (p) => p.textContent('[data-count]').then((t) => t.trim());
  const facetCount = (p, key) => p.locator(`[data-facet][value="${key}"]`).locator('xpath=..').locator('[data-facet-count]').textContent();
  const shownMatch = (p, keys) => p.evaluate((keys) => {
    const groups = {};
    keys.forEach((k) => { const g = k.split('__')[0]; (groups[g] = groups[g] || []).push(k); });
    return [...document.querySelectorAll('[data-item]:not([hidden])')].every((li) => {
      const t = li.dataset.f.split('___');
      return Object.values(groups).every((ks) => ks.some((k) => t.includes(k)));
    });
  }, keys);

  // ---------- Desktop: panel in a column ----------
  let c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let p = await open(c, 'category-ulun.html');
  ok(await p.locator('[data-facets]').isVisible() && await p.locator('[data-facets-open]').isHidden(), '17: компьютер — фильтры колонкой слева, кнопки «Фильтры» нет');
  const groups = await p.$$eval('.facets__title', (ls) => ls.map((l) => l.textContent.trim()));
  ok(JSON.stringify(groups) === JSON.stringify(['Страна произрастания', 'Категория', 'Фасовка', 'Сорт']), '17: 4 группы, как на сайте (одиночные скрыты)');
  ok(await p.locator('.category__grid > li:not([hidden])').count() === 12 && await p.evaluate(() => getComputedStyle(document.querySelector('.category__grid')).gridTemplateColumns.split(' ').length) === 3, '17: 12 плиток в 3 колонки — 4 полных ряда');
  await p.locator('.facet', { hasText: 'Натуральный' }).click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Товары 1–12 из 75' && await shownMatch(p, ['16__Натуральный']), '17: «Натуральный» → 75, все плитки натуральные');
  ok(new URL(p.url()).searchParams.get('f') === '16__Натуральный', '17: адрес как на сайте — ?f=16__Натуральный');
  ok(await facetCount(p, '3__Китай') === '20' && await facetCount(p, '3__Тайвань') === '54' && await facetCount(p, '3__Вьетнам') === '1', '17: счётчики пересчитаны: Китай 20, Тайвань 54, Вьетнам 1');
  ok(await p.locator('[data-facet][value="57__С жасмином"]').isDisabled(), '17: «С жасмином» дал бы 0 — недоступен');
  await p.locator('.facet', { hasText: 'Китай' }).click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Товары 1–12 из 20' && new URL(p.url()).searchParams.get('f') === '16__Натуральный___3__Китай', '17: + Китай → 20; f=16__Натуральный___3__Китай');
  await p.locator('.facet', { hasText: 'Тайвань' }).click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Товары 1–12 из 74' && await shownMatch(p, ['16__Натуральный', '3__Китай', '3__Тайвань']), '17: Китай или Тайвань внутри группы → 74');
  ok(await p.locator('.chips__chip').count() === 3, '17: три выбранных фильтра чипами над плиткой');
  await p.locator('.chips__chip', { hasText: 'Натуральный' }).click(); await p.waitForTimeout(200);
  ok(!(await p.locator('[data-facet][value="16__Натуральный"]').isChecked()) && await countText(p) === 'Товары 1–12 из 142', '17: чип снят → отметка снята, Китай + Тайвань = 142');
  await p.selectOption('[data-sort]', '-effective_price'); await p.waitForTimeout(200);
  await p.locator('[data-pager] [data-page="2"]:not(.pager__link--step)').click(); await p.waitForTimeout(300);
  const q = new URL(p.url()).searchParams;
  ok(q.get('sorting') === '-effective_price' && q.get('start') === '2' && q.get('f') === '3__Китай___3__Тайвань', '17: фильтры + сортировка + страница в одном адресе');
  await p.locator('.facet', { hasText: 'Ароматизированный' }).click(); await p.waitForTimeout(200);
  ok(new URL(p.url()).searchParams.get('start') === null, '17: новый фильтр возвращает на первую страницу');
  await p.goBack(); await p.waitForTimeout(300);
  ok(await countText(p) === 'Товары 13–24 из 142' && !(await p.locator('[data-facet][value="16__Ароматизированный"]').isChecked()), '17: «Назад» возвращает прошлый выбор и страницу');
  await p.locator('[data-chips-reset]').click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Товары 1–12 из 143' && await p.locator('[data-chips]').isHidden(), '17: «Сбросить все» → 143, чипов нет');
  await c.close();

  // Empty result + reset
  c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(c, 'category-ulun.html?f=57__С жасмином___16__Натуральный');
  ok(await p.locator('[data-empty]').isVisible() && await p.locator('[data-list]').isHidden() && await p.locator('[data-pager]').isHidden(), '17: пустой результат — «Ничего не нашлось», без плитки и страниц');
  await p.locator('[data-empty-reset]').click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Товары 1–12 из 143', '17: «Сбросить фильтры» в пустом состоянии');
  await p.goto(base + 'category-ulun.html?f=3__Нет___16__Ароматизированный___3__Китай', { waitUntil: 'networkidle' });
  ok(await countText(p) === 'Товары 1–12 из 58', '17: неизвестное значение в адресе пропускается, остальное работает (58)');
  await c.close();

  // ---------- Phone: sheet ----------
  c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p = await open(c, 'category-ulun.html?start=5');
  ok(await p.locator('[data-facets]').isHidden() && await p.locator('[data-facets-open]').isVisible(), '17: телефон — панель скрыта, кнопка «Фильтры» на месте');
  const row = await p.evaluate(() => { const a = document.querySelector('[data-facets-open]').getBoundingClientRect(); const s = document.querySelector('.category__sort').getBoundingClientRect(); return Math.abs(a.top - s.top) < 2; });
  ok(row, '17: «Фильтры» и сортировка в одной строке');
  await p.locator('[data-facets-open]').tap(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('[data-facets]').matches(':modal')), '17: «Фильтры» открывают панель поверх страницы');
  await p.locator('.facet', { hasText: 'Тайвань' }).tap(); await p.waitForTimeout(200);
  ok((await p.textContent('[data-facets-total]')).trim() === '64 товара', '17: кнопка «Показать 64 товара» — итог до закрытия');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.locator('[data-facets]').isHidden() && await p.evaluate(() => document.activeElement?.hasAttribute('data-facets-open')), '17: Esc закрывает, фокус на кнопке «Фильтры»');
  ok((await p.textContent('[data-facets-badge]')).trim() === '1' && await countText(p) === 'Товары 1–12 из 64', '17: на кнопке «1», в сетке 64');
  await p.locator('[data-facets-open]').tap(); await p.waitForTimeout(300);
  await p.locator('[data-facets-show]').tap(); await p.waitForTimeout(400);
  ok(await p.locator('[data-facets]').isHidden(), '17: «Показать» закрывает панель');
  for (const w of [320, 390, 768, 1060, 1440]) {
    await p.setViewportSize({ width: w, height: 844 }); await p.waitForTimeout(250);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const pagerFits = await p.evaluate(() => { const l = document.querySelector('[data-pager-list]'); if (!l) return true; const tops = [...l.children].map((x) => Math.round(x.getBoundingClientRect().top)); return l.scrollWidth <= l.clientWidth + 1 && new Set(tops).size <= 1; });
    ok(over <= 0 && pagerFits, `17: ${w} px — без прокрутки вбок, страницы помещаются`);
  }
  ok(await p.locator('[data-facets]').isVisible(), '17: при расширении до 1440 панель встаёт колонкой');
  await c.close();

  c = await b.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  p = await open(c, 'category-ulun.html?start=5');
  const pg = await p.evaluate(() => { const l = document.querySelector('[data-pager-list]'); const tops = [...l.children].map((x) => Math.round(x.getBoundingClientRect().top)); return { one: new Set(tops).size === 1, text: l.textContent.replace(/\s+/g, ' ').trim() }; });
  ok(pg.one && pg.text === '‹1…456…12›', `17: 320 px, страница 5 — «${pg.text}» в одну строку`);
  await c.close();

  ok(errors.length === 0, 'нет ошибок JS ' + errors.join('; '));
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
