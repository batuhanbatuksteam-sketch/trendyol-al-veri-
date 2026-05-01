/**
 * "Neden seçildi?" açıklama üretici
 * Tamamen kural tabanlı — hızlı ve LLM çağrısı gerektirmez
 */

function generateExplanation(product, rank, allProducts) {
  const { rating, reviewCount, price, bayesianScore, brand, name } = product;
  const scoreRounded = bayesianScore?.toFixed(2);

  // Sıralama bazlı prefix
  const rankLabels = ['🥇 En Güvenilir Seçim', '🥈 Güçlü Alternatif', '🥉 Bütçe Dostu Seçenek'];
  const rankLabel = rankLabels[rank] || `#${rank + 1}`;

  // Yorum kalabalığına göre güvenilirlik ifadesi
  let trustMsg = '';
  if (reviewCount >= 10000) {
    trustMsg = `${(reviewCount / 1000).toFixed(0)}K+ kullanıcı onayıyla platform rekoru kırıyor.`;
  } else if (reviewCount >= 5000) {
    trustMsg = `${(reviewCount / 1000).toFixed(1)}K yorumla kategorisinin en kalabalık doğrulamasına sahip.`;
  } else if (reviewCount >= 1000) {
    trustMsg = `${reviewCount.toLocaleString('tr-TR')} gerçek kullanıcı değerlendirmesi güvenilirliği kanıtlıyor.`;
  } else {
    trustMsg = `${reviewCount.toLocaleString('tr-TR')} yorumla yeterli örneklem büyüklüğüne ulaşmış.`;
  }

  // Rating kalitesi
  let ratingMsg = '';
  if (rating >= 4.8) {
    ratingMsg = `${rating} üzeri puan, mükemmelliği temsil ediyor.`;
  } else if (rating >= 4.5) {
    ratingMsg = `${rating} puan — kullanıcı memnuniyeti son derece yüksek.`;
  } else if (rating >= 4.0) {
    ratingMsg = `${rating} puan, kategorinin ortalamasının üzerinde.`;
  } else {
    ratingMsg = `${rating} puan — yeterli performans gösteriyor.`;
  }

  // Fiyat perspektifi
  const prices = allProducts.map(p => p.price).sort((a, b) => a - b);
  let priceMsg = '';
  if (price === prices[0]) {
    priceMsg = 'Önerilen seçenekler içinde en uygun fiyatlı.';
  } else if (price === prices[prices.length - 1]) {
    priceMsg = 'Premium segmentte; kalitesi fiyatını haklı kılıyor.';
  } else {
    priceMsg = `${price.toLocaleString('tr-TR')} TL ile fiyat/performans dengesini iyi tutuyor.`;
  }

  return {
    rankLabel,
    summary: `${trustMsg} ${ratingMsg} ${priceMsg}`,
    highlights: [
      `⭐ ${rating} / 5.0 puan`,
      `💬 ${reviewCount.toLocaleString('tr-TR')} değerlendirme`,
      `💰 ${price.toLocaleString('tr-TR')} TL`,
      `📊 Güvenilirlik skoru: ${scoreRounded}`,
    ],
  };
}

module.exports = { generateExplanation };
