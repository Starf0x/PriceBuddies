# PriceBuddies — single container: Next.js frontend (port 3000) + Express backend (internal 5001) + Chromium for scraping.
# Database: SQLite file in /data (mount as a volume; on Unraid /mnt/user/appdata/pricebuddies), see unraid/pricebuddies.xml.

FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Browser calls /backend/*, which Next rewrites to the internal Express server.
ENV NEXT_PUBLIC_API_URL=/backend DOCKER_BUILD=1 NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:22-bookworm-slim AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5001 \
    WEB_PORT=3000 \
    DB_CLIENT=sqlite \
    SQLITE_PATH=/data/pricebuddies.db \
    TZ=Europe/Amsterdam
WORKDIR /app
COPY --from=backend /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY --from=frontend /app/frontend/.next/standalone ./frontend/
COPY --from=frontend /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend /app/frontend/public ./frontend/public
COPY docker/ ./docker/
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:5001/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "docker/start.js"]
