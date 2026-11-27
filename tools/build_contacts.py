#!/usr/bin/env python3
"""Контакты на демо (п. 31: «Страница контактов на демо: 390 / 768 / 1440; данные с teaboom.ru»).

Разметка — та же, что у контактов v2 на сервере магазина (песочница): <main> снят в tools/account_src/contacts.html.
Данные — с teaboom.ru: на песочнице телефоны-заглушки и нет реквизитов, их подставляем с живой страницы /contact/.
Типографика — как у остальных страниц демо (typeset_html из build_index.py). Форма на демо не отправляется.

Запуск: python3 tools/build_contacts.py  (из корня репозитория).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from build_index import typeset_html  # noqa: E402

# Песочница → teaboom.ru (телефоны склада и офиса).
LIVE = [
    ("+7 (495) 000-11-22", "+7 (495) 120-15-51"),
    ("tel:+74950001122", "tel:+74951201551"),
    ("+7 (495) 000-33-44", "+7 (495) 796-79-74"),
    ("tel:+74950003344", "tel:+74957967974"),
]

# Реквизиты с teaboom.ru/contact/ (на песочнице организации по умолчанию нет).
REQ = """
        <details class="acc-card contacts__req">
          <summary class="address__toggle">Реквизиты ООО «Кассиопея»</summary>
          <dl class="facts">
            <div><dt>ИНН</dt><dd>7707798450</dd></div>
            <div><dt>КПП</dt><dd>771801001</dd></div>
            <div><dt>ОГРН</dt><dd>1137746187996</dd></div>
            <div><dt>Юридический адрес</dt><dd>107014, г. Москва, ул. 1-я Боевская, д. 2/12, стр. 4, пом. 1/1</dd></div>
            <div><dt>Расчётный счёт</dt><dd>40702810900000037250</dd></div>
            <div><dt>Банк</dt><dd>Филиал «Центральный» Банка ВТБ ПАО, г. Москва</dd></div>
            <div><dt>Корр. счёт</dt><dd>30101810145250000411</dd></div>
            <div><dt>БИК</dt><dd>044525411</dd></div>
            <div><dt>ОКПО</dt><dd>17234618</dd></div>
            <div><dt>ОКВЭД</dt><dd>51.70</dd></div>
            <div><dt>Генеральный директор</dt><dd>Дмитриев Антон Юрьевич</dd></div>
          </dl>
        </details>
"""

DEMO_JS = """
<script>
  // Демо: форма не уходит в магазин — проверка полей (forms.js) и строка «Демо: …».
  document.addEventListener("submit", function (e) {
    var form = e.target.closest && e.target.closest("[data-contact-form]");
    if (!form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var bad = null;
    form.querySelectorAll(".field__input").forEach(function (el) {
      var field = el.closest(".field"), box = field && field.querySelector("[data-error]");
      var v = el.value.trim(), msg = "";
      if (!v) msg = el.type === "email" ? "Введите email" : el.tagName === "TEXTAREA" ? "Напишите сообщение" : "Введите имя";
      else if (el.type === "email" && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) msg = "Проверьте email: нужен адрес вида name@mail.ru";
      el.setAttribute("aria-invalid", msg ? "true" : "false");
      if (field) field.classList.toggle("is-invalid", !!msg);
      if (box) { box.textContent = msg; box.hidden = !msg; }
      if (msg && !bad) bad = el;
    });
    var done = form.querySelector("[data-done]");
    if (bad) { bad.focus(); if (done) done.hidden = true; return; }
    done.textContent = "Демо: на сайте сообщение уйдёт в магазин, ответ придёт на " + form.querySelector("#ct-email").value.trim() + ".";
    done.hidden = false;
  }, true);
</script>
"""


def main() -> None:
    shell = (ROOT / "login.html").read_text(encoding="utf-8")
    head, rest = shell.split('<main id="main" tabindex="-1">', 1)
    _, tail = rest.split("</main>", 1)
    head = head.replace(
        '<link rel="stylesheet" href="assets/css/main.css">',
        '<link rel="stylesheet" href="assets/css/main.css">\n  <link rel="stylesheet" href="assets/css/cabinet.css">\n  <link rel="stylesheet" href="assets/css/pages.css">',
        1,
    )
    import re
    head = re.sub(r"<title>[^<]*</title>", "<title>Контакты — интернет-магазин чая «Чайный Бум»</title>", head, 1)
    main = (ROOT / "tools" / "account_src" / "contacts.html").read_text(encoding="utf-8")
    for a, b in LIVE:
        main = main.replace(a, b)
    main = re.sub(r'<script\b[^>]*\bsrc="/static/[^"]*"[^>]*></script>', "", main)
    main = main.replace('action="/lfs_contactcontact?ajax"', 'action="#"')
    main = main.replace('href="/"', 'href="index.html"')
    if "contacts__req" not in main:
        main = main.replace("      </aside>", REQ + "      </aside>", 1)
    tail = tail.replace("</body>", '  <script src="assets/js/contacts.js"></script>' + DEMO_JS + "</body>", 1)
    out = typeset_html(head + main + tail)
    (ROOT / "contacts.html").write_text(out, encoding="utf-8")
    print("built contacts.html")


def build_404() -> None:
    """404 на демо (технические страницы): та же разметка, что на сервере; пути — на страницы демо."""
    import re
    shell = (ROOT / "login.html").read_text(encoding="utf-8")
    head, rest = shell.split('<main id="main" tabindex="-1">', 1)
    _, tail = rest.split("</main>", 1)
    head = head.replace('<link rel="stylesheet" href="assets/css/main.css">',
                        '<link rel="stylesheet" href="assets/css/main.css">\n  <link rel="stylesheet" href="assets/css/pages.css">', 1)
    head = re.sub(r"<title>[^<]*</title>", "<title>Страница не найдена — интернет-магазин чая «Чайный Бум»</title>", head, 1)
    head = re.sub(r'<meta name="robots"[^>]*>', "", head).replace("</head>", '  <meta name="robots" content="noindex">\n</head>', 1)
    main = (ROOT / "tools" / "account_src" / "404.html").read_text(encoding="utf-8")
    for a, b in [('href="/"', 'href="index.html"'), ('href="/category-root"', 'href="category-ulun.html"'),
                 ('href="/shipping/"', 'href="shipping.html"'), ('href="/payment/"', 'href="payment.html"'),
                 ('href="/contact/"', 'href="contacts.html"'), ('href="/category-podarki"', 'href="https://teaboom.ru/category-podarki"'),
                 ('action="/search"', 'action="https://teaboom.ru/search"')]:
        main = main.replace(a, b)
    (ROOT / "page-404.html").write_text(typeset_html(head + main + tail), encoding="utf-8")
    print("built page-404.html")


def build_shop_reviews() -> None:
    """Отзывы о магазине на демо: первая страница отзывов v2 сервера (гостевой вид); дальше — на teaboom.ru."""
    import re
    shell = (ROOT / "login.html").read_text(encoding="utf-8")
    head, rest = shell.split('<main id="main" tabindex="-1">', 1)
    _, tail = rest.split("</main>", 1)
    head = head.replace('<link rel="stylesheet" href="assets/css/main.css">',
                        '<link rel="stylesheet" href="assets/css/main.css">\n  <link rel="stylesheet" href="assets/css/cabinet.css">\n  <link rel="stylesheet" href="assets/css/pages.css">', 1)
    head = re.sub(r"<title>[^<]*</title>", "<title>Отзывы о магазине — интернет-магазин чая «Чайный Бум»</title>", head, 1)
    main = (ROOT / "tools" / "account_src" / "shop-reviews.html").read_text(encoding="utf-8")
    main = re.sub(r'<script\b[^>]*\bsrc="/static/[^"]*"[^>]*></script>', "", main)
    for a, b in [('href="/"', 'href="index.html"'), ('href="/login?next=/shop_reviews/"', 'href="login.html"'),
                 ('href="?start=2"', 'href="https://teaboom.ru/shop_reviews/?start=2"')]:
        main = main.replace(a, b)
    tail = tail.replace("</body>", '  <script src="assets/js/typo.js"></script>\n</body>', 1)  # тексты отзывов — как на сервере
    (ROOT / "shop-reviews.html").write_text(typeset_html(head + main + tail), encoding="utf-8")
    print("built shop-reviews.html")


if __name__ == "__main__":
    main()
    build_404()
    build_shop_reviews()
