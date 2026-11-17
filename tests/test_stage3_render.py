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

    def test_boxed_pack_rates_by_grams(self):
        # «1 уп (150 г)» on two Габа teas: price per 100 g from the 150 g inside.
        self.assertEqual(b.pack_qty("1 уп (150 г)"), (150.0, "г"))
        self.assertAlmostEqual(b.unit_rate({"label": "1 уп (150 г)", "price": 7520}), 5013.333, places=2)

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


class Reviews(unittest.TestCase):
    def test_plural(self):
        got = [b.reviews_label(n).replace(NB, " ") for n in (1, 2, 5, 11, 21, 22, 112)]
        self.assertEqual(got, ["1 отзыв", "2 отзыва", "5 отзывов", "11 отзывов", "21 отзыв", "22 отзыва", "112 отзывов"])

    def test_score_and_date(self):
        self.assertEqual(b.score(5), "5,0")
        self.assertEqual(b.score(4.5), "4,5")
        self.assertEqual(b.ru_date("2022-02-28"), f"28{NB}февраля 2022")

    def test_example_rating_not_in_structured_data(self):
        # No real reviews: the labelled example (п. 22 sketch) shows, structured data stays clean.
        self.assertIn("4,8", b.render_rating(ANANAS))
        self.assertNotIn("aggregateRating", b.render_pdp_ld(ANANAS))

    def test_no_reviews_no_example_no_rating(self):
        p = copy.deepcopy(ANANAS)
        p["pdp"].pop("reviews_example")
        self.assertEqual(b.render_rating(p), "")

    def test_typography(self):
        self.assertEqual(b.typo("Сбербанк — курьеру"), f"Сбербанк{NB}— курьеру")
        self.assertEqual(b.typo("у м. Октябрьское"), f"у м.{NB}Октябрьское")
        self.assertEqual(b.typo("1 кг, 5 кг"), f"1{NB}кг, 5{NB}кг")
        self.assertEqual(b.typo("<script>"), "&lt;script&gt;")


if __name__ == "__main__":
    unittest.main()
