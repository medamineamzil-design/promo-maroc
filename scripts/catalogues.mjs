#!/usr/bin/env node
/*
 * Lecture automatique des catalogues des grandes surfaces (Marjane, Carrefour, Aswak Assalam, BIM, Kazyon…).
 *
 * Pour chaque source de sources.json ayant un bloc "catalogue" :
 *   1. ouvre les pages indiquées et y repère les catalogues (liens PDF, ou images de dépliant) ;
 *   2. envoie chaque nouveau catalogue à Claude, qui en extrait les produits en promotion :
 *      produit, marque, prix original, prix promo, et les dates de validité du catalogue ;
 *   3. enregistre le résultat dans data/catalogues.json (un catalogue déjà lu n'est jamais relu).
 *
 * Seules les promos avec prix original + prix promo + date de début + date de fin sont gardées.
 * Nécessite la variable ANTHROPIC_API_KEY (secret du dépôt GitHub). Sans elle, rien n'est fait.
 *
 * Usage : node scripts/catalogues.mjs [--only=marjane,bim] [--max=6]
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = process.env.PROMO_CATALOGUES || join(ROOT, "data", "catalogues.json");
const UA = "Mozilla/5.0 (compatible; PromoMarocBot/1.0; +https://github.com/medamineamzil-design/promo-maroc)";
const MODEL = "claude-opus-5-5";
const MAX_PDF_BYTES = 30 * 1024 * 1024; // limite de 32 Mo par requête
const MAX_IMAGES = 20;

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const only = args.only ? new Set(String(args.only).split(",")) : null;
const maxNew = Number(args.max ?? 6); // plafond de catalogues lus par passage (maîtrise du coût)

const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Casablanca" });
const sha = (buf) => createHash("sha1").update(buf).digest("hex");
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Schéma de sortie demandé à Claude ----------
const CATEGORIES = ["alimentation", "boissons", "hygiene", "entretien", "electromenager", "high-tech", "informatique", "mode",
  "maison", "bricolage", "bebe", "sport", "auto", "sante", "telecom", "voyage", "autre"];

const Extraction = z.object({
  catalogue: z.object({
    title: z.string().describe("Titre ou thème du catalogue, ex. « Rentrée 2026 »"),
    startDate: z.string().nullable().describe("Premier jour de validité, format AAAA-MM-JJ, ou null si absent du catalogue"),
    endDate: z.string().nullable().describe("Dernier jour de validité, format AAAA-MM-JJ, ou null si absent du catalogue"),
    cities: z.string().nullable().describe("Villes ou magasins concernés si le catalogue les limite, sinon null")
  }),
  products: z.array(z.object({
    product: z.string().describe("Nom du produit tel qu'imprimé, avec contenance / taille (ex. « Huile de table 5 L »)"),
    brand: z.string().nullable(),
    category: z.enum(CATEGORIES),
    originalPrice: z.number().describe("Prix avant remise (prix barré) en dirhams"),
    promoPrice: z.number().describe("Prix promotionnel en dirhams"),
    conditions: z.string().nullable().describe("Conditions particulières imprimées (carte fidélité, 2e à -50 %, etc.)")
  }))
});

const PROMPT = (store, hint) => `Voici le catalogue promotionnel de l'enseigne marocaine « ${store} ».
Nous sommes le ${todayISO()}.${hint ? `\nIndication trouvée sur la page web du catalogue : « ${hint} ».` : ""}

Extrais les produits en promotion, en respectant strictement ces règles :
- Ne garde un produit que si le prix avant remise (prix barré ou « au lieu de ») ET le prix promotionnel sont tous deux lisibles.
  Si seul un pourcentage est affiché avec le prix promo, calcule le prix original = prix promo / (1 - pourcentage).
  Un produit avec un seul prix (sans remise visible) n'est PAS une promotion : ignore-le.
- Les prix sont en dirhams (DH / MAD). « 12,90 » = 12.90. Ne confonds pas le prix au kilo avec le prix du produit.
- Recopie les dates de validité imprimées (« du … au … »). Année absente : prends l'année cohérente avec la date du jour.
  N'invente jamais de date : mets null si elle n'est pas imprimée.
- N'invente aucun produit ni aucun prix ; en cas de doute sur un chiffre, ignore le produit.`;

// ---------- Réseau ----------
async function fetchBuf(url, accept) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "fr-MA,fr;q=0.9" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "", url: res.url };
}

const abs = (u, base) => { try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return null; } };

/** Repère les catalogues d'une page : PDF en priorité, sinon les images de dépliant. */
async function discover(src) {
  const cfg = src.catalogue;
  const include = cfg.include ? new RegExp(cfg.include, "i") : null;
  const found = [];
  let reachable = 0;
  for (const page of cfg.pages) {
    let html;
    try { html = (await fetchBuf(page, "text/html")).buf.toString("utf8"); reachable++; }
    catch (e) { console.log(`   ${page} : ${e.message}`); continue; }
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const hint = (text.match(/(?:du|valable)\s+\d{1,2}(?:er)?\s*(?:[\/.-]\d{1,2}|[a-zéû]+)[^.]{0,40}?(?:au|jusqu'au)\s+\d{1,2}(?:er)?\s*(?:[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|[a-zéû]+(?:\s+\d{4})?)/i) || [""])[0];
    const pdfs = [...new Set([...html.matchAll(/(?:href|src|data-[a-z-]+)=["']([^"']+?\.pdf(?:\?[^"']*)?)["']/gi)]
      .map((m) => abs(m[1], page)).filter(Boolean).filter((u) => !include || include.test(u)))];
    if (pdfs.length) {
      for (const u of pdfs.slice(0, cfg.maxFiles || 4)) found.push({ key: u, kind: "pdf", urls: [u], page, hint });
      continue;
    }
    if (cfg.flipbook) {
      // Liseuse feuilletable (FlipBuilder / FlipHTML5) : les pages sont des images numérotées 1.jpg, 2.jpg…
      for (const m of html.matchAll(/(?:src|href)=["']([^"']+\/mobile\/index\.html)["']/gi)) {
        const base = abs(m[1], page).replace(/mobile\/index\.html$/, "");
        if (found.some((f) => f.key === base)) continue;
        const imgs = await flipbookPages(base);
        console.log(`   liseuse ${base} : ${imgs.length} page(s) trouvée(s)`);
        if (imgs.length) found.push({ key: base, kind: "images", urls: imgs, page, hint });
      }
    }
    if (cfg.images) {
      const imgs = [...new Set([...html.matchAll(/(?:src|data-src|data-lazy-src|href)=["']([^"']+?\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)]
        .map((m) => abs(m[1], page)).filter(Boolean)
        .filter((u) => (include ? include.test(decodeURI(u)) : /catalog|depliant|flyer|leaflet|brochure/i.test(u))))];
      // Regroupement par dépliant (ex. la date d'arrivage dans le nom du fichier)
      const groups = new Map();
      for (const u of imgs) {
        const g = cfg.group ? (decodeURI(u).match(new RegExp(cfg.group, "i")) || [])[1] || "autre" : "tout";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(u);
      }
      for (const [g, urls] of groups) {
        found.push({ key: page + "#" + g + "#" + sha(urls.join("|")).slice(0, 10), kind: "images", urls: urls.slice(0, MAX_IMAGES), page,
          hint: [hint, g !== "tout" && g !== "autre" ? `nom des fichiers du dépliant : « ${g} »` : ""].filter(Boolean).join(" ; ") });
      }
    }
  }
  if (!reachable) throw new Error("page(s) catalogue injoignable(s)");
  return found;
}

async function exists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    return res.ok && /image/.test(res.headers.get("content-type") || "");
  } catch { return false; }
}

async function flipbookPages(base) {
  for (const dir of ["files/large/", "files/mobile/", "files/page/"]) {
    const urls = [];
    for (let i = 1; i <= 40; i++) {
      const u = `${base}${dir}${i}.jpg`;
      if (!(await exists(u))) break;
      urls.push(u);
    }
    if (urls.length) return urls.slice(0, MAX_IMAGES);
  }
  return [];
}

// ---------- Lecture par Claude ----------
async function extract(client, src, cat) {
  const content = [];
  if (cat.kind === "pdf") {
    const { buf } = await fetchBuf(cat.urls[0], "application/pdf");
    if (buf.length > MAX_PDF_BYTES) throw new Error(`PDF trop lourd (${Math.round(buf.length / 1e6)} Mo)`);
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("le lien ne renvoie pas un PDF");
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } });
  } else {
    for (const u of cat.urls) {
      const { buf, type } = await fetchBuf(u, "image/*");
      const media = type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg";
      if (buf.length > 5 * 1024 * 1024) continue; // limite par image
      content.push({ type: "image", source: { type: "base64", media_type: media, data: buf.toString("base64") } });
    }
    if (!content.length) throw new Error("aucune image exploitable");
  }
  content.push({ type: "text", text: PROMPT(src.store || src.name, cat.hint) });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
    // En cas de refus par un filtre de sécurité, l'API relance la requête sur le modèle de repli recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content }]
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("refus du modèle");
  if (msg.stop_reason === "max_tokens") throw new Error("réponse tronquée (catalogue trop long)");
  if (!msg.parsed_output) throw new Error("réponse illisible");
  return { data: msg.parsed_output, usage: msg.usage };
}

// ---------- Programme principal ----------
async function main() {
  const today = todayISO();
  const { sources } = JSON.parse(await readFile(join(ROOT, "sources.json"), "utf8"));
  const cache = await readFile(CACHE, "utf8").then(JSON.parse).catch(() => ({ catalogues: {} }));

  // Les catalogues terminés sont retirés du cache
  for (const [k, c] of Object.entries(cache.catalogues)) if (c.endDate && c.endDate < today) delete cache.catalogues[k];

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY absente : lecture des catalogues désactivée (ajoutez le secret dans GitHub).");
    await writeFile(CACHE, JSON.stringify(cache, null, 1) + "\n");
    return;
  }
  const client = new Anthropic();
  let done = 0;

  for (const src of sources.filter((s) => s.catalogue && (!only || only.has(s.id)))) {
    console.log(`\n▶ ${src.name}`);
    let cats;
    try { cats = await discover(src); } catch (e) { console.log(`   découverte impossible : ${e.message}`); continue; }
    // Dépliant sans date de fin (ex. arrivages BIM « jusqu'à épuisement ») : affiché tant qu'il est en ligne
    // chez l'enseigne, retiré dès qu'il n'y est plus.
    const online = new Set(cats.map((c) => c.key));
    for (const [k, c] of Object.entries(cache.catalogues)) {
      if (c.sourceId !== src.id || c.endDate) continue;
      if (online.has(k)) c.lastSeen = today;
      else { delete cache.catalogues[k]; console.log(`   retiré (plus en ligne) : ${c.title}`); }
    }
    if (!cats.length) { console.log("   aucun catalogue repéré"); continue; }
    for (const cat of cats) {
      if (cache.catalogues[cat.key]) { cache.catalogues[cat.key].lastSeen = today; console.log(`   déjà lu : ${cat.key}`); continue; }
      if (done >= maxNew) { console.log(`   plafond de ${maxNew} catalogues atteint pour aujourd'hui`); break; }
      try {
        const { data, usage } = await extract(client, src, cat);
        done++;
        const c = data.catalogue;
        const valid = /^\d{4}-\d{2}-\d{2}$/;
        const items = data.products
          .map((p) => ({ ...p, originalPrice: round2(p.originalPrice), promoPrice: round2(p.promoPrice) }))
          .filter((p) => p.promoPrice > 0 && p.originalPrice > p.promoPrice && (p.originalPrice - p.promoPrice) / p.originalPrice <= 0.9);
        cache.catalogues[cat.key] = {
          sourceId: src.id, store: src.store || src.name, title: c.title, page: cat.page, file: cat.urls[0],
          startDate: valid.test(c.startDate || "") ? c.startDate : null,
          endDate: valid.test(c.endDate || "") ? c.endDate : null,
          cities: c.cities, readAt: today, lastSeen: today, products: items
        };
        console.log(`   ✔ ${c.title} : ${items.length} promos, du ${c.startDate} au ${c.endDate} (${usage.input_tokens} + ${usage.output_tokens} jetons)`);
        if (!cache.catalogues[cat.key].endDate) console.log("   pas de date de fin imprimée : affiché tant que le dépliant est en ligne");
      } catch (e) {
        console.log(`   ✘ ${cat.key} : ${e.message}`);
      }
    }
  }
  await writeFile(CACHE, JSON.stringify(cache, null, 1) + "\n");
  console.log(`\n${done} nouveau(x) catalogue(s) lu(s), ${Object.keys(cache.catalogues).length} en cache`);
}

main().catch((e) => { console.error(e); process.exit(1); });
