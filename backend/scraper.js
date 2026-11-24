// Generic product-page scraper (v0.0.53).
// scrapeProduct(url) → { name, price, currency, image, method, via } or null.
// Order: JSON-LD → microdata → meta tags → embedded JSON (__NEXT_DATA__ etc.) → visible price text.
// When the plain HTTP fetch gets a bot-check page, it retries with headless Chrome (puppeteer).
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LANG = process.env.SCRAPE_ACCEPT_LANGUAGE || 'nl-NL,nl;q=0.9,en;q=0.8';
const USE_BROWSER = process.env.SCRAPE_BROWSER !== 'false';
const SYMBOLS = { '€': 'EUR', '$': 'USD', '£': 'GBP', '₹': 'INR' };

// ── Price parsing ───────────────────────────────────────────────
// machine=true for schema.org/meta values, which always use "." as decimal separator.
function parsePrice(raw, machine = false) {
    if (raw == null) return null;
    if (typeof raw === 'number') return raw > 0 ? raw : null;
    if (machine && /^\s*\d+(\.\d+)?\s*$/.test(raw)) { const n = parseFloat(raw); return n > 0 ? Math.round(n * 100) / 100 : null; }
    let s = String(raw).replace(/[^\d.,]/g, '');
    if (!s) return null;
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
        // "1.299,95" or "12,99" (EU) — but "1,299" (US thousands) has 3 digits after the comma
        s = /,\d{3}$/.test(s) && lastDot === -1 ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
    } else {
        // "1.299" (EU thousands, no decimals) vs "12.99"; prices never have 3 decimals
        s = /\.\d{3}$/.test(s) && lastComma === -1 && !/^0\./.test(s) ? s.replace(/\./g, '') : s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function currencyFrom(text, fallback) {
    const m = String(text || '').match(/[€$£₹]|\b(EUR|USD|GBP|INR)\b/);
    return m ? (SYMBOLS[m[0]] || m[0]) : fallback;
}
function defaultCurrency(url) {
    const tld = (() => { try { return new URL(url).hostname.split('.').pop(); } catch { return ''; } })();
    return { in: 'INR', uk: 'GBP', com: 'USD', us: 'USD' }[tld] || 'EUR';
}

// ── Extractors ──────────────────────────────────────────────────
function flattenLd(node, out = []) {
    if (Array.isArray(node)) node.forEach(n => flattenLd(n, out));
    else if (node && typeof node === 'object') {
        out.push(node);
        if (node['@graph']) flattenLd(node['@graph'], out);
        if (node.mainEntity) flattenLd(node.mainEntity, out);
    }
    return out;
}
const isType = (n, t) => [].concat(n['@type'] || []).some(x => String(x).toLowerCase() === t);
const firstImage = (img) => typeof img === 'string' ? img : Array.isArray(img) ? firstImage(img[0]) : img?.url || img?.contentUrl || null;

function fromJsonLd($) {
    const nodes = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try { flattenLd(JSON.parse($(el).contents().text().trim().replace(/^\s*<!--|-->\s*$/g, '')), nodes); } catch { /* bad JSON */ }
    });
    const product = nodes.find(n => isType(n, 'product') || isType(n, 'productgroup'));
    if (!product) return null;
    let offers = [].concat(product.offers || product.hasVariant?.flatMap?.(v => [].concat(v.offers || [])) || []);
    offers = offers.flatMap(o => [o, ...[].concat(o?.offers || [])]).filter(Boolean);
    let price = null, currency = null;
    for (const o of offers) {
        price = parsePrice(o.price ?? o.lowPrice ?? o.priceSpecification?.price ?? [].concat(o.priceSpecification || [])[0]?.price, true);
        currency = o.priceCurrency || o.priceSpecification?.priceCurrency || [].concat(o.priceSpecification || [])[0]?.priceCurrency;
        if (price) break;
    }
    return { name: product.name, price, currency, image: firstImage(product.image) };
}

function fromMicrodata($) {
    const scope = $('[itemtype*="schema.org/Product"]').first();
    const root = scope.length ? scope : $.root();
    const prop = (p) => { const el = root.find(`[itemprop="${p}"]`).first(); return el.attr('content') || el.attr('src') || el.text().trim() || null; };
    const price = parsePrice(prop('price') || prop('lowPrice'), true);
    if (!price) return null;
    return { name: scope.length ? prop('name') : null, price, currency: prop('priceCurrency'), image: prop('image') };
}

function fromMeta($) {
    const m = (...keys) => { for (const k of keys) { const v = $(`meta[property="${k}"],meta[name="${k}"],meta[itemprop="${k}"]`).attr('content'); if (v) return v; } return null; };
    return {
        name: m('og:title', 'twitter:title'),
        price: parsePrice(m('product:price:amount', 'og:price:amount'), true),
        currency: m('product:price:currency', 'og:price:currency'),
        image: m('og:image', 'twitter:image'),
    };
}

// Search embedded app state (Next.js, Nuxt, Redux…) for the first object with a title-ish and price-ish key.
function fromEmbeddedJson($) {
    const blobs = [];
    $('script').each((_, el) => {
        const t = $(el).contents().text();
        if ($(el).attr('id') === '__NEXT_DATA__' || $(el).attr('type') === 'application/json') blobs.push(t);
        else { const m = t.match(/window\.__(?:INITIAL_STATE|PRELOADED_STATE|NUXT|APOLLO_STATE)__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/); if (m) blobs.push(m[1]); }
    });
    const PRICE = ['salePrice', 'finalPrice', 'currentPrice', 'sellingPrice', 'price', 'jdPrice', 'priceAmount'];
    const NAME = ['title', 'name', 'productName', 'skuName'];
    for (const b of blobs) {
        let data; try { data = JSON.parse(b); } catch { continue; }
        const stack = [data]; let seen = 0;
        while (stack.length && seen++ < 20000) {
            const o = stack.pop();
            if (!o || typeof o !== 'object') continue;
            const pk = PRICE.find(k => o[k] != null && (typeof o[k] !== 'object' || o[k].amount || o[k].value));
            const nk = NAME.find(k => typeof o[k] === 'string' && o[k].length > 3);
            if (pk && nk) {
                const pv = typeof o[pk] === 'object' ? (o[pk].amount ?? o[pk].value) : o[pk];
                const price = parsePrice(pv, true);
                if (price) return { name: o[nk], price, currency: o.currency || o.priceCurrency || o[pk]?.currency, image: firstImage(o.image || o.imageUrl || o.images) };
            }
            Object.values(o).forEach(v => { if (v && typeof v === 'object') stack.push(v); });
        }
    }
    return null;
}

const PRICE_SELECTORS = [
    '.x-price-primary', '#prcIsum', '.a-price .a-offscreen', '#corePrice_feature_div .a-offscreen', // eBay/Amazon
    '[data-test="price"]', '[data-testid*="price" i]', '[class*="sales-price" i]', '[class*="current-price" i]',
    '[class*="product-price" i]', '[class*="price" i]:not([class*="old" i]):not([class*="was" i]):not([class*="strike" i])',
];
function fromVisible($) {
    for (const sel of PRICE_SELECTORS) {
        let found = null;
        $(sel).each((_, el) => { const t = $(el).text().trim(); if (!found && t.length < 40 && /\d/.test(t) && parsePrice(t)) found = t; });
        if (found) return { price: parsePrice(found), currency: currencyFrom(found, null) };
    }
    return null;
}

function extract(html, url) {
    const $ = cheerio.load(html);
    const parts = [['jsonld', fromJsonLd($)], ['microdata', fromMicrodata($)], ['meta', fromMeta($)], ['embedded', fromEmbeddedJson($)], ['visible', fromVisible($)]];
    const r = { name: null, price: null, currency: null, image: null, method: null };
    for (const [method, p] of parts) {
        if (!p) continue;
        if (!r.price && p.price) { r.price = p.price; r.currency = p.currency || null; r.method = method; }
        r.name ||= p.name; r.image ||= p.image;
    }
    r.name = (r.name || $('h1').first().text() || $('title').text() || '').replace(/\s+/g, ' ').trim().substring(0, 200) || null;
    r.currency = (r.currency || defaultCurrency(url)).toUpperCase();
    if (r.image && url) { try { r.image = new URL(r.image, url).href; } catch { /* keep */ } }
    return r;
}

// Bot-protection / challenge pages (Cloudflare, Akamai, DataDome, JD "Risk Control", Amazon captcha…)
function isBlocked(html, status) {
    if ([403, 429, 503].includes(status)) return true;
    const head = String(html || '').slice(0, 20000).toLowerCase();
    return /risk control|just a moment|attention required|captcha|are you a robot|robot check|access denied|verify you are human|px-captcha|datadome|cf-chl/.test(head)
        || (head.length < 3000 && !/application\/ld\+json|og:title/.test(head));
}

// ── Fetching ────────────────────────────────────────────────────
async function fetchPlain(url) {
    const key = process.env.SCRAPER_API_KEY;
    const target = key ? `https://api.scraperapi.com/?api_key=${key}&url=${encodeURIComponent(url)}` : url;
    const res = await axios.get(target, {
        timeout: 15000, maxRedirects: 5, validateStatus: () => true, responseType: 'text',
        headers: { 'User-Agent': UA, 'Accept-Language': LANG, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    return { html: typeof res.data === 'string' ? res.data : '', status: res.status };
}

let browserPromise = null;
async function getBrowser() {
    if (!browserPromise) {
        const puppeteer = require('puppeteer');
        browserPromise = puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', `--lang=${LANG.split(',')[0]}`],
        }).catch(e => { browserPromise = null; throw e; });
    }
    return browserPromise;
}
async function fetchBrowser(url) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setUserAgent(UA);
        await page.setExtraHTTPHeaders({ 'Accept-Language': LANG });
        await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        // Challenge pages usually redirect/reload by themselves after a few seconds.
        // page.content() throws while such a reload is in progress, so treat that as "still blocked".
        const content = async () => { try { return await page.content(); } catch { return ''; } };
        let html = await content();
        for (let i = 0; i < 10 && isBlocked(html, 200); i++) {
            await new Promise(r => setTimeout(r, 1500));
            await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
            html = await content();
        }
        return { html, status: 200 };
    } finally {
        await page.close().catch(() => {});
    }
}

async function scrapeProduct(url) {
    let via = 'http', html = '', status = 0;
    try { ({ html, status } = await fetchPlain(url)); } catch (e) { status = 0; }
    let r = status && status < 400 && !isBlocked(html, status) ? extract(html, url) : null;
    if ((!r || !r.price) && USE_BROWSER) {
        try { ({ html } = await fetchBrowser(url)); via = 'browser'; r = isBlocked(html, 200) ? null : extract(html, url); }
        catch (e) { console.warn('Browser scrape failed:', e.message); }
    }
    if (!r || !r.price) return null;
    return { ...r, via };
}

// ── Currency conversion (for the INR-based tracker) ─────────────
const rateCache = {};
async function convert(value, from, to) {
    if (!value || !from || from === to) return value;
    const c = rateCache[from];
    if (!c || Date.now() - c.at > 6 * 3600 * 1000) {
        try { const { data } = await axios.get(`https://open.er-api.com/v6/latest/${from}`, { timeout: 5000 }); rateCache[from] = { at: Date.now(), rates: data.rates }; }
        catch (e) { if (!c) return null; }
    }
    const r = rateCache[from]?.rates?.[to];
    return r ? Math.round(value * r * 100) / 100 : null;
}

async function closeBrowser() {
    if (browserPromise) { const b = await browserPromise.catch(() => null); browserPromise = null; await b?.close(); }
}

module.exports = { scrapeProduct, extract, parsePrice, isBlocked, convert, closeBrowser };
