# Promo Maroc — application mobile de promotions

**Adresse : https://medamineamzil-design.github.io/promo-maroc/**

Application mobile (PWA, installable sur Android et iPhone, fonctionne hors ligne) pour suivre les
promotions commerciales au Maroc, tous types de produits.

## Fonctionnalités

- Pour chaque promotion : **produit, marque, enseigne, ville, catégorie, prix original, prix promo,
  pourcentage de remise, date de début, date de fin**, conditions et lien vers la source.
- Calcul automatique : saisissez deux valeurs parmi prix original / prix promo / pourcentage, la troisième est calculée.
- Statut automatique selon la date du jour : **En cours**, **À venir**, **Expirée**, avec le nombre de jours restants
  et une barre d'avancement.
- Recherche, filtres (ville, statut, remise minimum, 17 catégories), tri (% de remise, fin proche,
  économie, prix, récentes).
- Favoris, ajout / modification / suppression de promotions, partage (WhatsApp ou partage natif).
- Import / export JSON, thème clair / sombre, prix en dirhams (DH).

## Lancer l'application

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080 (ou http://<ip-du-pc>:8080 depuis le téléphone)
```

Pour l'installer sur un téléphone, hébergez le dossier en HTTPS (GitHub Pages, Netlify…), ouvrez-le dans
Chrome / Safari puis « Ajouter à l'écran d'accueil ».

## Promotions réelles et mise à jour quotidienne

- **Recueil des sources** : `sources.json` (61 sources : enseignes, boutiques en ligne, opérateurs, agrégateurs),
  lisible dans [SOURCES.md](SOURCES.md) et dans l'onglet **Sources** de l'application.
- **Robot quotidien** : `.github/workflows/update.yml` lance chaque matin (≈ 6 h 17, heure du Maroc)
  `scripts/update-promos.mjs`, qui :
  1. collecte les sources marquées `adapter` (détection automatique Shopify / WooCommerce / PrestaShop / Magento, analyseur Jumia) ;
  2. garde les produits avec prix barré et prix promo cohérents (remise entre 1 % et 95 %) ;
  3. conserve la **date de début** (premier jour où la promo est vue) et pose la **date de fin** quand la promo disparaît
     du site (les sites marchands n'affichent généralement pas de date de fin) ;
  4. ajoute les promos de catalogues saisies dans `data/manual.json` (avec leurs vraies dates) ;
  5. écrit `data/promotions.json` et le commite. L'application le charge à l'ouverture.
- Lancement manuel : onglet **Actions** de GitHub → « Mise à jour quotidienne des promotions » → *Run workflow*,
  ou en local : `node scripts/update-promos.mjs` (option `--only=jumia-flash,decathlon`).
- Tests des analyseurs : `node --test scripts/test/parsers.test.mjs`.

> Les tâches planifiées GitHub ne tournent que sur la branche par défaut (`main`) : le robot démarrera une fois
> cette branche fusionnée. Le rapport de chaque passage (source par source : nombre de promos ou erreur) est visible
> dans l'onglet Sources de l'application.
> Respectez les conditions d'utilisation des sites collectés ; retirez une source (`"adapter": null`) si son site l'interdit.

### Catalogues des grandes surfaces (lecture par IA)

`scripts/catalogues.mjs` lit chaque jour, avant la collecte, les catalogues des sources ayant un bloc `catalogue`
dans `sources.json` (BIM : dépliants d'arrivage en images ; Aswak Assalam : catalogue feuilletable). Claude
(`claude-opus-5-5`, sortie structurée) en extrait produit, marque, prix original, prix promo et dates de validité.
Un catalogue n'est lu qu'une fois (cache `data/catalogues.json`), au plus 6 nouveaux par jour.

- **Activation** : ajouter le secret `ANTHROPIC_API_KEY` dans GitHub → Settings → Secrets and variables → Actions.
  Sans ce secret, l'étape est ignorée.
- Seules les promos avec prix original, prix promo, date de début **et** date de fin imprimées sont publiées ;
  elles disparaissent automatiquement après leur date de fin.
- Marjane refuse les robots (403) et Kazyon n'a pas de site joignable : saisie manuelle (`data/manual.json`).

### Règle de retrait

- Promo de boutique en ligne (sans date de fin) : retirée dès qu'elle n'est plus sur le site du vendeur
  (gardée au plus 3 jours si le site ne répond pas).
- Promo de catalogue ou saisie à la main : retirée le lendemain de sa date de fin.
- Dépliant sans date de fin (arrivages BIM, « jusqu'à épuisement du stock ») : affiché tant qu'il est en ligne
  sur le site de l'enseigne, retiré à la mise à jour où il n'y est plus.

### Publication du site (GitHub Pages)

`.github/workflows/pages.yml` publie l'application à chaque modification et après chaque mise à jour.
À activer une fois : GitHub → Settings → Pages → Source : **GitHub Actions**. Adresse :
`https://medamineamzil-design.github.io/promo-maroc/`

### Saisie des catalogues (`data/manual.json`)

```json
[
  { "sourceId": "marjane", "store": "Marjane", "city": "Tout le Maroc", "product": "Huile de table 5 L", "brand": "Lesieur",
    "category": "alimentation", "originalPrice": 99.9, "promoPrice": 84.9,
    "startDate": "2026-09-24", "endDate": "2026-10-11", "source": "https://www.marjane.ma/contenu/catalogues-magasin" }
]
```

## Données

Les promotions marquées **Exemple** sont des données de démonstration (prix plausibles, **non vérifiés**) ;
elles peuvent être masquées dans le menu **Plus**. Les vraies promotions s'ajoutent via le bouton **＋**
ou par import JSON :

```json
[
  {
    "product": "Huile de table 5 L",
    "brand": "Lesieur",
    "store": "Marjane",
    "city": "Casablanca",
    "category": "alimentation",
    "originalPrice": 99.9,
    "promoPrice": 84.9,
    "startDate": "2026-10-01",
    "endDate": "2026-10-15",
    "source": "https://lien-du-catalogue",
    "conditions": "Dans la limite des stocks"
  }
]
```

Le pourcentage est recalculé à partir des prix. `category` prend l'un des identifiants de `data.js`
(`alimentation`, `boissons`, `hygiene`, `entretien`, `electromenager`, `high-tech`, `informatique`, `mode`,
`maison`, `bricolage`, `bebe`, `sport`, `auto`, `sante`, `telecom`, `voyage`, `autre`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'interface |
| `styles.css` | Styles mobiles (clair / sombre) |
| `app.js` | Logique : filtres, statuts, calculs, formulaire, stockage local |
| `data.js` | Catégories, villes, enseignes et exemples |
| `sources.json`, `SOURCES.md` | Recueil des sources de promotions |
| `scripts/` | Robot de collecte quotidienne et ses tests |
| `data/promotions.json` | Promotions réelles générées par le robot |
| `data/manual.json` | Promotions de catalogues saisies à la main |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Installation PWA et mode hors ligne |
