// Category filters, п. 17 (полный шаблон). BASE=http://127.0.0.1:8890/ node tests/stage4-category.cjs
// Numbers come from data/categories.json (live teaboom.ru, 17.11): Тайвань 64, with it Габа 51 /
// Дун Дин 1 / Да Хун Пао 0; Габа + Дун Дин 54. «Категория» is not a filter since п. 42.
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  const open = async (ctx, url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(url + ': ' + e.message)); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; };
  const countText = (p) => p.textContent('[data-count]').then((t) => t.trim().replace(/\u00a0/g, ' '));
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
  const groups = await p.$$eval('.facets__name', (ls) => ls.map((l) => l.textContent.trim()));
  ok(JSON.stringify(groups) === JSON.stringify(['Страна произрастания', 'Фасовка', 'Сорт']), '17 + 42: группы как на сайте (одиночные скрыты), без «Категории» — её заменяют подкатегории');
  // п. 45 (Ксения, 23.11): on a computer the groups fold under their titles, as on rusteaco.
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-facets-group]')].map((g) => g.classList.contains('is-folded') ? 0 : 1).join('')) === '100' && await p.locator('.facets__fold').nth(1).evaluate((e) => e.inert && e.getBoundingClientRect().height < 1), '45 (Артём, 24.11): компьютер — первая группа открыта, остальные под стрелкой; свёрнутое недоступно с клавиатуры');
  ok(await p.evaluate(() => [...document.querySelectorAll('.facets__toggle')].every((t) => t.getBoundingClientRect().height >= 40)), '45: заголовок группы — кнопка не ниже 40 px');
  const country = p.locator('.facets__group', { hasText: 'Фасовка' });
  await country.locator('.facets__toggle').click(); await p.waitForTimeout(400);
  ok(await country.locator('.facets__toggle').getAttribute('aria-expanded') === 'true' && await country.locator('.facet').first().isVisible(), '45: клик по заголовку раскрывает группу');
  await country.locator('.facets__toggle').click(); await p.waitForTimeout(400);
  ok(await country.evaluate((g) => g.classList.contains('is-folded')), '45: повторный клик сворачивает');
  // The rest of this run needs every group open.
  for (const t of await p.locator('.facets__toggle').all()) if ((await t.getAttribute('aria-expanded')) === 'false') await t.click();
  await p.waitForTimeout(400);
  // п. 43: «Вы смотрели» in the category — the same block as on the product page; it shows the
  // history (here: the marked example) and writes nothing, a category is not a product.
  ok(await p.locator('[data-viewed]').isVisible() && await p.locator('.seen').count() === 5 && await p.evaluate(() => localStorage.getItem('teaboom-viewed-v1') === null), '43: «Вы смотрели» в категории — пример с пометкой, история не пишется');
  ok(await p.evaluate(() => { const v = document.querySelector('[data-viewed]'); const g = document.querySelector('.category__grid').getBoundingClientRect(); const r = v.getBoundingClientRect(); return v.closest('.category__main') && Math.abs(r.left - g.left) < 2 && r.top > g.bottom; }), '43 (Антон, 24.11): «Вы смотрели» под листингом, в его колонке');
  // пп. 40, 45: the first 5 values, «Показать все (N)» only when 2 or more are hidden.
  const sort = p.locator('.facets__group', { hasText: 'Сорт' });
  const visibleIn = (g) => g.locator('li:not([hidden]) .facet').count();
  ok(await visibleIn(sort) === 5 && (await sort.locator('[data-facets-more]').textContent()).trim() === 'Показать все (7)', '45: «Сорт» — 5 значений и «Показать все (7)»');
  await sort.locator('[data-facets-more]').click(); await p.waitForTimeout(200);
  ok(await visibleIn(sort) === 7 && (await sort.locator('[data-facets-more]').textContent()).trim() === 'Свернуть', '45: «Показать все» раскрывает все 7, кнопка — «Свернуть»');
  await sort.locator('[data-facets-more]').click(); await p.waitForTimeout(200);
  ok(await p.locator('[data-facets-more]').count() === 1, '45: группы до 6 значений — целиком, без кнопки (никаких «показать ещё 1»)');
  // Артём, 18.11: a value chosen far down the list — the page goes back up to the new list start.
  await p.evaluate(() => scrollTo({ top: document.querySelector('.category__grid').getBoundingClientRect().bottom + scrollY - 600, left: 0, behavior: 'instant' }));
  await p.waitForTimeout(300);
  await p.locator('[data-facet][value="3__Тайвань"]').evaluate((e) => e.click()); await p.waitForTimeout(1200);
  const barTop = await p.evaluate(() => Math.round(document.querySelector('.category__bar').getBoundingClientRect().top));
  ok(barTop >= 0 && barTop < 200, `фильтр внизу страницы → плавно наверх к выдаче (сортировка на ${barTop} px)`);
  await p.locator('[data-facet][value="3__Тайвань"]').evaluate((e) => e.click()); await p.waitForTimeout(800);
  await p.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  // п. 42 (решение Ксении, 23.11): child categories as links under the title; the «Категория»
  // filter that repeated them is gone (п. 37: one way of the same choice).
  const subs = await p.$$eval('.category__subcats a', (a) => a.map((x) => [x.textContent.trim(), new URL(x.href).pathname]));
  ok(JSON.stringify(subs) === JSON.stringify([['Натуральный улун', '/category-naturalnyj-ulun'], ['Ароматизированный улун', '/category-aromatizirovannyj-ulun']]), `42: подкатегории ссылками под заголовком ${JSON.stringify(subs)}`);
  ok(await p.evaluate(() => { const h = document.querySelector('.category__title').getBoundingClientRect(); const s = document.querySelector('.category__subcats').getBoundingClientRect(); return s.top > h.bottom && s.top - h.bottom < 40; }) && await p.locator('[data-facet][value^="16__"]').count() === 0, '42: теги сразу под заголовком, группы «Категория» в фильтрах нет');
  ok(await p.evaluate(() => [...document.querySelectorAll('.category__subcat')].every((a) => a.getBoundingClientRect().height >= 40)), '42: теги не ниже 40 px');
  // Ксения, 24.11: the count by the title (not inside the <h1>), tags with a 4 px line only, the
  // sorting heads the filter column — its top on the line of the first tiles (no «лесенка»).
  if ((p.viewportSize() || {}).width >= 1060) {
    const lay = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const tag = getComputedStyle(document.querySelector('.category__subcat')); const line = getComputedStyle(document.querySelector('.category__subcat'), '::before');
      return { inH1: !!document.querySelector('h1 [data-count]'), countRight: r('[data-count]').left > r('.category__title').right, countTop: r('[data-count]').bottom < r('.category__subcats').top,
        sort: r('.category__sort'), facets: r('.facets'), tile: r('.category__grid > li:not([hidden])'),
        tagLine: [tag.borderTopWidth, tag.borderLeftWidth, tag.borderBottomWidth, line.height, line.borderTopLeftRadius !== '0px'].join(' ') };
    });
    ok(!lay.inH1 && lay.countRight && lay.countTop, 'Ксения 24.11: счётчик рядом с заголовком, не внутри <h1>');
    ok(lay.tagLine === '0px 0px 0px 4px true', `подкатегории без рамки, линия снизу 4 px со скруглёнными концами (Ксения 24.11) (${lay.tagLine})`);
    ok(Math.abs(lay.sort.top - lay.tile.top) <= 1 && lay.facets.top > lay.sort.bottom && Math.abs(lay.sort.width - lay.facets.width) <= 1, `Ксения 24.11: сортировка над фильтрами во всю ширину, верх на линии плиток (${Math.round(lay.sort.top)} / ${Math.round(lay.tile.top)})`);
  }
  const gaps = await p.evaluate(() => {
    const bar = document.querySelector('.category__bar').getBoundingClientRect();
    const li = [...document.querySelectorAll('.category__grid > li:not([hidden])')].map((e) => e.getBoundingClientRect());
    const rows = [...new Set(li.map((r) => Math.round(r.top)))];
    const first = li.filter((r) => Math.round(r.top) === rows[0]);
    // per row: do the pack chips share one line, and how much room is left above them
    // under the longest name (≈ the 12 px gap — no reserved empty line)
    const names = rows.map((t) => {
      const tiles = [...document.querySelectorAll('.category__grid > li:not([hidden])')].filter((e) => Math.round(e.getBoundingClientRect().top) === t);
      const packs = tiles.map((e) => Math.round(e.querySelector(".packs__grid").getBoundingClientRect().top));
      const room = Math.min(...tiles.map((e) => e.querySelector(".packs__grid").getBoundingClientRect().top - e.querySelector('.good__name').getBoundingClientRect().bottom));
      return { line: packs.every((y) => y === packs[0]), room: Math.round(room) };
    });
    return { top: Math.round(li[0].top - bar.bottom), row: Math.round(rows[1] - Math.max(...first.map((r) => r.bottom))), names };
  });
  ok(gaps.top <= 17 && gaps.row === 16, `38: сортировка → плитка ${gaps.top} px; между рядами ${gaps.row} px, как на главной (п. 20)`);
  ok(gaps.names.every((r) => r.line && r.room <= 14), `39: название в ряду одной высоты, ряд из однострочных не держит лишнюю строку (${JSON.stringify(gaps.names)})`);
  ok(await p.locator('.category__grid > li:not([hidden])').count() === 12 && await p.evaluate(() => getComputedStyle(document.querySelector('.category__grid')).gridTemplateColumns.split(' ').length) === 3, '17: 12 плиток в 3 колонки — 4 полных ряда');
  await p.locator('.facet', { hasText: 'Тайвань' }).click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Найдено 64 товара' && await shownMatch(p, ['3__Тайвань']), '17: «Тайвань» → 64, все плитки тайваньские');
  ok(new URL(p.url()).searchParams.get('f') === '3__Тайвань', '17: адрес как на сайте — ?f=3__Тайвань');
  ok(await facetCount(p, '57__Габа') === '51' && await facetCount(p, '57__Дун Дин') === '1', '17: счётчики пересчитаны: Габа 51, Дун Дин 1');
  ok(await p.locator('[data-facet][value="57__Да Хун Пао и Жоу Гуй"]').isDisabled(), '17: «Да Хун Пао» дал бы 0 — недоступен');
  await p.locator('.facet', { hasText: 'Габа' }).click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Найдено 51 товар' && new URL(p.url()).searchParams.get('f') === '3__Тайвань___57__Габа', '17: + Габа → 51; f=3__Тайвань___57__Габа');
  await p.locator('.facet', { hasText: 'Дун Дин' }).click(); await p.waitForTimeout(200);
  ok(await countText(p) === 'Найдено 52 товара' && await shownMatch(p, ['3__Тайвань', '57__Габа', '57__Дун Дин']), '17: Габа или Дун Дин внутри группы → 52');
  ok(await p.locator('.chips__chip').count() === 3, '17: три выбранных фильтра чипами над плиткой');
  await p.locator('.chips__chip', { hasText: 'Тайвань' }).click(); await p.waitForTimeout(200);
  ok(!(await p.locator('[data-facet][value="3__Тайвань"]').isChecked()) && await countText(p) === 'Найдено 54 товара', '17: чип снят → отметка снята, Габа + Дун Дин = 54');
  await p.selectOption('[data-sort]', '-effective_price'); await p.waitForTimeout(200);
  await p.locator('[data-pager] [data-page="2"]:not(.pager__link--step)').click(); await p.waitForTimeout(300);
  const q = new URL(p.url()).searchParams;
  ok(q.get('sorting') === '-effective_price' && q.get('start') === '2' && q.get('f') === '57__Габа___57__Дун Дин', '17: фильтры + сортировка + страница в одном адресе');
  await p.locator('.facet', { hasText: 'Вьетнам' }).click(); await p.waitForTimeout(200);
  ok(new URL(p.url()).searchParams.get('start') === null, '17: новый фильтр возвращает на первую страницу');
  await p.goBack(); await p.waitForTimeout(300);
  ok(await countText(p) === 'Найдено 54 товара' && (await p.getAttribute('[data-pager] [aria-current="page"]', 'data-page')) === '2' && !(await p.locator('[data-facet][value="3__Вьетнам"]').isChecked()), '17: «Назад» возвращает прошлый выбор и страницу');
  await p.locator('[data-chips-reset]').click(); await p.waitForTimeout(200);
  ok(await countText(p) === '143 товара' && await p.locator('[data-chips]').isHidden(), '17: «Сбросить все» → 143, чипов нет');
  await c.close();

  // Empty result + reset
  c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(c, 'category-ulun.html?f=57__Женьшень___3__Вьетнам');
  ok(await p.locator('[data-empty]').isVisible() && await p.locator('[data-list]').isHidden() && await p.locator('[data-pager]').isHidden(), '17: пустой результат — «Ничего не нашлось», без плитки и страниц');
  await p.locator('[data-empty-reset]').click(); await p.waitForTimeout(200);
  ok(await countText(p) === '143 товара', '17: «Сбросить фильтры» в пустом состоянии');
  await p.goto(base + 'category-ulun.html?f=3__Нет___57__Габа___3__Тайвань', { waitUntil: 'networkidle' });
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-facets-group]')].map((g) => (g.classList.contains('is-folded') ? 0 : 1) + ':' + g.querySelector('[data-facets-picked]').textContent).join(' ')) === '1:1 0:0 1:1', '45: группы с выбором из адреса открыты, у заголовка — сколько выбрано; остальные свёрнуты');
  ok(await countText(p) === 'Найдено 51 товар', '17: неизвестное значение в адресе пропускается, остальное работает (51)');
  await p.goto(base + 'category-ulun.html?f=16__Натуральный', { waitUntil: 'networkidle' });
  ok(await countText(p) === '143 товара', '42: старый адрес с «Категорией» не ломает страницу — показан весь улун');
  await c.close();

  // ---------- Desktop panel: no overlap with counts, no mid-word breaks, stays in view ----------
  for (const [w, h] of [[1060, 768], [1280, 800], [1440, 900]]) {
    c = await b.newContext({ viewport: { width: w, height: h } });
    p = await open(c, 'category-ulun.html?f=3__Тайвань___57__Габа');
    const bad = await p.evaluate(() => [...document.querySelectorAll('.facet')].filter((f) => {
      const l = f.querySelector('.facet__label');
      const n = f.querySelector('[data-facet-count]').getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(l);
      const rects = [...range.getClientRects()];
      const overlap = rects.some((r) => r.right > n.left - 4 && n.width > 0);
      // a word split across lines: some line ends without a space before the next line starts
      const lines = new Set(rects.map((r) => Math.round(r.top))).size;
      const cut = l.scrollWidth > l.clientWidth + 1;
      return overlap || lines > 1 || cut;
    }).map((f) => f.textContent.trim().replace(/\s+/g, ' ')));
    ok(bad.length === 0, `17: ${w} px — каждая подпись в одну строку целиком, не заезжает на цифры ${bad.join(' | ')}`);
    const zeroShown = await p.evaluate(() => [...document.querySelectorAll('.facet.is-off [data-facet-count]')].some((n) => getComputedStyle(n).visibility !== 'hidden'));
    ok(!zeroShown, `17: ${w} px — у недоступных значений нет «0»`);
    if (w === 1440) {
      ok(await p.locator('.facets__clear').isVisible() && !(await p.locator('.facets__clear').isDisabled()), '17: «Сбросить» рядом с заголовком активно, когда что-то выбрано');
      const jump = await p.evaluate(() => {
        const head = document.querySelector('.facets__heading').getBoundingClientRect().top;
        document.querySelector('.facets__clear').disabled = true;
        const after = document.querySelector('.facets__heading').getBoundingClientRect().top;
        document.querySelector('.facets__clear').disabled = false;
        return Math.abs(after - head);
      });
      ok(jump < 1, '17: вкл/выкл «Сбросить» не сдвигает заголовок фильтров');
    }
    // Two points inside the grid's run (below it the panel leaves with the page, as it should).
    const run = await p.evaluate(() => { const l = document.querySelector('.category__layout').getBoundingClientRect(); return { top: l.top + scrollY, bottom: l.bottom + scrollY }; });
    for (const y of [Math.round(run.top + 400), Math.round(run.bottom - h - 40)]) {
      await p.evaluate((y) => scrollTo({ top: y, left: 0, behavior: 'instant' }), y); await p.waitForTimeout(250);
      const r = await p.evaluate(() => { const d = document.querySelector('[data-facets]').getBoundingClientRect(); const m = document.querySelector('[data-masthead]').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, head: m.bottom, h: innerHeight }; });
      ok(r.top >= r.head - 1 && r.bottom <= r.h, `17: ${w}×${h}, прокрутка ${y} — колонка целиком на экране под шапкой (${Math.round(r.top)}–${Math.round(r.bottom)} из ${r.h})`);
    }
    await c.close();
  }

  // ---------- Phone: sheet ----------
  c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p = await open(c, 'category-ulun.html?start=5');
  ok(await p.locator('[data-facets]').isHidden() && await p.locator('[data-facets-open]').isVisible(), '17: телефон — панель скрыта, кнопка «Фильтры» на месте');
  const row = await p.evaluate(() => { const a = document.querySelector('[data-facets-open]').getBoundingClientRect(); const s = document.querySelector('.category__sort').getBoundingClientRect(); return Math.abs(a.top - s.top) < 2; });
  ok(row, '17: «Фильтры» и сортировка в одной строке');
  await p.locator('[data-facets-open]').tap(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('[data-facets]').matches(':modal')), '17: «Фильтры» открывают панель поверх страницы');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-facets-group]')].every((g) => !g.classList.contains('is-folded') && g.querySelector('[data-facets-toggle]').disabled)), '45: телефон — шторка как принята: все группы открыты, заголовки не сворачиваются');
  await p.locator('.facet', { hasText: 'Тайвань' }).tap(); await p.waitForTimeout(200);
  ok((await p.textContent('[data-facets-total]')).trim() === '64 товара', '17: кнопка «Показать 64 товара» — итог до закрытия');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelector('[data-facets]').classList.contains('is-closing')), '17: Esc — лист уезжает вниз (анимация, как у меню)');
  await p.waitForTimeout(400);
  ok(await p.locator('[data-facets]').isHidden() && await p.evaluate(() => document.activeElement?.hasAttribute('data-facets-open')), '17: Esc закрывает, фокус на кнопке «Фильтры»');
  ok((await p.textContent('[data-facets-badge]')).trim() === '1' && await countText(p) === 'Найдено 64 товара', '17: на кнопке «1», в сетке 64');
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
