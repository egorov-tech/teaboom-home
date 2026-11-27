/* Типографика для текстов из базы магазина (описание, характеристики, отзывы, похожие).
   На демо неразрывные пробелы ставила сборка; здесь тексты приходят из админки как есть,
   поэтому короткое слово привязываем к следующему — строка не кончается на «в», «и», «из»… */
(() => {
  "use strict";
  const SHORT = /(^|[\s («„"—–-])(а|в|и|к|о|с|у|я|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|под|над|при|про|или|что)[ \t\r\n]+(?=\S)/gi;
  const UNIT = /(\d)\s+(₽|г|кг|мл|л|мин|шт|см|°)(?![а-яё])/gi;
  // «г. Мэнхай», «ул. Народного…» — сокращение не остаётся в конце строки.
  const ABBR = /(^|[\s(«])(г\.|д\.|ул\.|стр\.|пос\.|им\.|м\.|пр\.|пер\.)\s+(?=\S)/g;
  const TAIL = /(^|[\s(«„"—–-])(а|в|и|к|о|с|у|я|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|под|над|при|про|или|что)[ \t\r\n]+$/i;
  const tie = (text) => {
    // «а &nbsp;так» из админки: обычный пробел рядом с неразрывным — один неразрывный.
    let out = text.replace(/[ \t]+\u00a0|\u00a0[ \t]+/g, "\u00a0"), prev;
    do { prev = out; out = out.replace(SHORT, "$1$2 "); } while (out !== prev);
    out = out.replace(UNIT, "$1\u00a0$2").replace(ABBR, "$1$2\u00a0");
    // «45 000» — разряды числа не разрываются.
    out = out.replace(/(\d) (\d{3})(?!\d)/g, "$1\u00a0$2");
    // Короткое слово в конце узла, а следующее — в другом теге («с <b>головой</b>»).
    return out.replace(TAIL, "$1$2\u00a0");
  };
  const roots = document.querySelectorAll(".info, .contacts, .prose, .specs, .review__text, .seen__name, .product__title, .breadcrumbs, .more__title, .footer, .good__name, .cats__name, .about, .perks");
  roots.forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const next = tie(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  });
})();
