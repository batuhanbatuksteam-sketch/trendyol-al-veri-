require('dotenv').config();

// ─── Trendyol URL Şablonları ───────────────────────────────────────────────
const TRENDYOL = {
  search: (keyword, page = 1) =>
    `https://www.trendyol.com/sr?q=${encodeURIComponent(keyword)}&pi=${page}`,
  product: (contentId, slug = 'urun') =>
    `https://www.trendyol.com/${slug}-p-${contentId}`,
  category: (slug) =>
    `https://www.trendyol.com/${slug}`,
};

// ─── Scraper Ayarları ──────────────────────────────────────────────────────
const SCRAPER = {
  headless: true,
  timeout: 30000,          // ms — sayfa yükleme zaman aşımı
  waitAfterLoad: 2500,     // ms — JS render için bekleme
  maxProductsPerKeyword: 48, // Bir sayfada maksimum ürün
  parallelLimit: 3,        // Eş zamanlı maksimum Playwright instance
};

// ─── Scoring Ayarları ─────────────────────────────────────────────────────
const SCORING = {
  topN: 3,                 // Sunulacak en iyi ürün sayısı
  defaultMinReviews: 50,   // AI eşik belirleyemezse varsayılan
  bayesianC: null,         // null = AI tarafından belirlenir
};

// ─── Replicate / Gemini ───────────────────────────────────────────────────
const AI = {
  replicateToken: process.env.REPLICATE_API_TOKEN,
  model: 'google/gemini-2.5-flash',
  keywordCount: 4,         // Üretilecek alternatif keyword sayısı
};

// ─── Önbellek ─────────────────────────────────────────────────────────────
const CACHE = {
  ttlSeconds: 1800,        // 30 dakika
};

module.exports = { TRENDYOL, SCRAPER, SCORING, AI, CACHE };
