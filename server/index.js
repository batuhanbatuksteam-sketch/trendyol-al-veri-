require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Logger (Frontend Log Paneli İçin) ────────────────────────────────────
const inMemoryLogs = [];
const originalLog = console.log;
const originalError = console.error;

function addLog(type, ...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  const ts = new Date().toISOString().split('T')[1].substring(0, 8);
  inMemoryLogs.push(`[${ts}] [${type}] ${msg}`);
  if (inMemoryLogs.length > 200) inMemoryLogs.shift();
}

console.log = function(...args) {
  addLog('INFO', ...args);
  originalLog.apply(console, args);
};
console.error = function(...args) {
  addLog('ERROR', ...args);
  originalError.apply(console, args);
};

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Routes ──────────────────────────────────────────────────────────────
app.use('/api', searchRouter);

app.get('/api/logs', (req, res) => {
  res.json({ logs: inMemoryLogs });
});

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Catch-all: SPA ───────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🛍️  Trendyol Alışveriş Asistanı başladı`);
  console.log(`📡  http://0.0.0.0:${PORT}`);
  console.log(`🤖  Model: google/gemini-2.5-flash (Replicate)`);
  console.log(`${'─'.repeat(40)}\n`);
});

module.exports = app;
