import fs from 'node:fs';
import path from 'node:path';
import {normalizePaper, readApprovedPapers} from './paper-schema.mjs';

function setOutput(name, value) {
    if (!process.env.GITHUB_OUTPUT) return;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replace(/[\r\n]+/g, ' ')}\n`);
}

function decodeIssueText(value) {
    let decoded = String(value || '');
    for (let attempt = 0; attempt < 2 && /%[0-9a-f]{2}/i.test(decoded); attempt += 1) {
        try {
            const next = decodeURIComponent(decoded.replace(/\+/g, ' '));
            if (next === decoded) break;
            decoded = next;
        } catch {
            break;
        }
    }
    return decoded;
}

function normalizeMarkers(value) {
    return value
        .replace(/<![\-\u2013\u2014]{1,2}\s*seminal-paper-submission:start\s*[\-\u2013\u2014]{1,2}>/gi, '<!-- seminal-paper-submission:start -->')
        .replace(/<![\-\u2013\u2014]{1,2}\s*seminal-paper-submission:end\s*[\-\u2013\u2014]{1,2}>/gi, '<!-- seminal-paper-submission:end -->');
}

function createSubmission() {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const issueNumber = Number(event.issue?.number);
    const body = normalizeMarkers(decodeIssueText(event.issue?.body));
    const match = body.match(/<!-- seminal-paper-submission:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- seminal-paper-submission:end -->/);
    if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error('Issue number is missing.');
    if (!match) throw new Error('Issue does not contain a structured paper submission.');

    const paper = normalizePaper(JSON.parse(match[1]));
    const archiveHtml = fs.readFileSync('index.html', 'utf8').toLowerCase();
    if (archiveHtml.includes(paper.url.toLowerCase()) || archiveHtml.includes(`>${paper.title.toLowerCase()}<`)) {
        throw new Error('This paper already exists in the original archive.');
    }

    const approved = readApprovedPapers();
    if (approved.some(item => item.url === paper.url || item.title.toLowerCase() === paper.title.toLowerCase())) {
        throw new Error('This paper already exists in approved submissions.');
    }

    const submissionPath = `submissions/issue-${issueNumber}.json`;
    if (fs.existsSync(submissionPath)) throw new Error(`Issue ${issueNumber} already has a submission file.`);
    fs.mkdirSync(path.dirname(submissionPath), {recursive: true});
    fs.writeFileSync(submissionPath, `${JSON.stringify(paper, null, 2)}\n`);
    setOutput('submission_path', submissionPath);
    setOutput('issue_title', `[Paper Submission] ${paper.title}`);
}

try {
    createSubmission();
} catch (error) {
    setOutput('error', error.message || 'Unknown validation error.');
    console.error(error.message || error);
    process.exitCode = 1;
}
