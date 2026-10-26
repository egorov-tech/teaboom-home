"""Builds index.html from tools/index.template.html and data/products.json.

Run from anywhere: python3 tools/build_index.py
Needs Pillow (reads product photo sizes for width/height).
"""
import json, html, pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://teaboom.ru"
products = json.load(open(ROOT / f"data/products.json", encoding="utf-8"))
NB = " "

def esc(s):
    return html.escape(s, quote=True)

def money(v):
    whole = abs(v - round(v)) < 1e-9
    s = f"{v:,.0f}" if whole else f"{v:,.2f}"
    s = s.replace(",", NB).replace(".", ",")
    return f"{s}{NB}₽"

def cut(old, now):
    return int((old - now) * 100 / old + 0.5)

def site(path):
    return path if path.startswith("http") else SITE + path

# ---------- banners (text transcribed from the images, see CONTENT.md) ----------
slides = [
    ("https://t.me/Teaboom", "Подпишитесь на наш канал и будьте в курсе! Telegram-канал Teaboom на экране телефона"),
    ("/shipping/", "Оформите заказ до 14:00 и получите доставку в вечернее время"),
    ("/shipping/#shipping_1", "Бесплатная доставка при заказе на сумму 3500 рублей в пределах МКАД"),
    ("/shipping/#shipping_5", "Самовывоз — бесплатно! Метро Октябрьское Поле и Панфиловская, ул. Народного Ополчения, д. 47"),
    ("/search?q=габа", "Оригинальный габа чай из Тайваня и Вьетнама"),
    ("/search?q=анчан", "Анчан — синий чай из Таиланда. Хит сезона"),
    ("/category-matcha", "Разноцветный матча чай и аксессуары. Хит сезона"),
    ("/search?q=ку%20цяо", "Ку цяо — гречишный чай. Хит сезона"),
    ("/category-travyanoj-chaj", "Полезный чай из душистых трав. Хит сезона"),
    ("/category-posuda-i-aksessuary", "Посуда и аксессуары"),
    ("/category-kofe", "Вкусный кофе"),
    ("/category-sladosti", "Сладости"),
]
n = len(slides)
BANNER_SIZES = "(min-width: 1060px) 820px, (min-width: 600px) calc(100vw - 64px), 88vw"
GOOD_SIZES = "(min-width: 1060px) 260px, (min-width: 600px) 45vw, 104px"
# The site opens on the Telegram banner; the demo opens on a tea (Анчан, "Хит сезона"),
# the rest keep the site's order. Files keep the site's numbering.
order = [6, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]
slide_html = []
for i, src in enumerate(order, 1):
    href, alt = slides[src - 1]
    first = i == 1
    img_attrs = 'fetchpriority="high"' if first else 'loading="lazy" decoding="async"'
    tab = "" if first else ' tabindex="-1"'
    slide_html.append(f'''          <li class="banners__slide" aria-roledescription="слайд" aria-label="{i} из {n}" data-slide>
            <a class="banners__link" href="{esc(site(href))}"{tab}>
              <picture>
                <source srcset="assets/images/banners/slide-{src:02d}-480.webp 480w, assets/images/banners/slide-{src:02d}.webp 910w" sizes="{BANNER_SIZES}" type="image/webp">
                <img class="banners__image" src="assets/images/banners/slide-{src:02d}.jpg" srcset="assets/images/banners/slide-{src:02d}-480.jpg 480w, assets/images/banners/slide-{src:02d}.jpg 910w" sizes="{BANNER_SIZES}" alt="{esc(alt)}" width="910" height="512" {img_attrs}>
              </picture>
            </a>
          </li>''')
bars = '<span class="is-current"></span>' + "<span></span>" * (n - 1)

# ---------- side categories ----------
side = [("Красный чай", "category-krasnyj-chaj"), ("Кофе", "category-kofe"), ("Черный чай", "category-chernyy_tea"),
        ("Сладости", "category-sladosti"), ("Посуда и аксессуары", "category-posuda-i-aksessuary"),
        ("Зеленый чай", "category-zelenyj-chaj"), ("Пуэр", "category-puer"), ("Улун", "category-ulun"),
        ("Белый чай", "category-belyj-chaj")]
side_html = "\n".join(f'''            <li>
              <a class="shelf__link" href="{SITE}/{slug}">
                <picture>
                  <source srcset="assets/images/categories/{slug}.webp" type="image/webp">
                  <img class="shelf__thumb" src="assets/images/categories/{slug}.jpg" alt="" width="56" height="56" decoding="async"{' loading="lazy"' if k >= 3 else ''}>
                </picture>
                {esc(name)}
              </a>
            </li>''' for k, (name, slug) in enumerate(side))

# ---------- catalogue dropdown ----------
catalog = [("Подарки", "category-podarki"), ("Матча", "category-matcha"), ("Черный чай", "category-chernyy_tea"),
           ("Чай зелёный с черным ароматизированный", "category-chaj-zelyonyj-s-chernym-aromatizirovannyj"),
           ("Зеленый чай", "category-zelenyj-chaj"), ("Красный чай", "category-krasnyj-chaj"), ("Белый чай", "category-belyj-chaj"),
           ("Желтый чай", "category-zheltyj-chaj"), ("Улун", "category-ulun"), ("Пуэр", "category-puer"),
           ("Травяной чай", "category-travyanoj-chaj"), ("Добавки к чаю", "category-dobavki-k-chayu"),
           ("Фруктовый чай", "category-fruktovyj-chaj"), ("Мате и лапачо", "category-mate-i-lapacho"),
           ("Ройбуш, ханибуш и каркаде (гибискус)", "category-rojbush-hanibush-i-karkade-gibiskus"),
           ("Связанный чай", "category-svyazannyj-chaj"), ("Кофе", "category-kofe"), ("Сиропы и топпинги", "category-siropy-i-toppingi"),
           ("Сладости", "category-sladosti"), ("Посуда и аксессуары", "category-posuda-i-aksessuary")]
catalog_html = "\n".join(f'            <li><a class="catalog__link" href="{SITE}/{slug}">{esc(name)}</a></li>' for name, slug in catalog)

# ---------- products ----------
cards = []
ld_items = []
for idx, p in enumerate(products, 1):
    pid = f"good-{idx}"
    v0 = p["variants"][0]
    chips = []
    for j, v in enumerate(p["variants"]):
        old_attr = f' data-old="{v["old"]:g}"' if v["old"] else ""
        chips.append(f'''              <label class="pack__chip">
                <input class="pack__input" type="radio" name="{pid}-pack" value="{v["sku"]}" data-price="{v["price"]:g}"{old_attr} data-label="{esc(v["label"])}"{" checked" if j == 0 else ""}>
                <span class="pack__body">
                  <span class="pack__weight">{esc(v["label"])}</span>
                  <span class="pack__sum">{money(v["price"])}</span>
                </span>
              </label>''')
    badge = f'<span class="good__badge" data-cut>−{cut(v0["old"], v0["price"])}%</span>' if v0["old"] else '<span class="good__badge" data-cut hidden></span>'
    was_hidden = "" if v0["old"] else " hidden"
    was_val = money(v0["old"]) if v0["old"] else ""
    w, h = (600, 600)
    w, h = Image.open(ROOT / f"assets/images/products/{p['slug']}.jpg").size
    cards.append(f'''        <li>
          <article class="good" aria-labelledby="{pid}-name" data-good>
            <a class="good__media" href="{SITE}{p["url"]}" tabindex="-1" aria-hidden="true">
              <picture>
                <source srcset="assets/images/products/{p["slug"]}-280.webp 280w, assets/images/products/{p["slug"]}.webp 600w" sizes="{GOOD_SIZES}" type="image/webp">
                <img class="good__image" src="assets/images/products/{p["slug"]}.jpg" srcset="assets/images/products/{p["slug"]}-280.jpg 280w, assets/images/products/{p["slug"]}.jpg 600w" sizes="{GOOD_SIZES}" alt="{esc(p["alt"])}" width="{w}" height="{h}" loading="lazy" decoding="async">
              </picture>
              {badge}
            </a>
            <div class="good__head">
              <p class="good__cat"><a href="{SITE}{p["cat_url"]}">{esc(p["cat"])}</a></p>
              <h3 class="good__name" id="{pid}-name"><a href="{SITE}{p["url"]}">{esc(p["name"])}</a></h3>
            </div>
            <fieldset class="good__packs">
              <legend class="visually-hidden">Фасовка: {esc(p["name"])}</legend>
              <div class="pack__grid">
{chr(10).join(chips)}
              </div>
            </fieldset>
            <div class="good__buy">
              <p class="tag" aria-live="polite">
                <span class="visually-hidden">Цена:</span>
                <span class="tag__now" data-now>{money(v0["price"])}</span>
                <span class="tag__was" data-was{was_hidden}><span class="visually-hidden">без скидки</span> <s data-was-value>{was_val}</s></span>
                <span class="tag__sku">арт. <span data-sku>{v0["sku"]}</span></span>
              </p>
              <button class="add press" type="button" data-add>В корзину</button>
            </div>
          </article>
        </li>''')
    prices = [v["price"] for v in p["variants"]]
    ld_items.append({
        "@type": "ListItem", "position": idx,
        "item": {
            "@type": "Product", "name": p["name"], "url": SITE + p["url"], "image": p["img"] if p["img"].startswith("http") else SITE + p["img"],
            "category": p["cat"], "sku": v0["sku"],
            "offers": {"@type": "AggregateOffer", "priceCurrency": "RUB", "lowPrice": f"{min(prices):.2f}", "highPrice": f"{max(prices):.2f}", "offerCount": len(prices)},
        },
    })

ld = [
    {"@context": "https://schema.org", "@type": "ItemList", "name": "Рекомендуем", "itemListElement": ld_items},
    {"@context": "https://schema.org", "@type": "Organization", "name": "Teaboom.ru", "url": "https://teaboom.ru/",
     "logo": "https://teaboom.ru/static/eetheme/assets/images/logo.png", "telephone": "+74951201551", "email": "info@teaboom.ru",
     "address": {"@type": "PostalAddress", "addressLocality": "Москва", "streetAddress": "ул. 1-я Боевская, д. 2/12, стр. 4, пом. 1/1", "addressCountry": "RU"},
     "sameAs": ["https://t.me/Teaboom", "https://vk.com/teaboom", "https://www.ok.ru/teaboom"]},
]

tpl = (ROOT / "tools" / "index.template.html").read_text(encoding="utf-8")
out = (tpl.replace("{{SLIDES}}", "\n".join(slide_html)).replace("{{BARS}}", bars).replace("{{N}}", f"{n:02d}")
          .replace("{{SIDE}}", side_html).replace("{{CATALOG}}", catalog_html).replace("{{GOODS}}", "\n".join(cards))
          .replace("{{JSONLD}}", json.dumps(ld, ensure_ascii=False, indent=2)))
assert "{{" not in out
open(ROOT / f"index.html", "w", encoding="utf-8").write(out)
print("ok", len(out))
