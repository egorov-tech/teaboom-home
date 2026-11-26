/* Избранное в демо. На сайте — их готовый список (ap_product_lists, только после входа); здесь —
   localStorage, чтобы команда могла пройти сценарий: сердечко на плитке и в карточке, счётчик
   в шапке. ?guest — показать, что увидит гость: подсказку «Войдите…» вместо сохранения. */
(() => {
  "use strict";

  const KEY = "teaboom-fav-v1";
  const guest = new URLSearchParams(location.search).has("guest");
  const LOGIN = "login.html";

  const read = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list.filter((x) => typeof x === "string" && x) : [];
    } catch (e) {
      return [];
    }
  };
  const write = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) { /* приватный режим: без памяти */ }
  };

  const paint = () => {
    const list = read();
    const set = new Set(list);
    document.querySelectorAll("[data-fav]").forEach((button) => {
      const on = set.has(button.dataset.fav);
      button.setAttribute("aria-pressed", String(on));
      const name = button.dataset.favName || "товар";
      button.setAttribute("aria-label", on ? `Убрать из избранного: ${name}` : `Добавить в избранное: ${name}`);
    });
    document.querySelectorAll("[data-fav-link]").forEach((link) => {
      const count = link.querySelector("[data-fav-count]");
      if (count) count.textContent = String(list.length);
      link.classList.toggle("is-filled", list.length > 0);
      link.setAttribute("aria-label", list.length ? `Избранное, товаров: ${list.length}` : "Избранное");
    });
  };

  // Подсказка гостю — одна на страницу, у нажатой кнопки; закрывается кликом мимо и Esc.
  let hint = null;
  const closeHint = () => {
    if (hint) hint.hidden = true;
  };
  const showHint = (button) => {
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "fav-hint";
      hint.setAttribute("role", "status");
      hint.innerHTML = `Войдите, чтобы сохранять избранное. <a href="${LOGIN}">Войти</a>`;
      document.body.append(hint);
    }
    const box = button.getBoundingClientRect();
    hint.hidden = false;
    const width = hint.offsetWidth;
    const left = Math.min(Math.max(16, box.right - width), document.documentElement.clientWidth - width - 16);
    hint.style.left = `${left + scrollX}px`;
    hint.style.top = `${box.bottom + scrollY + 10}px`;
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fav]");
    if (!button) {
      if (hint && !event.target.closest(".fav-hint")) closeHint();
      return;
    }
    event.preventDefault();
    if (guest) {
      showHint(button);
      return;
    }
    const slug = button.dataset.fav;
    const list = read();
    const i = list.indexOf(slug);
    if (i === -1) list.unshift(slug);
    else list.splice(i, 1);
    write(list);
    paint();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeHint();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) paint();
  });

  paint();
})();
