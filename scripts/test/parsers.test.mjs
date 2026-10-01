import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDecathlon, parsePrice, parseShopify, parseWooStore, parseJumia, parsePrestashop, parseMagento, parseWooHtml, parseAnyHtml, isValidPromo, guessCategory } from "../lib/parsers.mjs";

test("parsePrice gère les formats marocains", () => {
  assert.equal(parsePrice("1 299,00 DH"), 1299);
  assert.equal(parsePrice("1.299,50 Dhs"), 1299.5);
  assert.equal(parsePrice("2,499.00 MAD"), 2499);
  assert.equal(parsePrice("179 Dhs"), 179);
  assert.equal(parsePrice("1.299 DH"), 1299);
  assert.equal(parsePrice("19,90"), 19.9);
  assert.equal(parsePrice("12 990,00 DH"), 12990);
  assert.ok(Number.isNaN(parsePrice("")));
});

test("Shopify : garde les variantes avec compare_at_price", () => {
  const items = parseShopify({ products: [
    { title: "Crème CeraVe", vendor: "CeraVe", handle: "creme", images: [{ src: "https://x/i.jpg" }], variants: [{ price: "120.00", compare_at_price: "150.00" }] },
    { title: "Sans promo", handle: "n", variants: [{ price: "10.00", compare_at_price: null }] }
  ] }, "https://shop.ma");
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { product: "Crème CeraVe", brand: "CeraVe", originalPrice: 150, promoPrice: 120, url: "https://shop.ma/products/creme", image: "https://x/i.jpg" });
});

test("WooCommerce Store API", () => {
  const items = parseWooStore([{ name: "Mixeur", permalink: "https://s.ma/p/mixeur", prices: { regular_price: "49900", sale_price: "39900", currency_minor_unit: 2 }, images: [] }]);
  assert.equal(items[0].originalPrice, 499);
  assert.equal(items[0].promoPrice, 399);
});

test("Jumia", () => {
  const html = `<div><article class="prd _fb col c-prd"><a class="core" href="/sandales-adidas-123.html" data-gtm-brand="Adidas"><div class="img-c"><img data-src="https://ma.jumia.is/a.jpg" class="img"></div>
    <div class="info"><h3 class="name">Adidas Adilette Aqua</h3><div class="prc">179 Dhs</div><div class="s-prc-w"><div class="old">300 Dhs</div><div class="bdg _dsct _sm">40%</div></div></div></a></article>
    <article class="prd _fb col c-prd"><a class="core" href="/x.html"><h3 class="name">Sans ancien prix</h3><div class="prc">99 Dhs</div></a></article></div>`;
  const items = parseJumia(html, "https://www.jumia.ma/flash-sales/");
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { product: "Adidas Adilette Aqua", brand: "Adidas", originalPrice: 300, promoPrice: 179, url: "https://www.jumia.ma/sandales-adidas-123.html", image: "https://ma.jumia.is/a.jpg" });
});

test("PrestaShop", () => {
  const html = `<article class="product-miniature js-product-miniature" data-id-product="1"><img src="/img/1.jpg">
    <h3 class="h3 product-title"><a href="https://d.ma/velo.html">Vélo VTT</a></h3>
    <span class="regular-price">2 999,00 DH</span><span class="price">2 499,00 DH</span></article>`;
  const items = parsePrestashop(html, "https://d.ma/5080-promotions");
  assert.equal(items.length, 1);
  assert.equal(items[0].product, "Vélo VTT");
  assert.equal(items[0].originalPrice, 2999);
  assert.equal(items[0].promoPrice, 2499);
  assert.equal(items[0].image, "https://d.ma/img/1.jpg");
});

test("Magento", () => {
  const html = `<li class="item product product-item"><img class="product-image-photo" src="https://e.ma/m.jpg">
    <a class="product-item-link" href="https://e.ma/tv.html"> TV LG 55" </a>
    <span data-price-amount="4990" data-price-type="finalPrice"></span><span data-price-type="oldPrice" data-price-amount="6490"></span></li>`;
  const items = parseMagento(html, "https://e.ma/vente-flash");
  assert.deepEqual(items[0], { product: 'TV LG 55"', brand: "", originalPrice: 6490, promoPrice: 4990, url: "https://e.ma/tv.html", image: "https://e.ma/m.jpg" });
});

test("WooCommerce HTML et détection automatique", () => {
  const html = `<ul><li class="product type-product"><a href="https://p.ma/creme"><img src="https://p.ma/c.jpg"><h2 class="woocommerce-loop-product__title">Crème solaire</h2>
    <span class="price"><del><bdi>189,00&nbsp;DH</bdi></del> <ins><bdi>151,20&nbsp;DH</bdi></ins></span></a></li></ul>`;
  assert.equal(parseWooHtml(html, "https://p.ma").length, 1);
  const any = parseAnyHtml(html, "https://p.ma");
  assert.equal(any.platform, "woocommerce-html");
  assert.equal(any.items[0].promoPrice, 151.2);
});

test("validation et catégories", () => {
  assert.ok(isValidPromo({ product: "Abc", originalPrice: 100, promoPrice: 80 }));
  assert.ok(!isValidPromo({ product: "Abc", originalPrice: 80, promoPrice: 100 }));
  assert.ok(!isValidPromo({ product: "Abc", originalPrice: 100, promoPrice: 1 }));
  assert.equal(guessCategory("Smartphone Samsung Galaxy A15"), "high-tech");
  assert.equal(guessCategory("Machine à laver Beko 8kg"), "electromenager");
  assert.equal(guessCategory("Huile de table Lesieur 5L"), "alimentation");
  assert.equal(guessCategory("BATTEUR ELECTRIQUE 120W 5V ROYAL", "alimentation"), "electromenager");
  assert.equal(guessCategory("PLANCHA 2000W KROHLER", "alimentation"), "electromenager");
  assert.equal(guessCategory("Truc inconnu", "sante"), "sante");
});

test("PrestaShop sans product-title (Univers Para, Maparami)", () => {
  const up = `<div class="js-product-miniature" data-id-product="15410"><div class="element-top"><a href="https://u.ma/p/15410-algo.html" class="thumbnail"><img src="https://u.ma/i.jpg"></a></div>
    <div class="product-name"><a href="https://u.ma/p/15410-algo.html" title="ALGOLOGIE COFFRET TRESORS">ALGOLOGIE COFFRET TRESORS</a></div>
    <div class="ax-product-cats"><a href="https://u.ma/857-promotions" title="PROMOTIONS">PROMOTIONS</a></div>
    <div class="product-price-and-shipping"> <span class="regular-price">892,50&nbsp;MAD</span> <span class="price"> 589,05&nbsp;MAD </span></div></div>
    <div class="js-product-miniature" data-id-product="1"><a href="https://u.ma/x.html" title="Sans promo">Sans promo</a><span class="price"> 1 440,00&nbsp;MAD </span></div>`;
  const a = parsePrestashop(up, "https://u.ma/");
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].product, a[0].originalPrice, a[0].promoPrice, a[0].url], ["ALGOLOGIE COFFRET TRESORS", 892.5, 589.05, "https://u.ma/p/15410-algo.html"]);
  const mp = `<article class="product-miniature js-product-miniature" data-id-product="9898"><div class="manufacturer"><a href="//m.ma/brand/705">Acretin C</a></div>
    <h3 ><a href="https://m.ma/9898-acretin.html" class="product_name one_line" title="Acretin C Gel Anti-Acné 30g original">Acretin C Gel Anti-Acné...</a></h3>
    <div class="product-price-and-shipping"> <span class="regular-price" aria-label="Prix de base">340,00&nbsp;Dh</span><span class="price price-sale" aria-label="Prix"> 198,00&nbsp;Dh </span></div></article>`;
  const b = parsePrestashop(mp, "https://m.ma/");
  assert.deepEqual([b[0].product, b[0].brand, b[0].originalPrice, b[0].promoPrice], ["Acretin C Gel Anti-Acné 30g original", "Acretin C", 340, 198]);
});

test("Decathlon product-card (HTML réel)", () => {
  const html = `<li class="js-product-card"> <article class="product-card" data-sku="87be"> <div class="product-card_media"> <div class="product-card_image">
    <a href=https://www.decathlon.ma/p/313049-116672-chaussures-nh100-noir.html class="js-product-card-link" tabindex="-1" aria-hidden="true">
    <img alt="Chaussures de randonnée à scratch 24 au 34 enfant, NH100 noir" width="200" loading="lazy" src="https://contents.mediadecathlon.com/p2578793/prod.jpg?format=auto&f=1024x0"></a></div></div>
    <div class="price -sale"> <div class="price_items"> <div class="price_item u-typo-body-s"> <span class="price_amount" data-testid="current-price" data-value="179"> <span class="u-sr-only"> Current price 179 MAD </span> <span aria-hidden="true"> 179 MAD </span> </span>
    <span class="price_barred-amount" data-testid="price-before-reduction"> <span class="u-sr-only">Prix avant la réduction 229 MAD</span> <span aria-hidden="true">229 MAD</span> </span>
    <span class="price_discount" data-testid="discount-amount"> <span aria-hidden="true">21%</span> </span> </div> </div> </div> </article> </li>
    <li class="js-product-card"><article class="product-card"><img alt="Sans promo"><span class="price_amount" data-testid="current-price" data-value="99"></span></article></li>`;
  const items = parseDecathlon(html, "https://www.decathlon.ma/5080-promotions");
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { product: "Chaussures de randonnée à scratch 24 au 34 enfant, NH100 noir", brand: "", originalPrice: 229, promoPrice: 179,
    url: "https://www.decathlon.ma/p/313049-116672-chaussures-nh100-noir.html", image: "https://contents.mediadecathlon.com/p2578793/prod.jpg?format=auto&f=1024x0" });
});
