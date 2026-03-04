const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new Database('./serials.db');

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS serial_counters (
    year    INTEGER NOT NULL,
    week    INTEGER NOT NULL,
    line    TEXT    NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, week, line)
  );

  CREATE TABLE IF NOT EXISTS serial_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    serial      TEXT    NOT NULL UNIQUE,
    year        INTEGER NOT NULL,
    week        INTEGER NOT NULL,
    line        TEXT    NOT NULL,
    counter     INTEGER NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Helper: get current YY and WW
function getCurrentYearWeek() {
  const now = new Date();
  const year = now.getFullYear();
  const yy = String(year).slice(-2);

  // ISO week number
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  const weekDay = startOfYear.getDay() || 7; // 1=Mon ... 7=Sun
  const ww = String(Math.ceil((dayOfYear + weekDay - 1) / 7)).padStart(2, '0');

  return { yy, ww, year: parseInt(yy), week: parseInt(ww) };
}

// Atomic serial generation using SQLite transaction
const generateSerial = db.transaction((line) => {
  const { yy, ww, year, week } = getCurrentYearWeek();

  // Upsert counter row
  db.prepare(`
    INSERT INTO serial_counters (year, week, line, counter)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(year, week, line) DO UPDATE SET counter = counter + 1
  `).run(year, week, line);

  // Read back the value just set
  const row = db.prepare(`
    SELECT counter FROM serial_counters WHERE year = ? AND week = ? AND line = ?
  `).get(year, week, line);

  const counter = row.counter;
  const nnnnnn = String(counter).padStart(6, '0');
  const serial = `${yy}${ww}${line}${nnnnnn}`;

  // Log the serial (will throw if duplicate, which shouldn't happen)
  db.prepare(`
    INSERT INTO serial_log (serial, year, week, line, counter)
    VALUES (?, ?, ?, ?, ?)
  `).run(serial, year, week, line, counter);

  return { serial, yy, ww, line, counter };
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Generate serial
app.post('/api/serial', (req, res) => {
  const { line } = req.body;
  const validLines = ['01', '02', '03', '04', '05'];

  if (!line || !validLines.includes(line)) {
    return res.status(400).json({ error: 'Línea inválida. Use: 01, 02, 03, 04 o 05' });
  }

  try {
    const result = generateSerial(line);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando número de serie' });
  }
});

// API: Get recent serials
app.get('/api/serials', (req, res) => {
  const { line, limit = 50 } = req.query;
  let query = `SELECT * FROM serial_log`;
  const params = [];

  if (line) {
    query += ` WHERE line = ?`;
    params.push(line);
  }

  query += ` ORDER BY id DESC LIMIT ?`;
  params.push(parseInt(limit));

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// API: Get stats
app.get('/api/stats', (req, res) => {
  const { yy, ww } = getCurrentYearWeek();
  const counters = db.prepare(`
    SELECT * FROM serial_counters WHERE year = ? AND week = ? ORDER BY line
  `).all(parseInt(yy), parseInt(ww));

  const total = db.prepare(`SELECT COUNT(*) as total FROM serial_log`).get();

  res.json({ currentYear: yy, currentWeek: ww, counters, totalGenerated: total.total });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
