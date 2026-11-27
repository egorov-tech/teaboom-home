/* Контакты на демо (часть contacts-srv.js сервера: часы, пометки, карта по нажатию; форма — в contacts.html).
   Контакты v2: «Написать нам» — их форма связи /lfs_contactcontact?ajax (ответ JSON с текстом), как
   «Не пришло письмо?» на сбросе пароля. Ошибки полей — forms-srv.js; итог — строкой под кнопкой и тостом. */
(() => {
  "use strict";
  // Часы из админки («Пн - Пт: 10:00 - 19:00 Сб - Вс: …», «пн - пт с 10:00 до 19:00сб - вс …») — как в шапке сайта:
  // дни строчными, тире без пробелов, выходные с новой строки.
  document.querySelectorAll(".place [data-hours]").forEach((dd) => {
    let t = dd.textContent.replace(/\s+/g, " ").trim();
    t = t.replace(/(пн|вт|ср|чт|пт|сб|вс)\s*-\s*(пн|вт|ср|чт|пт|сб|вс)/gi, (m, a, b) => `${a.toLowerCase()}–${b.toLowerCase()}`);
    t = t.replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, "$1–$2");
    const parts = t.split(/\s*(?=(?:сб|вс)–)/);
    dd.textContent = "";
    parts.forEach((part, i) => { if (i) dd.append(document.createElement("br")); dd.append(part.trim()); });
  });

  // Пометки из админки начинаются с пробела — первая строка не должна съезжать.
  document.querySelectorAll(".place__note").forEach((note) => {
    const w = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
    const first = w.nextNode();
    if (first) first.nodeValue = first.nodeValue.replace(/^[\s\u00a0]+/, "");
  });

  // Карта — по нажатию (их cookie только после действия покупателя).
  // Реквизиты: «Скопировать реквизиты» — текстом «Подпись: значение» по группам (28.11).
  document.querySelectorAll("[data-req]").forEach((box) => {
    const btn = box.querySelector("[data-req-copy]"), done = box.querySelector("[data-req-done]");
    btn?.addEventListener("click", async () => {
      const text = [...box.querySelectorAll(".contacts__req-group")].map((g) =>
        [...g.querySelectorAll(".facts > div")].map((r) => r.querySelector("dt").textContent.trim() + ": " + r.querySelector("dd").textContent.trim()).join("\n")).join("\n\n");
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.append(t); t.select(); try { ok = document.execCommand("copy"); } catch (e2) { ok = false; } t.remove();
      }
      if (done) { done.textContent = ok ? "Реквизиты скопированы — можно вставить в письмо или платёжку." : "Не удалось скопировать — выделите текст вручную."; done.hidden = false; }
      btn.textContent = ok ? "Скопировано" : "Скопировать реквизиты";
      window.setTimeout(() => { btn.textContent = "Скопировать реквизиты"; }, 2500);
    });
  });

  // Своя статичная карта не открылась — показываем прежнюю кнопку живой карты.
  document.querySelectorAll("[data-map-static] img").forEach((img) => {
    const fail = () => { const box = img.closest("[data-map-src]"); img.closest("[data-map-static]").remove(); box.querySelector("[data-map-show]").hidden = false; };
    if (img.complete && !img.naturalWidth) fail(); else img.addEventListener("error", fail, { once: true });
  });
  document.querySelectorAll("[data-map-show]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const box = btn.closest("[data-map-src]");
      const f = document.createElement("iframe");
      f.src = box.dataset.mapSrc; f.title = box.dataset.mapTitle || "Карта"; f.allowFullscreen = true;
      box.replaceChildren(f);
      f.focus({ preventScroll: true });
    });
  });

})();
