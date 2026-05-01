const Replicate = require('replicate');
const { AI } = require('../config');

// ─── Statik Fallback Sözlük ────────────────────────────────────────────────
const SYNONYM_MAP = {
  'spor ayakkabı':   ['koşu ayakkabısı', 'sneaker', 'yürüyüş ayakkabısı', 'spor bot'],
  'laptop':          ['dizüstü bilgisayar', 'notebook', 'taşınabilir bilgisayar', 'gaming laptop'],
  'kulaklık':        ['bluetooth kulaklık', 'kablosuz kulaklık', 'over-ear kulaklık', 'tws kulaklık'],
  'telefon':         ['akıllı telefon', 'smartphone', 'cep telefonu', 'android telefon'],
  'tablet':          ['ipad', 'android tablet', 'grafik tablet', 'e-kitap okuyucu'],
  'tv':              ['akıllı televizyon', 'smart tv', 'oled tv', 'qled tv'],
  'saat':            ['akıllı saat', 'smartwatch', 'kol saati', 'spor saat'],
  'çanta':           ['sırt çantası', 'omuz çantası', 'el çantası', 'laptop çantası'],
  'kamera':          ['fotoğraf makinesi', 'dijital kamera', 'dslr', 'mirrorless kamera'],
  'bilgisayar':      ['masaüstü bilgisayar', 'all-in-one pc', 'gaming pc', 'iMac'],
};

/**
 * Replicate üzerinden Gemini 2.5 Flash ile keyword genişletme
 */
async function expandWithGemini(keyword) {
  const replicate = new Replicate({ auth: AI.replicateToken });

  const prompt = `Sen bir Türk e-ticaret uzmanısın. Kullanıcı Trendyol'da "${keyword}" arıyor.

Bu arama için Türkçe ${AI.keywordCount} adet alternatif ve niş arama terimi üret.
Kurallar:
- Sadece Trendyol'da gerçekten aranabilecek kelimeler
- Farklı bakış açıları: marka, özellik, kullanım senaryosu
- Özgün keyword dahil etme
- Sadece JSON array formatında döndür, başka hiçbir şey yazma

Örnek format: ["koşu ayakkabısı", "sneaker erkek", "yürüyüş ayakkabısı", "spor bot"]

Cevap:`;

  let result = '';
  try {
    for await (const event of replicate.stream(AI.model, { input: { prompt } })) {
      result += `${event}`;
    }

    // JSON array parse et
    const match = result.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('JSON array bulunamadı');
    
    const keywords = JSON.parse(match[0]);
    if (!Array.isArray(keywords) || keywords.length === 0) throw new Error('Geçersiz array');
    
    console.log(`[KEYWORD] Gemini genişletti: ${keywords.join(', ')}`);
    return keywords.slice(0, AI.keywordCount);
  } catch (err) {
    console.error(`[KEYWORD] Gemini hatası: ${err.message} — fallback kullanılıyor`);
    return fallbackExpand(keyword);
  }
}

/**
 * Statik sözlük tabanlı fallback
 */
function fallbackExpand(keyword) {
  const lower = keyword.toLowerCase();
  
  // Direkt eşleşme
  if (SYNONYM_MAP[lower]) return SYNONYM_MAP[lower].slice(0, AI.keywordCount);
  
  // Kısmi eşleşme
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return synonyms.slice(0, AI.keywordCount);
    }
  }
  
  // Son çare: kelimeyi parçala ve basit varyasyonlar üret
  return [
    `${keyword} fiyat`,
    `en iyi ${keyword}`,
    `${keyword} yorumları`,
    `ucuz ${keyword}`,
  ].slice(0, AI.keywordCount);
}

/**
 * Ana export: keyword + alternatifleri döndürür
 */
async function expandKeywords(keyword) {
  const alternatives = await expandWithGemini(keyword);
  // Orijinal keyword + alternatifleri birleştir, duplicate kaldır
  const allKeywords = [keyword, ...alternatives].filter((k, i, arr) => 
    arr.findIndex(x => x.toLowerCase() === k.toLowerCase()) === i
  );
  return allKeywords;
}

module.exports = { expandKeywords };
