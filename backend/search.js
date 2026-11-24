// Product search across shops (v0.0.50).
// Every source returns the same shape: { id, name, price, priceValue, currency, image, url, store, storeLogo }.
// A failing source never breaks the search; its error is reported in `sources`.
const axios = require('axios');

const CURRENCY = (process.env.SEARCH_CURRENCY || 'EUR').toUpperCase();
const LOCALE = process.env.SEARCH_LOCALE || 'nl-NL';
const AMAZON_DOMAIN = process.env.AMAZON_DOMAIN || 'amazon.nl';
const EBAY_MARKETPLACE = process.env.EBAY_MARKETPLACE || 'EBAY_NL';
const SHOPPING_COUNTRY = process.env.SHOPPING_COUNTRY || 'nl';
const CACHE_MS = parseInt(process.env.SEARCH_CACHE_MINUTES || '60', 10) * 60 * 1000;
const PER_SOURCE = 20;

const LOGOS = {
    Amazon: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    eBay: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg',
};

// ── Currency ────────────────────────────────────────────────────
let rates = null; // 1 CURRENCY = rates[X] X
let ratesAt = 0;
async function loadRates() {
    if (rates && Date.now() - ratesAt < 6 * 3600 * 1000) return;
    try {
        const { data } = await axios.get(`https://open.er-api.com/v6/latest/${CURRENCY}`, { timeout: 5000 });
        if (data?.rates) { rates = data.rates; ratesAt = Date.now(); }
    } catch (e) {
        console.warn('Exchange rates unavailable:', e.message);
    }
}
function toTarget(value, from) {
    const cur = (from || CURRENCY).toUpperCase();
    if (cur === CURRENCY) return value;
    const r = rates?.[cur];
    return r ? value / r : null; // unknown rate → no price rather than a wrong one
}
function format(value) {
    return value == null ? 'N/A' : new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(value);
}
function parsePrice(raw) {
    if (typeof raw === 'number') return raw;
    if (!raw) return null;
    // Handles "€ 1.299,00", "$1,299.00", "1299"
    let s = String(raw).replace(/[^\d.,]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
}
function item({ id, name, value, currency, image, url, store }) {
    const v = value == null ? null : toTarget(value, currency);
    const priceValue = v == null ? null : Math.round(v * 100) / 100;
    return {
        id, name: (name || 'Unknown').substring(0, 140), price: format(priceValue), priceValue,
        currency: CURRENCY, image: image || null, url: url || '#', store, storeLogo: LOGOS[store] || null,
    };
}

// ── SerpApi quota (shared by Amazon and Google Shopping) ────────
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_MONTHLY_LIMIT = parseInt(process.env.SERPAPI_MONTHLY_LIMIT || '250', 10);
const serpUsage = { count: 0, month: new Date().getMonth() };
function takeSerpCall() {
    const m = new Date().getMonth();
    if (m !== serpUsage.month) { serpUsage.count = 0; serpUsage.month = m; }
    if (serpUsage.count >= SERPAPI_MONTHLY_LIMIT) throw new Error('SerpApi monthly limit reached');
    serpUsage.count++;
}

// ── Sources ─────────────────────────────────────────────────────
async function amazon(q) {
    if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY missing');
    takeSerpCall();
    const { data } = await axios.get('https://serpapi.com/search.json', {
        params: { api_key: SERPAPI_KEY, engine: 'amazon', amazon_domain: AMAZON_DOMAIN, k: q }, timeout: 15000,
    });
    // amazon.nl/.de/.fr… prices are EUR, amazon.com USD, amazon.co.uk GBP
    const cur = AMAZON_DOMAIN.endsWith('.com') ? 'USD' : AMAZON_DOMAIN.endsWith('.co.uk') ? 'GBP'
        : AMAZON_DOMAIN.endsWith('.in') ? 'INR' : 'EUR';
    return (data?.organic_results || []).slice(0, PER_SOURCE).map((r, i) => item({
        id: `amz-${r.asin || i}`, name: r.title, value: r.extracted_price ?? parsePrice(r.price),
        currency: cur, image: r.thumbnail, url: r.link, store: 'Amazon',
    }));
}

async function googleShopping(q) {
    if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY missing');
    takeSerpCall();
    const { data } = await axios.get('https://serpapi.com/search.json', {
        params: { api_key: SERPAPI_KEY, engine: 'google_shopping', q, gl: SHOPPING_COUNTRY, hl: SHOPPING_COUNTRY },
        timeout: 15000,
    });
    // One call covers many local shops (bol.com, Coolblue, MediaMarkt, …); `source` is the shop name.
    return (data?.shopping_results || []).slice(0, PER_SOURCE).map((r, i) => item({
        id: `gs-${r.product_id || i}`, name: r.title, value: r.extracted_price ?? parsePrice(r.price),
        currency: CURRENCY, image: r.thumbnail, url: r.product_link || r.link, store: r.source || 'Google Shopping',
    }));
}

let ebayToken = null, ebayTokenExp = 0;
async function ebay(q) {
    const { EBAY_APP_ID: id, EBAY_CERT_ID: secret } = process.env;
    if (!id || !secret) throw new Error('EBAY_APP_ID / EBAY_CERT_ID missing');
    if (!ebayToken || Date.now() > ebayTokenExp) {
        const { data } = await axios.post('https://api.ebay.com/identity/v1/oauth2/token',
            new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }).toString(),
            { headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
        ebayToken = data.access_token;
        ebayTokenExp = Date.now() + (data.expires_in - 60) * 1000;
    }
    // The old Finding API was shut down by eBay in 2025; Browse API is the supported route.
    const { data } = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
        params: { q, limit: PER_SOURCE },
        headers: { Authorization: `Bearer ${ebayToken}`, 'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE },
        timeout: 15000,
    });
    return (data.itemSummaries || []).map(r => item({
        id: `ebay-${r.itemId}`, name: r.title, value: parsePrice(r.price?.value), currency: r.price?.currency,
        image: r.image?.imageUrl || r.thumbnailImages?.[0]?.imageUrl, url: r.itemWebUrl, store: 'eBay',
    }));
}

let bolToken = null, bolTokenExp = 0;
async function bol(q) {
    const { BOL_CLIENT_ID: id, BOL_CLIENT_SECRET: secret } = process.env;
    if (!id || !secret) throw new Error('BOL_CLIENT_ID / BOL_CLIENT_SECRET missing');
    if (!bolToken || Date.now() > bolTokenExp) {
        const { data } = await axios.post('https://login.bol.com/token?grant_type=client_credentials', null, {
            headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, Accept: 'application/json' }, timeout: 15000,
        });
        bolToken = data.access_token;
        bolTokenExp = Date.now() + ((data.expires_in || 300) - 30) * 1000;
    }
    // bol.com Marketing Catalog API (needs a bol.com partner account)
    const { data } = await axios.get('https://api.bol.com/marketing/catalog/v1/products/search', {
        params: { 'search-term': q, 'country-code': 'NL', 'page-size': PER_SOURCE, 'include-offer': true, 'include-image': true },
        headers: { Authorization: `Bearer ${bolToken}`, Accept: 'application/json', 'Accept-Language': 'nl' }, timeout: 15000,
    });
    return (data?.results || []).map((r, i) => {
        const p = r.product || r;
        return item({
            id: `bol-${p.ean || p.bolProductId || i}`, name: p.title, value: parsePrice(r.offer?.price ?? p.offer?.price),
            currency: 'EUR', image: r.image?.url || p.image?.url, url: p.url, store: 'bol.com',
        });
    });
}

const SOURCES = { amazon, googleShopping, ebay, bol };
const ENABLED = (process.env.SEARCH_SOURCES || 'amazon,googleShopping,ebay,bol').split(',').map(s => s.trim()).filter(s => SOURCES[s]);

// ── Ranking ─────────────────────────────────────────────────────
function relevance(name, q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const n = (name || '').toLowerCase();
    return words.filter(w => n.includes(w)).length / (words.length || 1);
}
function normalizeUrl(u) {
    try { const x = new URL(u); return (x.hostname + x.pathname).replace(/\/$/, '').toLowerCase(); } catch { return u; }
}

// ── Main ────────────────────────────────────────────────────────
const cache = new Map(); // query → { at, results, sources }

async function search(rawQuery, { sort = 'relevance', min, max, stores } = {}) {
    const q = rawQuery.trim().replace(/\s+/g, ' ');
    const key = q.toLowerCase();
    let hit = cache.get(key);
    let cached = !!hit && Date.now() - hit.at < CACHE_MS;
    if (!cached) {
        await loadRates();
        const settled = await Promise.allSettled(ENABLED.map(s => SOURCES[s](q)));
        const sources = {};
        let results = [];
        settled.forEach((r, i) => {
            const name = ENABLED[i];
            if (r.status === 'fulfilled') { sources[name] = { ok: true, count: r.value.length }; results.push(...r.value); }
            else { sources[name] = { ok: false, count: 0, error: r.reason?.response?.status ? `HTTP ${r.reason.response.status}` : r.reason?.message }; }
        });
        const seen = new Set();
        results = results.filter(r => { const k = normalizeUrl(r.url); if (seen.has(k)) return false; seen.add(k); return true; });
        results.forEach(r => { r.relevance = relevance(r.name, q); });
        hit = { at: Date.now(), results, sources };
        // Only cache when at least one source worked, so a temporary outage is retried next time.
        if (Object.values(sources).some(s => s.ok)) cache.set(key, hit);
        if (cache.size > 500) cache.delete(cache.keys().next().value);
    }

    let list = hit.results;
    const lo = parseFloat(min), hi = parseFloat(max);
    if (Number.isFinite(lo)) list = list.filter(r => r.priceValue != null && r.priceValue >= lo);
    if (Number.isFinite(hi)) list = list.filter(r => r.priceValue != null && r.priceValue <= hi);
    if (stores) { const want = String(stores).toLowerCase().split(','); list = list.filter(r => want.includes(r.store.toLowerCase())); }
    const nullLast = (a, b, f) => (a.priceValue == null) - (b.priceValue == null) || f();
    if (sort === 'price_asc') list = [...list].sort((a, b) => nullLast(a, b, () => a.priceValue - b.priceValue));
    else if (sort === 'price_desc') list = [...list].sort((a, b) => nullLast(a, b, () => b.priceValue - a.priceValue));
    else list = [...list].sort((a, b) => b.relevance - a.relevance || nullLast(a, b, () => 0));

    return { results: list, sources: hit.sources, cached, currency: CURRENCY, serpapiUsage: `${serpUsage.count}/${SERPAPI_MONTHLY_LIMIT}` };
}

module.exports = { search, parsePrice, relevance };
