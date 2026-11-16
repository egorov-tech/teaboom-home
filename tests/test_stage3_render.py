"""Render helpers shared by the home tile, the product page and (later) the category page.

Run: python3 -m unittest discover -s tests -p 'test_stage3_render.py'
"""
import copy
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
import build_index as b  # noqa: E402

NB = " "
ANANAS = next(p for p in b.products if p["slug"] == "ananasovij-ulun")


class Labels(unittest.TestCase):
    def test_kilograms(self):
        self.assertEqual(b.show_label("1000 г"), f"1{NB}кг")
        self.assertEqual(b.show_label("5000 г"), f"5{NB}кг")

    def test_small_weights_and_pieces_stay(self):
        self.assertEqual(b.show_label("100 г"), f"100{NB}г")
        self.assertEqual(b.show_label("48 шт"), f"48{NB}шт")

    def test_rate_per_100g_ignores_display_unit(self):
        v = {"label": "1000 г", "price": 2064.0}
        self.assertAlmostEqual(b.unit_rate(v), 206.4)

    def test_money(self):
        self.assertEqual(b.money(326.4), f"326,40{NB}₽")
        self.assertEqual(b.money(6320), f"6{NB}320{NB}₽")


class Packs(unittest.TestCase):
    def test_tile_packs_carry_sku_as_string(self):
        html = b.render_packs(ANANAS, "tile", group="good-1")
        self.assertIn('value="01306"', html)
        self.assertIn(f'data-label="1{NB}кг"', html)
        self.assertEqual(html.count('class="pack__input"'), 4)
        self.assertEqual(html.count(" checked"), 1)

    def test_pdp_packs_keep_the_page_contract(self):
        html = b.render_packs(ANANAS, "pdp")
        self.assertIn('data-sku="01308"', html)
        self.assertIn('data-grams="1000"', html)
        self.assertIn('<span class="pack__weight">1<i>кг</i></span>', html)
        self.assertIn("data-pack-rate", html)

    def test_names_are_escaped(self):
        p = copy.deepcopy(ANANAS)
        p["name"] = 'Чай <b> & "кавычки"'
        card, _ = b.render_tile(1, p)
        self.assertNotIn("<b>", card)
        self.assertIn("&lt;b&gt; &amp; &quot;кавычки&quot;", card)


class Price(unittest.TestCase):
    def test_no_old_price_means_no_discount(self):
        p = copy.deepcopy(ANANAS)
        for v in p["variants"]:
            v["old"] = None
        tile = b.render_price(p, "tile")
        self.assertIn("data-was hidden", tile)
        self.assertNotIn("is-sale", tile)
        pdp = b.render_price(p, "pdp")
        self.assertNotIn("is-sale", pdp)
        self.assertIn("hidden", pdp)

    def test_sale_price(self):
        tile = b.render_price(ANANAS, "tile")
        self.assertIn(f"326,40{NB}₽", tile)
        self.assertIn(f"349,20{NB}₽", tile)
        self.assertIn("is-sale", tile)


if __name__ == "__main__":
    unittest.main()
