#!/usr/bin/env node
/*
 * Mise à jour quotidienne des promotions de Promo Maroc.
 *
 * - lit sources.json et collecte chaque source dont "adapter" n'est pas null ;
 * - ajoute les promotions saisies à la main dans data/manual.json (catalogues avec dates) ;
 * - conserve la date de première détection (= date de début) d'un jour sur l'autre ;
 * - une promo qui disparaît de sa source reçoit comme date de fin le dernier jour où elle a été vue ;
 * - écrit data/promotions.json, lu par l'application.
 *
 * Usage : node scripts/update-promos.mjs [--only=id1,id2] [--dry-run]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseShopify, parseWooStore, parseJumia, parseAnyHtml, isValidPromo, guessCategory } from "./lib/parsers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.PROMO_OUT || join(ROOT, "data", "promotions.json");
const MANUAL = join(ROOT, "data", "manual.json");
const CATALOGUES = process.env.PROMO_CATALOGUES || join(ROOT, "data", "catalogues.json");
const UA = "Mozilla/5.0 (compatible; PromoMarocBot/1.0; +https://github.com/medamineamzil-design/promo-maroc)";
const MAX_PAGES = 5;
const KEEP_IF_SOURCE_DOWN_DAYS = 3; // site en panne : on garde ses promos d'hier au plus 3 jours
const DELAY_MS = Number(process.env.PROMO_DELAY_MS ?? 1500);

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const only = args.only ? new Set(String(args.only).split(",")) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Casablanca" });
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);
const round2 = (n) => Math.round(n * 100) / 100;
const percentOf = (o, p) => Math.round(((o - p) / o) * 1000) / 10;

async function get(url, opts = {}) {
  try { return await getOnce(url, opts); }
  catch (e) {
    if (/HTTP 4\d\d/.test(e.message)) throw e; // refus explicite : inutile d'insister
    await sleep(5000);
    return getOnce(url, opts); // une nouvelle tentative pour les erreurs réseau passagères
  }
}

async function getOnce(url, { json = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "fr-MA,fr;q=0.9", Accept: json ? "application/json" : "text/html,application/xhtml+xml" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (json) {
      if (!type.includes("json")) throw new Error("pas du JSON");
      return await res.json();
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const withPage = (url, n) => {
  if (n === 1) return url;
  const u = new URL(url);
  u.searchParams.set("page", n);
  return u.href;
};

// ---------- Adaptateurs ----------
async function tryShopify(src) {
  const items = [];
  for (let page = 1; page <= (src.maxPages || MAX_PAGES); page++) {
    const json = await get(`${src.url.replace(/\/$/, "")}/products.json?limit=250&page=${page}`, { json: true });
    if (!json?.products?.length) break;
    items.push(...parseShopify(json, src.url));
    await sleep(DELAY_MS);
  }
  return items;
}

async function tryWooStore(src) {
  const items = [];
  for (let page = 1; page <= (src.maxPages || MAX_PAGES); page++) {
    const json = await get(`${src.url.replace(/\/$/, "")}/wp-json/wc/store/v1/products?on_sale=true&per_page=100&page=${page}`, { json: true });
    if (!Array.isArray(json) || !json.length) break;
    items.push(...parseWooStore(json));
    await sleep(DELAY_MS);
  }
  return items;
}

async function tryHtml(src, parser) {
  const items = [];
  let platform = null;
  const seen = new Set();
  for (let page = 1; page <= (src.maxPages || MAX_PAGES); page++) {
    let html;
    try { html = await get(withPage(src.promoUrl, page)); }
    catch (e) { if (page === 1) throw e; break; } // fin de la pagination
    const res = parser ? { platform: "jumia", items: parser(html, src.promoUrl) } : parseAnyHtml(html, src.promoUrl);
    const fresh = res.items.filter((i) => !seen.has(i.url || i.product));
    if (!fresh.length) break;
    fresh.forEach((i) => seen.add(i.url || i.product));
    platform = res.platform;
    items.push(...fresh);
    await sleep(DELAY_MS);
  }
  return { platform, items };
}

async function collect(src) {
  if (src.adapter === "jumia") return { platform: "jumia", ...(await tryHtml(src, parseJumia)) };
  // auto : API structurées d'abord, puis analyse du HTML de la page promotions
  for (const [platform, fn] of [["shopify", tryShopify], ["woocommerce", tryWooStore]]) {
    try {
      const items = await fn(src);
      if (items.length) return { platform, items };
    } catch { /* plateforme différente : on essaie la suivante */ }
  }
  return tryHtml(src);
}

// ---------- Programme principal ----------
async function main() {
  const today = todayISO();
  const { sources } = JSON.parse(await readFile(process.env.PROMO_SOURCES || join(ROOT, "sources.json"), "utf8"));
  const previous = await readFile(OUT, "utf8").then(JSON.parse).catch(() => ({ promotions: [] }));
  const prevById = new Map(previous.promotions.filter((p) => p.origin === "auto").map((p) => [p.id, p]));
  const manual = await readFile(MANUAL, "utf8").then(JSON.parse).catch(() => []);

  const report = [];
  const found = new Map();
  const seenKeys = new Set(); // dédoublonnage entre sources (même lien ou même produit au même prix)
  const normUrl = (u) => (u || "").split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();

  for (const src of sources.filter((s) => s.adapter && (!only || only.has(s.id)))) {
    const started = Date.now();
    try {
      const { platform, items } = await collect(src);
      let kept = 0;
      for (const it of items) {
        it.originalPrice = round2(it.originalPrice);
        it.promoPrice = round2(it.promoPrice);
        if (!isValidPromo(it)) continue;
        const id = "a-" + hash(src.id + "|" + (it.url || it.product));
        const store = src.store || src.name.split(" – ")[0];
        const keys = [it.url && "u:" + normUrl(it.url), `p:${store}|${it.product.toLowerCase()}|${it.promoPrice}`].filter(Boolean);
        if (found.has(id) || keys.some((k) => seenKeys.has(k))) continue;
        keys.forEach((k) => seenKeys.add(k));
        found.set(id, { ...it, sourceId: src.id, store, sector: src.sector });
        kept++;
      }
      report.push({ id: src.id, ok: true, platform, count: kept, ms: Date.now() - started });
      console.log(`✔ ${src.id.padEnd(20)} ${String(kept).padStart(4)} promos  (${platform || "aucune plateforme reconnue"})`);
    } catch (e) {
      report.push({ id: src.id, ok: false, error: String(e.message || e), count: 0 });
      console.log(`✘ ${src.id.padEnd(20)} ${e.message || e}`);
    }
  }

  // Sources en échec aujourd'hui : on garde leurs promos d'hier telles quelles plutôt que de les déclarer terminées
  // (de même pour les sources non collectées lors d'un passage partiel --only)
  const failed = new Set(report.filter((r) => !r.ok || r.count === 0).map((r) => r.id));
  const ran = new Set(report.map((r) => r.id));
  for (const prev of prevById.values()) if (!ran.has(prev.sourceId)) failed.add(prev.sourceId);

  const promotions = [];
  for (const [id, it] of found) {
    const prev = prevById.get(id);
    promotions.push({
      id, origin: "auto", sourceId: it.sourceId,
      product: it.product, brand: it.brand || "", store: it.store, city: "Tout le Maroc",
      category: guessCategory(`${it.product} ${it.brand || ""}`, it.sector),
      originalPrice: it.originalPrice, promoPrice: it.promoPrice, percent: percentOf(it.originalPrice, it.promoPrice),
      startDate: prev && !prev.endDate ? prev.startDate : today,
      endDate: null, lastSeen: today,
      url: it.url, image: it.image || ""
    });
  }
  for (const prev of prevById.values()) {
    if (found.has(prev.id)) continue;
    const srcInfo = sources.find((x) => x.id === prev.sourceId);
    if (srcInfo?.store) prev.store = srcInfo.store;
    // Promo sans date de fin qui n'est plus sur le site du vendeur : elle est retirée.
    // Exception : si le site n'a pas répondu aujourd'hui, on la garde quelques jours.
    if (failed.has(prev.sourceId) && !prev.endDate && prev.lastSeen >= addDays(today, -KEEP_IF_SOURCE_DOWN_DAYS)) promotions.push(prev);
  }

  // Promotions saisies à partir des catalogues (avec dates réelles)
  for (const m of manual) {
    const o = Number(m.originalPrice), p = Number(m.promoPrice);
    if (!(o > p && p > 0) || !m.startDate || !m.endDate || m.endDate < today) continue; // terminée : retirée
    promotions.push({
      id: "m-" + hash(`${m.store}|${m.product}|${m.startDate}`), origin: "manual", sourceId: m.sourceId || "",
      product: m.product, brand: m.brand || "", store: m.store, city: m.city || "Tout le Maroc",
      category: m.category || guessCategory(m.product), originalPrice: round2(o), promoPrice: round2(p),
      percent: percentOf(o, p), startDate: m.startDate, endDate: m.endDate,
      url: m.source || "", image: m.image || "", conditions: m.conditions || ""
    });
  }

  // Promotions lues dans les catalogues des grandes surfaces (scripts/catalogues.mjs), avec leurs vraies dates
  const catalogues = await readFile(CATALOGUES, "utf8").then(JSON.parse).catch(() => ({ catalogues: {} }));
  const seenCat = new Set();
  for (const c of Object.values(catalogues.catalogues || {})) {
    if (!c.startDate || !c.endDate || c.endDate < today) continue; // sans date de fin ou terminé : pas affiché
    for (const p of c.products || []) {
      const id = "c-" + hash(`${c.store}|${p.product}|${p.promoPrice}|${c.startDate}`);
      if (seenCat.has(id)) continue;
      seenCat.add(id);
      promotions.push({
        id, origin: "catalogue", sourceId: c.sourceId,
        product: p.product, brand: p.brand || "", store: c.store, city: "Tout le Maroc",
        category: p.category || guessCategory(p.product), originalPrice: p.originalPrice, promoPrice: p.promoPrice,
        percent: percentOf(p.originalPrice, p.promoPrice), startDate: c.startDate, endDate: c.endDate,
        url: c.file || c.page || "", image: "",
        conditions: [c.title && `Catalogue « ${c.title} »`, c.cities && `Magasins : ${c.cities}`, p.conditions].filter(Boolean).join(" · ")
      });
    }
  }

  promotions.sort((a, b) => b.percent - a.percent);
  const data = { generatedAt: new Date().toISOString(), date: today, count: promotions.length, sources: report, promotions };

  if (args["dry-run"]) {
    console.log(`\n${promotions.length} promotions (dry-run, rien d'écrit)`);
    return;
  }
  await mkdir(dirname(OUT), { recursive: true });
  // Une promo par ligne : fichier compact mais lisible dans les diffs git
  const body = JSON.stringify({ ...data, promotions: [] }).replace(/"promotions":\[\]/, () =>
    '"promotions":[\n' + promotions.map((p) => JSON.stringify(p)).join(",\n") + "\n]");
  await writeFile(OUT, body + "\n");
  const okCount = report.filter((r) => r.ok && r.count > 0).length;
  console.log(`\n${promotions.length} promotions écrites dans data/promotions.json — ${okCount}/${report.length} sources avec résultats`);
}

main().catch((e) => { console.error(e); process.exit(1); });
