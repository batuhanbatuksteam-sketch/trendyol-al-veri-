const express = require('express');
const router = express.Router();
const { expandKeywords } = require('../modules/keywordExpander');
const { scrapeKeywords } = require('../modules/scraper');
const { scoreAndRank } = require('../modules/scorer');
const { generateExplanation } = require('../modules/explainer');
const { getOrSet } = require('../utils/cache');

/**
 * POST /api/search
 * Body: { query: "spor ayakkabı" }
 * Response: { results: [...], keywords: [...], meta: {...} }
 */
router.post('/search', async (req, res) => {
  const startTime = Date.now();
  const { query } = req.body;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Lütfen en az 2 karakter girin.' });
  }

  const cleanQuery = query.trim();
  const cacheKey = `search:${cleanQuery.toLowerCase()}`;

  try {
    const result = await getOrSet(cacheKey, async () => {
      // ADIM 1: Keyword Genişletme
      console.log(`\n${'='.repeat(50)}`);
      console.log(`[SEARCH] Yeni arama: "${cleanQuery}"`);
      const keywords = await expandKeywords(cleanQuery);
      console.log(`[SEARCH] Keywordler: ${keywords.join(' | ')}`);

      // ADIM 2: Paralel Scraping
      console.log(`[SEARCH] Scraping başlıyor (${keywords.length} keyword)...`);
      const rawProducts = await scrapeKeywords(keywords);
      console.log(`[SEARCH] Ham ürün sayısı: ${rawProducts.length}`);

      if (rawProducts.length === 0) {
        return {
          results: [],
          keywords,
          meta: { query: cleanQuery, totalFound: 0, duration: Date.now() - startTime },
          error: 'Ürün bulunamadı. Farklı bir arama terimi deneyin.',
        };
      }

      // ADIM 3: Skorlama
      const topProducts = await scoreAndRank(rawProducts, cleanQuery);
      console.log(`[SEARCH] Top ${topProducts.length} ürün belirlendi`);

      // ADIM 4: Açıklama Üretimi
      const results = topProducts.map((product, index) => ({
        ...product,
        explanation: generateExplanation(product, index, topProducts),
      }));

      return {
        results,
        keywords,
        meta: {
          query: cleanQuery,
          totalFound: rawProducts.length,
          filtered: topProducts.length,
          duration: Date.now() - startTime,
          minReviewsUsed: topProducts[0]?.minReviewsUsed,
          globalAvgUsed: topProducts[0]?.globalAvgUsed,
        },
      };
    });

    // Önbellekten geldiyse duration güncelle
    if (result.meta) result.meta.cached = result.meta.duration !== undefined && 
      Date.now() - startTime < 100;

    res.json(result);
  } catch (err) {
    console.error(`[SEARCH] Kritik hata: ${err.message}`, err.stack);
    res.status(500).json({
      error: 'Arama sırasında bir hata oluştu. Lütfen tekrar deneyin.',
      detail: err.message,
    });
  }
});

module.exports = router;
