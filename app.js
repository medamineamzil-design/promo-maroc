/* Promo Maroc — application mobile (PWA) de suivi des promotions. */
(() => {
  "use strict";

  const STORAGE = { promos: "pm.promos", favs: "pm.favs", demo: "pm.showDemo", theme: "pm.theme" };
  const $ = (sel) => document.querySelector(sel);
  const DAY = 86400000;

  // ---------- Stockage (protégé : peut être indisponible en navigation privée) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignoré */ }
    }
  };

  // ---------- Dates (au format AAAA-MM-JJ, heure locale) ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
  const fmtDate = (s) => parseISO(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  // ---------- Prix ----------
  const fmtPrice = (n) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " DH";
  const percentOf = (orig, promo) => Math.round(((orig - promo) / orig) * 1000) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  const PAGE = 40;

  // ---------- État ----------
  const state = {
    userPromos: store.get(STORAGE.promos, []),
    favs: new Set(store.get(STORAGE.favs, [])),
    showDemo: store.get(STORAGE.demo, null), // null = automatique (exemples seulement sans données réelles)
    remote: [],      // promotions collectées chaque jour (data/promotions.json)
    remoteInfo: null,
    sources: [],     // recueil des sources (sources.json)
    view: "all",
    category: "all",
    storeFilter: "all",
    query: "",
    city: "Toutes les villes",
    status: "active",
    sort: "discount",
    minPct: 0
  };

  function demoPromos() {
    const t = today();
    return DEMO_PROMOS.map((p, i) => ({
      id: "demo-" + i,
      demo: true,
      product: p.product, brand: p.brand, store: p.store, city: p.city, category: p.category,
      originalPrice: p.originalPrice, promoPrice: p.promoPrice,
      percent: percentOf(p.originalPrice, p.promoPrice),
      startDate: toISO(addDays(t, p.start)), endDate: toISO(addDays(t, p.end)),
      conditions: p.conditions || "", source: "", createdAt: addDays(t, p.start).getTime()
    }));
  }

  const demoVisible = () => state.showDemo ?? state.remote.length === 0;
  const allPromos = () => [...state.remote, ...state.userPromos, ...(demoVisible() ? demoPromos() : [])];

  // Promotions réelles : fichier mis à jour chaque jour par le robot de collecte
  async function loadRemote() {
    try {
      const [data, src] = await Promise.all([
        fetch("data/promotions.json", { cache: "no-cache" }).then((r) => r.ok ? r.json() : null),
        fetch("sources.json", { cache: "no-cache" }).then((r) => r.ok ? r.json() : null)
      ]);
      if (src) state.sources = src.sources || [];
      if (data) {
        state.remoteInfo = data;
        state.remote = (data.promotions || []).map((p) => ({
          ...p, remote: true, source: p.url || "", createdAt: parseISO(p.startDate).getTime()
        }));
      }
    } catch { /* hors ligne sans cache : on garde les données locales */ }
    render();
  }

  function statusOf(p) {
    const t = toISO(today());
    if (t < p.startDate) return "upcoming";
    if (p.endDate && t > p.endDate) return "expired";
    return "active";
  }

  function timeLabel(p) {
    const t = toISO(today());
    const st = statusOf(p);
    if (st === "upcoming") { const n = daysBetween(t, p.startDate); return n === 1 ? "Commence demain" : `Commence dans ${n} j`; }
    if (st === "expired") return "Terminée";
    if (!p.endDate) return "Fin non communiquée";
    const n = daysBetween(t, p.endDate);
    if (n === 0) return "Dernier jour !";
    if (n === 1) return "Se termine demain";
    return `Encore ${n} jours`;
  }

  // ---------- Filtrage & tri ----------
  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = allPromos();
    if (state.view === "fav") list = list.filter((p) => state.favs.has(p.id));
    if (state.view === "mine") list = list.filter((p) => !p.demo && !p.remote);
    if (state.category !== "all") list = list.filter((p) => p.category === state.category);
    if (state.storeFilter !== "all") list = list.filter((p) => p.store === state.storeFilter);
    if (state.city !== "Toutes les villes") list = list.filter((p) => p.city === state.city || p.city === "Tout le Maroc");
    if (state.status !== "all") list = list.filter((p) => statusOf(p) === state.status);
    if (state.minPct) list = list.filter((p) => p.percent >= state.minPct);
    if (q) list = list.filter((p) => [p.product, p.brand, p.store, p.city, catOf(p.category).label].join(" ").toLowerCase().includes(q));

    const sorters = {
      discount: (a, b) => b.percent - a.percent,
      ending: (a, b) => (a.endDate || "9999").localeCompare(b.endDate || "9999"),
      saving: (a, b) => (b.originalPrice - b.promoPrice) - (a.originalPrice - a.promoPrice),
      priceAsc: (a, b) => a.promoPrice - b.promoPrice,
      recent: (a, b) => b.createdAt - a.createdAt
    };
    return list.sort(sorters[state.sort]);
  }

  // ---------- Rendu ----------
  // Liste des magasins présents dans les promotions (avec leur nombre de promos en cours)
  function renderStoreFilter() {
    const counts = new Map();
    for (const p of allPromos()) if (statusOf(p) === "active") counts.set(p.store, (counts.get(p.store) || 0) + 1);
    for (const p of allPromos()) if (!counts.has(p.store)) counts.set(p.store, 0);
    const stores = [...counts].sort((a, b) => a[0].localeCompare(b[0], "fr"));
    if (state.storeFilter !== "all" && !counts.has(state.storeFilter)) state.storeFilter = "all";
    $("#fStore").innerHTML = `<option value="all">🏬 Magasins</option>` +
      stores.map(([n, c]) => `<option value="${esc(n)}"${n === state.storeFilter ? " selected" : ""}>${esc(n)}${c ? ` (${c})` : ""}</option>`).join("");
  }

  // Promotions phares : fortes remises en cours, au plus 2 par magasin pour varier
  function featuredPromos() {
    const active = allPromos().filter((p) => statusOf(p) === "active" &&
      (state.city === "Toutes les villes" || p.city === state.city || p.city === "Tout le Maroc"));
    // Les promos de catalogue (avec de vraies dates de début et de fin) sont mises en avant
    const score = (p) => p.percent + Math.min(20, Math.log10(Math.max(1, p.originalPrice - p.promoPrice)) * 5) + (p.endDate ? 15 : 0);
    const perStore = new Map();
    const out = [];
    for (const p of active.sort((a, b) => score(b) - score(a))) {
      const n = perStore.get(p.store) || 0;
      if (n >= 2) continue;
      perStore.set(p.store, n + 1);
      out.push(p);
      if (out.length === 10) break;
    }
    return out;
  }

  function renderFeatured() {
    const show = state.view === "all" && !state.query.trim();
    const items = show ? featuredPromos() : [];
    $("#featured").hidden = !items.length;
    if (!items.length) return;
    $("#featuredInfo").textContent = `${items.length} offres`;
    $("#featuredList").innerHTML = items.map((p) => {
      const cat = catOf(p.category);
      return `
        <article class="hero" data-id="${esc(p.id)}" tabindex="0">
          <div class="hero-img">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${cat.icon}</span>`}
            <b class="hero-badge">-${Math.round(p.percent)}%</b></div>
          <div class="hero-body">
            <p class="hero-store">${esc(p.store)}</p>
            <h3>${esc(p.product)}</h3>
            <p><span class="promo">${fmtPrice(p.promoPrice)}</span> <s>${fmtPrice(p.originalPrice)}</s></p>
            <p class="hero-time">${p.endDate ? timeLabel(p) : `Repérée le ${fmtDate(p.startDate)}`}</p>
          </div>
        </article>`;
    }).join("");
  }

  function renderFilters() {
    $("#fCat").innerHTML = `<option value="all">🧺 Produits</option>` +
      CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.label)}</option>`).join("");
    $("#fCity").innerHTML = ["Toutes les villes", ...CITIES.slice(1)].map((c) => `<option>${esc(c)}</option>`).join("");
    $("#formCity").innerHTML = CITIES.map((c) => `<option>${esc(c)}</option>`).join("");
    $("#formCategory").innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.label)}</option>`).join("");
    $("#storeList").innerHTML = STORES.map((s) => `<option value="${esc(s)}">`).join("");
    const chips = [{ id: "all", label: "Tout", icon: "✨" }, ...CATEGORIES];
    $("#categories").innerHTML = chips.map((c) =>
      `<button class="chip${c.id === state.category ? " active" : ""}" data-cat="${c.id}" role="tab">${c.icon} ${esc(c.label)}</button>`).join("");
  }

  function card(p) {
    const st = statusOf(p);
    const cat = catOf(p.category);
    const fav = state.favs.has(p.id);
    return `
      <article class="card ${st}" data-id="${esc(p.id)}" tabindex="0">
        <div class="badge">-${p.percent.toLocaleString("fr-FR")}%</div>
        <div class="card-icon" aria-hidden="true">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : cat.icon}</div>
        <div class="card-body">
          <h3>${esc(p.product)}</h3>
          <p class="meta">${esc(p.brand ? p.brand + " · " : "")}<b>${esc(p.store)}</b> · ${esc(p.city)}</p>
          <div class="prices">
            <span class="promo">${fmtPrice(p.promoPrice)}</span>
            <span class="orig">${fmtPrice(p.originalPrice)}</span>
          </div>
          <p class="dates">📅 ${p.endDate ? `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}` : `Depuis le ${fmtDate(p.startDate)}`}</p>
          <div class="foot">
            <span class="time ${st}">${timeLabel(p)}</span>
            ${p.demo ? '<span class="tag">Exemple</span>' : p.origin === "catalogue" ? '<span class="tag ok">Catalogue</span>' : p.remote ? '<span class="tag ok">Mise à jour auto</span>' : p.source ? '<span class="tag ok">Sourcée</span>' : ""}
          </div>
        </div>
        <button class="fav${fav ? " on" : ""}" data-fav="${esc(p.id)}" aria-label="${fav ? "Retirer des" : "Ajouter aux"} favoris">${fav ? "♥" : "♡"}</button>
      </article>`;
  }

  function render() {
    document.body.classList.toggle("view-sources", state.view === "sources");
    renderStoreFilter();
    renderFeatured();
    $("#fCat").value = state.category;
    const filtersOn = state.category !== "all" || state.storeFilter !== "all" || state.city !== "Toutes les villes" || state.minPct > 0 || state.query.trim();
    $("#btnClear").hidden = !filtersOn || state.view === "sources";
    if (state.view === "sources") return renderSources();
    const list = filtered();
    // Affichage par paquets de 40 (des milliers de promos réelles) ; on revient à 40 quand les filtres changent
    const sig = JSON.stringify([state.view, state.category, state.storeFilter, state.city, state.status, state.sort, state.minPct, state.query]);
    if (sig !== state.sig) { state.sig = sig; state.limit = PAGE; }
    const shown = list.slice(0, state.limit);
    $("#list").innerHTML = shown.map(card).join("") + (list.length > shown.length
      ? `<button id="btnMoreItems" class="btn ghost more">Voir plus (${list.length - shown.length} restantes)</button>` : "");
    $("#empty").hidden = list.length > 0;
    const best = list.reduce((m, p) => Math.max(m, p.percent), 0);
    const saving = list.reduce((s, p) => s + (p.originalPrice - p.promoPrice), 0);
    $("#stats").innerHTML = list.length
      ? `<span><b>${list.length}</b> promo${list.length > 1 ? "s" : ""}</span><span>Jusqu'à <b>-${best}%</b></span><span>Économie cumulée <b>${fmtPrice(round2(saving))}</b></span>`
      : "";
    $("#stats").innerHTML += updateInfo();
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.cat === state.category));
    document.querySelectorAll(".bottombar [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  }

  function updateInfo() {
    const d = state.remoteInfo?.generatedAt;
    if (!d) return `<span class="upd">Promotions réelles : en attente de la première collecte</span>`;
    return `<span class="upd">Mise à jour : ${new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>`;
  }

  const KINDS = [
    ["enseigne", "🏬 Enseignes et grandes surfaces (catalogues)"],
    ["e-commerce", "🛍️ Boutiques en ligne"],
    ["operateur", "📶 Opérateurs télécom"],
    ["deals", "🎟️ Deals services et loisirs"],
    ["agregateur", "📚 Agrégateurs de catalogues"]
  ];

  function renderSources() {
    const q = state.query.trim().toLowerCase();
    const report = new Map((state.remoteInfo?.sources || []).map((r) => [r.id, r]));
    const list = state.sources.filter((s) => !q || `${s.name} ${s.url} ${s.format}`.toLowerCase().includes(q));
    const auto = state.sources.filter((s) => s.adapter).length;
    $("#stats").innerHTML = `<span><b>${state.sources.length}</b> sources</span><span><b>${auto}</b> collectées chaque jour</span>` + updateInfo();
    $("#list").innerHTML = KINDS.map(([kind, title]) => {
      const items = list.filter((s) => s.kind === kind);
      if (!items.length) return "";
      return `<h2 class="group">${title} <small>${items.length}</small></h2>` + items.map((s) => {
        const r = report.get(s.id);
        const status = !s.adapter ? `<span class="tag">Consultation / saisie manuelle</span>`
          : !r ? `<span class="tag">Collecte auto · en attente</span>`
          : r.ok && r.count ? `<span class="tag ok">✔ ${r.count} promo${r.count > 1 ? "s" : ""} aujourd'hui</span>`
          : `<span class="tag err">✘ ${esc(r.error || "aucune promo trouvée")}</span>`;
        return `
          <article class="source">
            <div class="source-head">
              <h3>${esc(s.name)}</h3>
              ${s.official ? '<span class="tag ok">Officiel</span>' : '<span class="tag">Relais</span>'}
            </div>
            <p class="meta">${catOf(s.sector).icon} ${esc(s.format)} · ${esc(s.frequency)}${s.hasDates ? " · dates de validité" : ""}</p>
            ${s.notes ? `<p class="meta">${esc(s.notes)}</p>` : ""}
            <div class="foot">${status}<a class="btn small" href="${esc(s.promoUrl)}" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a></div>
          </article>`;
      }).join("");
    }).join("");
    $("#empty").hidden = list.length > 0;
    document.querySelectorAll(".bottombar [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  }

  function openDetail(id) {
    const p = allPromos().find((x) => x.id === id);
    if (!p) return;
    const cat = catOf(p.category);
    const total = p.endDate ? daysBetween(p.startDate, p.endDate) + 1 : 0;
    const elapsed = Math.min(total, Math.max(0, daysBetween(p.startDate, toISO(today())) + 1));
    const st = statusOf(p);
    const dlg = $("#dlgDetail");
    dlg.innerHTML = `
      <div class="sheet-head">
        <h2>${cat.icon} ${esc(p.product)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button>
      </div>
      ${p.demo ? '<p class="warn">Exemple de démonstration : prix non vérifiés.</p>' : ""}
      ${p.image ? `<img class="detail-img" src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">` : ""}
      <div class="detail-prices">
        <div><small>Prix original</small><s>${fmtPrice(p.originalPrice)}</s></div>
        <div class="big"><small>Prix promo</small><b>${fmtPrice(p.promoPrice)}</b></div>
        <div><small>Remise</small><b class="pct">-${p.percent}%</b></div>
      </div>
      <p class="saving">Vous économisez <b>${fmtPrice(round2(p.originalPrice - p.promoPrice))}</b></p>
      <dl class="info">
        <dt>Enseigne</dt><dd>${esc(p.store)}</dd>
        ${p.brand ? `<dt>Marque</dt><dd>${esc(p.brand)}</dd>` : ""}
        <dt>Ville</dt><dd>${esc(p.city)}</dd>
        <dt>Catégorie</dt><dd>${esc(cat.label)}</dd>
        <dt>Date début</dt><dd>${fmtDate(p.startDate)}</dd>
        <dt>Date fin</dt><dd>${p.endDate ? fmtDate(p.endDate) : "Non communiquée par le vendeur"}</dd>
        ${total ? `<dt>Durée</dt><dd>${total} jour${total > 1 ? "s" : ""}</dd>` : ""}
        ${p.remote && p.lastSeen ? `<dt>Prix vérifié le</dt><dd>${fmtDate(p.lastSeen)}</dd>` : ""}
        ${p.conditions ? `<dt>Conditions</dt><dd>${esc(p.conditions)}</dd>` : p.remote ? `<dt>Conditions</dt><dd>Prix relevé sur le site du vendeur ; date de fin non communiquée (jusqu'à épuisement ou fin de l'offre).</dd>` : ""}
        ${p.source ? `<dt>Source</dt><dd><a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">${p.origin === "catalogue" ? "Voir le catalogue" : p.remote ? "Voir chez le vendeur" : "Voir la source"}</a></dd>` : ""}
      </dl>
      ${total ? `<div class="progress" aria-label="Avancement de la promotion"><span style="width:${st === "upcoming" ? 0 : (elapsed / total) * 100}%"></span></div>` : ""}
      <p class="time ${st}">${timeLabel(p)}</p>
      <div class="actions wrap">
        <button class="btn ghost" data-share="${esc(p.id)}">📤 Partager</button>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText(p))}">💬 WhatsApp</a>
        ${p.demo || p.remote ? "" : `<button class="btn ghost" data-edit="${esc(p.id)}">✏️ Modifier</button><button class="btn danger" data-del="${esc(p.id)}">🗑️ Supprimer</button>`}
      </div>`;
    dlg.showModal();
  }

  const shareText = (p) =>
    `🏷️ ${p.product}${p.brand ? " (" + p.brand + ")" : ""} chez ${p.store} – ${p.city}\n` +
    `${fmtPrice(p.originalPrice)} ➜ ${fmtPrice(p.promoPrice)} (-${p.percent}%)\n` +
    (p.endDate ? `Du ${fmtDate(p.startDate)} au ${fmtDate(p.endDate)}` : `Depuis le ${fmtDate(p.startDate)}`) + (p.source ? `\n${p.source}` : "");

  // ---------- Formulaire ----------
  const form = $("#promoForm");
  let lastEdited = [];

  function openForm(p) {
    form.reset();
    $("#formError").textContent = "";
    lastEdited = [];
    form.elements.id.value = p ? p.id : ""; // reset() ne vide pas les champs cachés
    $("#formTitle").textContent = p ? "Modifier la promotion" : "Nouvelle promotion";
    const t = today();
    const v = p || { city: "Tout le Maroc", category: "alimentation", startDate: toISO(t), endDate: toISO(addDays(t, 7)) };
    for (const [k, val] of Object.entries(v)) if (form.elements[k] && val !== undefined) form.elements[k].value = val;
    $("#dlgForm").showModal();
  }

  // Calcul automatique du troisième champ à partir des deux derniers saisis
  form.addEventListener("input", (e) => {
    const name = e.target.name;
    if (!["originalPrice", "promoPrice", "percent"].includes(name)) return;
    lastEdited = [name, ...lastEdited.filter((n) => n !== name)].slice(0, 2);
    if (lastEdited.length < 2) {
      if (name === "percent") return;
      lastEdited = ["originalPrice", "promoPrice"];
    }
    const el = form.elements;
    const o = parseFloat(el.originalPrice.value), pr = parseFloat(el.promoPrice.value), pc = parseFloat(el.percent.value);
    const target = ["originalPrice", "promoPrice", "percent"].find((n) => !lastEdited.includes(n));
    if (target === "percent" && o > 0 && pr >= 0) el.percent.value = percentOf(o, pr);
    if (target === "promoPrice" && o > 0 && pc >= 0 && pc <= 100) el.promoPrice.value = round2(o * (1 - pc / 100));
    if (target === "originalPrice" && pr > 0 && pc > 0 && pc < 100) el.originalPrice.value = round2(pr / (1 - pc / 100));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const el = form.elements;
    const data = {
      product: el.product.value.trim(), brand: el.brand.value.trim(), store: el.store.value.trim(),
      city: el.city.value, category: el.category.value,
      originalPrice: round2(parseFloat(el.originalPrice.value)), promoPrice: round2(parseFloat(el.promoPrice.value)),
      startDate: el.startDate.value, endDate: el.endDate.value,
      source: el.source.value.trim(), conditions: el.conditions.value.trim()
    };
    const err = validate(data);
    if (err) { $("#formError").textContent = err; return; }
    data.percent = percentOf(data.originalPrice, data.promoPrice);
    const id = el.id.value;
    if (id) {
      const i = state.userPromos.findIndex((p) => p.id === id);
      state.userPromos[i] = { ...state.userPromos[i], ...data };
      toast("Promotion modifiée");
    } else {
      state.userPromos.push({ id: "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: Date.now(), ...data });
      toast("Promotion ajoutée");
    }
    save();
    $("#dlgForm").close();
    render();
  });

  function validate(d) {
    if (!d.product) return "Indiquez le nom du produit.";
    if (!d.store) return "Indiquez l'enseigne.";
    if (!(d.originalPrice > 0)) return "Le prix original doit être supérieur à 0.";
    if (!(d.promoPrice >= 0)) return "Indiquez le prix promo (ou le pourcentage).";
    if (d.promoPrice >= d.originalPrice) return "Le prix promo doit être inférieur au prix original.";
    if (!d.startDate || !d.endDate) return "Indiquez la date de début et la date de fin.";
    if (d.endDate < d.startDate) return "La date de fin doit être après la date de début.";
    if (d.source && !/^https?:\/\//i.test(d.source)) return "La source doit être un lien commençant par http:// ou https://";
    return "";
  }

  function save() {
    store.set(STORAGE.promos, state.userPromos);
    store.set(STORAGE.favs, [...state.favs]);
  }

  // ---------- Import / export ----------
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state.userPromos, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `promo-maroc-${toISO(today())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importJSON(file) {
    try {
      const arr = JSON.parse(await file.text());
      if (!Array.isArray(arr)) throw new Error();
      const known = new Set(state.userPromos.map((p) => p.id));
      let added = 0, skipped = 0;
      for (const raw of arr) {
        const p = {
          product: String(raw.product || "").trim(), brand: String(raw.brand || "").trim(), store: String(raw.store || "").trim(),
          city: CITIES.includes(raw.city) ? raw.city : "Tout le Maroc",
          category: CATEGORIES.some((c) => c.id === raw.category) ? raw.category : "autre",
          originalPrice: round2(Number(raw.originalPrice)), promoPrice: round2(Number(raw.promoPrice)),
          startDate: String(raw.startDate || ""), endDate: String(raw.endDate || ""),
          source: String(raw.source || "").trim(), conditions: String(raw.conditions || "").trim()
        };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(p.endDate) || validate(p)) { skipped++; continue; }
        const id = typeof raw.id === "string" && raw.id ? raw.id : "u-" + Date.now().toString(36) + added;
        if (known.has(id)) { skipped++; continue; }
        state.userPromos.push({ ...p, id, percent: percentOf(p.originalPrice, p.promoPrice), createdAt: Number(raw.createdAt) || Date.now() });
        known.add(id);
        added++;
      }
      save(); render();
      toast(`${added} promotion(s) importée(s)` + (skipped ? `, ${skipped} ignorée(s)` : ""));
    } catch {
      toast("Fichier invalide");
    }
  }

  // ---------- Divers ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
  }

  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }

  // ---------- Événements ----------
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  $("#fCity").addEventListener("change", (e) => { state.city = e.target.value; render(); });
  $("#fStore").addEventListener("change", (e) => { state.storeFilter = e.target.value; render(); });
  $("#fCat").addEventListener("change", (e) => { state.category = e.target.value; render(); });
  $("#btnClear").addEventListener("click", () => {
    Object.assign(state, { category: "all", storeFilter: "all", city: "Toutes les villes", minPct: 0, query: "" });
    $("#search").value = ""; $("#fCity").value = state.city; $("#fMin").value = "0";
    render();
  });
  $("#featuredList").addEventListener("click", (e) => { const c = e.target.closest(".hero"); if (c) openDetail(c.dataset.id); });
  $("#featuredList").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.classList.contains("hero")) openDetail(e.target.dataset.id); });
  $("#fStatus").addEventListener("change", (e) => { state.status = e.target.value; render(); });
  $("#fSort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#fMin").addEventListener("change", (e) => { state.minPct = Number(e.target.value); render(); });
  $("#categories").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (b) { state.category = b.dataset.cat; render(); }
  });

  $("#list").addEventListener("click", (e) => {
    if (e.target.id === "btnMoreItems") { state.limit += PAGE; render(); return; }
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      const id = favBtn.dataset.fav;
      state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
      save(); render();
      return;
    }
    const c = e.target.closest(".card");
    if (c) openDetail(c.dataset.id);
  });
  $("#list").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("card")) openDetail(e.target.dataset.id);
  });

  $("#dlgDetail").addEventListener("click", async (e) => {
    const t = e.target;
    if (t.dataset.share) {
      const p = allPromos().find((x) => x.id === t.dataset.share);
      const text = shareText(p);
      if (navigator.share) { try { await navigator.share({ title: p.product, text }); } catch { /* annulé */ } }
      else { try { await navigator.clipboard.writeText(text); toast("Copié dans le presse-papiers"); } catch { toast("Partage indisponible"); } }
    } else if (t.dataset.edit) {
      const p = state.userPromos.find((x) => x.id === t.dataset.edit);
      $("#dlgDetail").close();
      openForm(p);
    } else if (t.dataset.del) {
      if (!confirm("Supprimer cette promotion ?")) return;
      state.userPromos = state.userPromos.filter((x) => x.id !== t.dataset.del);
      state.favs.delete(t.dataset.del);
      save(); $("#dlgDetail").close(); render(); toast("Promotion supprimée");
    }
  });

  // Fermeture des fenêtres : bouton ✕ / Annuler ou clic sur le fond
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]") || e.target === d) d.close();
  }));

  document.querySelectorAll(".bottombar [data-view]").forEach((b) => b.addEventListener("click", () => {
    state.view = b.dataset.view;
    // Dans Favoris / Mes ajouts on montre aussi les promos à venir et expirées
    if (state.view === "fav" || state.view === "mine") { state.status = "all"; $("#fStatus").value = "all"; }
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("#btnAdd").addEventListener("click", () => openForm());
  $("#btnMore").addEventListener("click", () => { $("#toggleDemo").checked = demoVisible(); $("#dlgMore").showModal(); });
  $("#btnMine").addEventListener("click", () => {
    $("#dlgMore").close();
    state.view = "mine"; state.status = "all"; $("#fStatus").value = "all";
    render();
  });
  $("#btnExport").addEventListener("click", exportJSON);
  $("#fileImport").addEventListener("change", (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; });
  $("#toggleDemo").addEventListener("change", (e) => { state.showDemo = e.target.checked; store.set(STORAGE.demo, state.showDemo); render(); });
  $("#btnReset").addEventListener("click", () => {
    if (!confirm("Effacer toutes vos promotions et favoris ?")) return;
    state.userPromos = []; state.favs.clear(); save(); render(); toast("Données effacées");
  });
  $("#btnTheme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    applyTheme(next); store.set(STORAGE.theme, next);
  });

  // Image produit indisponible : on affiche l'icône de la catégorie à la place
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG") return;
    const holder = img.closest(".hero-img, .card-icon");
    if (holder) { const span = document.createElement("span"); span.textContent = "🏷️"; img.replaceWith(span); }
    else if (img.classList.contains("detail-img")) img.remove();
  }, true);

  // ---------- Démarrage ----------
  applyTheme(store.get(STORAGE.theme, null));
  renderFilters();
  render();
  loadRemote();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
