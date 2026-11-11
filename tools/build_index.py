"""Builds index.html and product.html from templates + data/products.json.

Run from anywhere: python3 tools/build_index.py
Needs Pillow (reads product photo sizes for width/height).
"""
import json, html, pathlib

from PIL import Image


ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://teaboom.ru"
PRODUCT_PAGE = "product.html"
products = json.load(open(ROOT / "data/products.json", encoding="utf-8"))
NB = "\u00a0"


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


def gallery_stems(p):
    """Local stems under assets/images/products/ for the in-card swipe."""
    stems = []
    for item in p.get("gallery") or [p["img"]]:
        if isinstance(item, str) and item.startswith("assets/"):
            stems.append(pathlib.Path(item).stem)
        else:
            # Remote URL: only the main product photo is stored locally as <slug>.*
            if p["slug"] not in stems:
                stems.append(p["slug"])
    # Unique, keep order
    out = []
    for s in stems:
        if s not in out:
            out.append(s)
    return out


# ---------- banners (text transcribed from the images, see CONTENT.md) ----------
# Painted slides still carry text in the JPG. CMS-shaped ones (п. 11) split fields:
# image · title · sticker · CTA · link · background — dark layout, clean photo.
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
# Demo CMS samples (clean photos, no baked-in type). Keys = shop slide numbers.
cms = {
    6: {
        "href": "/search?q=анчан",
        "sticker": "Хит сезона",
        "title": "Анчан — синий чай из Таиланда",
        "cta": "Смотреть анчан",
        "bg": "#2a2632",
        "alt": "Стеклянный чайник с синим анчаном на деревянном срезе",
        "sources": (
            'assets/images/banners/anchan-wide-480.webp 480w, assets/images/banners/anchan-wide.webp 910w',
            'assets/images/banners/anchan-wide-480.jpg 480w, assets/images/banners/anchan-wide.jpg 910w',
            "assets/images/banners/anchan-wide.jpg",
            910,
            512,
        ),
    },
}
# Per-image fields for existing artwork; no crop of baked-in text.
slide_backgrounds = {
    1: "#0786c7", 2: "#152b29", 3: "#e4cc0c", 4: "#ffffff",
    5: "#e4e4e4", 7: "#111111", 8: "#fce484", 9: "#cccccc",
    10: "#101010", 11: "#242424", 12: "#84543c",
}
n = len(slides)
BANNER_SIZES = "(min-width: 1200px) 1104px, 92vw"
CMS_SIZES = "(min-width: 1200px) 736px, (min-width: 768px) 66vw, 92vw"
GOOD_SIZES = "(min-width: 1060px) 260px, 45vw"
# The site opens on the Telegram banner; the demo opens on a tea (Анчан, "Хит сезона"),
# the rest keep the site's order. Files keep the site's numbering.
order = [6, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]
slide_html = []
for i, src in enumerate(order, 1):
    first = i == 1
    img_attrs = 'fetchpriority="high"' if first else 'loading="lazy" decoding="async"'
    tab = "" if first else ' tabindex="-1"'
    # Only the first banner loads with the page; the rest are fetched by home.js as the
    # carousel reaches them (lazy loading does not hold back images in a sideways scroller).
    pre = "" if first else "data-"
    if src in cms:
        c = cms[src]
        webp_set, jpg_set, jpg_src, w, h = c["sources"]
        # Product photos are single-file; banner anchan has srcset widths.
        if " " in webp_set:
            webp_attr = f'{pre}srcset="{webp_set}" sizes="{CMS_SIZES}"'
            jpg_attr = f'{pre}srcset="{jpg_set}" sizes="{CMS_SIZES}"'
        else:
            webp_attr = f'{pre}srcset="{webp_set}"'
            jpg_attr = ""
        mod = f' {c["mod"]}' if c.get("mod") else ""
        slide_html.append(f'''          <li class="banners__slide" aria-roledescription="слайд" aria-label="{i} из {n}" data-slide>
            <a class="banner{mod}" href="{esc(site(c["href"]))}" style="--banner-bg: {esc(c["bg"])}"{tab}>
              <div class="banner__text">
                <span class="banner__tag">{esc(c["sticker"])}</span>
                <span class="banner__title">{esc(c["title"])}</span>
                <span class="banner__cta">{esc(c["cta"])}</span>
              </div>
              <div class="banner__photo">
                <picture>
                  <source {webp_attr} type="image/webp">
                  <img {pre}src="{jpg_src}" {jpg_attr} alt="{esc(c["alt"])}" width="{w}" height="{h}" {img_attrs}>
                </picture>
              </div>
            </a>
          </li>''')
    else:
        href, alt = slides[src - 1]
        slide_html.append(f'''          <li class="banners__slide" aria-roledescription="слайд" aria-label="{i} из {n}" data-slide>
            <a class="banners__link" href="{esc(site(href))}" style="--slide-bg: {slide_backgrounds[src]}"{tab}>
              <picture>
                <source {pre}srcset="assets/images/banners/slide-{src:02d}-480.webp 480w, assets/images/banners/slide-{src:02d}.webp 910w" sizes="{BANNER_SIZES}" type="image/webp">
                <img class="banners__image" {pre}src="assets/images/banners/slide-{src:02d}.jpg" {pre}srcset="assets/images/banners/slide-{src:02d}-480.jpg 480w, assets/images/banners/slide-{src:02d}.jpg 910w" sizes="{BANNER_SIZES}" alt="{esc(alt)}" width="910" height="512" {img_attrs}>
              </picture>
            </a>
          </li>''')
def banner_dot(i):
    current = ' aria-current="true"' if i == 1 else ""
    return (
        f'            <button class="banners__dot" type="button" data-dot '
        f'aria-label="Баннер {i} из {n}"{current}></button>'
    )


banner_dots = "\n".join(banner_dot(i) for i in range(1, n + 1))
# ---------- category tiles (the shop's own nine from the home page side menu) ----------
side = [("Красный чай", "category-krasnyj-chaj"), ("Кофе", "category-kofe"), ("Черный чай", "category-chernyy_tea"),
        ("Сладости", "category-sladosti"), ("Посуда и аксессуары", "category-posuda-i-aksessuary"),
        ("Зеленый чай", "category-zelenyj-chaj"), ("Пуэр", "category-puer"), ("Улун", "category-ulun"),
        ("Белый чай", "category-belyj-chaj")]
cats_html = "\n".join(f'''        <li class="cats__item">
          <a class="cats__link" href="{SITE}/{slug}">
            <picture>
              <source srcset="assets/images/categories/{slug}.webp 112w, assets/images/categories/{slug}-tile.webp 360w" sizes="(min-width: 1060px) 200px, (min-width: 768px) 30vw, 42vw" type="image/webp">
              <img class="cats__image" src="assets/images/categories/{slug}-tile.jpg" srcset="assets/images/categories/{slug}.jpg 112w, assets/images/categories/{slug}-tile.jpg 360w" sizes="(min-width: 1060px) 200px, (min-width: 768px) 30vw, 42vw" alt="" width="360" height="360" loading="lazy" decoding="async">
            </picture>
            <span class="cats__name">{esc(name)}</span>
          </a>
        </li>''' for name, slug in side)

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
# Dock sheet: relative URLs (п. 19), same list as the desktop catalogue.
catalog_rel_html = "\n".join(f'            <li><a class="catalog__link" href="/{slug}">{esc(name)}</a></li>' for name, slug in catalog)

# ---------- products ----------
cards = []
ld_items = []
ARROW = (
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
)
def pack_qty(label):
    """'500 г' -> (500, 'г'), '48 шт' -> (48, 'шт')."""
    num, unit = label.split()[:2]
    return float(num), unit


def show_label(label):
    """'1000 г' -> '1 кг', '5000 г' -> '5 кг'; smaller weights and pieces stay as they are."""
    qty, unit = pack_qty(label)
    if unit == "г" and qty >= 1000 and qty % 1000 == 0:
        return f"{qty / 1000:g}{NB}кг"
    return label.replace(" ", NB)


def unit_rate(v):
    """Price per 100 g for weighed packs, per 1 piece otherwise."""
    qty, unit = pack_qty(v["label"])
    return v["price"] / qty * (100 if unit == "г" else 1)


for idx, p in enumerate(products, 1):
    pid = f"good-{idx}"
    v0 = p["variants"][0]
    base_rate = unit_rate(v0)
    best_rate = min(unit_rate(v) for v in p["variants"])
    chips = []
    for j, v in enumerate(p["variants"]):
        old_attr = f' data-old="{v["old"]:g}"' if v["old"] else ""
        qty, unit = pack_qty(v["label"])
        # п. 24: chips carry the weight only (as on phones); the price per 100 g of the chosen
        # pack is one line under the price, green when that pack is the best value.
        r = unit_rate(v)
        rate_label = f"{money(round(r))} за 100{NB}г" if unit == "г" else f"{money(round(r))} за шт"
        is_best = r == best_rate and best_rate < base_rate - 0.005
        best_attr = ' data-best' if is_best else ""
        chips.append(f'''              <label class="pack">
                <input class="pack__input" type="radio" name="{pid}-pack" value="{v["sku"]}" data-price="{v["price"]:g}"{old_attr} data-qty="{qty:g}" data-unit="{unit}" data-label="{esc(show_label(v["label"]))}" data-rate="{esc(rate_label)}"{best_attr}{" checked" if j == 0 else ""}>
                <span class="pack__body">
                  <span class="pack__weight">{esc(show_label(v["label"]))}</span>
                </span>
              </label>''')
        if j == 0:
            first_rate, first_best = rate_label, is_best
    badge = f'<span class="good__badge" data-cut>−{cut(v0["old"], v0["price"])}%</span>' if v0["old"] else '<span class="good__badge" data-cut hidden></span>'
    was_hidden = "" if v0["old"] else " hidden"
    was_val = money(v0["old"]) if v0["old"] else ""

    stems = gallery_stems(p)
    frames = []
    for fi, stem in enumerate(stems):
        jpg = ROOT / f"assets/images/products/{stem}.jpg"
        if not jpg.exists():
            # Fall back to the main slug file if a gallery stem is missing.
            stem = p["slug"]
            jpg = ROOT / f"assets/images/products/{stem}.jpg"
        w, h = Image.open(jpg).size
        lazy = "" if (idx == 1 and fi == 0) else ' loading="lazy"'
        alt = esc(p["alt"] if fi == 0 else f'{p["alt"]} — фото {fi + 1}')
        # Widths the tile really needs: 280 / 400 for phones and tablets, the largest for
        # desktop Retina. Photos shared with the product page have a 640 copy; use it instead
        # of their 970 px original.
        big = f"{stem}-640" if (ROOT / f"assets/images/products/{stem}-640.jpg").exists() else stem
        big_w = Image.open(ROOT / f"assets/images/products/{big}.jpg").size[0]
        webp_set = f"assets/images/products/{stem}-280.webp 280w, assets/images/products/{stem}-400.webp 400w, assets/images/products/{big}.webp {big_w}w"
        jpg_set = f"assets/images/products/{stem}-280.jpg 280w, assets/images/products/{stem}-400.jpg 400w, assets/images/products/{big}.jpg {big_w}w"
        # Extra gallery photos wait for the first touch of the card (home.js hydrates them).
        pre = "data-" if fi > 0 else ""
        frames.append(f'''              <a class="good__frame" href="{PRODUCT_PAGE}" tabindex="-1" aria-hidden="true" data-gallery-frame>
                <picture>
                  <source {pre}srcset="{webp_set}" sizes="{GOOD_SIZES}" type="image/webp">
                  <img class="good__image" {pre}src="assets/images/products/{stem}-400.jpg" {pre}srcset="{jpg_set}" sizes="{GOOD_SIZES}" alt="{alt}" width="{w}" height="{h}"{lazy} decoding="async">
                </picture>
              </a>''')

    multi = len(stems) > 1
    if multi:
        dot_bits = []
        for i in range(1, len(stems) + 1):
            current = ' aria-current="true"' if i == 1 else ""
            dot_bits.append(
                f'                <button type="button" aria-label="Фото {i} из {len(stems)}"'
                f"{current} data-gallery-dot></button>"
            )
        dots = "\n".join(dot_bits)
        media = f'''            <div class="good__media good__gallery" data-gallery>
              <div class="good__track" data-gallery-track>
{chr(10).join(frames)}
              </div>
              <p class="good__swipe" data-gallery-hint aria-hidden="true">
                <svg viewBox="0 0 24 16" width="24" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5 8h14M15 4l4 4-4 4M9 4 5 8l4 4"/></svg>
                <span>листайте</span>
              </p>
              <div class="good__dots" data-gallery-dots>
{dots}
              </div>
              {badge}
            </div>'''
    else:
        media = f'''            <div class="good__media">
{frames[0].replace("good__frame", "good__frame good__frame--solo").replace(' tabindex="-1" aria-hidden="true"', "")}
              {badge}
            </div>'''

    cards.append(f'''        <li>
          <article class="good" aria-labelledby="{pid}-name" data-good data-slug="{esc(p["slug"])}">
{media}
            <div class="good__head">
              <p class="good__sku">арт. <span data-sku>{v0["sku"]}</span></p>
              <h3 class="good__name" id="{pid}-name"><a href="{PRODUCT_PAGE}">{esc(p["name"])}</a></h3>
            </div>
            <fieldset class="good__packs packs packs--compact">
              <legend class="visually-hidden">Фасовка: {esc(p["name"])}</legend>
              <div class="packs__grid">
{chr(10).join(chips)}
              </div>
            </fieldset>
            <div class="good__buy">
              <p class="tag" aria-live="polite">
                <span class="visually-hidden">Цена:</span>
                <span class="tag__now{" is-sale" if v0["old"] else ""}" data-now>{money(v0["price"])}</span>
                <span class="tag__was" data-was{was_hidden}><span class="visually-hidden">без скидки</span> <s data-was-value>{was_val}</s></span>
                <span class="tag__rate{" is-best" if first_best else ""}" data-rate-line>{first_rate}<span class="visually-hidden" data-best-note{"" if first_best else " hidden"}>, выгоднее всего</span></span>
              </p>
              <button class="add press" type="button" data-add>В корзину</button>
            </div>
          </article>
        </li>''')
    prices = [v["price"] for v in p["variants"]]
    ld_items.append({
        "@type": "ListItem", "position": idx,
        "item": {
            "@type": "Product", "name": p["name"], "url": SITE + p["url"], "image": p["img"] if str(p["img"]).startswith("http") else SITE + "/" + str(p["img"]).lstrip("/"),
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

def shell(nav_home_attr, search_id, footer_note, dock_home_attr=""):
    """One masthead + footer + dock for every page — same components, page-specific attrs only."""
    mast = (ROOT / "tools/partials/masthead.html").read_text(encoding="utf-8")
    foot = (ROOT / "tools/partials/footer.html").read_text(encoding="utf-8")
    dock = (ROOT / "tools/partials/dock.html").read_text(encoding="utf-8")
    mast = (
        mast.replace("{{NAV_HOME_ATTR}}", nav_home_attr)
        .replace("{{SEARCH_ID}}", search_id)
        .replace("{{CATALOG}}", catalog_html)
    )
    foot = foot.replace("{{FOOTER_NOTE}}", footer_note)
    dock = (
        dock.replace("{{DOCK_HOME_ATTR}}", dock_home_attr)
        .replace("{{CATALOG}}", catalog_rel_html)
    )
    return mast, foot, dock


tpl = (ROOT / "tools" / "index.template.html").read_text(encoding="utf-8")
mast_home, foot_home, dock_home = shell(
    ' aria-current="page"',
    "search-field",
    'Демо главной и <a href="product.html">карточки товара</a> для обсуждения. Магазин: <a href="https://teaboom.ru/">teaboom.ru</a>',
    ' aria-current="page"',
)
out = (
    tpl.replace("{{MASTHEAD}}", mast_home)
    .replace("{{FOOTER}}", foot_home)
    .replace("{{DOCK}}", dock_home)
    .replace("{{SLIDES}}", "\n".join(slide_html))
    .replace("{{DOTS}}", banner_dots)
    .replace("{{N}}", f"{n:02d}")
    .replace("{{CATS}}", cats_html)
    .replace("{{GOODS}}", "\n".join(cards))
    .replace("{{JSONLD}}", json.dumps(ld, ensure_ascii=False, indent=2))
)
assert "{{" not in out
(ROOT / "index.html").write_text(out, encoding="utf-8")
print("ok index", len(out))

# ---------- product.html (same shell as home + pineapple PDP content) ----------
ptpl = (ROOT / "tools" / "product.template.html").read_text(encoding="utf-8")
mast_pdp, foot_pdp, dock_pdp = shell(
    "",
    "search-field-product",
    'Демо одной системы: <a href="./">главная</a> и эта карточка. Магазин: <a href="https://teaboom.ru/">teaboom.ru</a>',
)
pout = (
    ptpl.replace("{{MASTHEAD}}", mast_pdp)
    .replace("{{FOOTER}}", foot_pdp)
    .replace("{{DOCK}}", dock_pdp)
)
assert "{{" not in pout
(ROOT / "product.html").write_text(pout, encoding="utf-8")
print("ok product", len(pout))
