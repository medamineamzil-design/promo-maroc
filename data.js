/* Référentiels et exemples de démonstration pour Promo Maroc. */

const CATEGORIES = [
  { id: "alimentation", label: "Alimentation", icon: "🛒" },
  { id: "boissons", label: "Boissons", icon: "🥤" },
  { id: "hygiene", label: "Hygiène & Beauté", icon: "🧴" },
  { id: "entretien", label: "Entretien maison", icon: "🧽" },
  { id: "electromenager", label: "Électroménager", icon: "🧺" },
  { id: "high-tech", label: "High-Tech", icon: "📱" },
  { id: "informatique", label: "Informatique", icon: "💻" },
  { id: "mode", label: "Mode & Chaussures", icon: "👟" },
  { id: "maison", label: "Maison & Déco", icon: "🛋️" },
  { id: "bricolage", label: "Bricolage & Jardin", icon: "🛠️" },
  { id: "bebe", label: "Bébé & Enfants", icon: "🍼" },
  { id: "sport", label: "Sport & Loisirs", icon: "⚽" },
  { id: "auto", label: "Auto & Moto", icon: "🚗" },
  { id: "sante", label: "Santé & Parapharmacie", icon: "💊" },
  { id: "telecom", label: "Télécom & Internet", icon: "📶" },
  { id: "voyage", label: "Voyages & Services", icon: "✈️" },
  { id: "autre", label: "Autre", icon: "🏷️" }
];

const CITIES = [
  "Tout le Maroc", "Casablanca", "Rabat", "Salé", "Témara", "Kénitra", "Fès", "Meknès",
  "Marrakech", "Agadir", "Tanger", "Tétouan", "Oujda", "Nador", "El Jadida", "Safi",
  "Mohammedia", "Béni Mellal", "Khouribga", "Settat", "Laâyoune", "Dakhla", "Essaouira",
  "Errachidia", "Ouarzazate", "Taza", "Al Hoceïma", "Berrechid", "Khémisset", "Larache"
];

const STORES = [
  "Marjane", "Carrefour", "Carrefour Market", "Aswak Assalam", "Label'Vie", "BIM", "Atacadao",
  "Acima", "Electroplanet", "Biougnach", "Virgin Megastore", "Jumia", "Avito", "Decathlon",
  "Kitea", "Mr Bricolage", "Ikea", "LC Waikiki", "Defacto", "Zara", "Bershka", "Marwa",
  "Kiabi", "Yves Rocher", "Pharmacie", "Orange", "inwi", "Maroc Telecom", "Autre"
];

/*
 * Exemples de démonstration : prix et produits plausibles, mais NON vérifiés.
 * Les dates sont relatives au jour d'ouverture (en jours) pour que la démo
 * montre toujours des promos en cours, à venir et expirées.
 */
const DEMO_PROMOS = [
  { product: "Huile de table 5 L", brand: "Lesieur", store: "Marjane", city: "Tout le Maroc", category: "alimentation", originalPrice: 99.9, promoPrice: 84.9, start: -3, end: 10, conditions: "Dans la limite des stocks disponibles" },
  { product: "Farine de blé tendre 10 kg", brand: "", store: "BIM", city: "Tout le Maroc", category: "alimentation", originalPrice: 65, promoPrice: 55, start: -1, end: 6 },
  { product: "Thé vert 200 g", brand: "Sultan", store: "Carrefour", city: "Casablanca", category: "alimentation", originalPrice: 24.5, promoPrice: 19.9, start: -5, end: 2 },
  { product: "Pack eau minérale 6 × 1,5 L", brand: "Sidi Ali", store: "Aswak Assalam", city: "Rabat", category: "boissons", originalPrice: 36, promoPrice: 29.9, start: 0, end: 14 },
  { product: "Lessive poudre 5 kg", brand: "Tide", store: "Atacadao", city: "Tout le Maroc", category: "entretien", originalPrice: 119, promoPrice: 89, start: -2, end: 12 },
  { product: "Shampooing 400 ml", brand: "Head & Shoulders", store: "Label'Vie", city: "Marrakech", category: "hygiene", originalPrice: 42.9, promoPrice: 29.9, start: -4, end: 9 },
  { product: "Smartphone 128 Go", brand: "Samsung Galaxy A", store: "Electroplanet", city: "Tout le Maroc", category: "high-tech", originalPrice: 2999, promoPrice: 2499, start: -6, end: 20, conditions: "Paiement en 3× sans frais selon conditions" },
  { product: "Téléviseur LED 55\" 4K", brand: "LG", store: "Biougnach", city: "Casablanca", category: "high-tech", originalPrice: 6490, promoPrice: 4990, start: 3, end: 17 },
  { product: "Ordinateur portable 15,6\" i5 / 16 Go", brand: "HP", store: "Virgin Megastore", city: "Rabat", category: "informatique", originalPrice: 7990, promoPrice: 6790, start: -10, end: 5 },
  { product: "Machine à laver 8 kg", brand: "Beko", store: "Electroplanet", city: "Fès", category: "electromenager", originalPrice: 4290, promoPrice: 3490, start: -8, end: 8 },
  { product: "Réfrigérateur combiné 400 L", brand: "Samsung", store: "Marjane", city: "Agadir", category: "electromenager", originalPrice: 7999, promoPrice: 6499, start: 5, end: 25 },
  { product: "Baskets running homme", brand: "Kalenji", store: "Decathlon", city: "Tanger", category: "sport", originalPrice: 399, promoPrice: 249, start: -7, end: 4 },
  { product: "Djellaba femme", brand: "", store: "Marwa", city: "Tout le Maroc", category: "mode", originalPrice: 599, promoPrice: 359, start: -2, end: 18 },
  { product: "Jean slim homme", brand: "", store: "LC Waikiki", city: "Meknès", category: "mode", originalPrice: 299, promoPrice: 179, start: -20, end: -2 },
  { product: "Canapé 3 places", brand: "", store: "Kitea", city: "Casablanca", category: "maison", originalPrice: 5990, promoPrice: 4490, start: -1, end: 30 },
  { product: "Perceuse visseuse sans fil 18 V", brand: "Bosch", store: "Mr Bricolage", city: "Rabat", category: "bricolage", originalPrice: 1290, promoPrice: 990, start: -3, end: 11 },
  { product: "Couches taille 4 (×58)", brand: "Pampers", store: "Carrefour Market", city: "Tout le Maroc", category: "bebe", originalPrice: 139, promoPrice: 109, start: -1, end: 7 },
  { product: "Crème solaire SPF50 200 ml", brand: "", store: "Pharmacie", city: "Oujda", category: "sante", originalPrice: 189, promoPrice: 151.2, start: -15, end: -1 },
  { product: "Pneu 205/55 R16", brand: "Michelin", store: "Autre", city: "Kénitra", category: "auto", originalPrice: 1150, promoPrice: 920, start: 2, end: 16 },
  { product: "Forfait internet 4G 50 Go", brand: "", store: "inwi", city: "Tout le Maroc", category: "telecom", originalPrice: 100, promoPrice: 50, start: -4, end: 3, conditions: "Offre valable pour une recharge éligible" }
];
