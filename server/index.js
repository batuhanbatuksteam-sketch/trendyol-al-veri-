require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Routes ──────────────────────────────────────────────────────────────
app.use('/api', searchRouter);

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Catch-all: SPA ───────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛍️  Trendyol Alışveriş Asistanı başladı`);
  console.log(`📡  http://localhost:${PORT}`);
  console.log(`🤖  Model: google/gemini-2.5-flash (Replicate)`);
  console.log(`${'─'.repeat(40)}\n`);
});

module.exports = app;
