const Replicate = require('replicate');
const { AI, SCORING } = require('../config');

/**
 * Gemini 2.5 Flash ile kategori bazlı dinamik minimum yorum eşiği belirle
 * @param {string} originalQuery - Kullanıcının orijinal araması
 * @param {Array} products - Scrape edilen ham ürün listesi
 * @returns {number} - Minimum yorum sayısı eşiği
 */
async function determineMinReviews(originalQuery, products) {
  const replicate = new Replicate({ auth: AI.replicateToken });

  // Ürün istatistiklerini özetle
  const reviewCounts = products.map(p => p.reviewCount).filter(r => r > 0).sort((a, b) => a - b);
  const stats = reviewCounts.length > 0 ? {
    min: reviewCounts[0],
    max: reviewCounts[reviewCounts.length - 1],
    median: reviewCounts[Math.floor(reviewCounts.length / 2)],
    total: reviewCounts.length,
    above100: reviewCounts.filter(r => r >= 100).length,
    above50:  reviewCounts.filter(r => r >= 50).length,
    above10:  reviewCounts.filter(r => r >= 10).length,
  } : null;

  if (!stats || stats.total < 5) {
    console.log('[SCORER] Yeterli veri yok — varsayılan eşik kullanılıyor');
    return SCORING.defaultMinReviews;
  }

  const prompt = `Sen bir e-ticaret veri analistisin. "${originalQuery}" araması için Trendyol'dan şu istatistikler geldi:

- Toplam ürün sayısı: ${stats.total}
- En az yorum: ${stats.min}
- En fazla yorum: ${stats.max}
- Medyan yorum: ${stats.median}
- 100+ yorumlu ürün: ${stats.above100}
- 50+ yorumlu ürün: ${stats.above50}
- 10+ yorumlu ürün: ${stats.above10}

Görevin: Bu kategoride "güvenilir" bir ürün değerlendirmesi için minimum yorum sayısı eşiğini belirle.
Mantığın:
- Eğer bu niş/az bilinen bir kategori ise eşiği düşük tut (10-30)
- Eğer bu popüler/rekabetçi bir kategori ise eşiği yüksek tut (100-500)
- En az 5 ürünün bu eşiği geçmesini sağla
- Sayıyı optimize et: çok düşük = güvenilmez sonuçlar, çok yüksek = hiç sonuç yok

Sadece tek bir tam sayı döndür (örn: 75). Başka hiçbir şey yazma.

Cevap:`;

  try {
    let result = '';
    for await (const event of replicate.stream(AI.model, { input: { prompt } })) {
      result += `${event}`;
    }
    const threshold = parseInt(result.trim().replace(/[^\d]/g, ''), 10);
    if (isNaN(threshold) || threshold < 1) throw new Error('Geçersiz eşik');
    
    console.log(`[SCORER] AI eşik belirledi: ${threshold} (query: "${originalQuery}")`);
    return threshold;
  } catch (err) {
    console.error(`[SCORER] AI eşik hatası: ${err.message} — medyan/3 kullanılıyor`);
    // Medyanın 1/3'ü mantıklı bir fallback
    return Math.max(10, Math.round(stats.median / 3));
  }
}

/**
 * Bayesian Ortalama hesapla
 * Score = (C × m + Σx) / (C + n)
 *
 * C = Güven sabiti (AI tarafından belirlenen eşik)
 * m = Global ortalama puan
 * n = Ürünün yorum sayısı
 * Σx = n × rating
 */
function bayesianAverage(rating, reviewCount, globalAvg, C) {
  if (reviewCount <= 0) return 0;
  const sumX = rating * reviewCount;
  return (C * globalAvg + sumX) / (C + reviewCount);
}

/**
 * Duplicate ürünleri kaldır (contentId üzerinden)
 */
function deduplicateProducts(products) {
  const seen = new Set();
  return products.filter(p => {
    if (seen.has(p.contentId)) return false;
    seen.add(p.contentId);
    return true;
  });
}

/**
 * Ana scoring pipeline
 * @param {Array} products - Ham ürün listesi
 * @param {string} originalQuery - Orijinal kullanıcı araması
 * @returns {Array} - Skorlanmış Top N ürün
 */
async function scoreAndRank(products, originalQuery) {
  // 1. Duplicate temizle
  const unique = deduplicateProducts(products);
  console.log(`[SCORER] Unique ürün: ${unique.length}`);

  // 2. Rating ve fiyatı olan ürünleri filtrele
  const valid = unique.filter(p => p.rating > 0 && p.price > 0);
  console.log(`[SCORER] Rating + fiyatı olan: ${valid.length}`);

  // 3. AI ile dinamik eşik belirle
  const minReviews = await determineMinReviews(originalQuery, valid);
  const filtered = valid.filter(p => p.reviewCount >= minReviews);
  console.log(`[SCORER] Eşik (${minReviews}+): ${filtered.length} ürün kaldı`);

  // Eşikten geçen yeterli ürün yoksa eşiği yarıya indir
  const finalFiltered = filtered.length >= SCORING.topN ? filtered :
    valid.filter(p => p.reviewCount >= Math.round(minReviews / 2));
  
  if (finalFiltered.length === 0) {
    console.log('[SCORER] Yeterli ürün bulunamadı');
    return [];
  }

  // 4. Global ortalama puan
  const globalAvg = finalFiltered.reduce((sum, p) => sum + p.rating, 0) / finalFiltered.length;
  const C = minReviews; // Güven sabiti = belirlenen eşik

  // 5. Bayesian skor hesapla
  const scored = finalFiltered.map(p => ({
    ...p,
    bayesianScore: bayesianAverage(p.rating, p.reviewCount, globalAvg, C),
    minReviewsUsed: minReviews,
    globalAvgUsed: parseFloat(globalAvg.toFixed(2)),
  }));

  // 6. Sırala ve Top N al
  scored.sort((a, b) => b.bayesianScore - a.bayesianScore);
  return scored.slice(0, SCORING.topN);
}

module.exports = { scoreAndRank };
