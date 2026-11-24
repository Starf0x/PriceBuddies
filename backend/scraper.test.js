// Run: npm test  (offline fixtures; browser test runs only when PUPPETEER_EXECUTABLE_PATH is set)
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { extract, parsePrice, isBlocked, scrapeProduct } = require('./scraper');

const page = (head, body = '') => `<html><head>${head}</head><body>${body}${'<p>filler</p>'.repeat(300)}</body></html>`;

test('parsePrice: EU, US and machine formats', () => {
    assert.strictEqual(parsePrice('€ 12,99'), 12.99);
    assert.strictEqual(parsePrice('€ 1.299,95'), 1299.95);
    assert.strictEqual(parsePrice('€ 1.299,-'), 1299);
    assert.strictEqual(parsePrice('$1,299.50'), 1299.5);
    assert.strictEqual(parsePrice('1,299'), 1299);
    assert.strictEqual(parsePrice('19.99', true), 19.99);
    assert.strictEqual(parsePrice('gratis'), null);
});

test('JSON-LD Product (with @graph and offers array)', () => {
    const ld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, {
        '@type': 'Product', name: 'Coca-Cola Zero 24x330ml', image: ['/img/cola.jpg'],
        offers: [{ '@type': 'Offer', price: '17.49', priceCurrency: 'EUR' }] }] };
    const r = extract(page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`), 'https://shop.nl/p/1');
    assert.deepStrictEqual([r.name, r.price, r.currency, r.image, r.method], ['Coca-Cola Zero 24x330ml', 17.49, 'EUR', 'https://shop.nl/img/cola.jpg', 'jsonld']);
});

test('Open Graph product meta', () => {
    const r = extract(page('<meta property="og:title" content="Koffie"><meta property="product:price:amount" content="8.95"><meta property="product:price:currency" content="EUR">'), 'https://x.nl');
    assert.deepStrictEqual([r.name, r.price, r.currency, r.method], ['Koffie', 8.95, 'EUR', 'meta']);
});

test('Embedded app state (__NEXT_DATA__)', () => {
    const nd = { props: { pageProps: { product: { title: 'Frisdrank 24-pack', salePrice: { amount: '15.99', currency: 'EUR' } } } } };
    const r = extract(page(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script>`), 'https://x.nl');
    assert.deepStrictEqual([r.name, r.price, r.method], ['Frisdrank 24-pack', 15.99, 'embedded']);
});

test('Visible price text, ignoring old/strike prices', () => {
    const r = extract(page('<title>Thee</title>', '<h1>Groene thee</h1><span class="price-old">€ 5,99</span><span class="product-price">€ 4,49</span>'), 'https://x.nl');
    assert.deepStrictEqual([r.name, r.price, r.currency, r.method], ['Groene thee', 4.49, 'EUR', 'visible']);
});

test('Bot-check pages are detected', () => {
    assert.ok(isBlocked('<html><head><title>Joybuy Risk Control</title></head><body>Data-encryptie</body></html>', 200));
    assert.ok(isBlocked('<title>Just a moment...</title>', 200));
    assert.ok(isBlocked('', 403));
    assert.ok(!isBlocked(page('<meta property="og:title" content="x">'), 200));
});

test('Browser fallback passes a JS challenge page', { skip: !process.env.PUPPETEER_EXECUTABLE_PATH }, async () => {
    // Plain HTTP gets a "Risk Control" page that sets a cookie via JS and reloads, like joybuy.nl.
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html');
        if ((req.headers.cookie || '').includes('ok=1')) {
            return res.end(page('<script type="application/ld+json">{"@type":"Product","name":"Cola Zero","offers":{"price":"17.49","priceCurrency":"EUR"}}</script>'));
        }
        res.end('<html><head><title>Risk Control</title></head><body>Data-encryptie<script>setTimeout(()=>{document.cookie="ok=1";location.reload()},500)</script></body></html>');
    }).listen(0);
    try {
        const r = await scrapeProduct(`http://127.0.0.1:${server.address().port}/dp/1`);
        assert.deepStrictEqual([r.name, r.price, r.via], ['Cola Zero', 17.49, 'browser']);
    } finally {
        server.close();
        await require('./scraper').closeBrowser();
    }
});
