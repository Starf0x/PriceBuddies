// Waits for MySQL/MariaDB and creates the tables from backend/schema.sql (idempotent: CREATE ... IF NOT EXISTS).
const fs = require('node:fs');
const path = require('node:path');
const mysql = require(path.join(__dirname, '../backend/node_modules/mysql2/promise'));

async function initDb() {
    const cfg = {
        host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true,
    };
    const db = process.env.DB_NAME || 'pricebuddy';
    let conn;
    for (let i = 1; !conn; i++) {
        try { conn = await mysql.createConnection(cfg); }
        catch (e) {
            if (i >= 30) throw new Error(`database not reachable at ${cfg.host}:${cfg.port} (${e.message})`);
            console.log(`[init-db] waiting for database (${e.code || e.message}) ${i}/30`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db.replace(/`/g, '')}\``);
    await conn.changeUser({ database: db });
    const sql = fs.readFileSync(path.join(__dirname, '../backend/schema.sql'), 'utf8')
        .split('\n').filter(l => !/^\s*(CREATE DATABASE|USE)\b/i.test(l)).join('\n');
    await conn.query(sql);
    await conn.end();
    console.log(`[init-db] database "${db}" ready`);
}

module.exports = { initDb };
