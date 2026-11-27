/* Личный кабинет v2 поверх их view (lfs/v2/customer/*):
   — «Повторить заказ»: товары заказа в корзину их диспетчером (тот же запрос, что «В корзину»), потом — корзина;
   — удалить адрес: второе нажатие подтверждает («Точно удалить?»), без системного окна;
   — избранное: снятое ♡ убирает плитку со страницы (на сервере — их fav-srv), пусто → подсказка;
   — лента разделов на телефоне показывает текущий раздел; короткие слова не висят в конце строк. */
(() => {
  "use strict";

  const root = document.querySelector("[data-cabinet]");
  if (!root) return;

  const toast = (msg, level) => window.TeaboomToast?.(msg, { level });
  const csrf = () => window.csrftoken || (document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || "";

  // ---------- Переносы: «в», «и», «с»… не остаются в конце строки (как typo.js на остальных страницах) ----------
  const SHORT = /(^|[\s («„"—–-])(а|в|и|к|о|с|у|я|во|до|за|из|ко|на|не|ни|но|об|от|по|со|без|для|под|над|при|про|или|что)[ \t\r\n]+(?=\S)/gi;
  const ABBR = /(^|[\s(«])(г\.|д\.|ул\.|стр\.|пос\.|им\.|пр\.|пер\.)\s+(?=\S)/g;
  const walker = document.createTreeWalker(root.querySelector(".acc__main") || root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("script, style, textarea, option") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let out = node.nodeValue, prev;
    do { prev = out; out = out.replace(SHORT, "$1$2 "); } while (out !== prev);
    out = out.replace(ABBR, "$1$2\u00a0");
    if (out !== node.nodeValue) node.nodeValue = out;
  }

  // ---------- Их разделы (подписки, юрлица): тексты в голосе сайта ----------
  const legacy = root.querySelector(".acc-legacy");
  if (legacy) {
    legacy.querySelectorAll("label").forEach((l) => {
      const last = [...l.childNodes].reverse().find((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (last) last.nodeValue = last.nodeValue.replace(/:\s*$/, "");
    });
    legacy.querySelectorAll("h5, p, label").forEach((el) => {
      el.childNodes.forEach((n) => { if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(/"([^"]+)"/g, "«$1»"); });
    });
    legacy.querySelectorAll("h5").forEach((h) => {
      const t = h.textContent.trim();
      if (/^Форма выбора юрлиц/.test(t)) {
        // Список их юрлиц: заголовок по-человечески; нет ни одного — блок не нужен.
        const box = h.closest(".ee-product-list");
        const wrap = box?.querySelector(".companies_wrap");
        if (wrap && !wrap.querySelector("input, select, li, tr, a")) box.hidden = true;
        else h.textContent = "Ваши юридические лица";
      }
      if (/^Webpush/i.test(t)) h.textContent = "Уведомления в браузере";
      if (/^Совет!?$/.test(t)) h.remove();
    });
  }

  // ---------- Лента разделов (узкий экран): текущий раздел на виду ----------
  const current = root.querySelector(".acc__link.is-current");
  const menu = root.querySelector(".acc__menu");
  if (current && menu && menu.scrollWidth > menu.clientWidth) {
    const left = current.offsetLeft - (menu.clientWidth - current.offsetWidth) / 2;
    menu.scrollTo({ left: Math.max(0, left), behavior: "instant" });
  }

  // ---------- «Повторить заказ» ----------
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-reorder]");
    if (!button || button.classList.contains("is-busy")) return;
    const items = [...(button.nextElementSibling?.querySelectorAll("[data-reorder-item]") || [])]
      .map((i) => ({ id: i.dataset.id, qty: Math.max(1, Math.round(parseFloat(i.dataset.qty) || 1)) }));
    if (!items.length) { toast("Этих товаров больше нет в каталоге.", "error"); return; }
    button.classList.add("is-busy");
    button.setAttribute("aria-busy", "true");
    button.style.minWidth = `${button.offsetWidth}px`;
    const label = button.textContent;
    button.textContent = "Добавляем…";
    let added = 0;
    for (const it of items) {
      const body = new URLSearchParams({ product_id: it.id, quantity: String(it.qty), "add-to-cart": "1" });
      try {
        const res = await fetch("/product-form-dispatcher?ajax", {
          method: "POST", body, credentials: "same-origin",
          headers: { "X-CSRFToken": csrf(), "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" },
        });
        const data = await res.json().catch(() => ({}));
        // Их ответ: product_amount — сколько теперь в корзине; ошибка наличия — без него.
        if (res.ok && data.product_amount !== undefined && data.product_amount !== null && data.product_amount !== "") added += 1;
      } catch (e) { /* сеть — следующий товар */ }
    }
    if (added) {
      if (added < items.length) {
        toast(`Добавили ${added} из ${items.length}: остальных сейчас нет в наличии.`, "info");
        setTimeout(() => { location.href = "/cart"; }, 1600);
      } else {
        location.href = "/cart";
      }
      return;
    }
    button.classList.remove("is-busy");
    button.removeAttribute("aria-busy");
    button.textContent = label;
    toast("Товаров из этого заказа сейчас нет в наличии.", "error");
  });

  // ---------- Удалить адрес: подтверждение вторым нажатием ----------
  root.querySelectorAll("form[data-confirm]").forEach((form) => {
    const button = form.querySelector("[type=submit]");
    if (!button) return;
    const label = button.textContent;
    let timer = 0;
    const reset = () => { button.classList.remove("is-confirm"); button.textContent = label; delete form.dataset.armed; };
    form.addEventListener("submit", (e) => {
      if (form.dataset.armed) { form.closest("[data-addr]")?.classList.add("is-removing"); return; }
      e.preventDefault();
      form.dataset.armed = "1";
      button.classList.add("is-confirm");
      button.textContent = "Точно удалить?";
      clearTimeout(timer);
      timer = setTimeout(reset, 4000);
    });
    button.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== button) reset(); }, 150));
  });

  // ---------- Избранное: снятое ♡ убирает плитку ----------
  const favs = root.querySelector("[data-favs]");
  if (favs) {
    // Только после нажатия покупателя и только «было в избранном → убрали»: при загрузке их fav-srv
    // сначала рисует ♡ пустыми (список ещё не пришёл) — это не снятие.
    let clickedAt = 0;
    favs.addEventListener("click", (e) => { if (e.target.closest("[data-fav]")) clickedAt = Date.now(); }, true);
    new MutationObserver((records) => {
      records.forEach((r) => {
        const b = r.target;
        if (r.attributeName !== "aria-pressed" || !b.matches?.("[data-fav]") || b.getAttribute("aria-pressed") !== "false") return;
        if (r.oldValue !== "true" || Date.now() - clickedAt > 5000) return;
        const li = b.closest("li");
        if (!li || li.parentElement !== favs) return;
        li.style.transition = "opacity .2s";
        li.style.opacity = "0";
        setTimeout(() => {
          li.remove();
          if (!favs.children.length) {
            favs.hidden = true;
            const empty = root.querySelector("[data-favs-empty]");
            if (empty) empty.hidden = false;
          }
        }, 220);
      });
    }).observe(favs, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["aria-pressed"] });
  }
})();

