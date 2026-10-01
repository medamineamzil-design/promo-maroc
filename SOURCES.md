# Recueil des sources de promotions au Maroc

61 sources, dont 14 collectées automatiquement chaque jour. Généré depuis `sources.json`.

- **Auto** = le robot quotidien relève les prix (prix barré → prix promo) ; la date de début = premier jour de détection.
- **Manuel** = catalogues avec dates de validité, ou sites qui refusent les robots : à saisir dans `data/manual.json` ou via l'application.
- **Relais** = site non officiel qui republie les catalogues ; à utiliser comme référence, pas comme source de collecte automatique.

## Enseignes et grandes surfaces (catalogues) (16)

| Source | Officiel | Collecte | Fréquence | Dates | Lien |
|---|---|---|---|---|---|
| Marjane / Marjane Market | oui | manuel | Catalogues thématiques de 2 à 3 semaines | oui | [www.marjane.ma/contenu/catalogues-magasin](https://www.marjane.ma/contenu/catalogues-magasin) |
| Carrefour Maroc (Label'Vie) | oui | manuel | Hebdomadaire | oui | [carrefourmaroc.ma/mes-promotions/nos-offres-du-moment](https://carrefourmaroc.ma/mes-promotions/nos-offres-du-moment/) |
| Carrefour Maroc – catalogues | oui | manuel | Hebdomadaire | oui | [carrefour.ma/catalogues](https://carrefour.ma/catalogues/) |
| Aswak Assalam | oui | manuel | Catalogue d'environ 3 semaines | oui | [aswakassalam.com/promotions](https://aswakassalam.com/promotions/) |
| Aswak Assalam – catalogue PDF | oui | manuel | Catalogue d'environ 3 semaines | oui | [aswakassalam.com/catalogue](https://aswakassalam.com/catalogue/) |
| BIM Maroc | oui | manuel (Adresse officielle à confirmer ; catalogues relayés par les agrégateurs) | Arrivages mardi et vendredi | oui | [www.bim.ma](https://www.bim.ma) |
| Groupe Label'Vie (Carrefour, Carrefour Market, Atacadao, Supeco) | oui | manuel | - | non | [labelvie.ma/en/our-business/our-brands](https://labelvie.ma/en/our-business/our-brands/) |
| Kazyon | relais | manuel | Hebdomadaire (jeudi → mercredi) | oui | [depenseless.com/magasin/kazyon](https://depenseless.com/magasin/kazyon/) |
| Supeco | relais | manuel | Hebdomadaire | oui | [hmizate.ma/deal/catalogue-supeco-c24](https://hmizate.ma/deal/catalogue-supeco-c24) |
| Atacadao | relais | manuel | Catalogue d'environ 3 semaines | oui | [promotionmaroc.com/category/catalogue-depliant/supermarche-maroc/atacadao](https://promotionmaroc.com/category/catalogue-depliant/supermarche-maroc/atacadao/) |
| Acima / Carrefour Market | relais | manuel | Hebdomadaire | oui | [www.getcata.com/ma-fr/catalogs/carrefour-market](https://www.getcata.com/ma-fr/catalogs/carrefour-market) |
| Kitea | relais | manuel | Catalogues saisonniers (ex. Back to School jusqu'au 31/10) | oui | [promomaroc.com/ameublement/kitea](https://promomaroc.com/ameublement/kitea/) |
| Biougnach | relais | manuel | Événementielle | oui | [promomaroc.com/electromenager/biougnach](https://promomaroc.com/electromenager/biougnach/) |
| Virgin Megastore Maroc | relais | manuel | Événementielle | oui | [www.tiendeo.ma/rabat/virgin-megastore](https://www.tiendeo.ma/rabat/virgin-megastore) |
| Mr Bricolage Maroc | relais | manuel | Catalogues saisonniers | oui | [www.cataloguesdumaroc.com/category/mr-bricolage](https://www.cataloguesdumaroc.com/category/mr-bricolage/) |
| Bricoma | relais | manuel | Catalogues saisonniers | oui | [catalogueaumaroc.com/catalogue/bricolage/bricoma](https://catalogueaumaroc.com/catalogue/bricolage/bricoma/) |

## Boutiques en ligne (20)

| Source | Officiel | Collecte | Fréquence | Dates | Lien |
|---|---|---|---|---|---|
| Marjanemall | oui | manuel (Le site refuse les robots (HTTP 403) : consultation / saisie manuelle) | Quotidienne (ventes flash) | non | [www.marjanemall.ma](https://www.marjanemall.ma/) |
| Jumia – Ventes flash | oui | auto (jumia) | Plusieurs fois par jour | non | [www.jumia.ma/flash-sales](https://www.jumia.ma/flash-sales/) |
| Jumia – Soldes | oui | auto (jumia) | Quotidienne | non | [www.jumia.ma/mlp-soldes](https://www.jumia.ma/mlp-soldes/) |
| Jumia – Hot deals | oui | auto (jumia) | Quotidienne | non | [www.jumia.ma/mlp-destockage-massif](https://www.jumia.ma/mlp-destockage-massif/) |
| Jumia – Ventes flash électronique | oui | auto (jumia) | Quotidienne | non | [www.jumia.ma/electronique/flash-sales](https://www.jumia.ma/electronique/flash-sales/) |
| Electroplanet – Vente flash | oui | manuel (Le site refuse les robots (HTTP 403) : consultation / saisie manuelle) | Quotidienne | non | [www.electroplanet.ma/vente-flash](https://www.electroplanet.ma/vente-flash) |
| Decathlon Maroc – Promotions | oui | auto (auto) | Quotidienne | non | [www.decathlon.ma/5080-promotions](https://www.decathlon.ma/5080-promotions) |
| Decathlon Maroc – Soldes | oui | manuel | Périodes de soldes | non | [www.decathlon.ma/content/179-soldes](https://www.decathlon.ma/content/179-soldes) |
| UltraPC – Promotions | oui | auto (auto) | Quotidienne | non | [www.ultrapc.ma/promotions](https://www.ultrapc.ma/promotions) |
| Iris – Bons plans | oui | manuel (Le site refuse les robots (HTTP 403) : consultation / saisie manuelle) | Quotidienne | non | [www.iris.ma/en/bons-plans](https://www.iris.ma/en/bons-plans) |
| Cosmos Electro | oui | auto (auto) (Site injoignable lors des premiers passages) | Quotidienne | non | [www.cosmoselectro.ma](https://www.cosmoselectro.ma/) |
| Parapharma.ma – Promotions | oui | manuel (Le site refuse les robots (HTTP 401 « Bot check ») : consultation / saisie manuelle) | Quotidienne | non | [www.parapharma.ma/promotion](http://www.parapharma.ma/promotion) |
| Univers Para Discount – Bons deals | oui | auto (auto) | Quotidienne | non | [universparadiscount.ma/428-les-bons-deals](https://universparadiscount.ma/428-les-bons-deals) |
| Atlas Para – Promotions | oui | auto (auto) | Quotidienne | non | [www.atlaspara.ma/promotions](https://www.atlaspara.ma/promotions) |
| La Maison Para | oui | auto (auto) | Quotidienne | non | [lamaisonpara.ma](https://lamaisonpara.ma/) |
| Mapara.ma | oui | manuel (Le site refuse les robots (HTTP 403) : consultation / saisie manuelle) | Quotidienne | non | [mapara.ma](https://mapara.ma/) |
| Maparami.ma | oui | auto (auto) | Quotidienne | non | [maparami.ma](https://maparami.ma/) |
| BeautyMall.ma | oui | auto (auto) | Quotidienne | non | [beautymall.ma](https://beautymall.ma/) |
| Nova Parapharmacie | oui | auto (auto) | Quotidienne | non | [novapara.ma](https://novapara.ma/) |
| LC Waikiki (boutique officielle Jumia) | oui | auto (jumia) | Quotidienne | non | [www.jumia.ma/mlp-boutique-officielle-lc-waikiki](https://www.jumia.ma/mlp-boutique-officielle-lc-waikiki/) |

## Opérateurs télécom (2)

| Source | Officiel | Collecte | Fréquence | Dates | Lien |
|---|---|---|---|---|---|
| inwi – Bons plans | oui | manuel | Mensuelle | oui | [inwi.ma/fr/bons-plans](https://inwi.ma/fr/bons-plans) |
| Orange Maroc | oui | manuel | Mensuelle | oui | [www.orange.ma](https://www.orange.ma/) |

## Deals services et loisirs (1)

| Source | Officiel | Collecte | Fréquence | Dates | Lien |
|---|---|---|---|---|---|
| Hmizate – Deals (hôtels, restaurants, loisirs) | oui | manuel | Quotidienne | oui | [hmizate.ma/deal/promotions-au-maroc-c28](https://hmizate.ma/deal/promotions-au-maroc-c28) |

## Agrégateurs de catalogues (22)

| Source | Officiel | Collecte | Fréquence | Dates | Lien |
|---|---|---|---|---|---|
| Catalogues.ma | relais | manuel | Quotidienne | oui | [catalogues.ma/catalogs](https://catalogues.ma/catalogs) |
| Catalogy.ma (BIM, Marjane, Kazyon) | relais | manuel | Hebdomadaire | oui | [catalogy.ma](https://catalogy.ma/) |
| Tiendeo Maroc | relais | manuel | Quotidienne | oui | [www.tiendeo.ma](https://www.tiendeo.ma/) |
| PromoCatalogues.ma (comparateur) | relais | manuel | Hebdomadaire | oui | [promocatalogues.ma/fr](https://promocatalogues.ma/fr) |
| DealDiali | relais | manuel | Hebdomadaire | oui | [dealdiali.com/catalogues](https://dealdiali.com/catalogues) |
| Promoty.ma | relais | manuel | Hebdomadaire | oui | [promoty.ma](https://promoty.ma/) |
| Top-catalogues.ma | relais | manuel | Hebdomadaire | oui | [top-catalogues.ma/marjane-catalogues](https://top-catalogues.ma/marjane-catalogues) |
| PromotionMaroc.com | relais | manuel | Quotidienne | oui | [promotionmaroc.com/category/promotion](https://promotionmaroc.com/category/promotion/) |
| SoldeMaroc.com | relais | manuel | Quotidienne | oui | [www.soldemaroc.com/category/catalogue](https://www.soldemaroc.com/category/catalogue/) |
| PromoMaroc.com | relais | manuel | Quotidienne | oui | [promomaroc.com/supermarche](https://promomaroc.com/supermarche/) |
| PromotioneMaroc.com | relais | manuel | Hebdomadaire | oui | [promotionemaroc.com](https://promotionemaroc.com/) |
| PromotionAuMaroc.com | relais | manuel | Hebdomadaire | oui | [promotionaumaroc.com](https://promotionaumaroc.com/) |
| Depenseless.com | relais | manuel | Hebdomadaire | oui | [depenseless.com/magasin/electroplanet](https://depenseless.com/magasin/electroplanet/) |
| Hmizate – Catalogues | relais | manuel | Hebdomadaire | oui | [hmizate.ma/deal/catalogues-c6](https://hmizate.ma/deal/catalogues-c6) |
| CatalogueAuMaroc.com | relais | manuel | Hebdomadaire | oui | [catalogueaumaroc.com/catalogue/bricolage](https://catalogueaumaroc.com/catalogue/bricolage/) |
| CataloguesDuMaroc.com | relais | manuel | Hebdomadaire | oui | [www.cataloguesdumaroc.com/category/bricolage](https://www.cataloguesdumaroc.com/category/bricolage/) |
| MultiCatalogue.com | relais | manuel | Hebdomadaire | oui | [multicatalogue.com/catalogue-bim](https://multicatalogue.com/catalogue-bim/) |
| PromotionMarocBim.com | relais | manuel | Mardi et vendredi | oui | [promotionmarocbim.com/category/bim-vendredi-mardi](https://promotionmarocbim.com/category/bim-vendredi-mardi/) |
| Qiima.ma (communautaire) | relais | manuel | Quotidienne | oui | [www.qiima.ma/merchants/decathlon-maroc](https://www.qiima.ma/merchants/decathlon-maroc) |
| GetCata Maroc | relais | manuel | Hebdomadaire | oui | [getcata.com/ma-fr/marrakech/catalogs/cosmos-electro](https://getcata.com/ma-fr/marrakech/catalogs/cosmos-electro) |
| Dealy.ma | relais | manuel | Quotidienne | non | [www.dealy.ma/ma/fr/marque/decathlon](https://www.dealy.ma/ma/fr/marque/decathlon) |
| Tkhayar.ma | relais | manuel | Irrégulière | oui | [tkhayar.ma/electromenager-technologie/cosmos-electro](https://tkhayar.ma/electromenager-technologie/cosmos-electro/) |
