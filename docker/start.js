// Container entrypoint: run backend + frontend; stop the container if either exits.
// Data lives in SQLite at SQLITE_PATH (default /data/pricebuddies.db; mount /data as a volume).
const { spawn } = require('node:child_process');
const path = require('node:path');

const run = (name, args, env = {}) => {
    const p = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('exit', (code) => { console.error(`[start] ${name} exited (${code}), stopping container`); process.exit(code || 1); });
    return p;
};

const children = [
    run('backend', [path.join(__dirname, '../backend/server.js')]),
    run('frontend', [path.join(__dirname, '../frontend/server.js')], { PORT: process.env.WEB_PORT || '3000', HOSTNAME: '0.0.0.0' }),
];
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { children.forEach(c => c.kill(sig)); setTimeout(() => process.exit(0), 3000); });
