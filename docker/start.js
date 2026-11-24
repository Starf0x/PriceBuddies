// Container entrypoint: prepare the database, then run backend + frontend; stop the container if either exits.
const { spawn } = require('node:child_process');
const path = require('node:path');

const run = (name, args, env = {}) => {
    const p = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('exit', (code) => { console.error(`[start] ${name} exited (${code}), stopping container`); process.exit(code || 1); });
    return p;
};

(async () => {
    await require('./init-db').initDb();
    const children = [
        run('backend', [path.join(__dirname, '../backend/server.js')]),
        run('frontend', [path.join(__dirname, '../frontend/server.js')], { PORT: process.env.WEB_PORT || '3000', HOSTNAME: '0.0.0.0' }),
    ];
    for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { children.forEach(c => c.kill(sig)); setTimeout(() => process.exit(0), 3000); });
})().catch((e) => { console.error('[start] failed:', e.message); process.exit(1); });
