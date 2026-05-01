const { chromium } = require('playwright');
const { TRENDYOL, SCRAPER } = require('../config');

/**
 * Trendyol'un gerçek API yapısına göre ürün parse et
 * color-variants endpoint: { [productGroupId]: [ { id, name, price, ratingScore, url, image } ] }
 */
function parseColorVariantsResponse(json) {
  const products = [];
  if (typeof json !== 'object' || !json) return products;

  for (const [groupId, variants] of Object.entries(json)) {
    if (!Array.isArray(variants)) continue;
    // Her varyant grubundan en iyi puanlıyı al
    const sorted = variants.sort((a, b) =>
      (b.ratingScore?.averageRating || 0) - (a.ratingScore?.averageRating || 0)
    );
    const p = sorted[0];
    if (!p) continue;

    const contentId = String(p.id || '');
    if (!contentId) continue;

    const rating = parseFloat(p.ratingScore?.averageRating) || 0;
    const reviewCount = parseInt(p.ratingScore?.totalCount) || 0;
    const price = parseFloat(
      p.price?.discountedPrice ||
      p.price?.current ||
      p.price?.sellingPrice ||
      p.recommendedRetailPrice?.discountedPromotionPriceNumerized ||
      0
    );

    // Görsel: bigImage öncelikli
    const image = p.bigImage || p.image || '';

    products.push({
      contentId,
      name: p.name || 'Bilinmeyen Ürün',
      brand: '',
      price,
      rating,
      reviewCount,
      image,
      productUrl: p.url ? `https://www.trendyol.com${p.url}` : '',
      labels: p.labels || [],
    });
  }
  return products;
}

/**
 * DOM'dan productGroupId listesini çıkar (color-variants API için)
 */
async function extractProductGroupIds(page) {
  return page.evaluate(() => {
    const ids = new Set();

    // Yöntem 1: data-id attribute
    document.querySelectorAll('[data-id]').forEach(el => {
      const id = el.getAttribute('data-id');
      if (id && /^\d+$/.test(id)) ids.add(id);
    });

    // Yöntem 2: URL pattern'den contentId çıkar
    document.querySelectorAll('a[href*="-p-"]').forEach(a => {
      const match = a.href.match(/-p-(\d+)/);
      if (match) ids.add(match[1]);
    });

    // Yöntem 3: __NEXT_DATA__'dan
    try {
      const nextEl = document.getElementById('__NEXT_DATA__');
      if (nextEl) {
        const str = nextEl.textContent;
        const matches = str.matchAll(/"(?:contentId|productGroupId|id)"\s*:\s*(\d{6,})/g);
        for (const m of matches) ids.add(m[1]);
      }
    } catch (_) {}

    return [...ids].slice(0, 48);
  });
}

/**
 * DOM fallback: link'lerden temel veri çek
 */
async function domFallback(page) {
  return page.evaluate(() => {
    const products = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="-p-"]').forEach(anchor => {
      const href = anchor.getAttribute('href');
      const match = href?.match(/-p-(\d+)/);
      if (!match) return;
      const contentId = match[1];
      if (seen.has(contentId)) return;
      seen.add(contentId);

      // En yakın anlamlı container
      let el = anchor;
      let container = anchor;
      for (let i = 0; i < 10; i++) {
        if (!el.parentElement) break;
        el = el.parentElement;
        const txt = el.textContent || '';
        if (txt.includes('TL') || txt.match(/\d+[,\.]\d+/)) {
          container = el;
          break;
        }
      }

      const text = container.textContent || '';
      const priceMatch = text.match(/[\d\.]+,\d{2}\s*TL/) || text.match(/(\d[\d\.]+)\s*TL/);
      let price = 0;
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/\./g, '').replace(',', '.').replace(' TL', '')) || 0;
      }

      const img = container.querySelector('img');
      const name = img?.getAttribute('alt') || img?.getAttribute('title') || anchor.getAttribute('title') || 'Ürün';
      const image = img?.getAttribute('src') || img?.getAttribute('data-src') || '';

      products.push({
        contentId,
        name,
        brand: '',
        price,
        rating: 0,
        reviewCount: 0,
        image,
        productUrl: `https://www.trendyol.com${href}`,
      });
    });

    return products.slice(0, 48);
  });
}

/**
 * Tek bir keyword için Trendyol'u scrape et
 * Öncelik: color-variants XHR intercept → direct API fetch → DOM fallback
 */
async function scrapeKeyword(keyword, browser) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    extraHTTPHeaders: {
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const page = await context.newPage();
  let interceptedProducts = [];

  // ─── XHR Intercept ────────────────────────────────────────────────────────
  page.on('response', async (response) => {
    const url = response.url();
    const ct  = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      if (url.includes('color-variants')) {
        const json = await response.json();
        const parsed = parseColorVariantsResponse(json);
        if (parsed.length > 0) {
          interceptedProducts.push(...parsed);
          console.log(`[XHR] "${keyword}" → ${parsed.length} ürün (color-variants)`);
        }
      }
    } catch (_) {}
  });

  try {
    const searchUrl = TRENDYOL.search(keyword);
    console.log(`[SCRAPER] → ${keyword} | ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: SCRAPER.timeout });
    await page.waitForTimeout(SCRAPER.waitAfterLoad);

    // ─── Strateji 1: XHR intercept ────────────────────────────────────────
    if (interceptedProducts.length > 0) {
      console.log(`[SCRAPER] "${keyword}": ${interceptedProducts.length} ürün (XHR ✅)`);
      return interceptedProducts.slice(0, SCRAPER.maxProductsPerKeyword);
    }

    // ─── Strateji 2: productGroupId → color-variants API direkt çağır ─────
    console.log(`[SCRAPER] "${keyword}": XHR kaçırıldı, direct API deneniyor...`);
    const groupIds = await extractProductGroupIds(page);
    console.log(`[SCRAPER] "${keyword}": ${groupIds.length} productGroupId bulundu`);

    if (groupIds.length > 0) {
      try {
        const apiUrl = `https://apigw.trendyol.com/discovery-sfint-search-service/api/search/color-variants?productGroupIds=${groupIds.join('%2C')}`;
        const apiRes = await page.evaluate(async (url) => {
          const r = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
          });
          if (!r.ok) return null;
          return r.json();
        }, apiUrl);

        if (apiRes) {
          const parsed = parseColorVariantsResponse(apiRes);
          if (parsed.length > 0) {
            console.log(`[SCRAPER] "${keyword}": ${parsed.length} ürün (Direct API ✅)`);
            return parsed.slice(0, SCRAPER.maxProductsPerKeyword);
          }
        }
      } catch (apiErr) {
        console.warn(`[SCRAPER] "${keyword}": Direct API hatası: ${apiErr.message}`);
      }
    }

    // ─── Strateji 3: DOM fallback ──────────────────────────────────────────
    console.log(`[SCRAPER] "${keyword}": DOM fallback...`);
    const domProducts = await domFallback(page);
    console.log(`[SCRAPER] "${keyword}": ${domProducts.length} ürün (DOM)`);
    return domProducts.slice(0, SCRAPER.maxProductsPerKeyword);

  } catch (err) {
    console.error(`[SCRAPER] "${keyword}" kritik hata: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

/**
 * Birden fazla keyword'ü paralel scrape et
 */
async function scrapeKeywords(keywords) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: SCRAPER.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const results = [];
    const chunks = [];
    for (let i = 0; i < keywords.length; i += SCRAPER.parallelLimit) {
      chunks.push(keywords.slice(i, i + SCRAPER.parallelLimit));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(kw => scrapeKeyword(kw, browser))
      );
      results.push(...chunkResults.flat());
    }

    return results;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeKeywords };
