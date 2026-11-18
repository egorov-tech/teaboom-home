# Шрифты

`assets/fonts/open-sans.woff2` и `oswald.woff2` собраны из исходников Google Fonts
(github.com/google/fonts: `ofl/opensans/OpenSans[wdth,wght].ttf`, `ofl/oswald/Oswald[wght].ttf`),
лицензия Open Font License.

- Open Sans: начертания 400–700, ширина 100; Oswald: 500–600.
- Символы: латиница и цифры (U+0020–00FF), кириллица (U+0400–045F), типографика
  (– — « » „ “ ‘ ’ … • № − ₽ ™ €) и всё, что встречается в `*.html`, `assets/js`, `data`.
- В Open Sans нет знака ₽ — как и в файлах Google; в тексте он рисуется системным шрифтом,
  в ценах (Oswald) — своим.

Пересборка (fontTools ≥ 4.60): `fontTools.varLib.instancer.instantiateVariableFont` с
`{"wght": (400, 700), "wdth": 100}` / `{"wght": (500, 600)}`, затем `fontTools.subset`
с `flavor="woff2"`, `layout_features=["*"]`. Если на сайте появятся новые символы
(например, казахские буквы) — пересобрать с ними.
