// Избранное (26.11): шапка — та же кнопка, что корзина; плитка — сердечко в строке артикула,
// не на фото; карточка — квадрат рядом с «В корзину»; ?guest — подсказка «Войдите…».
// BASE=http://127.0.0.1:8890/ node tests/fav.cjs
const { chromium } = require('/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const box = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom }; }, s);

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  for (const w of [1440, 390]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 760, hasTouch: w < 760 });
    const p = await c.newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + 'category-ulun.html', { waitUntil: 'networkidle' });

    const fav = await box(p, '[data-fav-link]'); const cart = await box(p, '[data-cart]');
    ok(fav && cart && Math.abs(fav.h - cart.h) < 1 && Math.abs(fav.y - cart.y) < 1, `${w}: сердечко в шапке одной высоты и на одной линии с корзиной`);

    const heart = await box(p, '.good .fav--tile'); const media = await box(p, '.good .good__media');
    ok(heart && media && heart.y >= media.b - 1, `${w}: сердечко на плитке под фото, не на нём`);
    ok(heart && heart.w >= 40 && heart.h >= 40, `${w}: зона нажатия сердечка на плитке ≥ 40×40`);

    await p.locator('.good .fav--tile').first().click();
    const slug = await p.locator('.good .fav--tile').first().getAttribute('data-fav');
    const st = await p.evaluate(() => ({ pressed: document.querySelector('.good .fav--tile').getAttribute('aria-pressed'), count: document.querySelector('[data-fav-count]').textContent, filled: document.querySelector('[data-fav-link]').classList.contains('is-filled') }));
    ok(st.pressed === 'true' && st.count === '1' && st.filled, `${w}: нажатие — в избранном, счётчик 1`);
    await p.locator('.good .fav--tile').first().click();
    ok(await p.evaluate(() => document.querySelector('[data-fav-count]').textContent) === '0', `${w}: повторное нажатие убирает`);

    // Карточка: тот же список; кнопка вровень с «В корзину».
    await p.evaluate((s) => localStorage.setItem('teaboom-fav-v1', JSON.stringify([s])), 'ananasovij-ulun');
    await p.goto(base + 'product.html', { waitUntil: 'networkidle' });
    await p.locator('[data-buy-slot]').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -200)); await p.waitForTimeout(300);
    const cta = await box(p, '.buy__row .cta'); const pdp = await box(p, '.fav--pdp');
    ok(cta && pdp && Math.abs(cta.h - pdp.h) < 1 && Math.abs(cta.y - pdp.y) < 1 && Math.abs(pdp.w - pdp.h) < 1, `${w}: в карточке квадрат вровень с «В корзину»`);
    ok(await p.evaluate(() => document.querySelector('.fav--pdp').getAttribute('aria-pressed')) === 'true', `${w}: отмеченный товар отмечен и в карточке`);
    if (w < 760) {
      await p.evaluate(() => scrollTo(0, document.body.scrollHeight / 2)); await p.waitForTimeout(400);
      const pinned = await p.evaluate(() => document.querySelector('[data-buy-action]').classList.contains('is-pinned'));
      ok(pinned && !(await box(p, '.fav--pdp')), `${w}: в закреплённой панели сердечка нет`);
    }

    // Гость.
    await p.evaluate(() => localStorage.removeItem('teaboom-fav-v1'));
    await p.goto(base + 'product.html?guest', { waitUntil: 'networkidle' });
    await p.locator('[data-buy-slot]').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -200));
    await p.locator('.fav--pdp').click(); await p.waitForTimeout(200);
    const hint = await box(p, '.fav-hint');
    ok(hint && hint.x >= 0 && hint.x + hint.w <= w && await p.evaluate(() => document.querySelector('[data-fav-count]').textContent) === '0', `${w}: гость — подсказка в пределах экрана, ничего не сохранено`);
    await p.keyboard.press('Escape');
    ok(!(await box(p, '.fav-hint')), `${w}: Esc закрывает подсказку`);
    ok(errors.length === 0, `${w}: без ошибок JS ${errors.join('; ')}`);
    await c.close();
  }
  await b.close();
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  process.exitCode = fails ? 1 : 0;
})();
