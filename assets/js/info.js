/* Текст из админки (статьи, вакансии, описания способов доставки и оплаты) приходит как есть:
   пустые <p></p>, <h2></h2>, переносы <br> в начале и конце заголовков, по три <br> подряд.
   Чистим только показ — данные в админке не трогаем. Без скрипта текст тоже читается. */
(() => {
  "use strict";

  const isBlank = (el) => !el.textContent.replace(/[\s ​]/g, "") && !el.querySelector("img, iframe, video, table, hr");

  document.querySelectorAll(".info-body").forEach((body) => {
    // Пустые абзацы, заголовки, ячейки-обёртки.
    body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, span, div").forEach((el) => {
      if (isBlank(el)) el.remove();
    });

    // <br> в начале и в конце блока и больше одного подряд.
    [body, ...body.querySelectorAll("p, h2, h3, h4, li, div, span")].forEach((el) => {
      const trim = (pick) => {
        let node = pick(el);
        while (node && ((node.nodeType === 3 && !node.nodeValue.trim()) || node.nodeName === "BR")) {
          const next = pick === first ? node.nextSibling : node.previousSibling;
          node.remove();
          node = next;
        }
      };
      const first = (e) => e.firstChild;
      const last = (e) => e.lastChild;
      trim(first);
      trim(last);
      // Повтор переноса — только если между ними одни пробелы (CSS «br + br» видит и пару с текстом).
      el.querySelectorAll("br").forEach((br) => {
        let prev = br.previousSibling;
        while (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev = prev.previousSibling;
        if (prev && prev.nodeName === "BR") br.remove();
      });
    });

    // Короткое слово — к следующему (как typo.js на сервере): текст из админки без неразрывных
    // пробелов, а «&nbsp;и может» сборочный типограф не ловит.
    const SHORT = /(^|[\s(«„"—–-])(а|в|и|к|о|с|у|я|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|под|над|при|про|или|что)[ \t\r\n]+(?=\S)/gi;
    const TAIL = /(^|[\s(«„"—–-])(а|в|и|к|о|с|у|я|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|под|над|при|про|или|что)[ \t\r\n]+$/i;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let out = node.nodeValue, prev;
      do { prev = out; out = out.replace(SHORT, "$1$2\u00a0"); } while (out !== prev);
      out = out.replace(TAIL, "$1$2\u00a0");
      if (out !== node.nodeValue) node.nodeValue = out;
    }

    // Таблицы — в прокрутку, чтобы страница не становилась шире экрана.
    body.querySelectorAll("table").forEach((table) => {
      if (table.parentElement.classList.contains("info-table")) return;
      const wrap = document.createElement("div");
      wrap.className = "info-table";
      table.before(wrap);
      wrap.append(table);
    });
  });
})();
