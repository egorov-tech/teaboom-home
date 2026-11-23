// 23.11: one search field at a time (Антон, ~1500 px: header + menu bar both showed one) and
// cart rows that keep room for the name at any width (Ксения: 900–999 px, a letter per line).
// BASE=http://127.0.0.1:8890/ node tests/stage4-search-cart.cjs
const { chromium } = require(process.env.PW || '/Users/ghpr/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = process.env.BASE || 'http://127.0.0.1:8890/';
let fails = 0; const ok = (c, n) => { console.log(`${c ? 'PASS' : 'FAIL'} ${n}`); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  // 1. Never two search fields visible
  for (const w of [768, 1060, 1280, 1500, 1920]) for (const page of ['index.html', 'password-reset.html', 'product.html?nointro', 'category-ulun.html', 'cart.html']) {
    const c = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await c.newPage();
    await p.goto(base + page, { waitUntil: 'networkidle' });
    const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let bad = null;
    const top = Math.min(max, 700);
    const path = [...Array(Math.floor(top / 10) + 1).keys()].map((i) => i * 10);
    for (const y of [...path, ...path.slice().reverse()]) {
      await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(60);
      const both = await p.evaluate(() => {
        const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || r.width < 40) return false; const top = document.querySelector('[data-masthead]').getBoundingClientRect().bottom; return r.bottom > top + 4 && r.top < innerHeight; };
        const quick = document.querySelector('.quick__search'); const qr = quick.getBoundingClientRect(); const qcs = getComputedStyle(quick);
        const quickVis = qr.width > 40 && qcs.visibility !== 'hidden' && +qcs.opacity > 0 && qcs.display !== 'none';
        return quickVis && vis(document.querySelector('.search'));
      });
      if (both) { bad = y; break; }
    }
    ok(bad === null, `${w} ${page}: одно поле поиска при прокрутке вниз и вверх${bad !== null ? ' — оба видны на y=' + bad : ''}`);
    await c.close();
  }
  // 2. Cart with 6 items: name never narrower than 120px
  const items = [['ananasovij-ulun','Ананасовый улун, 100 г'],['ulun-kola','Улун Кола, 100 г'],['ulun-medovaya-dynya','Улун Медовая Дыня, 250 г'],['molochnyj-ulun-tajvani-1','Молочный улун Тайвань высшей категории, 500 г'],['a','Те Гуань Инь классический, 50 г'],['b','Да Хун Пао, 100 г']].map(([s,n],i)=>({sku:'s'+i,name:n,pack:'100 г',price:326.4*(i+1),img:'assets/images/products/ananasovij-ulun-280.jpg',url:'product.html',qty:i+1}));
  for (const w of [320, 390, 760, 768, 899, 900, 972, 1000, 1059, 1060, 1280, 1440]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 } });
    await c.addInitScript((it) => localStorage.setItem('teaboom-demo-cart-v2', JSON.stringify(it)), items);
    const p = await c.newPage(); await p.goto(base + 'cart.html', { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => ({ n: document.querySelectorAll('.line').length, min: Math.min(...[...document.querySelectorAll('.line__name')].map((e) => e.getBoundingClientRect().width)), info: Math.min(...[...document.querySelectorAll('.line__info')].map((e) => e.getBoundingClientRect().width)), over: document.documentElement.scrollWidth > innerWidth }));
    ok(r.n === 6 && r.info >= (w < 360 ? 90 : 120) && !r.over, `${w} корзина: 6 строк, ширина названия ${Math.round(r.info)} px, без сдвига вбок`);
    await c.close();
  }
  console.log(fails ? `${fails} FAIL` : 'ALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
})();
