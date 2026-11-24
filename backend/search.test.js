// Run: npm test  (uses node:test, no network: axios is stubbed)
const test = require('node:test');
const assert = require('node:assert');
const axios = require('axios');

process.env.SERPAPI_KEY = 'x';
process.env.EBAY_APP_ID = 'x';
process.env.EBAY_CERT_ID = 'x';
delete process.env.BOL_CLIENT_ID;
let calls = 0;
axios.post = async () => ({ data: { access_token: 't', expires_in: 7200 } });
axios.get = async (url, { params } = {}) => {
    calls++;
    if (url.includes('er-api')) return { data: { rates: { EUR: 1, USD: 1.1 } } };
    if (params?.engine === 'amazon') return { data: { organic_results: [
        { asin: 'A1', title: 'Sony WH-1000XM5 koptelefoon', extracted_price: 299, link: 'https://amazon.nl/dp/A1' }] } };
    if (params?.engine === 'google_shopping') return { data: { shopping_results: [
        { title: 'Sony WH-1000XM5', source: 'Coolblue', price: '€ 279,00', product_link: 'https://coolblue.nl/x' },
        { title: 'Kabel', source: 'bol.com', price: '€ 9,99', product_link: 'https://bol.com/y' }] } };
    if (url.includes('ebay')) return { data: { itemSummaries: [
        { itemId: 'E1', title: 'Sony WH-1000XM5 used', price: { value: '220.00', currency: 'USD' }, itemWebUrl: 'https://ebay.nl/itm/E1' }] } };
    throw new Error('unexpected ' + url);
};
const { search, parsePrice } = require('./search');

test('parsePrice handles EU and US formats', () => {
    assert.strictEqual(parsePrice('€ 1.299,00'), 1299);
    assert.strictEqual(parsePrice('$1,299.50'), 1299.5);
    assert.strictEqual(parsePrice('N/A'), null);
});

test('search merges shops, converts currency, sorts and filters', async () => {
    const r = await search('sony  wh-1000xm5', { sort: 'price_asc' });
    assert.deepStrictEqual(r.results.map(x => x.store), ['bol.com', 'eBay', 'Coolblue', 'Amazon']);
    assert.strictEqual(r.results[1].priceValue, 200); // 220 USD / 1.1
    assert.strictEqual(r.sources.bol.ok, false); // no key → reported, not fatal
    const f = await search('Sony WH-1000XM5', { min: 100, max: 290 });
    assert.ok(f.cached);
    assert.deepStrictEqual(f.results.map(x => x.store).sort(), ['Coolblue', 'eBay']);
    assert.strictEqual(f.results[0].relevance, 1);
});

test('cache avoids repeat API calls', async () => {
    const before = calls;
    await search('SONY WH-1000XM5');
    assert.strictEqual(calls, before);
});
