// SQLite backend with the same interface as the mysql2 pool used in server.js (v0.0.56).
// pool.query(sql, params) → [rows] for SELECT, [{ insertId, affectedRows }] otherwise.
// pool.getConnection() → { query, beginTransaction, commit, rollback, release }.
// Uses Node's built-in node:sqlite (no native build needed). Tables are created on first use.
const fs = require('node:fs');
const path = require('node:path');

process.removeAllListeners('warning'); // hide node:sqlite "experimental" warning
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });
const { DatabaseSync } = require('node:sqlite');

const ISO_NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    notifications_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT ${ISO_NOW}
);
CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    created_at TEXT DEFAULT ${ISO_NOW}
);
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Electronics',
    image_url TEXT,
    created_at TEXT DEFAULT ${ISO_NOW}
);
CREATE TABLE IF NOT EXISTS product_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    product_url TEXT NOT NULL,
    last_price REAL,
    target_price REAL,
    created_at TEXT DEFAULT ${ISO_NOW}
);
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_source_id INTEGER NOT NULL REFERENCES product_sources(id) ON DELETE CASCADE,
    price REAL NOT NULL,
    scraped_at TEXT DEFAULT ${ISO_NOW}
);
CREATE INDEX IF NOT EXISTS idx_history_source ON price_history(product_source_id, scraped_at);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    target_price REAL NOT NULL,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TRIGGERED','DISABLED')),
    created_at TEXT DEFAULT ${ISO_NOW}
);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    message TEXT,
    sent_at TEXT DEFAULT ${ISO_NOW}
);`;

function toParam(v) {
    if (v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
}
// The few MySQL-only bits used in this codebase
const translate = (sql) => sql.replace(/\bINSERT\s+IGNORE\b/gi, 'INSERT OR IGNORE');

function createPool(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    db.exec(SCHEMA);
    console.log(`SQLite database ready: ${file}`);

    const run = (sql, params = []) => {
        const stmt = db.prepare(translate(sql));
        const args = [].concat(params).map(toParam);
        if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)) return [stmt.all(...args).map(r => ({ ...r })), []];
        const r = stmt.run(...args);
        return [{ insertId: Number(r.lastInsertRowid), affectedRows: r.changes }, undefined];
    };

    // One write transaction at a time: queries outside it wait until it is released.
    let lock = null;
    const waitUnlocked = async () => { while (lock) await lock.promise; };

    return {
        async query(sql, params) { await waitUnlocked(); return run(sql, params); },
        async execute(sql, params) { await waitUnlocked(); return run(sql, params); },
        async getConnection() {
            await waitUnlocked();
            let release; lock = { promise: new Promise(r => { release = r; }) };
            let inTx = false, done = false;
            const free = () => { if (!done) { done = true; lock = null; release(); } };
            return {
                async query(sql, params) { return run(sql, params); },
                async execute(sql, params) { return run(sql, params); },
                async beginTransaction() { db.exec('BEGIN'); inTx = true; },
                async commit() { if (inTx) { db.exec('COMMIT'); inTx = false; } },
                async rollback() { if (inTx) { db.exec('ROLLBACK'); inTx = false; } },
                release() { if (inTx) { try { db.exec('ROLLBACK'); } catch { /* none */ } inTx = false; } free(); },
            };
        },
        async end() { db.close(); },
        sqlite: db,
    };
}

module.exports = { createPool };
