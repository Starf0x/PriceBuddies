// SQLite adapter: mysql2-compatible results, transactions, cascade deletes, Date params.
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const { createPool } = require('./sqlite');

const pool = createPool(path.join(os.tmpdir(), `pb-test-${process.pid}.db`));

test('insert/select/update/delete with mysql2-style results', async () => {
    const [u] = await pool.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', ['A', 'a@x.nl', 'h']);
    assert.strictEqual(u.insertId, 1);
    const [[row]] = await pool.query('SELECT * FROM users WHERE id = ?', [u.insertId]);
    assert.strictEqual(row.email, 'a@x.nl');
    assert.match(row.created_at, /^\d{4}-\d\d-\d\dT.*Z$/);
    const [upd] = await pool.query('UPDATE users SET notifications_active = ? WHERE id = ?', [true, 1]);
    assert.strictEqual(upd.affectedRows, 1);
});

test('transaction rollback and cascade delete', async () => {
    const c = await pool.getConnection();
    await c.beginTransaction();
    const [p] = await c.query('INSERT INTO products (name, user_id) VALUES (?, ?)', ['X', 1]);
    await c.rollback(); c.release();
    assert.strictEqual((await pool.query('SELECT * FROM products'))[0].length, 0);

    const c2 = await pool.getConnection();
    await c2.beginTransaction();
    const [p2] = await c2.query('INSERT INTO products (name, user_id) VALUES (?, ?)', ['Y', 1]);
    await c2.query('INSERT INTO websites (name, base_url) VALUES (?, ?)', ['w', 'https://w']);
    const [s] = await c2.query('INSERT INTO product_sources (product_id, website_id, product_url, last_price) VALUES (?, 1, ?, ?)', [p2.insertId, 'u', 9.99]);
    await c2.query('INSERT IGNORE INTO price_history (product_source_id, price, scraped_at) VALUES (?, ?, ?)', [s.insertId, 9.99, new Date('2026-01-01')]);
    // A query from another request waits until the transaction is released
    let waited = false; const other = pool.query('SELECT 1').then(() => { waited = true; });
    await new Promise(r => setTimeout(r, 20)); assert.strictEqual(waited, false);
    await c2.commit(); c2.release(); await other; assert.ok(waited);

    const [[h]] = await pool.query('SELECT price, scraped_at FROM price_history');
    assert.deepStrictEqual(h, { price: 9.99, scraped_at: '2026-01-01T00:00:00.000Z' });
    await pool.query('DELETE FROM products WHERE id = ?', [p2.insertId]);
    assert.strictEqual((await pool.query('SELECT * FROM price_history'))[0].length, 0);
});
