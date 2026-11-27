/* Кабинет на демо: те же действия, что на сервере (cabinet-srv.js подключён рядом), но без сервера —
   «Повторить заказ», ♡, «В корзину», «Удалить адрес», сохранение форм показывают, что произойдёт на сайте. */
(() => {
  "use strict";
  const text = (m) => String(m || "").trim();
const ICONS = {
    info: '<circle cx="10" cy="10" r="7.25"/><path d="M10 9v4.5M10 6.5v.01"/>',
    success: '<circle cx="10" cy="10" r="7.25"/><path d="m6.75 10.25 2.25 2.25 4.25-4.5"/>',
    error: '<circle cx="10" cy="10" r="7.25"/><path d="M10 6.25v4.5M10 13.5v.01"/>',
  };
  let stack = null;
  const toast = (message, { level = "info", life } = {}) => {
    const msg = text(message);
    if (!msg) return null;
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toasts";
      document.body.append(stack);
    }
    // Одно и то же дважды подряд не складываем.
    const last = stack.lastElementChild;
    if (last && last.dataset.msg === msg) return last;
    const el = document.createElement("div");
    el.className = `toast toast--${level}`;
    el.dataset.msg = msg;
    el.setAttribute("role", level === "error" ? "alert" : "status");
    el.innerHTML = `<svg class="toast__icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[level] || ICONS.info}</svg><p class="toast__text"></p><button class="toast__close press" type="button" aria-label="Закрыть сообщение"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m5 5 10 10M15 5 5 15"/></svg></button>`;
    el.querySelector(".toast__text").textContent = msg;
    const close = () => {
      if (el.classList.contains("is-leaving")) return;
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector(".toast__close").addEventListener("click", close);
    stack.append(el);
    let timer = setTimeout(close, life || (level === "error" ? 8000 : 5000));
    // Пока на сообщении курсор или фокус — не исчезает.
    el.addEventListener("mouseenter", () => clearTimeout(timer));
    el.addEventListener("focusin", () => clearTimeout(timer));
    el.addEventListener("mouseleave", () => { timer = setTimeout(close, 3000); });
    return el;
  };
  window.TeaboomToast = toast;

  const root = document.querySelector("[data-cabinet]");
  if (!root) return;
  const say = (msg) => toast(msg, { level: "info" });

  // Действия, которым нужен сервер: перехватываем раньше cabinet-srv.js (фаза захвата).
  root.addEventListener("click", (e) => {
    const t = e.target;
    let msg = "";
    if (t.closest("[data-reorder]")) msg = "Демо: на сайте товары этого заказа лягут в корзину, и откроется корзина.";
    else if (t.closest("[data-add], [data-step]")) msg = "Демо: на сайте здесь товар добавится в корзину или изменится количество.";
    else if (t.closest("[data-fav]")) msg = "Демо: на сайте ♡ уберёт товар из избранного.";
    else if (t.closest(".order__actions a.cta")) msg = "Демо: на сайте здесь откроется оплата заказа.";
    else if (t.closest("#webpush-subscribe-button, .acc-legacy a[href*='confirm']")) msg = "Демо: на сайте здесь подключатся уведомления.";
    if (!msg) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    say(msg);
  }, true);

  // Формы: forms.js проверяет поля; верная форма — сообщение вместо отправки.
  const DONE = {
    profile: "Демо: на сайте данные сохранятся — «Данные профиля сохранены».",
    password: "Демо: на сайте пароль сменится — «Пароль изменён».",
    email: "Демо: на сайте email сменится, и вход будет по новому адресу.",
  };
  // Фаза захвата: раньше обработчиков cabinet.js (подтверждение удаления) и forms.js (проверка полей).
  document.addEventListener("submit", (e) => {
    const form = e.target.closest?.(".acc form");
    if (!form) return;
    e.preventDefault();
    if (form.matches("[data-confirm]")) {
      if (form.dataset.armed) { form.closest("[data-addr]")?.remove(); say("Демо: на сайте адрес удалится."); }
      return; // первое нажатие — cabinet.js покажет «Точно удалить?»
    }
    setTimeout(() => {
      if (form.querySelector(".is-invalid, [aria-invalid=true]")) return;
      const btn = form.querySelector("[type=submit]");
      if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); if (btn.dataset.label) btn.textContent = btn.dataset.label; }
      say(DONE[form.dataset.form] || "Демо: на сайте здесь сохранятся изменения.");
    }, 0);
  }, true);
})();
