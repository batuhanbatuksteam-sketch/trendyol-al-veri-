/* ═══════════════════════════════════════════════════
   Trendyol Alışveriş Asistanı — Frontend App Logic
   ═══════════════════════════════════════════════════ */

// ─── DOM Refs ─────────────────────────────────────────────────
const searchForm       = document.getElementById('search-form');
const searchInput      = document.getElementById('search-input');
const searchBtn        = document.getElementById('search-btn');
const heroSection      = document.getElementById('hero-section');
const loadingSection   = document.getElementById('loading-section');
const resultsSection   = document.getElementById('results-section');
const errorSection     = document.getElementById('error-section');
const resultsGrid      = document.getElementById('results-grid');
const resultsMeta      = document.getElementById('results-meta');
const keywordsRow      = document.getElementById('keywords-row');
const newSearchBtn     = document.getElementById('new-search-btn');
const retryBtn         = document.getElementById('retry-btn');
const errorTitle       = document.getElementById('error-title');
const errorMsg         = document.getElementById('error-msg');
const quickTags        = document.querySelectorAll('.tag');

// ─── State ────────────────────────────────────────────────────
let currentQuery = '';
let stepTimer = null;

// ─── Quick Tags ───────────────────────────────────────────────
quickTags.forEach(tag => {
  tag.addEventListener('click', () => {
    const q = tag.dataset.query;
    searchInput.value = q;
    searchInput.focus();
    startSearch(q);
  });
});

// ─── Form Submit ──────────────────────────────────────────────
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchInput.style.animation = 'shake 0.3s ease';
    setTimeout(() => searchInput.style.animation = '', 300);
    return;
  }
  startSearch(q);
});

// ─── New Search ───────────────────────────────────────────────
newSearchBtn.addEventListener('click', resetToHome);
retryBtn.addEventListener('click', () => {
  if (currentQuery) startSearch(currentQuery);
});

// ─── Loading Steps Animation ──────────────────────────────────
const STEPS = ['step-1', 'step-2', 'step-3', 'step-4'];
const STEP_DURATIONS = [3000, 8000, 5000, 2000]; // ms per step

function animateSteps() {
  let cumulative = 0;
  STEPS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('step-active', 'step-done');

    // Activate after cumulative delay
    setTimeout(() => {
      // Mark previous as done
      if (i > 0) {
        const prev = document.getElementById(STEPS[i - 1]);
        if (prev) {
          prev.classList.remove('step-active');
          prev.classList.add('step-done');
          prev.querySelector('.step-status').textContent = '✅';
        }
      }
      el.classList.add('step-active');
      el.querySelector('.step-status').textContent = '⏳';
    }, cumulative);

    cumulative += STEP_DURATIONS[i];
  });
}

function resetSteps() {
  STEPS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('step-active', 'step-done');
    el.querySelector('.step-status').textContent = '⏳';
  });
}

function completeAllSteps() {
  STEPS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('step-active');
    el.classList.add('step-done');
    el.querySelector('.step-status').textContent = '✅';
  });
}

// ─── UI State Transitions ─────────────────────────────────────
function showLoading() {
  heroSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  resetSteps();
  animateSteps();
  searchBtn.disabled = true;
}

function showResults() {
  loadingSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  heroSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  searchBtn.disabled = false;
  completeAllSteps();
}

function showError(title, msg) {
  loadingSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  heroSection.classList.add('hidden');
  errorSection.classList.remove('hidden');
  errorTitle.textContent = title;
  errorMsg.textContent = msg;
  searchBtn.disabled = false;
}

function resetToHome() {
  resultsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  heroSection.classList.remove('hidden');
  searchInput.value = '';
  searchInput.focus();
}

// ─── Star Rating Renderer ─────────────────────────────────────
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

// ─── Product Card Renderer ────────────────────────────────────
function renderProductCard(product, index) {
  const { name, price, rating, reviewCount, image, productUrl, bayesianScore, explanation } = product;
  
  const rankClass = `rank-${index + 1}`;
  const rankLabel = explanation?.rankLabel || `#${index + 1}`;
  const summary = explanation?.summary || '';
  const highlights = explanation?.highlights || [];

  const priceStr = price > 0 
    ? `${price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
    : 'Fiyat yok';

  const scoreStr = bayesianScore ? bayesianScore.toFixed(3) : '—';

  const imageHtml = image
    ? `<img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
       <span class="product-image-placeholder" style="display:none">🛍️</span>`
    : `<span class="product-image-placeholder">🛍️</span>`;

  const highlightsHtml = highlights
    .map(h => `<span class="highlight">${escapeHtml(h)}</span>`)
    .join('');

  return `
    <article class="product-card" role="article" aria-label="${escapeHtml(name)}">
      <span class="rank-badge ${rankClass}">${escapeHtml(rankLabel)}</span>

      <div class="product-image-wrapper">
        ${imageHtml}
      </div>

      <div class="product-info">
        <h3 class="product-name">${escapeHtml(name)}</h3>

        <div class="stats-row">
          <div class="stat">
            <span class="stat-label">Puan</span>
            <span class="stat-value rating">${rating > 0 ? rating.toFixed(1) : '—'}</span>
            <span class="stars">${rating > 0 ? renderStars(rating) : ''}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Değerlendirme</span>
            <span class="stat-value reviews">${reviewCount > 0 ? reviewCount.toLocaleString('tr-TR') : '—'}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Fiyat</span>
            <span class="stat-value price">${priceStr}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Güvenilirlik</span>
            <span class="stat-value score">${scoreStr}</span>
          </div>
        </div>

        ${summary ? `
        <div class="explanation-box">
          <div class="explanation-label">📌 Neden seçildi?</div>
          <div class="explanation-text">${escapeHtml(summary)}</div>
        </div>` : ''}

        ${highlights.length > 0 ? `<div class="highlights">${highlightsHtml}</div>` : ''}

        <a href="${escapeHtml(productUrl)}" target="_blank" rel="noopener noreferrer" class="cta-btn" id="product-cta-${index + 1}">
          🛍️ Trendyol'da Gör
        </a>
      </div>
    </article>
  `;
}

// ─── Search Pipeline ──────────────────────────────────────────
async function startSearch(query) {
  currentQuery = query;
  showLoading();

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (data.error) {
      showError('Ürün Bulunamadı', data.error);
      return;
    }

    if (!data.results || data.results.length === 0) {
      showError('Sonuç Yok', `"${query}" için yeterli güvenilir ürün bulunamadı. Farklı bir arama terimi deneyin.`);
      return;
    }

    renderResults(data);

  } catch (err) {
    console.error('[FRONTEND] Arama hatası:', err);
    showError(
      'Bağlantı Hatası',
      err.message || 'Sunucuyla iletişim kurulamadı. Lütfen tekrar deneyin.'
    );
  }
}

// ─── Results Renderer ─────────────────────────────────────────
function renderResults(data) {
  const { results, keywords, meta } = data;

  // Meta info
  const duration = meta?.duration ? `${(meta.duration / 1000).toFixed(1)}s` : '—';
  const total = meta?.totalFound || 0;
  const minRev = meta?.minReviewsUsed || '?';
  const avg = meta?.globalAvgUsed || '?';

  resultsMeta.innerHTML = `
    "<strong>${escapeHtml(meta?.query || currentQuery)}</strong>" için 
    <strong>${total}</strong> ürün tarandı →
    <strong>${results.length}</strong> en güvenilir seçildi
    <span style="margin-left:12px; opacity:0.6">⏱ ${duration} · 
    AI eşik: ${minRev}+ yorum · Ort. puan: ${avg}</span>
  `;

  // Keywords pills
  if (keywords && keywords.length > 0) {
    keywordsRow.innerHTML = keywords
      .map(kw => `<span class="kw-pill">🔍 ${escapeHtml(kw)}</span>`)
      .join('');
  }

  // Product cards
  resultsGrid.innerHTML = results
    .map((product, i) => renderProductCard(product, i))
    .join('');

  showResults();

  // Smooth scroll to results
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ─── Security: HTML Escape ────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Shake Animation (CSS injected) ──────────────────────────
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
`;
document.head.appendChild(shakeStyle);

// ─── Init ─────────────────────────────────────────────────────
console.log('🛍️ Trendyol Alışveriş Asistanı hazır');

// ─── Log Panel Mantığı ───────────────────────────────────────────────
const logsBtn = document.getElementById('logs-trigger-btn');
const logsModal = document.getElementById('logs-modal');
const logsClose = document.getElementById('logs-close-btn');
const logsContainer = document.getElementById('logs-container');
let logInterval = null;

function fetchLogs() {
  fetch('/api/logs')
    .then(r => r.json())
    .then(data => {
      const logs = data.logs || [];
      const wasAtBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= logsContainer.clientHeight + 50;
      
      logsContainer.innerHTML = logs.map(line => {
        let cls = 'info';
        if (line.includes('[ERROR]')) cls = 'error';
        if (line.includes('[SCRAPER]')) cls = 'scraper';
        return `<div class="log-line ${cls}">${escapeHtml(line)}</div>`;
      }).join('');
      
      if (wasAtBottom) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    })
    .catch(err => console.error('Log fetch hatası:', err));
}

logsBtn.addEventListener('click', () => {
  logsModal.classList.remove('hidden');
  fetchLogs(); // Hemen çek
  logInterval = setInterval(fetchLogs, 1500); // 1.5 sn'de bir güncelle
});

logsClose.addEventListener('click', () => {
  logsModal.classList.add('hidden');
  if (logInterval) clearInterval(logInterval);
});

logsModal.addEventListener('click', (e) => {
  if (e.target === logsModal) {
    logsModal.classList.add('hidden');
    if (logInterval) clearInterval(logInterval);
  }
});
