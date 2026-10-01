/* Extraction des produits en promotion depuis les plateformes e-commerce courantes. */

/** Convertit "1 299,00 DH", "1.299,00", "2,499.00 MAD", "179 Dhs" en nombre. */
export function parsePrice(raw) {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;
  let s = String(raw).replace(/&nbsp;|&#160;| | /g, " ").replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    s = s.replace(dec === "," ? /\./g : /,/g, "").replace(dec, ".");
  } else if (lastComma >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/,(?=.*,)/g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  return parseFloat(s);
}

const decode = (s) => String(s ?? "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, " ").trim();

const attr = (html, name) => {
  const m = html.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) || html.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? decode(m[1]) : "";
};

const absUrl = (u, base) => { try { return u ? new URL(u, base).href : ""; } catch { return ""; } };

/** Découpe le HTML en blocs commençant par l'ouverture d'un élément correspondant à `startRe`. */
function blocks(html, startRe) {
  const idx = [];
  const re = new RegExp(startRe.source, "gi");
  let m;
  while ((m = re.exec(html))) idx.push(m.index);
  return idx.map((start, i) => html.slice(start, idx[i + 1] ?? Math.min(html.length, start + 8000)));
}

// ---------- Shopify : /products.json ----------
export function parseShopify(json, base) {
  const out = [];
  for (const p of json?.products || []) {
    const v = (p.variants || []).find((x) => Number(x.compare_at_price) > Number(x.price)) || null;
    if (!v) continue;
    out.push({
      product: decode(p.title), brand: decode(p.vendor),
      originalPrice: parsePrice(v.compare_at_price), promoPrice: parsePrice(v.price),
      url: absUrl(`/products/${p.handle}`, base), image: p.images?.[0]?.src || ""
    });
  }
  return out;
}

// ---------- WooCommerce : /wp-json/wc/store/v1/products?on_sale=true ----------
export function parseWooStore(json) {
  const out = [];
  for (const p of Array.isArray(json) ? json : []) {
    const pr = p.prices || {};
    const unit = 10 ** (pr.currency_minor_unit ?? 2);
    const regular = Number(pr.regular_price) / unit, sale = Number(pr.sale_price ?? pr.price) / unit;
    if (!(regular > sale)) continue;
    out.push({
      product: decode(p.name), brand: decode(p.brands?.[0]?.name),
      originalPrice: regular, promoPrice: sale, url: p.permalink || "", image: p.images?.[0]?.src || ""
    });
  }
  return out;
}

// ---------- Jumia : cartes <article class="prd ..."> ----------
export function parseJumia(html, base) {
  const out = [];
  for (const b of blocks(html, /<article[^>]*class="[^"]*\bprd\b[^"]*"/)) {
    const name = (b.match(/<h3[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) || [])[1];
    const prc = (b.match(/<div[^>]*class="[^"]*\bprc\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1];
    const old = (b.match(/<div[^>]*class="[^"]*\bold\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1];
    if (!name || !prc || !old) continue;
    const link = (b.match(/<a[^>]*class="[^"]*\bcore\b[^"]*"[^>]*>/i) || [""])[0];
    const img = (b.match(/<img[^>]*>/i) || [""])[0];
    out.push({
      product: decode(name), brand: attr(link, "data-gtm-brand") || attr(link, "data-ga4-item_brand"),
      originalPrice: parsePrice(decode(old)), promoPrice: parsePrice(decode(prc)),
      url: absUrl(attr(link, "href"), base), image: absUrl(attr(img, "data-src") || attr(img, "src"), base)
    });
  }
  return out;
}

// ---------- PrestaShop : <article class="product-miniature"> ----------
export function parsePrestashop(html, base) {
  const out = [];
  for (const b of blocks(html, /<(?:article|div)[^>]*class="[^"]*product-miniature[^"]*"/)) {
    const regular = (b.match(/class="[^"]*regular-price[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1];
    const price = (b.match(/<span[^>]*class="(?:[^"]*\s)?(?:price|product-price)(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/i) || [])[1];
    if (!regular || !price) continue;
    // Nom du produit : titre de thème classique, sinon lien "product_name", sinon premier lien produit avec attribut title
    let title = b.match(/class="[^"]*product-title[^"]*"[^>]*>\s*(?:<a([^>]*)>)?([\s\S]*?)<\/(?:a|h\d)>/i);
    let name = title && decode(title[2]);
    let linkAttrs = title?.[1] || "";
    if (!name) {
      const a = b.match(/<a([^>]*class="[^"]*product[_-]?name[^"]*"[^>]*)>([\s\S]*?)<\/a>/i) ||
        b.match(/<a([^>]*href="[^"]*\.html"[^>]*title="[^"]+"[^>]*)>([\s\S]*?)<\/a>/i);
      if (a) { linkAttrs = a[1]; name = attr(a[1], "title") || decode(a[2]); }
    } else if (/\.\.\.$|…$/.test(name) && attr(linkAttrs, "title")) name = attr(linkAttrs, "title");
    if (!name) continue;
    const brand = decode((b.match(/class="[^"]*manufacturer[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1]);
    const img = (b.match(/<img[^>]*>/i) || [""])[0];
    title = [null, linkAttrs];
    out.push({
      product: name, brand,
      originalPrice: parsePrice(decode(regular)), promoPrice: parsePrice(decode(price)),
      url: absUrl(attr(title[1] || "", "href"), base),
      image: absUrl(attr(img, "data-full-size-image-url") || attr(img, "data-src") || attr(img, "src"), base)
    });
  }
  return out;
}

// ---------- Decathlon Maroc : cartes product-card avec data-testid / data-value ----------
export function parseDecathlon(html, base) {
  const out = [];
  for (const b of blocks(html, /<article[^>]*class="[^"]*\bproduct-card\b[^"]*"/)) {
    const cur = b.match(/data-testid="current-price"[^>]*data-value="([\d.]+)"|data-value="([\d.]+)"[^>]*data-testid="current-price"/i);
    // Prix barré : <span data-testid="price-before-reduction"> … <span aria-hidden="true">229 MAD</span>
    const old = b.match(/data-testid="price-before-reduction"[^>]*>[\s\S]*?aria-hidden="true"[^>]*>([^<]+)</i);
    if (!cur || !old) continue;
    const href = b.match(/<a[^>]*\shref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const img = (b.match(/<img[^>]*>/i) || [""])[0];
    const titleEl = b.match(/class="[^"]*product-card_title[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|p|span|a|div)>/i);
    const name = (titleEl && decode(titleEl[1])) || attr(img, "alt");
    if (!name) continue;
    const brand = decode((b.match(/class="[^"]*product-card_brand[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span|div)>/i) || [])[1]);
    out.push({
      product: name, brand,
      originalPrice: parsePrice(decode(old[1])), promoPrice: parseFloat(cur[1] || cur[2]),
      url: absUrl(href ? href[1] || href[2] || href[3] : "", base), image: absUrl(attr(img, "src") || attr(img, "data-src"), base)
    });
  }
  return out;
}

// ---------- Magento 2 : <li class="product-item"> avec data-price-amount ----------
export function parseMagento(html, base) {
  const out = [];
  for (const b of blocks(html, /<(?:li|div)[^>]*class="[^"]*\bproduct-item\b[^"]*"/)) {
    const fin = b.match(/data-price-type="finalPrice"[^>]*data-price-amount="([\d.]+)"|data-price-amount="([\d.]+)"[^>]*data-price-type="finalPrice"/i);
    const old = b.match(/data-price-type="oldPrice"[^>]*data-price-amount="([\d.]+)"|data-price-amount="([\d.]+)"[^>]*data-price-type="oldPrice"/i);
    const link = b.match(/<a([^>]*class="[^"]*product-item-link[^"]*"[^>]*)>([\s\S]*?)<\/a>/i);
    if (!fin || !old || !link) continue;
    const img = (b.match(/<img[^>]*class="[^"]*product-image-photo[^"]*"[^>]*>/i) || b.match(/<img[^>]*>/i) || [""])[0];
    out.push({
      product: decode(link[2]), brand: "",
      originalPrice: parseFloat(old[1] || old[2]), promoPrice: parseFloat(fin[1] || fin[2]),
      url: absUrl(attr(link[1], "href"), base), image: absUrl(attr(img, "src"), base)
    });
  }
  return out;
}

// ---------- WooCommerce (HTML) : <li class="product ..."> avec <del> / <ins> ----------
export function parseWooHtml(html, base) {
  const out = [];
  for (const b of blocks(html, /<li[^>]*class="[^"]*\bproduct\b[^"]*"/)) {
    const del = (b.match(/<del[^>]*>([\s\S]*?)<\/del>/i) || [])[1];
    const ins = (b.match(/<ins[^>]*>([\s\S]*?)<\/ins>/i) || [])[1];
    const title = (b.match(/<h[23][^>]*class="[^"]*(?:woocommerce-loop-product__title|product-title|product-name)[^"]*"[^>]*>([\s\S]*?)<\/h[23]>/i) || [])[1];
    if (!del || !ins || !title) continue;
    const link = (b.match(/<a[^>]*href="[^"]*"[^>]*>/i) || [""])[0];
    const img = (b.match(/<img[^>]*>/i) || [""])[0];
    out.push({
      product: decode(title), brand: "",
      originalPrice: parsePrice(decode(del)), promoPrice: parsePrice(decode(ins)),
      url: absUrl(attr(link, "href"), base), image: absUrl(attr(img, "data-src") || attr(img, "src"), base)
    });
  }
  return out;
}

/** Essaie tous les analyseurs HTML et garde celui qui trouve le plus de produits. */
export function parseAnyHtml(html, base) {
  const results = [
    ["jumia", parseJumia(html, base)],
    ["prestashop", parsePrestashop(html, base)],
    ["magento", parseMagento(html, base)],
    ["decathlon", parseDecathlon(html, base)],
    ["woocommerce-html", parseWooHtml(html, base)]
  ].sort((a, b) => b[1].length - a[1].length);
  return { platform: results[0][1].length ? results[0][0] : null, items: results[0][1] };
}

/** Garde uniquement les promotions cohérentes. */
export function isValidPromo(p) {
  return p.product && p.product.length >= 3 &&
    Number.isFinite(p.originalPrice) && Number.isFinite(p.promoPrice) &&
    p.promoPrice > 0 && p.originalPrice > p.promoPrice &&
    (p.originalPrice - p.promoPrice) / p.originalPrice >= 0.01 &&
    (p.originalPrice - p.promoPrice) / p.originalPrice <= 0.95;
}

// ---------- Catégorisation par mots-clés ----------
const KEYWORDS = [
  ["telecom", /\b(forfait|recharge|carte sim|internet 4g|5g box)\b/i],
  ["informatique", /\b(laptop|ordinateur|pc |pc$|portable \d|imprimante|clavier|souris|ssd|disque dur|écran pc|moniteur|carte graphique|processeur|routeur|cl[ée] usb)\b/i],
  ["high-tech", /\b(smartphone|t[ée]l[ée]phone|iphone|galaxy|redmi|xiaomi|tablette|ipad|tv|t[ée]l[ée]viseur|televiseur|smart tv|écouteurs|ecouteurs|casque|airpods|enceinte|montre connect|smartwatch|console|playstation|ps5|xbox|camera|appareil photo)\b/i],
  ["electromenager", /\b(r[ée]frig[ée]rateur|frigo|cong[ée]lateur|machine [àa] laver|lave[- ]linge|lave[- ]vaisselle|four|micro[- ]ondes|cuisini[èe]re|plaque|climatiseur|aspirateur|bouilloire|mixeur|blender|robot|friteuse|air fryer|batteur|plancha|gaufrier|grille[- ]pain|presse[- ]agrumes|extracteur de jus|glaci[èe]re [ée]lectrique|hachoir|appareil [àa] |po[êe]le [ée]lectrique|cafeti[èe]re|fer [àa] repasser|s[èe]che[- ]cheveux|lisseur|ventilateur|chauffage|radiateur|chauffe[- ]eau)\b/i],
  ["bebe", /\b(b[ée]b[ée]|couche|poussette|biberon|enfant|lait infantile)\b/i],
  ["sante", /\b(vitamine|compl[ée]ment|cr[èe]me solaire|spf|cerave|la roche[- ]posay|vichy|av[èe]ne|bioderma|uriage|svr|nuxe|a-derma|parapharm)\b/i],
  ["hygiene", /\b(shampo|gel douche|d[ée]odorant|parfum|maquillage|mascara|rouge [àa] l[èe]vres|soin|cr[èe]me|savon|dentifrice|rasoir|s[ée]rum)\b/i],
  ["entretien", /\b(lessive|d[ée]tergent|javel|nettoyant|liquide vaisselle|adoucissant|d[ée]sinfectant|serpill)\b/i],
  ["sport", /\b(v[ée]lo|trottinette|fitness|halt[èe]re|tapis de course|ballon|football|running|randonn[ée]e|natation|kalenji|domyos|quechua)\b/i],
  ["mode", /\b(chaussure|basket|sneaker|sandale|t-shirt|tee-shirt|chemise|pantalon|jean|robe|veste|manteau|pull|sac [àa] main|montre|djellaba|caftan|pyjama|sweat|jupe)\b/i],
  ["maison", /\b(canap[ée]|matelas|lit |armoire|chaise|table (?:basse|[àa] manger|de salon|de jardin|de chevet)|bureau|d[ée]co|rideau|tapis|couette|drap|oreiller|po[êe]le|casserole|ustensile|vaisselle|marmite|cocotte)\b/i],
  ["bricolage", /\b(perceuse|visseuse|outil|scie|meuleuse|tournevis|jardin|tondeuse|peinture)\b/i],
  ["auto", /\b(pneu|voiture|auto|moto|huile moteur|batterie auto|gps)\b/i],
  ["boissons", /\b(eau min[ée]rale|soda|jus|caf[ée] |th[ée] |boisson|lait )\b/i],
  ["alimentation", /\b(huile|farine|sucre|riz|p[âa]tes|conserve|fromage|yaourt|chocolat|biscuit|c[ée]r[ée]ale|thon|sardine|olive|miel|confiture|beurre)\b/i]
];

export function guessCategory(text, fallback = "autre") {
  for (const [cat, re] of KEYWORDS) if (re.test(text)) return cat;
  return fallback;
}
