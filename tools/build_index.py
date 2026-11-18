"""Builds index.html and product.html from templates + data/products.json.

Run from anywhere: python3 tools/build_index.py
Needs Pillow (reads product photo sizes for width/height).
"""
import json
import re, html, pathlib, re

from PIL import Image


ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://teaboom.ru"
PRODUCT_PAGE = "product.html"
products = json.load(open(ROOT / "data/products.json", encoding="utf-8"))
NB = "\u00a0"


def esc(s):
    return html.escape(s, quote=True)


def tile_name(name):
    # No soft hyphens (Антон, 10.11: names break between words only). At 320 px the card's
    # tighter inset and tracking let «ароматизированный» fit whole — see _goods.scss.
    return esc(name)


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
GOOD_SIZES = "(min-width: 1060px) 260px, (min-width: 768px) 31vw, 45vw"
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
              <source srcset="assets/images/categories/{slug}.webp 112w, assets/images/categories/{slug}-tile.webp 360w" sizes="(min-width: 900px) 18vw, (min-width: 768px) 30vw, 42vw" type="image/webp">
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
ARROW = (
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
)
def pack_qty(label):
    """'500 г' -> (500, 'г'), '48 шт' -> (48, 'шт'), '1 уп (150 г)' -> (150, 'г')."""
    m = re.search(r"\((\d+(?:[.,]\d+)?)\s*г\)", label)
    if m:
        return float(m.group(1).replace(",", ".")), "г"
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


def rate_info(p):
    """Per-pack price per 100 g (or per piece) and which pack is the best value."""
    base_rate = unit_rate(p["variants"][0])
    best_rate = min(unit_rate(v) for v in p["variants"])
    out = []
    for v in p["variants"]:
        _, unit = pack_qty(v["label"])
        r = unit_rate(v)
        label = f"{money(round(r))} за 100{NB}г" if unit == "г" else f"{money(round(r))} за шт"
        out.append((label, r == best_rate and best_rate < base_rate - 0.005))
    return out


def num(v):
    """Price for a data attribute: 326.40, 1432 (the format the product page always used)."""
    return f"{v:g}" if abs(v - round(v)) < 1e-9 else f"{v:.2f}"


def render_packs(p, mode, group="pack"):
    """Pack chips. «tile» — home/category card (weight only); «pdp» — product page (with rate).

    The two keep their own data attributes: home.js and product-card.js read them.
    """
    chips = []
    for j, (v, (rate_label, is_best)) in enumerate(zip(p["variants"], rate_info(p))):
        qty, unit = pack_qty(v["label"])
        shown = show_label(v["label"])
        checked = " checked" if j == 0 else ""
        if mode == "tile":
            # п. 24: chips carry the weight only (as on phones); the price per 100 g of the chosen
            # pack is one line under the price, green when that pack is the best value.
            old_attr = f' data-old="{v["old"]:g}"' if v["old"] else ""
            best_attr = ' data-best' if is_best else ""
            chips.append(f'''              <label class="pack">
                <input class="pack__input" type="radio" name="{group}-pack" value="{v["sku"]}" data-price="{v["price"]:g}"{old_attr} data-qty="{qty:g}" data-unit="{unit}" data-label="{esc(shown)}" data-rate="{esc(rate_label)}"{best_attr}{checked}>
                <span class="pack__body">
                  <span class="pack__weight">{esc(shown)}</span>
                </span>
              </label>''')
        else:
            amount, unit_shown = shown.split(NB)
            old_attr = f' data-old-price="{num(v["old"])}"' if v["old"] else ""
            chips.append(f'''                <label class="pack">
                  <input class="pack__input" type="radio" name="{group}" value="{qty:g}"
                         data-sku="{v["sku"]}" data-price="{num(v["price"])}"{old_attr} data-grams="{qty:g}" data-label="{esc(shown)}"{checked}>
                  <span class="pack__body">
                    <span class="pack__weight">{esc(amount)}<i>{esc(unit_shown)}</i></span>
                    <span class="pack__rate" data-pack-rate></span>
                  </span>
                </label>''')
    return ("\n" if mode == "tile" else "\n\n").join(chips)


def render_price(p, mode):
    """Price of the first (checked) pack. JS keeps it in step when another pack is chosen."""
    v0 = p["variants"][0]
    sale = " is-sale" if v0["old"] else ""
    if mode == "tile":
        first_rate, first_best = rate_info(p)[0]
        was_hidden = "" if v0["old"] else " hidden"
        was_val = money(v0["old"]) if v0["old"] else ""
        return f'''              <p class="tag" aria-live="polite">
                <span class="visually-hidden">Цена:</span>
                <span class="tag__now{sale}" data-now>{money(v0["price"])}</span>
                <span class="tag__was" data-was{was_hidden}><span class="visually-hidden">без скидки</span> <s data-was-value>{was_val}</s></span>
                <span class="tag__rate{" is-best" if first_best else ""}" data-rate-line>{first_rate}<span class="visually-hidden" data-best-note{"" if first_best else " hidden"}>, выгоднее всего</span></span>
              </p>'''
    hidden = "" if v0["old"] else " hidden"
    was = money(v0["old"]) if v0["old"] else ""
    cut_txt = f"−{cut(v0['old'], v0['price'])}%" if v0["old"] else ""
    return f'''            <div class="price" aria-live="polite" aria-atomic="true">
              <p class="price__line">
                <span class="visually-hidden">Цена:</span>
                <span class="price__now{sale}" data-out="price">{money(v0["price"])}</span>
                <span class="price__was"{hidden}>
                  <span class="visually-hidden">Старая цена:</span>
                  <s data-out="old-price">{was}</s>
                </span>
                <span class="price__cut" data-out="discount"{hidden}>{cut_txt}</span>
              </p>
            </div>'''


# ---------- product page (п. 15, 22, 23) ----------
service = json.load(open(ROOT / "data/service.json", encoding="utf-8"))
PDP_SIZES = "(min-width: 1060px) 520px, calc(100vw - 32px)"
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
          "сентября", "октября", "ноября", "декабря"]


def plural(n, one, few, many):
    """1 отзыв · 2 отзыва · 5 отзывов · 11 отзывов · 21 отзыв."""
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def typo(text):
    """Escaped prose with Russian typesetting: a dash never opens a line, «м. Октябрьское»,
    «ул. Народного», «№ 1» stay together."""
    s = esc(text)
    s = s.replace(" — ", NB + "— ")
    s = re.sub(r"(^|\s)(м\.|ул\.|д\.|г\.|№) ", lambda m: m.group(1) + m.group(2) + NB, s)
    return units(s)


def units(text):
    """Keep a number with its unit: «5 кг», «500 мл», «2 ч. л.» never break apart."""
    return re.sub(r"(\d) (г|кг|мл|мин|ч\.)", lambda m: m.group(1) + NB + m.group(2), text)


SHORT = ("в", "во", "с", "со", "к", "ко", "у", "о", "об", "и", "а", "но", "не", "ни", "до", "по", "от",
         "на", "за", "из", "для", "при", "без", "под", "над", "или", "что")
NAMES = ("Почта", "Октябрьское", "Народного", "МЦК", "Apple", "Google", "г.", "м.", "ул.", "д.", "№", "т.")
_SHORT_RE = re.compile(r"(^|[\s(«„\u00a0])(" + "|".join(SHORT) + r") (?=\S)", re.IGNORECASE)
_NAME_RE = re.compile(r"(^|[\s(«\u00a0])(" + "|".join(re.escape(n) for n in NAMES) + r") (?=\S)")
_NUM_RE = re.compile(r"(\d) (₽|г\b|кг|мл|мин|минут|км|шт|%|°C)")


def typeset_text(t):
    """Russian line breaking for UI copy: a preposition or conjunction never ends a line,
    «г. Москва», «Почта России», «ул. Народного Ополчения» stay together, a number keeps its
    unit, a dash never opens a line."""
    t = t.replace(" — ", NB + "— ")
    for _ in range(2):  # «и в г. Москва»: chains of short words
        t = _SHORT_RE.sub(lambda m: m.group(1) + m.group(2) + NB, t)
        t = _NAME_RE.sub(lambda m: m.group(1) + m.group(2) + NB, t)
    t = re.sub(r"(\d) (\d{3})\b", lambda m: m.group(1) + NB + m.group(2), t)  # 3 500
    return _NUM_RE.sub(lambda m: m.group(1) + NB + m.group(2), t)


def typeset_html(html_text):
    """typeset_text() over the text of <main> only — not tags, attributes, scripts or styles."""
    a, b = html_text.find("<main"), html_text.find("</main>")
    if a < 0 or b < 0:
        return html_text
    part = html_text[a:b]
    out, pos, skip = [], 0, False
    for m in re.finditer(r"<[^>]+>", part):
        text = part[pos:m.start()]
        out.append(text if skip else typeset_text(text))
        tag = m.group(0).lower()
        if tag.startswith(("<script", "<style")):
            skip = True
        elif tag.startswith(("</script", "</style")):
            skip = False
        out.append(m.group(0))
        pos = m.end()
    out.append(typeset_text(part[pos:]))
    return html_text[:a] + "".join(out) + html_text[b:]


def reviews_label(n):
    return f"{n}{NB}{plural(n, 'отзыв', 'отзыва', 'отзывов')}"


def ru_date(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d}{NB}{MONTHS[m - 1]} {y}"


def score(x):
    """5 → «5,0», 4.5 → «4,5»."""
    return f"{x:.1f}".replace(".", ",")


def stars(r):
    full = int(round(r))
    return "★" * full + "☆" * (5 - full)


def photo_sources(stem):
    """srcset for the big product photo: a 640 copy when we have one, then the original."""
    base = ROOT / "assets/images/products"
    w, h = Image.open(base / f"{stem}.jpg").size
    if (base / f"{stem}-640.jpg").exists():
        webp = f"assets/images/products/{stem}-640.webp 640w, assets/images/products/{stem}.webp {w}w"
        jpg = f"assets/images/products/{stem}-640.jpg 640w, assets/images/products/{stem}.jpg {w}w"
    else:
        webp = f"assets/images/products/{stem}.webp {w}w"
        jpg = f"assets/images/products/{stem}.jpg {w}w"
    return webp, jpg, w, h


def render_pdp_media(p):
    """п. 15: one photo — just the photo. Two and more — swipe with dots on phones,
    thumbnails on desktop. Same gallery module as the home tiles; no autoplay."""
    d = p["pdp"]
    photos = d["photos"]
    multi = len(photos) > 1
    frames = []
    for i, ph in enumerate(photos):
        webp, jpg, w, h = photo_sources(ph["stem"])
        pre = "data-" if i else ""
        load = 'fetchpriority="high"' if i == 0 else 'loading="lazy" decoding="async"'
        caption = ""
        if ph.get("caption"):
            caption = f'''
              <figcaption class="shot__caption">
                <span class="shot__caption-key">{esc(ph["key"])}</span>
                <span>{esc(ph["caption"])}</span>
              </figcaption>'''
        attrs = ' data-gallery-frame' if multi else ""
        hidden = f' aria-label="Фото {i + 1} из {len(photos)}"' if multi else ""
        frames.append(f'''            <figure class="shot"{attrs}{hidden}>
              <picture>
                <source {pre}srcset="{webp}" sizes="{PDP_SIZES}" type="image/webp">
                <img class="shot__image" {pre}src="assets/images/products/{ph["stem"]}.jpg" {pre}srcset="{jpg}" sizes="{PDP_SIZES}" alt="{esc(ph["alt"])}" width="{w}" height="{h}" {load}>
              </picture>{caption}
            </figure>''')
    if not multi:
        return f'''        <div class="product__media">
          <div class="photos">
{frames[0]}
          </div>
        </div>'''
    cur = ' aria-current="true"'
    thumbs = "\n".join(f'''          <li>
            <button class="gallery__btn" type="button" aria-label="{esc(ph["alt"])}"{cur if i == 0 else ""} data-gallery-thumb>
              <img class="gallery__thumb" src="assets/images/products/{ph["stem"]}-280.webp" alt="" width="120" height="120" loading="lazy">
            </button>
          </li>''' for i, ph in enumerate(photos))
    return f'''        <div class="product__media" data-gallery>
          <div class="photos">
            <div class="photos__track" data-gallery-track>
{chr(10).join(frames)}
            </div>
          </div>
          <ul class="gallery" role="list" aria-label="Фотографии товара">
{thumbs}
          </ul>
        </div>'''


BREW_KEYS = [("Количество", "Количество"), ("Объём", "Объём воды"), ("Температура воды", "Температура"),
             ("Время заваривания", "Время")]


def render_brew(p, aside=False):
    """«Как заваривать»: the shop's «Советы к применению» from the product page — four facts.
    Desktop: under the photo; narrower: after the purchase block."""
    specs = dict(p["pdp"]["specs"])
    facts = [(label, specs[key]) for key, label in BREW_KEYS if key in specs]
    if not facts:
        return ""
    items = "\n".join(f'            <div class="brew__fact"><dt>{esc(l)}</dt><dd>{units(esc(v))}</dd></div>' for l, v in facts)
    cls = "brew brew--aside" if aside else "brew"
    return f'''        <section class="{cls}" aria-labelledby="brew-title">
          <h2 class="brew__title" id="brew-title">Как заваривать</h2>
          <dl class="brew__facts">
{items}
          </dl>
        </section>'''


def render_promise():
    """п. 35 (Антон, 18.11): delivery and payment in one place — a disclosure under «В корзину»
    (texts from /shipping/ and /payment/), instead of short facts here plus a tab below."""
    # п. 47 (Ксения, 18.11): her delivery text, cut down the way her example shows — one row per
    # way: name, the condition under it, the price on the right. The block opens on demand.
    rows = "\n".join(
        f'''                  <li>
                    <span class="rates__name">{typo(r["name"])}</span>
                    <span class="rates__price">{typo(r["price"])}</span>
                    <span class="rates__note">{typo(r["note"])}</span>
                  </li>''' for r in service["delivery_rates"]["rows"])
    delivery = f'''                <ul class="rates__list">
{rows}
                </ul>'''
    payment = "\n".join(f"                <li>{typo(x)}</li>" for x in service["payment"])
    return f'''          <details class="promise" id="delivery">
            <summary class="promise__toggle">Доставка и оплата</summary>
            <div class="delivery">
              <div>
                <h3>Доставка</h3>
                <div class="rates">
{delivery}
                </div>
                <a class="delivery__more" href="{SITE}/shipping/">Все способы доставки</a>
              </div>
              <div>
                <h3>Оплата</h3>
                <ul>
{payment}
                </ul>
                <a class="delivery__more" href="{SITE}/payment/">Все способы оплаты</a>
              </div>
            </div>
          </details>'''


def render_rating(p):
    """п. 22: only for a product that has reviews; the count opens the reviews tab."""
    rs = p["pdp"]["reviews"]
    ex = p["pdp"].get("reviews_example")
    if rs:
        avg, n = sum(r["rating"] for r in rs) / len(rs), len(rs)
    elif ex:
        # Demo template: the shop's reviews module feeds real numbers (п. 22 sketch: 4,8 · 12).
        avg, n = ex["rating"], ex["count"]
    else:
        return ""
    # п. 34 (Антон, 18.11): the whole row — stars, score and count — is one link to the reviews.
    return f'''
          <a class="rating" href="#reviews" data-tab-link="reviews">
            <span class="rating__stars" aria-hidden="true">{stars(avg)}</span>
            <span class="rating__value"><span class="visually-hidden">Средняя оценка </span>{score(avg)}<span class="visually-hidden"> из 5,</span></span>
            <span class="rating__link">{reviews_label(n)}</span>
          </a>'''


def spec_rows(specs):
    """п. 36 (Антон, 18.11): four brewing facts → two rows in place of the first of them:
    «Количество: 2 ч. л. на 500 мл» and «Заваривать: 1–3 мин при 80–85 °C»."""
    keys = [k for k, _ in BREW_KEYS]
    d = dict(specs)
    if not all(k in d for k in keys):
        return specs
    brew = [("Количество", f'{d["Количество"]} на {d["Объём"]}'),
            ("Заваривать", f'{d["Время заваривания"]} при {d["Температура воды"]}')]
    out, done = [], False
    for k, v in specs:
        if k in keys:
            if not done:
                out.extend(brew)
                done = True
            continue
        out.append((k, v))
    return out


def rail_arrows():
    """«Назад / Вперёд» for a sideways row (data-rail, more.js): «Похожие», reviews."""
    return '''        <div class="rail__arrows" data-rail-arrows hidden>
          <button class="rail__arrow press" type="button" aria-label="Назад" data-rail-prev>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="rail__arrow press" type="button" aria-label="Вперёд" data-rail-next>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>'''


def render_details(p):
    """п. 23: Описание · Характеристики · Отзывы (доставка и оплата — под кнопкой, п. 35). Tabs on phones (JS),
    the same sections one under another on wider screens and without JS."""
    d = p["pdp"]
    rs = d["reviews"]
    ex = d.get("reviews_example")
    shown = rs or (ex["items"] if ex else [])
    desc = "\n".join(f"                <p>{typo(x)}</p>" for x in d["description"])
    benefits = "\n".join(f"                  <li>{esc(x)}</li>" for x in d["benefits"])
    specs = "\n".join(
        f'                <div class="specs__row"><dt>{esc(k)}</dt><dd>{units(esc(v))}</dd></div>' for k, v in spec_rows(d["specs"]))
    if shown:
        items = "\n".join(f'''                <li class="review">
                  <div class="review__who">
                    <span class="review__avatar" aria-hidden="true">{esc(r["author"][0])}</span>
                    <span class="review__author">{esc(r["author"])}</span>
                    <time class="review__date" datetime="{r["date"]}">{ru_date(r["date"])}</time>
                  </div>
                  <p class="review__rating"><span aria-hidden="true">{stars(r["rating"])}</span><span class="visually-hidden">Оценка {r["rating"]} из 5</span></p>
                  <blockquote class="review__text">{esc(r["text"])}</blockquote>
                </li>''' for r in shown)
        note = "" if rs else f'              <p class="reviews__sample">{typo(ex["note"])}</p>\n'
        # «Отзывы 12» but three on the page (Артём, 18.11): the row ends with a card that leads to
        # all of them — on the shop the module shows the first ones here, the rest on its list.
        all_n = len(rs) or (ex["count"] if ex else 0)
        more = ""
        if all_n > len(shown):
            more = f'''
                <li class="review review--all">
                  <a class="review__all" href="{esc(site(d["source"]["url"].replace(SITE, "")))}#reviews_for_product">Все {all_n} {plural(all_n, "отзыв", "отзыва", "отзывов")}</a>
                </li>'''
        reviews_body = f'''{note}              <ul class="reviews__list" data-rail-track data-strip>
{items}{more}
              </ul>'''
    else:
        reviews_body = '              <p class="reviews__empty">Ещё никто не оставлял отзывов. Будьте первым!</p>'
    write = site(d["source"]["url"].replace(SITE, ""))
    total = len(rs) or (ex["count"] if ex else 0)
    count = f' <span class="details__count">{total}</span>' if total else ""
    return f'''        <section class="details" aria-label="О товаре" data-details>
          <div class="details__tabs" role="tablist" aria-label="О товаре" data-tabs data-strip hidden>
            <button class="details__tab" type="button" role="tab" id="tab-about" aria-controls="about" aria-selected="true" data-tab="about">Описание</button>
            <button class="details__tab" type="button" role="tab" id="tab-specs" aria-controls="specs" aria-selected="false" tabindex="-1" data-tab="specs">Характеристики</button>
            <button class="details__tab" type="button" role="tab" id="tab-reviews" aria-controls="reviews" aria-selected="false" tabindex="-1" data-tab="reviews">Отзывы{count}</button>
          </div>

          <div class="details__panel" id="about" role="tabpanel" aria-labelledby="tab-about" data-panel>
            <h2 class="details__title">Описание</h2>
            <div class="about-tea">
              <div class="prose">
{desc}
              </div>
              <div class="prose about-tea__aside">
                <h3>Вкус</h3>
                <p>{typo(d["taste"])}</p>
                <h3>Полезные свойства</h3>
                <ul>
{benefits}
                </ul>
              </div>
            </div>
          </div>

          <div class="details__panel" id="specs" role="tabpanel" aria-labelledby="tab-specs" data-panel>
            <h2 class="details__title">Характеристики</h2>
            <dl class="specs">
{specs}
            </dl>
          </div>

          <div class="details__panel" id="reviews" role="tabpanel" aria-labelledby="tab-reviews" data-panel>
            <div class="reviews" data-rail>
              <div class="reviews__head">
                <h2 class="details__title">Отзывы</h2>
{rail_arrows()}
                <a class="reviews__write press" href="{esc(write)}#reviews_for_product">Оставить отзыв</a>
              </div>
{reviews_body}
            </div>
          </div>
        </section>'''


def render_crumbs(p):
    items = ['        <li class="breadcrumbs__item"><a href="./">Начало</a></li>']
    items += [f'        <li class="breadcrumbs__item"><a href="{site(u)}">{esc(n)}</a></li>' for n, u in p["pdp"]["breadcrumbs"]]
    items.append(f'        <li class="breadcrumbs__item"><span aria-current="page">{esc(p["name"])}</span></li>')
    return '      <ol class="breadcrumbs__list" data-strip>\n' + "\n".join(items) + "\n      </ol>"


def render_pdp_ld(p):
    d = p["pdp"]
    prices = [v["price"] for v in p["variants"]]
    ld = {
        "@context": "https://schema.org", "@type": "Product", "name": p["name"],
        "category": p["cat"], "description": d["description"][0], "image": [p["img"]],
        "sku": p["variants"][0]["sku"], "brand": {"@type": "Brand", "name": "Teaboom"},
        "offers": {"@type": "AggregateOffer", "priceCurrency": "RUB", "lowPrice": f"{min(prices):.2f}",
                   "highPrice": f"{max(prices):.2f}", "offerCount": len(prices)},
    }
    if d["reviews"]:
        rs = d["reviews"]
        ld["aggregateRating"] = {"@type": "AggregateRating", "ratingValue": f"{sum(r['rating'] for r in rs) / len(rs):.1f}",
                                 "reviewCount": len(rs), "bestRating": "5"}
        ld["review"] = [{"@type": "Review", "author": {"@type": "Person", "name": r["author"]}, "datePublished": r["date"],
                         "reviewRating": {"@type": "Rating", "ratingValue": r["rating"], "bestRating": 5},
                         "reviewBody": r["text"]} for r in rs]
    return json.dumps(ld, ensure_ascii=False, indent=2)


def render_tile(idx, p, live_links=False):
    """One product tile for the home grid (and later the category page) + its JSON-LD item."""
    pid = f"good-{idx}"
    v0 = p["variants"][0]
    # Home keeps its demo links (accepted); the category sends a product without a demo page
    # to its live teaboom.ru page.
    page = p.get("pdp", {}).get("page") or (site(p["url"]) if live_links else PRODUCT_PAGE)
    badge = f'<span class="good__badge" data-cut>−{cut(v0["old"], v0["price"])}%</span>' if v0["old"] else '<span class="good__badge" data-cut hidden></span>'

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
        frames.append(f'''              <a class="good__frame" href="{page}" tabindex="-1" aria-hidden="true" data-gallery-frame>
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

    card = (f'''        <li>
          <article class="good" aria-labelledby="{pid}-name" data-good data-slug="{esc(p["slug"])}">
{media}
            <div class="good__head">
              <p class="good__sku">арт. <span data-sku>{v0["sku"]}</span></p>
              <h3 class="good__name" id="{pid}-name"><a href="{page}">{tile_name(p["name"])}</a></h3>
            </div>
            <fieldset class="good__packs packs packs--compact">
              <legend class="visually-hidden">Фасовка: {esc(p["name"])}</legend>
              <div class="packs__grid">
{render_packs(p, "tile", group=pid)}
              </div>
            </fieldset>
            <div class="good__buy">
{render_price(p, "tile")}
              <button class="add press" type="button" data-add>В корзину</button>
            </div>
          </article>
        </li>''')
    prices = [v["price"] for v in p["variants"]]
    ld_item = ({
        "@type": "ListItem", "position": idx,
        "item": {
            "@type": "Product", "name": p["name"], "url": SITE + p["url"], "image": p["img"] if str(p["img"]).startswith("http") else SITE + "/" + str(p["img"]).lstrip("/"),
            "category": p["cat"], "sku": v0["sku"],
            "offers": {"@type": "AggregateOffer", "priceCurrency": "RUB", "lowPrice": f"{min(prices):.2f}", "highPrice": f"{max(prices):.2f}", "offerCount": len(prices)},
        },
    })
    return card, ld_item


# ---------- demo navigation ----------
# Pages the demo has locally: links to their live address open the demo page instead, so the
# team can walk home → category → product. Filters and the remaining pages stay on the shop.
LOCAL = {
    f"{SITE}/category-ulun": "category-ulun.html",
    f"{SITE}/cart": "cart.html",
    f"{SITE}/checkout-dispatcher": "checkout.html",
    f"{SITE}/login": "login.html",
    # Dock «Кабинет»: a visitor who is not signed in lands on the login page first.
    f"{SITE}/my-account": "login.html",
}


def demo_links(html_text):
    for live, local in LOCAL.items():
        html_text = html_text.replace(f'href="{live}"', f'href="{local}"')
    return html_text


# ---------- category page (п. 17) ----------
categories = json.load(open(ROOT / "data/categories.json", encoding="utf-8"))


FILTER_SEP = "___"  # the live site joins filters as ?f=3__Китай___16__Натуральный


def filter_key(gid, value):
    return f"{gid}__{value}"


def render_filters(c, by_slug):
    """Filter groups as on teaboom.ru: only groups with more than one value (the site hides
    single-value groups), values in the site's order. Counts start for the full category;
    category.js keeps them live for the current choice."""
    groups = []
    for g in c["filters_data"]:
        vals = [v for v in g["values"] if v["slugs"]]
        if len(vals) < 2:
            continue
        # Packs read like the tiles (500 г, 1 кг, 5 кг), lightest first; the key keeps the
        # site's value («1000 г»), so the address stays the shop's.
        if g["title"] == "Фасовка":
            vals = sorted(vals, key=lambda v: pack_qty(v["value"])[0])
        gid = f'fg-{g["id"]}'
        rows = []
        # пп. 40, 45 (Антон и Ксения, 18.11): the first 5 values, the rest behind «Показать все (N)» —
        # but only when at least 2 are hidden: never «show 1 more» (Антон), never a long list
        # before the fold (Ксения). Up to 6 values: all of them at once.
        shown = 5 if len(vals) - 5 >= 2 else len(vals)
        for i, v in enumerate(vals):
            key = filter_key(g["id"], v["value"])
            extra = " data-extra hidden" if i >= shown else ""
            rows.append(f'''              <li{extra}>
                <label class="facet">
                  <input class="facet__input" type="checkbox" value="{esc(key)}" data-facet>
                  <span class="facet__box" aria-hidden="true"></span>
                  <span class="facet__label" title="{esc(v["value"])}">{esc(show_label(v["value"]) if g["title"] == "Фасовка" else v["value"])}</span>
                  <span class="facet__count" data-facet-count>{len(v["slugs"])}</span>
                </label>
              </li>''')
        rest = len(vals) - shown
        more = (f'\n            <button class="facets__more" type="button" aria-expanded="false" data-facets-more>Показать все ({len(vals)})</button>'
                if rest else "")
        groups.append(f'''          <fieldset class="facets__group">
            <legend class="facets__title" id="{gid}">{esc(g["title"])}</legend>
            <ul class="facets__list">
{chr(10).join(rows)}
            </ul>{more}
          </fieldset>''')
    return "\n".join(groups)


def page_window(cur, total):
    """1 … 4 5 6 … 12: first, last and two around the current page."""
    keep = {1, total, cur - 1, cur, cur + 1}
    out, last = [], 0
    for n in range(1, total + 1):
        if n in keep:
            if n - last > 1:
                out.append(None)
            out.append(n)
            last = n
    return out


def render_category(c, mast, foot, dock):
    """Breadcrumbs → H1 → subcategories → filters (panel / sheet) · count · sorting → chips →
    the accepted tile grid → pages → the category text. Filters, sorting and pages run in
    category.js over the whole category, with the live site's address (?f=…&sorting=…&start=N)."""
    per = c["per_page"]
    own = {p["slug"]: p for p in products}
    items = [own.get(p["slug"], p) for p in c["products"]]
    facets = {}
    for g in c["filters_data"]:
        for v in g["values"]:
            for slug in v["slugs"]:
                facets.setdefault(slug, []).append(filter_key(g["id"], v["value"]))
    cards, ld_items = [], []
    for idx, p in enumerate(items, 1):
        card, ld_item = render_tile(idx, p, live_links=True)
        v0 = p["variants"][0]
        hidden = "" if idx <= per else " hidden"
        f_attr = esc(FILTER_SEP.join(facets.get(p["slug"], [])))
        card = card.replace("        <li>", f'        <li data-item data-order="{idx}" data-price="{v0["price"]:g}" data-name="{esc(p["name"].lower())}" data-f="{f_attr}"{hidden}>', 1)
        cards.append(card)
        if idx <= per:
            ld_items.append(ld_item)
    pages = (len(items) + per - 1) // per
    crumbs = ('      <ol class="breadcrumbs__list" data-strip>\n        <li class="breadcrumbs__item"><a href="./">Начало</a></li>\n'
              + "".join(f'        <li class="breadcrumbs__item"><a href="{site(u)}">{esc(n)}</a></li>\n' for n, u in c["breadcrumbs"])
              + f'        <li class="breadcrumbs__item"><span aria-current="page">{esc(c["title"])}</span></li>\n      </ol>')
    # п. 37 (Антон, 18.11): subcategory buttons repeated the «Категория» filter next to them —
    # only the filter stays. Redirects of the subcategory pages are for SEO and the backend.
    subcats = ""
    sorting = "\n".join(f'            <option value="{v}"{" selected" if i == 0 else ""}>{esc(n)}</option>' for i, (v, n) in enumerate(c["sorting"]))
    cur = ' aria-current="page"'
    nums = []
    for n in page_window(1, pages):
        if n is None:
            nums.append('          <li class="pager__gap" aria-hidden="true">…</li>')
        else:
            nums.append(f'          <li><a class="pager__link" href="?start={n}" data-page="{n}"{cur if n == 1 else ""}>{n}</a></li>')
    pager = f'''      <nav class="pager" aria-label="Страницы каталога" data-pager>
        <ul class="pager__list" data-pager-list>
{chr(10).join(nums)}
        </ul>
      </nav>'''
    seo = c["seo"]
    body = []
    for b in seo[1:]:
        if "p" in b:
            body.append(f"        <p>{typo(b['p'])}</p>")
        elif "h" in b:
            body.append(f"        <h3>{typo(b['h'])}</h3>")
        else:
            body.append("        <ul>\n" + "\n".join(f"          <li>{typo(x)}</li>" for x in b["ul"]) + "\n        </ul>")
    seo_html = f'''    <section class="about wrap" aria-labelledby="seo-title">
      <h2 class="about__title" id="seo-title">{esc(seo[0]["h"])}</h2>
      <div class="about__body">
{chr(10).join(body)}
      </div>
    </section>'''
    ld = [{"@context": "https://schema.org", "@type": "ItemList", "name": c["title"], "numberOfItems": len(items), "itemListElement": ld_items}]
    tpl = (ROOT / "tools" / "category.template.html").read_text(encoding="utf-8")
    # п. 41 (Антон, 18.11): the count says how many products there are — «143 товара», with
    # filters «Найдено 79 товаров»; which page you are on is shown by the pager.
    first = f"{len(items)} {plural(len(items), 'товар', 'товара', 'товаров')}"
    out = (
        tpl.replace("{{MASTHEAD}}", mast).replace("{{FOOTER}}", foot).replace("{{DOCK}}", dock)
        .replace("{{SEO_TITLE}}", esc(c["seo_title"]))
        .replace("{{META_DESC}}", esc(f'{c["title"]}: {len(items)} сортов, фасовки от 100 г, цена от {money(min(p["variants"][0]["price"] for p in items)).replace(NB, " ")}.'))
        .replace("{{PER_PAGE}}", str(per))
        .replace("{{CRUMBS}}", crumbs).replace("{{H1}}", esc(c["title"])).replace("{{SUBCATS}}", subcats)
        .replace("{{COUNT}}", first).replace("{{TOTAL}}", str(len(items)))
        .replace("{{FACETS}}", render_filters(c, own)).replace("{{SORTING}}", sorting)
        .replace("{{GOODS}}", "\n".join(cards)).replace("{{PAGER}}", pager).replace("{{SEO}}", seo_html)
        .replace("{{VIEWED}}", render_viewed(sample=next(x["pdp"]["viewed_example"] for x in products if x.get("pdp", {}).get("viewed_example"))))
        .replace("{{JSONLD}}", json.dumps(ld, ensure_ascii=False, indent=2))
    )
    assert "{{" not in out, c["page"]
    return out


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
    # The partial keeps the shop's relative links (Ксения: «все ссылки относительные»), as the
    # backend will use it. The demo lives on another domain, so the built page points them at
    # teaboom.ru — and «/» at the demo's own home — otherwise every dock link is a 404.
    dock = dock.replace('href="/"', 'href="./"').replace('href="/', f'href="{SITE}/')
    return mast, foot, dock


def main():
    cards, ld_items = [], []
    for idx, p in enumerate(products, 1):
        card, ld_item = render_tile(idx, p)
        cards.append(card)
        ld_items.append(ld_item)

    ld = [
        {"@context": "https://schema.org", "@type": "ItemList", "name": "Рекомендуем", "itemListElement": ld_items},
        {"@context": "https://schema.org", "@type": "Organization", "name": "Teaboom.ru", "url": "https://teaboom.ru/",
         "logo": "https://teaboom.ru/static/eetheme/assets/images/logo.png", "telephone": "+74951201551", "email": "info@teaboom.ru",
         "address": {"@type": "PostalAddress", "addressLocality": "Москва", "streetAddress": "ул. 1-я Боевская, д. 2/12, стр. 4, пом. 1/1", "addressCountry": "RU"},
         "sameAs": ["https://t.me/Teaboom", "https://vk.com/teaboom", "https://www.ok.ru/teaboom"]},
    ]

    tpl = (ROOT / "tools" / "index.template.html").read_text(encoding="utf-8")
    mast_home, foot_home, dock_home = shell(
        ' aria-current="page"',
        "search-field",
        'Демо главной, <a href="category-ulun.html">категории</a> и <a href="product.html">карточки товара</a> для обсуждения. Магазин: <a href="https://teaboom.ru/">teaboom.ru</a>',
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
    (ROOT / "index.html").write_text(demo_links(out), encoding="utf-8")
    print("ok index", len(out))

    # ---------- product pages (same shell as home; content from data/products.json) ----------
    ptpl = (ROOT / "tools" / "product.template.html").read_text(encoding="utf-8")
    mast_pdp, foot_pdp, dock_pdp = shell(
        "",
        "search-field-product",
        'Демо одной системы: <a href="./">главная</a> и карточки товара. Магазин: <a href="https://teaboom.ru/">teaboom.ru</a>',
    )
    for c in categories:
        page_html = render_category(c, *shell(
            "", "search-field-category",
            'Демо: <a href="./">главная</a>, категория и карточки товара. Магазин: <a href="https://teaboom.ru/">teaboom.ru</a>'))
        (ROOT / c["page"]).write_text(demo_links(typeset_html(page_html)), encoding="utf-8")
        print("ok", c["page"], len(page_html))

    for pdp in (p for p in products if "pdp" in p):
        d = pdp["pdp"]
        pv0 = pdp["variants"][0]
        multi_photo = len(d["photos"]) > 1
        low = min(v["price"] for v in pdp["variants"])
        packs_txt = ", ".join(show_label(v["label"]).replace(NB, " ") for v in pdp["variants"])
        pout = (
            ptpl.replace("{{MASTHEAD}}", mast_pdp)
            .replace("{{FOOTER}}", foot_pdp)
            .replace("{{DOCK}}", dock_pdp)
            .replace("{{SEO_TITLE}}", esc(d["seo_title"]))
            .replace("{{META_DESC}}", esc(f'{pdp["name"]}. {d["summary"]} Фасовки {packs_txt}, цена от {money(low).replace(NB, " ")}.'))
            .replace("{{OG_TITLE}}", esc(d["og_title"]))
            .replace("{{OG_DESC}}", esc(d["summary"]))
            .replace("{{OG_IMAGE}}", esc(pdp["img"]))
            .replace("{{CRUMBS}}", render_crumbs(pdp))
            .replace("{{MEDIA}}", render_pdp_media(pdp))
            .replace("{{LABEL_URL}}", esc(site(d["label"][1])))
            .replace("{{LABEL}}", esc(d["label"][0]))
            .replace("{{H1}}", esc(pdp["name"]))
            .replace("{{RATING}}", render_rating(pdp))
            .replace("{{SUMMARY}}", typo(d["summary"]))
            .replace("{{PDP_PACKS}}", render_packs(pdp, "pdp"))
            .replace("{{PDP_PRICE}}", render_price(pdp, "pdp"))
            .replace("{{PDP_SKU}}", esc(pv0["sku"]))
            .replace("{{PDP_BUY_PACK}}", esc(show_label(pv0["label"])))
            .replace("{{PDP_BUY_SALE}}", ' class="is-sale"' if pv0["old"] else "")
            .replace("{{PDP_BUY_PRICE}}", money(pv0["price"]))
            .replace("{{DETAILS}}", render_details(pdp))
            .replace("{{RELATED}}", render_related(pdp))
            .replace("{{VIEWED}}", render_viewed(pdp))
            .replace("{{BREW}}", "")
            .replace("{{PROMISE}}", render_promise())
            .replace("{{JSONLD}}", render_pdp_ld(pdp))
        )
        assert "{{" not in pout, d["page"]
        (ROOT / d["page"]).write_text(demo_links(typeset_html(pout)), encoding="utf-8")
        print("ok", d["page"], len(pout))


# ---------- product page: «Похожие и сопутствующие товары» (п. 46), «Вы смотрели» (п. 44) ----------
def catalog_product(slug):
    """A product by slug from the demo products or the imported category (live data)."""
    own = {p["slug"]: p for p in products}
    cat = {p["slug"]: p for c in categories for p in c["products"]}
    return own.get(slug) or cat[slug]


def render_related(p):
    """п. 46 (Ксения, 18.11): the shop's own list from the admin, as full catalogue tiles — packs,
    price per 100 g and «В корзину» right here (teaboom.ru now shows a photo and a name only).
    Only products in stock; the product itself never. A filled-up example is marked as such."""
    rel = p["pdp"].get("related")
    if not rel:
        return ""
    slugs = [s for s in rel["site"] + rel.get("example", []) if s != p["slug"]]
    if not slugs:
        return ""
    tiles = "\n".join(render_tile(101 + i, catalog_product(s), live_links=True)[0] for i, s in enumerate(slugs))
    note = f'\n      <p class="more__note">{typo(rel["note"])}</p>' if rel.get("example") else ""
    return f'''    <section class="more" aria-labelledby="related-title" data-rail>
      <div class="more__head">
        <h2 class="more__title" id="related-title">Похожие и сопутствующие товары</h2>
{rail_arrows()}
      </div>{note}
      <ul class="goods__grid more__rail" data-rail-track data-strip>
{tiles}
      </ul>
    </section>'''


def seen_item(p, url):
    """One «Вы смотрели» entry: what the browser remembers about a product page."""
    low = min(v["price"] for v in p["variants"])
    # Names go into the page by script, past typeset_html: bind short words here («Улун с хризантемой»).
    return {"slug": p["slug"], "name": typeset_text(p["name"]), "url": url,
            "img": f"assets/images/products/{p['slug']}-280.jpg",
            "price": low, "from": len(p["variants"]) > 1}


def render_viewed(p=None, sample=None):
    """пп. 43, 44 (Ксения, 18.11): products this shopper opened — kept in the browser (on the shop
    the module does it). A product page adds itself to the list; a category page only shows it.
    Until there is anything to show, the block shows a marked example of real products."""
    ex = (p["pdp"].get("viewed_example") if p else None) or sample
    me = seen_item(p, p["pdp"]["page"]) if p else None
    sample = [seen_item(catalog_product(s), site(catalog_product(s)["url"])) for s in (ex["slugs"] if ex else [])]
    note = f'\n      <p class="more__note" data-viewed-note hidden>{typo(ex["note"])}</p>' if ex else ""
    return f'''    <section class="more more--seen" aria-labelledby="viewed-title" data-viewed hidden>
      <h2 class="more__title" id="viewed-title">Вы смотрели</h2>{note}
      <ul class="seen-list" data-viewed-list data-strip></ul>
      <script type="application/json" data-viewed-me>{json.dumps(me, ensure_ascii=False)}</script>
      <script type="application/json" data-viewed-sample>{json.dumps(sample, ensure_ascii=False)}</script>
    </section>'''


# ---------- cart, checkout, login, password reset (пп. 25–27) ----------
def cart_sample():
    """Two real lines for cart.html?demo: the demo product and a 1 kg pack from the category."""
    own = {p["slug"]: p for p in products}
    cat = {p["slug"]: p for c in categories for p in c["products"]}
    out = []
    for slug, label, qty in (("ananasovij-ulun", "100 г", 2), ("ulun-medovaya-dinya", "1000 г", 1)):
        p = own.get(slug) or cat[slug]
        v = next(x for x in p["variants"] if x["label"] == label)
        page = p.get("pdp", {}).get("page") or site(p["url"])
        out.append({"sku": v["sku"], "name": p["name"], "pack": show_label(v["label"]), "price": v["price"],
                    "old": v["old"], "img": f"assets/images/products/{slug}-280.jpg", "url": page, "qty": qty})
    return json.dumps(out, ensure_ascii=False, indent=1)


def render_service_pages():
    note = ('Демо: <a href="./">главная</a>, <a href="category-ulun.html">категория</a>, '
            '<a href="product.html">товар</a>, <a href="cart.html">корзина</a>, '
            '<a href="checkout.html">оформление</a> и <a href="login.html">вход</a>. '
            'Магазин: <a href="https://teaboom.ru/">teaboom.ru</a>')
    mast, foot, dock = shell("", "search-field-service", note)
    for name in ("cart", "checkout", "login", "password-reset"):
        tpl = (ROOT / "tools" / f"{name}.template.html").read_text(encoding="utf-8")
        out = (tpl.replace("{{MASTHEAD}}", mast).replace("{{FOOTER}}", foot).replace("{{DOCK}}", dock)
               .replace("{{SAMPLE}}", cart_sample()))
        assert "{{" not in out, name
        (ROOT / f"{name}.html").write_text(demo_links(typeset_html(out)), encoding="utf-8")
        print("ok", f"{name}.html", len(out))


if __name__ == "__main__":
    main()
    render_service_pages()
