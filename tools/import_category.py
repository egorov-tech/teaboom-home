"""Import a live teaboom.ru category into data/categories.json + tile photos.

Usage:
  python3 tools/import_category.py ulun <items.json> <filters.json> [--captured YYYY-MM-DD]

<items.json>   — all products of the category in site order (live-category-items.cjs over
                 ?start=1..N): name, url, img, cat, variants[{label, sku, old, price}].
<filters.json> — {group: {value: [slug, ...]}} collected from the live filter links
                 (?f=<id>__<value>), with ids in FILTER_IDS below.

Photos: each product image is fetched once and saved as a 640 / 400 / 280 square, jpg + webp,
like the photos already in assets/images/products. Existing files are kept.
"""
import io
import json
import pathlib
import sys
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "assets/images/products"

# Filter ids of the live site (teaboom.ru/category-ulun?f=<id>__<value>).
FILTER_IDS = {"Страна произрастания": 3, "Категория": 16, "Фасовка": 34, "Сорт": 57}

# Live tiles that carry a promo flag instead of the category line in the first row.
FLAGS = ("Новинка!", "Скидка!")


def photo(slug, url):
    if (IMG / f"{slug}-280.jpg").exists():
        return False
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=60).read()
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(bg, im).convert("RGB")
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    im = im.crop((left, top, left + side, top + side))
    for size, name in ((640, slug), (400, f"{slug}-400"), (280, f"{slug}-280")):
        out = im.resize((min(size, side), min(size, side)), Image.LANCZOS)
        out.save(IMG / f"{name}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        out.save(IMG / f"{name}.webp", "WEBP", quality=78, method=6)
    return True


def main():
    key, items_path, filters_path = sys.argv[1:4]
    captured = sys.argv[sys.argv.index("--captured") + 1] if "--captured" in sys.argv else None
    items = json.load(open(items_path, encoding="utf-8"))
    groups = json.load(open(filters_path, encoding="utf-8"))

    data_path = ROOT / "data/categories.json"
    cats = json.load(open(data_path, encoding="utf-8"))
    cat = next(c for c in cats if c["slug"] == key)

    products, fetched = [], 0
    for it in items:
        slug = it["url"].rstrip("/").split("/product/")[1]
        if not it["variants"]:
            raise SystemExit(f"{slug}: no packs captured — check the live tile by hand")
        fetched += photo(slug, it["img"])
        products.append({
            "slug": slug,
            "name": it["name"],
            "alt": it["name"],
            "url": f"/product/{slug}",
            "img": it["img"],
            "cat": it["cat"],
            "variants": [
                {"title": f'{it["name"]}, {v["label"]}', "label": v["label"], "sku": v["sku"],
                 "old": v["old"], "price": v["price"]}
                for v in it["variants"]
            ],
        })

    slugs = {p["slug"] for p in products}
    filters = []
    for group, values in groups.items():
        vals = [{"value": v, "slugs": [s for s in members if s in slugs]} for v, members in values.items()]
        filters.append({"title": group, "id": FILTER_IDS[group], "values": vals})

    per = cat["per_page"]
    cat["products"] = products
    cat["filters_data"] = filters
    cat["site_pages"] = (len(products) + per - 1) // per
    cat["source"] = {"url": f"https://teaboom.ru{cat['live']}", "pages": f"?start=1..{cat['site_pages']}",
                     "captured": captured or cat["source"].get("captured")}
    data_path.write_text(json.dumps(cats, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{key}: {len(products)} products, {len(filters)} filter groups, photos fetched: {fetched}")


if __name__ == "__main__":
    main()
