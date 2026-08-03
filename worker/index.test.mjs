import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {extractReadableText, isSafeSourceUrl, normalizePaper, verifyDoi} from './index.js';

test('rejects local and credential-bearing source URLs', () => {
    assert.equal(isSafeSourceUrl('https://example.com/paper.pdf'), true);
    assert.equal(isSafeSourceUrl('http://localhost/paper'), false);
    assert.equal(isSafeSourceUrl('http://127.0.0.1/paper'), false);
    assert.equal(isSafeSourceUrl('https://user:pass@example.com/paper'), false);
});

test('extracts readable text while dropping active content', () => {
    const html = '<title>A &amp; B</title><style>bad</style><main>Hello <b>world</b></main><script>bad()</script>';
    assert.equal(extractReadableText(html), 'A & B Hello world');
});

test('normalizes a structured paper response', () => {
    const paper = normalizePaper({
        title: 'MapReduce', author: 'Jeffrey Dean, Sanjay Ghemawat', company: 'Google',
        year: 2004, doi: '', sector: 'Technical Paper', format: 'Paper',
    }, 'https://example.com/mapreduce.pdf', ['Technical Paper']);
    assert.equal(paper.year, '2004');
    assert.equal(paper.url, 'https://example.com/mapreduce.pdf');
});

test('clears a DOI that Crossref cannot verify', async () => {
    const paper = {
        title: 'MapReduce: Simplified Data Processing on Large Clusters',
        year: '2004',
        doi: 'https://doi.org/10.1145/1251252.1251260',
    };
    const verified = await verifyDoi(paper, async () => new Response('', {status: 404}));
    assert.equal(verified.doi, '');
});

test('keeps a DOI only when Crossref title and year match', async () => {
    const paper = {
        title: 'A Seminal Systems Paper',
        year: '2004',
        doi: 'https://doi.org/10.1000/example',
    };
    const matchingFetch = async () => Response.json({
        message: {title: ['A Seminal Systems Paper'], issued: {'date-parts': [[2004]]}},
    });
    assert.equal((await verifyDoi(paper, matchingFetch)).doi, paper.doi);

    const wrongYearFetch = async () => Response.json({
        message: {title: ['A Seminal Systems Paper'], issued: {'date-parts': [[2008]]}},
    });
    assert.equal((await verifyDoi(paper, wrongYearFetch)).doi, '');
});

test('health endpoint permits the production site origin', async () => {
    const request = new Request('https://worker.example/health', {headers: {Origin: 'https://nikhi1g.github.io'}});
    const response = await worker.fetch(request, {}, {waitUntil() {}});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://nikhi1g.github.io');
});

test('rejects unknown browser origins', async () => {
    const request = new Request('https://worker.example/health', {headers: {Origin: 'https://attacker.example'}});
    const response = await worker.fetch(request, {}, {waitUntil() {}});
    assert.equal(response.status, 403);
});
