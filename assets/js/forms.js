/* Forms shared by login, password reset, cart coupon (and later checkout / account):
   tabs ([data-switch]), show-password ([data-peek]), inline validation, demo submit.
   On the shop the forms post to the same addresses as teaboom.ru; the demo has no backend,
   so a valid submit only says what the shop does next. */
(() => {
  // ---------- Tabs: «Быстрый вход / Авторизация / Регистрация» ----------
  document.querySelectorAll("[data-switch]").forEach((list) => {
    const tabs = [...list.querySelectorAll("[data-switch-tab]")];
    const pane = (key) => document.querySelector(`[data-switch-pane="${key}"]`);

    const show = (tab, focus = false) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const p = pane(t.dataset.switchTab);
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => {
        show(tab);
        history.replaceState(null, "", `#${tab.dataset.switchTab}`);
      });
      tab.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        let next = null;
        if (step) next = tabs[(i + step + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        show(next, true);
      });
    });

    // login.html#register opens the right tab (links from the header, checkout, etc.).
    // Without JS all forms stay on the page one under another; with JS — tabs.
    list.hidden = false;
    const fromHash = () => {
      const tab = tabs.find((t) => `#${t.dataset.switchTab}` === location.hash);
      if (tab) show(tab);
    };
    show(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
    fromHash();
    window.addEventListener("hashchange", fromHash);
  });

  // ---------- Show / hide password ----------
  document.querySelectorAll("[data-peek]").forEach((btn) => {
    const input = btn.parentElement.querySelector("input");
    btn.addEventListener("click", () => {
      const open = input.type === "password";
      input.type = open ? "text" : "password";
      btn.setAttribute("aria-pressed", String(open));
      btn.setAttribute("aria-label", open ? "Скрыть пароль" : "Показать пароль");
    });
  });

  // ---------- Validation ----------
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const problem = (input) => {
    const v = input.value.trim();
    if (input.required && !v) {
      if (input.type === "email" || input.autocomplete === "username") return "Введите email";
      if (input.type === "password" || input.dataset.sameAs) return "Введите пароль";
      return "Заполните поле";
    }
    if (v && (input.type === "email" || input.autocomplete === "username") && !EMAIL.test(v)) {
      return "Проверьте email: нужен адрес вида name@mail.ru";
    }
    if (input.dataset.sameAs) {
      const other = document.getElementById(input.dataset.sameAs);
      if (other && v && v !== other.value) return "Пароли не совпадают";
    }
    return "";
  };

  const mark = (input, text) => {
    const field = input.closest(".field");
    const box = field?.querySelector("[data-error]");
    input.setAttribute("aria-invalid", text ? "true" : "false");
    field?.classList.toggle("is-invalid", Boolean(text));
    if (box) {
      box.textContent = text;
      box.hidden = !text;
    }
  };

  const DONE = {
    link: (f) => `Демо: на сайте сюда отправится письмо со ссылкой для входа — ${f.email.value.trim()}.`,
    login: () => "Демо: на сайте здесь выполнится вход и откроется личный кабинет.",
    register: () => "Демо: на сайте здесь создастся учётная запись и выполнится вход.",
    reset: (f) => `Демо: на сайте сюда отправится письмо со ссылкой для смены пароля — ${f.email.value.trim()}.`,
  };

  document.querySelectorAll("form[data-form]").forEach((form) => {
    const inputs = [...form.querySelectorAll(".field__input")];
    const done = form.querySelector("[data-done]");

    // Errors appear after the first try, then follow the typing.
    inputs.forEach((input) => {
      input.addEventListener("blur", () => {
        if (input.value.trim() || form.dataset.tried) mark(input, problem(input));
      });
      input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") === "true") mark(input, problem(input));
        if (done) done.hidden = true;
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.dataset.tried = "1";
      let first = null;
      inputs.forEach((input) => {
        const text = problem(input);
        mark(input, text);
        if (text && !first) first = input;
      });
      if (first) {
        first.focus();
        return;
      }
      if (done) {
        done.textContent = (DONE[form.dataset.form] || (() => "Демо: форма заполнена верно."))(form);
        done.hidden = false;
      }
    });
  });
})();
