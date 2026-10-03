#!/usr/bin/env node
/* Diagnostic d'une source : affiche ce que renvoie le site pour adapter l'analyseur.
 * Usage : node scripts/debug-source.mjs decathlon,maparami */
import { readFile } from "node:fs/promises";
import { parseAnyHtml } from "./lib/parsers.mjs";

const ids = (process.argv[2] || "").split(",").map((x) => x.trim()).filter(Boolean);
const { sources: all } = JSON.parse(await readFile(new URL("../sources.json", import.meta.url), "utf8"));
// Un identifiant peut aussi être une adresse directe (https://…) pour tester une page candidate
const sources = [...all.filter((s) => ids.includes(s.id)),
  ...ids.filter((x) => /^https?:\/\//.test(x)).map((u) => ({ id: u, url: new URL(u).origin, promoUrl: u }))];
const UA = "Mozilla/5.0 (compatible; PromoMarocBot/1.0; +https://github.com/medamineamzil-design/promo-maroc)";

for (const src of sources) {
  console.log(`\n===== ${src.id} : ${src.promoUrl}`);
  for (const url of [src.promoUrl, src.url.replace(/\/$/, "") + "/products.json?limit=1", src.url.replace(/\/$/, "") + "/wp-json/wc/store/v1/products?per_page=1"]) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-MA,fr;q=0.9" }, redirect: "follow" });
      const body = await res.text();
      console.log(`-- ${url}\n   HTTP ${res.status} → ${res.url}\n   type=${res.headers.get("content-type")} server=${res.headers.get("server")} taille=${body.length}`);
      if (url !== src.promoUrl) { console.log("   début : " + body.slice(0, 200).replace(/\s+/g, " ")); continue; }
      const marks = ["product-miniature", "product-item", 'class="prd', "woocommerce", "cdn.shopify", "__NEXT_DATA__", "application/ld+json", "regular-price", "old-price", "oldPrice", "price--compare", "<del", "data-price", "prestashop", "Magento", "vtex", "salesforce", "algolia"];
      console.log("   marqueurs : " + marks.map((m) => `${m}=${body.split(m).length - 1}`).join(" "));
      console.log("   titre : " + (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim());
      // Catalogues : liens PDF, liseuses intégrées (iframe) et grandes images
      const uniq = (a) => [...new Set(a)].slice(0, 15);
      const pdfs = uniq([...body.matchAll(/(?:href|src|data-[a-z-]+)=["']([^"']+\.pdf[^"']*)["']/gi)].map((m) => m[1]));
      const frames = uniq([...body.matchAll(/<iframe[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]));
      const imgs = uniq([...body.matchAll(/(?:src|data-src|href)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi)].map((m) => m[1])
        .filter((u) => /catalog|depliant|flyer|promo|leaflet|brochure|upload|wp-content|cdn/i.test(u)));
      const links = uniq([...body.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)]
        .filter((m) => /catalog|d[ée]pliant|promo|offre|arrivage/i.test(m[1] + m[2])).map((m) => `${m[1]} « ${m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)} »`));
      const dates = uniq([...body.replace(/<[^>]+>/g, " ").matchAll(/(?:du|valable|jusqu'au|au)\s+\d{1,2}(?:er)?\s*(?:[\/.-]\d{1,2}|\s+[a-zéû]+)[^.<]{0,40}/gi)].map((m) => m[0].replace(/\s+/g, " ")));
      console.log("   PDF : " + (pdfs.join(" | ") || "aucun"));
      console.log("   iframes : " + (frames.join(" | ") || "aucune"));
      console.log("   images : " + (imgs.join(" | ") || "aucune"));
      console.log("   liens catalogue : " + (links.join(" | ") || "aucun"));
      console.log("   dates : " + (dates.join(" | ") || "aucune"));
      // Sites construits dans le navigateur (Next.js…) : adresses d'API visibles dans la page
      const apis = uniq([...body.matchAll(/https?:\/\/[a-z0-9.-]+(?:\/[^"'\s<>\\]*)?(?:api|graphql|catalog|promo|flyer|cms)[^"'\s<>\\]*/gi)].map((m) => m[0]));
      console.log("   API repérées : " + (apis.join(" | ") || "aucune"));
      const nextData = body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]{0,1500})/);
      if (nextData) console.log("   __NEXT_DATA__ : " + nextData[1].replace(/\s+/g, " "));
      const rsc = [...body.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]{0,600}?)"\]\)/g)].map((m) => m[1]).filter((x) => /promo|catalog|prix|price|pdf|jpg/i.test(x)).slice(0, 6);
      if (rsc.length) console.log("   données Next.js : " + rsc.join(" || ").replace(/\s+/g, " "));
      // Scripts du site (Next.js, React…) : on y cherche les adresses d'où viennent les données
      if (/_next\/static|__next_f|data-reactroot|id="root"/.test(body)) {
        const scripts = uniq([...body.matchAll(/<script[^>]*src=["']([^"']+\.js[^"']*)["']/gi)].map((m) => new URL(m[1], res.url).href)).slice(0, 15);
        const all = new Set();
        for (const js of [...new Set([...body.matchAll(/<script[^>]*src=["']([^"']+\.js[^"']*)["']/gi)].map((m) => new URL(m[1], res.url).href))].slice(0, 60)) {
          try {
            const code = await (await fetch(js, { headers: { "User-Agent": UA } })).text();
            for (const m of code.matchAll(/["'`](https?:\/\/[a-z0-9.-]+[^"'`\s]{0,120})["'`]/gi))
              if (!/w3\.org|reactjs|nextjs\.org|googletagmanager|google-analytics|facebook|schema\.org|github|mozilla|fonts\./i.test(m[1])) all.add(m[1]);
            for (const m of code.matchAll(/["'`](\/(?:api|graphql|wp-json|v\d)[^"'`\s]{0,100})["'`]/gi)) all.add(m[1]);
          } catch { /* script illisible */ }
        }
        console.log(`   scripts analysés : ${scripts.length}+ ; adresses trouvées : ` + ([...all].slice(0, 60).join(" | ") || "aucune"));
      }
      const res2 = parseAnyHtml(body, src.promoUrl);
      console.log(`   analyseur : ${res2.platform} ${res2.items.length} produits`);
      const anchor = body.search(/data-testid="current-price"|regular-price/);
      if (anchor > 0) {
        const start = Math.max(body.lastIndexOf("product-card", anchor - 1) - 200, anchor - 3000, 0);
        console.log("   carte produit complète : " + body.slice(start, anchor + 1800).replace(/\s+/g, " "));
      }
      const re = /(regular-price|old-price|oldPrice|price--compare|<del|data-price|class="[^"]*price[^"]*")/gi;
      let m, n = 0;
      while ((m = re.exec(body)) && n < 4) { console.log("   extrait : " + body.slice(Math.max(0, m.index - 400), m.index + 300).replace(/\s+/g, " ")); n++; re.lastIndex = m.index + 2000; }
    } catch (e) {
      console.log(`-- ${url}\n   erreur : ${e.message}`);
    }
  }
}
