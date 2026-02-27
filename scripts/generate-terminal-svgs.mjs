/**
 * Generate terminal-style SVG screenshots from captured ANSI-colored text output.
 * Faithfully parses ANSI escape codes from the raw output — no color guessing.
 * Usage: node generate-terminal-svgs.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, '..', 'docs', 'static', 'img', 'screenshots');

// Vivid dark-terminal palette mapped to ANSI color codes
const ANSI_MAP = {
    30: '#45475a',  // black
    31: '#ff6b81',  // red
    32: '#7ee787',  // green
    33: '#ffd866',  // yellow
    34: '#79c0ff',  // blue
    35: '#d2a8ff',  // magenta
    36: '#7ee8d5',  // cyan
    37: '#d8dee9',  // white
    90: '#7f849c',  // bright black (gray)
    91: '#ff7eb3',  // bright red
    92: '#7ee787',  // bright green
    93: '#ffb86c',  // bright yellow (peach)
    94: '#89dcfe',  // bright blue (sky)
    95: '#f5c2e7',  // bright magenta (pink)
    96: '#7ee8d5',  // bright cyan (teal)
    97: '#ffffff',  // bright white
};
const DEFAULT_FG = '#d8dee9';
const BG = '#1e1e2e';
const TITLE_BG = '#313244';
const BORDER_COLOR = '#45475a';
const GRAY = '#6c7086';

const FONT = "'Cascadia Code','Fira Code','JetBrains Mono','Consolas',monospace";
const FONT_SIZE = 13;
const CHAR_W = 7.8;
const LINE_H = 19;
const PAD_X = 16;
const PAD_Y = 12;
const TITLE_H = 36;

function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Parse a line containing ANSI escape codes into an array of {text, color, bold} segments.
 * Faithfully maps ANSI codes to theme colors — no interpretation.
 */
function parseAnsi(line) {
    const segments = [];
    let color = DEFAULT_FG;
    let bold = false;
    let buf = '';

    const flush = () => {
        if (buf) { segments.push({ text: buf, color, bold }); buf = ''; }
    };

    let i = 0;
    while (i < line.length) {
        // Detect ESC [ ... m sequence
        if (line.charCodeAt(i) === 0x1b && line[i + 1] === '[') {
            flush();
            const end = line.indexOf('m', i + 2);
            if (end === -1) { buf += line[i]; i++; continue; }
            const codes = line.slice(i + 2, end).split(';').map(Number);
            for (const c of codes) {
                if (c === 0) { color = DEFAULT_FG; bold = false; }
                else if (c === 1) { bold = true; }
                else if (c === 39) { color = DEFAULT_FG; }
                else if (ANSI_MAP[c]) { color = ANSI_MAP[c]; }
            }
            i = end + 1;
        } else {
            buf += line[i];
            i++;
        }
    }
    flush();

    // Merge adjacent segments with identical color+bold to eliminate tspan gaps
    const merged = [];
    for (const seg of segments) {
        const prev = merged[merged.length - 1];
        if (prev && prev.color === seg.color && prev.bold === seg.bold) {
            prev.text += seg.text;
        } else {
            merged.push({ ...seg });
        }
    }
    return merged;
}

/** Get visible (non-ANSI) character count */
function visibleLength(segments) {
    return segments.reduce((n, s) => n + s.length, 0);
}

/** Check if a line (stripped) contains box-drawing characters */
function hasBoxChars(text) {
    return /[┌┐└┘├┤┬┴┼─│]/.test(text);
}

/** Render a parsed line's segments as SVG tspan elements */
function renderSegments(segments) {
    return segments.map(s => {
        const esc = escapeXml(s.text);
        const attrs = [`fill="${s.color}"`];
        if (s.bold) attrs.push('font-weight="bold"');
        return `<tspan ${attrs.join(' ')}>${esc}</tspan>`;
    }).join('');
}

function generateSvg(parsedLines, title) {
    // parsedLines = array of { segments: [...], plainText: string }
    while (parsedLines.length && !parsedLines[parsedLines.length - 1].plainText.trim()) {
        parsedLines.pop();
    }

    const maxChars = Math.max(...parsedLines.map(l => l.plainText.length), 60);
    const width = maxChars * CHAR_W + PAD_X * 2;
    const height = TITLE_H + PAD_Y * 2 + parsedLines.length * LINE_H + 12;

    const textEls = parsedLines.map((line, i) => {
        const y = TITLE_H + PAD_Y + (i + 1) * LINE_H;
        const isTable = hasBoxChars(line.plainText);
        // For table lines, force textLength to prevent box-drawing gaps
        const tl = isTable
            ? ` textLength="${(line.plainText.length * CHAR_W).toFixed(1)}" lengthAdjust="spacingAndGlyphs"`
            : '';
        return `    <text x="${PAD_X}" y="${y}" font-family="${FONT}" font-size="${FONT_SIZE}"${tl}>${renderSegments(line.segments)}</text>`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><style>text{white-space:pre;}</style></defs>
  <rect width="${width}" height="${height}" rx="10" fill="${BG}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <rect width="${width}" height="${TITLE_H}" rx="10" fill="${TITLE_BG}"/>
  <rect y="${TITLE_H - 10}" width="${width}" height="10" fill="${TITLE_BG}"/>
  <circle cx="18" cy="18" r="6" fill="#f38ba8"/>
  <circle cx="38" cy="18" r="6" fill="#f9e2af"/>
  <circle cx="58" cy="18" r="6" fill="#a6e3a1"/>
  <text x="${width / 2}" y="22" font-family="'SF Pro','Segoe UI',system-ui,sans-serif" font-size="12" fill="${GRAY}" text-anchor="middle">${escapeXml(title)}</text>
${textEls}
</svg>`;
}

/** Load a raw ANSI file and parse each line into segments */
function loadRawFile(filename) {
    const fullPath = join(SCREENSHOTS_DIR, filename);
    if (!existsSync(fullPath)) {
        console.error(`  ⚠ Not found: ${filename}`);
        return null;
    }
    const content = readFileSync(fullPath, 'utf-8');
    const rawLines = content.split('\n').map(l => l.replace(/\r$/, ''));

    // Find first meaningful line
    const startIdx = rawLines.findIndex(l => {
        const plain = l.replace(/\x1b\[[0-9;]*m/g, '');
        return /^\s*(Feature|Specification):/.test(plain) || /^\s*┌/.test(plain);
    });

    const lines = startIdx > 0 ? rawLines.slice(startIdx) : rawLines;

    return lines.map(raw => {
        const segments = parseAnsi(raw);
        const plainText = segments.map(s => s.text).join('');
        return { segments, plainText };
    });
}

function saveSvg(outputFile, parsedLines, title) {
    if (!parsedLines || parsedLines.length === 0) {
        console.error(`  ⚠ No content for ${outputFile}`);
        return;
    }
    const svg = generateSvg([...parsedLines], title);
    writeFileSync(join(SCREENSHOTS_DIR, outputFile), svg, 'utf-8');
    console.log(`  ✓ ${outputFile} (${parsedLines.length} lines)`);
}

/** Find index of first summary table header row */
function findSummaryTable(lines) {
    return lines.findIndex(l =>
        /^\s*│\s*(Feature|Specification|Suite)\s+│/.test(l.plainText)
    );
}

// ============================================================
console.log('Generating terminal SVG screenshots...\n');

// 1. vitest-first-run.svg — BDD steps only (no summary table)
const bdd = loadRawFile('raw-bdd-output.txt');
if (bdd) {
    const si = findSummaryTable(bdd);
    const cut = si > 2 ? si - 2 : bdd.length;
    saveSvg('vitest-first-run.svg', bdd.slice(0, cut), 'npx vitest run');
}

// 2. terminal-output-hero.svg — Full BDD with summary table
if (bdd) {
    saveSvg('terminal-output-hero.svg', bdd, 'npx vitest run — LiveDoc BDD Output');
}

// 3. reporter-spec-output.svg — Specification pattern (steps only)
const spec = loadRawFile('raw-spec-output.txt');
if (spec) {
    const si = findSummaryTable(spec);
    const cut = si > 2 ? si - 2 : spec.length;
    saveSvg('reporter-spec-output.svg', spec.slice(0, Math.min(cut, 70)), 'LiveDocSpecReporter — spec+summary+headers');
}

// 4. vitest-spec-output.svg — Full spec output
if (spec) {
    saveSvg('vitest-spec-output.svg', spec.slice(0, 80), 'LiveDocSpecReporter — Specification Pattern');
}

// 5. reporter-detail-list.svg
const list = loadRawFile('raw-list-output.txt');
if (list) {
    saveSvg('reporter-detail-list.svg', list.slice(0, 50), 'LiveDocSpecReporter — list detail level');
}

// 6. reporter-detail-summary.svg
const summary = loadRawFile('raw-summary-output.txt');
if (summary) {
    saveSvg('reporter-detail-summary.svg', summary, 'LiveDocSpecReporter — summary detail level');
}

// 7. vitest-tutorial-output.svg
const tutorial = loadRawFile('raw-tutorial-output.txt');
if (tutorial) {
    const errIdx = tutorial.findIndex(l => /Error:\s*\d/.test(l.plainText) && /│/.test(l.plainText));
    const clean = errIdx > 0 ? tutorial.slice(0, errIdx - 2) : tutorial;
    saveSvg('vitest-tutorial-output.svg', clean.slice(0, 70), 'npx vitest run — Tutorial: Beautiful Tea Shipping Costs');
}

// 8. vitest-feature-output.svg
const feature = loadRawFile('raw-feature-output.txt');
if (feature) {
    saveSvg('vitest-feature-output.svg', feature, 'npx vitest run — Feature Test');
}

// 9. vitest-scenario-outline.svg
if (tutorial) {
    const ex3 = tutorial.findIndex(l => /Example:\s*3/.test(l.plainText));
    const outline = ex3 > 0 ? tutorial.slice(0, ex3) : tutorial.slice(0, 50);
    saveSvg('vitest-scenario-outline.svg', outline, 'Scenario Outline with Examples Table');
}

console.log('\nDone! SVGs saved to docs/static/img/screenshots/');
