#!/usr/bin/env python3
"""Личный кабинет на демо (п. 28 таблицы: «Кабинет на демо: 390 / 768 / 1440; все разделы»).

Источник — тот же кабинет v2, что на сервере магазина (песочница, cookie tb_v2): содержимое <main>
каждой страницы снято в tools/account_src/*.html (без csrf и с демо-данными вместо тестовой учётки).
Оболочка (шапка, подвал, нижняя панель, скрипты) — из login.html, как у остальных страниц демо.

Что меняется для демо:
  — ссылки кабинета /my-* → account-*.html, товары → product.html, каталог → category-ulun.html;
  — картинки товаров с сервера → assets/images/products/ (ананасовый улун);
  — формы не отправляются: forms.js демо показывает «Демо: …» (как на странице входа);
  — «Повторить заказ», «Удалить адрес», ♡ в избранном — показ поведения (assets/js/account.js).

Запуск: python3 tools/build_account.py  (из корня репозитория).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "account_src"

PAGES = {
    "account": "Личный кабинет",
    "account-orders": "Вы заказывали",
    "account-order": "Заказ № 1",
    "account-favorites": "Избранное",
    "account-companies": "Юридические лица",
    "account-addresses": "Адреса и телефоны",
    "account-subscriptions": "Подписки",
    "account-email": "Смена email",
    "account-password": "Смена пароля",
}

LINKS = [
    (r'href="/my-account"', 'href="account.html"'),
    (r'href="/my-orders"', 'href="account-orders.html"'),
    (r'href="/my-order/\d+"', 'href="account-order.html"'),
    (r'href="/my-favorite-products"', 'href="account-favorites.html"'),
    (r'href="/company/"', 'href="account-companies.html"'),
    (r'href="/my-addresses"', 'href="account-addresses.html"'),
    (r'href="/my-subscriptions/"', 'href="account-subscriptions.html"'),
    (r'href="/my-email"', 'href="account-email.html"'),
    (r'href="/my-password"', 'href="account-password.html"'),
    (r'href="/logout"', 'href="login.html"'),
    (r'href="/password-reset/"', 'href="password-reset.html"'),
    (r'href="/category-root"', 'href="category-ulun.html"'),
    (r'href="/product/[^"]+"', 'href="product.html"'),
    (r'href="/cart"', 'href="cart.html"'),
    (r'href="/"', 'href="index.html"'),
]

# Тестовая учётка песочницы → явно демонстрационные данные.
DEMO = [
    ("qa.teaboom.v2@example.com", "anna@example.com"),
    ("Тест Проверка", "Анна Смирнова"),
    ('value="Тест"', 'value="Анна"'),
    ('value="Проверка"', 'value="Смирнова"'),
    ("+7 (790) 000-00-00", "+7 (900) 123-45-67"),
    ("+7 (900) 000-00-00", "+7 (900) 123-45-67"),
    ("ТЕСТ v2 — не обрабатывать", "Позвоните за час до визита"),
]


def sanitize(html: str) -> str:
    html = re.sub(r'<input[^>]*name="csrfmiddlewaretoken"[^>]*>', "", html)
    for a, b in DEMO:
        html = html.replace(a, b)
    return html


def demoize(html: str) -> str:
    for pat, rep in LINKS:
        html = re.sub(pat, rep, html)
    # Картинки товаров: на демо — локальный ананасовый улун (единственный товар заказа и избранного).
    html = re.sub(r'src="/media/[^"]+"', 'src="assets/images/products/ananasovij-ulun.jpg"', html)
    html = re.sub(r'src="/static/teaboom_v2/[^"]+"', "", html)
    # Формы: никуда не уходят (forms.js демо пишет «Демо: …»), их скрипты сервера не нужны.
    html = re.sub(r'(<form\b[^>]*?)\saction="[^"]*"', r'\1 action="#"', html)
    html = re.sub(r"<script\b[^>]*\bsrc=\"/static/[^\"]*\"[^>]*></script>", "", html)
    return html


def main() -> None:
    shell = (ROOT / "login.html").read_text(encoding="utf-8")
    head, rest = shell.split('<main id="main" tabindex="-1">', 1)
    _, tail = rest.split("</main>", 1)
    head = head.replace(
        '<link rel="stylesheet" href="assets/css/main.css">',
        '<link rel="stylesheet" href="assets/css/main.css">\n  <link rel="stylesheet" href="assets/css/cabinet.css">',
        1,
    )
    # Кабинет — вход выполнен: в шапке кружок с первой буквой имени и «Кабинет» (как на сайте), не «Войти».
    head = re.sub(r'<a class="account press" href="login\.html" aria-label="Войти">.*?</a>',
                  '<a class="account account--in press" href="account.html" aria-label="Личный кабинет" title="anna@example.com">\n'
                  '          <span class="account__avatar" aria-hidden="true">А</span>\n'
                  '          <span class="account__label">Кабинет</span>\n        </a>', head, count=1, flags=re.S)
    tail = re.sub(r'<a class="dock__item" href="login\.html">.*?</a>',
                  '<a class="dock__item dock__item--in" href="account.html">\n'
                  '    <span class="dock__avatar" aria-hidden="true">А</span>\n'
                  '    <span class="dock__label">Кабинет</span>\n  </a>', tail, count=1, flags=re.S)
    tail = tail.replace("</body>", '  <script src="assets/js/cabinet.js"></script>\n  <script src="assets/js/account.js"></script>\n</body>', 1)
    for name, title in PAGES.items():
        src_path = SRC / f"{name}.html"
        main = sanitize(src_path.read_text(encoding="utf-8"))
        src_path.write_text(main, encoding="utf-8")  # исходник хранится уже без csrf и тестовой учётки
        page_head = re.sub(r"<title>[^<]*</title>", f"<title>{title} — интернет-магазин чая «Чайный Бум»</title>", head, 1)
        page_head = re.sub(r'<meta name="robots"[^>]*>', '<meta name="robots" content="noindex">', page_head)
        (ROOT / f"{name}.html").write_text(page_head + demoize(main) + tail, encoding="utf-8")
        print("built", f"{name}.html")


if __name__ == "__main__":
    main()
