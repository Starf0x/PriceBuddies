# PriceBuddies — v0.0.59

> **PriceBuddies is a fork of [PriceBuddy](https://github.com/chahel1817/PriceBuddy) by chahel1817.**
> Upstream has **no license**; this copy is kept public by the owner's choice (2026-11-24).

## Install on Unraid
1. Unraid terminal:
   `wget -O /boot/config/plugins/dockerMan/templates-user/my-PriceBuddies.xml https://raw.githubusercontent.com/Starf0x/PriceBuddies/main/unraid/pricebuddies.xml`
2. **Docker → Add Container → Template: PriceBuddies**. Keep **Data** = `/mnt/user/appdata/pricebuddies`; optionally add API keys (SerpApi, eBay, bol.com, e-mail). **Apply**.
3. Open `http://<unraid-ip>:3000` and create an account. No separate database needed (SQLite).

## Status / resume notes
- **Last updated:** 2026-11-25 09:30 (Europe/Amsterdam)
- **Versioning:** starts at 0.0.50, +3 per release (0.0.53, 0.0.56 … up to 0.0.98, then 0.1.0).
- **v0.0.50 — better shop search** (`backend/search.js`):
  - Sources: Amazon (SerpApi, `amazon.nl`), Google Shopping NL via SerpApi (covers bol.com, Coolblue, MediaMarkt…), eBay Browse API (`EBAY_NL`), bol.com Marketing Catalog API (optional, needs partner key; not yet tested against the live API).
  - Removed the eBay Finding API (shut down by eBay in 2025).
  - Prices as numbers (`priceValue`) in `SEARCH_CURRENCY` (default EUR), converted via open.er-api.com.
  - `/search?q=&sort=relevance|price_asc|price_desc&min=&max=&stores=` ; response `sources` shows per-shop ok/error.
  - 60-min in-memory cache per query (saves SerpApi quota); duplicates removed by URL.
  - Frontend search modal: sort + min/max filter, shows which shops failed.
  - Tests: `cd backend && npm test` (no network, axios stubbed). Browser test only runs with `PUPPETEER_EXECUTABLE_PATH` set.
- **v0.0.53 — better product-page scraping** (`backend/scraper.js`):
  - Works for any shop: JSON-LD → microdata → og/product meta → embedded app JSON (`__NEXT_DATA__`, `__INITIAL_STATE__`…) → visible price text.
  - Correct EU price parsing (`€ 1.299,95`); old code turned `€ 12,99` into 1299.
  - Bot-check pages (e.g. joybuy.nl "Risk Control", Cloudflare) are detected; then retried with headless Chrome (puppeteer, `SCRAPE_BROWSER`).
  - Currency taken from the page and converted correctly (old code treated every non-.in shop as USD).
  - `POST /api/scrape-preview {url}`; pasting a shop link in the search box shows that product.
  - Used by `scrapePriceByUrl` (server) and `sync_prices.js`; also as fallback when the eBay/Amazon selectors fail.
  - joybuy.nl could not be tested live from the cloud (blocked there); browser fallback is tested against a local fake challenge page.
- **v0.0.53 — Unraid Docker**:
  - `Dockerfile`: one container = Next.js (port 3000, standalone) + Express (internal 5001) + Chromium. Browser calls `/backend/*`, Next rewrites to Express (see `frontend/next.config.mjs`, only when `DOCKER_BUILD=1`).
  - `docker/start.js` starts both servers.
  - `unraid/pricebuddies.xml`: Unraid template (image `ghcr.io/starf0x/pricebuddies:latest`).
  - `.github/workflows/docker.yml`: builds + pushes the image to ghcr.io when a GitHub release is published (or run manually). After the first push, set the ghcr package to **public** so Unraid can pull without login.
  - Tested in the cloud: image builds, DB init, pages, register/login via `/backend`, healthcheck. Chromium install inside the image could not be tested there (Debian mirror blocked); test build skipped it.
- **v0.0.56 — renamed to PriceBuddies + SQLite**:
  - `backend/sqlite.js`: SQLite via Node's built-in `node:sqlite`, same interface as the mysql2 pool (`query`, `getConnection`, transactions), tables created automatically. Write transactions are serialized.
  - `backend/db.js`: SQLite by default (`SQLITE_PATH`, default `backend/data/pricebuddies.db`); MySQL only when `DB_CLIENT=mysql` or `DB_HOST`/`MYSQL_URL` is set.
  - Docker: `DB_CLIENT=sqlite`, `SQLITE_PATH=/data/pricebuddies.db`, `VOLUME /data`; MariaDB removed from compose and the Unraid template (now a `/data` path).
  - UI/name: PriceBuddy → PriceBuddies.
  - Tests: `sqlite.test.js` (results, transactions, cascade, dates).
- **v0.0.59 — working Settings page**: the old page was a non-functional mock-up. Now: edit name/e-mail (`PATCH /api/users/:id`), change password (`POST /api/users/:id/password`, needs current password), price-drop e-mail toggle; `GET /api/users/:id` returns profile + counts. Logo text PriceBuddies. API keys stay in the Unraid template / env.
- **Not changed yet:** tracked-product prices/alerts/sync still use INR (`server.js`, `sync_prices.js`); no auth tokens on API routes (anyone can pass any user id) — next candidates.
- Config: copy `backend/.env.example` to `backend/.env`.

---

# PriceBuddy 💹

**PriceBuddy** is a smart price tracking and comparison platform designed to help users save money by monitoring product prices across popular e-commerce platforms like **Amazon** and **eBay**.


## 🚀 Key Features

- **Multi-Store Tracking**: Track prices from Amazon and eBay in one place.
- **Price History Charts**: Visualize price trends over time with interactive charts.
- **Target Price Alerts**: Set your desired price and get notified when it drops.
- **Automated Sync**: Background cron jobs keep prices updated every few hours.
- **Currency Conversion**: Automatic conversion of international prices (USD) to INR.
- **Modern UI**: Sleek, responsive dashboard built with Next.js and Tailwind CSS.

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (App Router), [Tailwind CSS](https://tailwindcss.com/), [Heroicons](https://heroicons.com/)
- **Backend**: [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/)
- **Database**: [MySQL](https://www.mysql.com/)
- **Scraping/APIs**: [Axios](https://axios-http.com/), [Cheerio](https://cheerio.js.org/), [SerpApi](https://serpapi.com/) (Amazon), [eBay Find/Browse APIs](https://developer.ebay.com/)

## 📂 Project Structure

```text
pricebuddy/
├── frontend/          # Next.js application
├── backend/           # Express.js server & Database scripts
│   ├── schema.sql     # Database initialization script
│   └── sync_prices.js # Price synchronization script
└── README.md          # Project documentation
```

## ⚙️ Setup & Installation

### 1. Database Setup
Create a MySQL database and run the schema found in `backend/schema.sql`:
```bash
mysql -u your_user -p your_database < backend/schema.sql
```

### 2. Backend Configuration
1. Navigate to `backend/`.
2. Install dependencies: `npm install`.
3. Create a `.env` file and add your credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pricebuddy
   PORT=5001
   
   # Optional: For better scraping
   SERPAPI_KEY=your_serpapi_key
   EBAY_APP_ID=your_ebay_app_id
   EBAY_CERT_ID=your_ebay_cert_id
   ```
4. Start the server: `node server.js`.

### 3. Frontend Configuration
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5001
   ```
4. Start the development server: `npm run dev`.

## 🏗️ Demo & Simulation

If you want to showcase the real-time capabilities of PriceBuddy (Dashboard updates, Chart movements, and Email alerts) without waiting for a real-market price drop, use the simulation script:

1. **Navigate to the backend:**
   ```bash
   cd backend
   ```
2. **Run the simulation:**
   ```bash
   node simulate_demo.js
   ```
This script will pick a product in your database, artificially drop its price by 10%, update the history, and trigger an automated email alert—instantly showing the full power of PriceBuddy.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
