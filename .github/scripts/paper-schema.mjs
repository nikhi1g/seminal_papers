import fs from 'node:fs';
import path from 'node:path';

const required = ['title', 'url', 'author', 'year', 'sector', 'format'];
const allowed = [...required, 'company', 'doi'];
const formats = ['Book', 'Deck', 'Essay', 'Essay Series', 'Letter', 'Manifesto', 'Memo', 'Op-Ed', 'Paper', 'Presentation', 'Report', 'Research', 'Whitepaper'];

function clean(value, maxLength, field) {
    const normalized = String(value || '').trim();
    if (normalized.length > maxLength) throw new Error(`${field} exceeds ${maxLength} characters.`);
    if (/[<>\u0000-\u001f]/.test(normalized)) throw new Error(`${field} contains invalid characters.`);
    return normalized;
}

function validUrl(value, requiredValue, field) {
    const normalized = clean(value, 500, field);
    if (!normalized && !requiredValue) return '';
    let url;
    try {
        url = new URL(normalized);
    } catch {
        throw new Error(`${field} must be a valid URL.`);
    }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`${field} must use HTTP or HTTPS.`);
    return url.href;
}

export function normalizePaper(paper) {
    if (!paper || Array.isArray(paper) || typeof paper !== 'object') throw new Error('Submission must be one JSON object.');
    if (Object.keys(paper).some(key => !allowed.includes(key))) throw new Error('Submission contains an unsupported field.');
    for (const key of required) {
        if (!String(paper[key] || '').trim()) throw new Error(`Missing required field: ${key}.`);
    }

    const year = Number(paper.year);
    if (!Number.isInteger(year) || year < 1800 || year > 2100) throw new Error('Year must be between 1800 and 2100.');
    if (!formats.includes(paper.format)) throw new Error(`Unsupported format: ${paper.format}.`);

    return {
        title: clean(paper.title, 180, 'Title'),
        url: validUrl(paper.url, true, 'Direct link'),
        doi: validUrl(paper.doi, false, 'DOI link'),
        author: clean(paper.author, 1000, 'Author'),
        company: clean(paper.company, 120, 'Company'),
        year: String(year),
        sector: clean(paper.sector, 80, 'Sector'),
        format: paper.format,
    };
}

export function readApprovedPapers(directory = 'submissions') {
    if (!fs.existsSync(directory)) return [];
    const files = fs.readdirSync(directory)
        .filter(file => file.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right, undefined, {numeric: true}));
    const papers = files.map(file => {
        const filePath = path.join(directory, file);
        try {
            return normalizePaper(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        } catch (error) {
            throw new Error(`${filePath}: ${error.message}`);
        }
    });
    assertUniquePapers(papers);
    return papers;
}

export function assertUniquePapers(papers) {
    const titles = new Set();
    const urls = new Set();
    for (const paper of papers) {
        const title = paper.title.toLowerCase();
        const url = paper.url.toLowerCase();
        if (titles.has(title)) throw new Error(`Duplicate title: ${paper.title}.`);
        if (urls.has(url)) throw new Error(`Duplicate URL: ${paper.url}.`);
        titles.add(title);
        urls.add(url);
    }
}
