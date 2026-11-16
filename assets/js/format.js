/* One price format for every page (and the same as tools/build_index.py money()):
   326,40 ₽ · 6 320 ₽ — group and currency separated by a no-break space. */
(() => {
  "use strict";

  const whole = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const cents = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const money = (value) => {
    const amount = Math.round(value * 100) / 100;
    return `${(Number.isInteger(amount) ? whole : cents).format(amount)} ₽`;
  };

  window.TeaboomFormat = { money, whole: (value) => whole.format(value) };
})();
