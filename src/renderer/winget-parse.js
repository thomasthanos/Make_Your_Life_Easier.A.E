
const ANSI_COLOURS = /\x1b\[[0-9;]*m/g;
const SEPARATOR_LINE = /^[\s\-─═]+$/;
const KNOWN_SOURCES = new Set(['winget', 'msstore', 'winget-font']);

const isSeparator = (line) => SEPARATOR_LINE.test(line) && line.trim().length > 5;

export function toWingetLines(rawOutput) {
    return String(rawOutput)
        .replace(ANSI_COLOURS, '')
        .split('\r\n')
        .map((chunk) => { const parts = chunk.split('\r'); return parts[parts.length - 1]; })
        .join('\n')
        .split('\n');
}

function columnStarts(header, rows) {
    const starts = [];
    for (let pos = 0; pos < header.length; pos++) {
        const startsWord = header[pos] !== ' ' && (pos === 0 || header[pos - 1] === ' ');
        if (!startsWord) continue;
        const used = starts.length === 0 || rows.some((row) => pos < row.length && row[pos] !== ' ');
        if (used) starts.push(pos);
    }
    return starts;
}

function cell(line, start, end) {
    if (start < 0 || line.length <= start) return '';
    return line.substring(start, end === undefined ? line.length : Math.min(end, line.length))
        .trim()
        .replace(/[….]+$/, '')
        .trim();
}

const looksLikeRow = (line, starts) => starts.length > 1 && line.length > starts[1] && line[starts[1]] !== ' ';

export function parseWingetTables(rawOutput) {
    const lines = toWingetLines(rawOutput);
    const tables = [];

    for (let i = 1; i < lines.length; i++) {
        if (!isSeparator(lines[i]) || !lines[i - 1].trim()) continue;

        const header = lines[i - 1];
        const body = [];
        let end = i + 1;
        for (; end < lines.length; end++) {
            const line = lines[end];
            if (!line.trim() || isSeparator(line)) break;
            if (end + 1 < lines.length && isSeparator(lines[end + 1])) break;
            body.push(line);
        }

        const starts = columnStarts(header, body);
        if (starts.length >= 2) {
            tables.push({
                columns: starts.length,
                rows: body
                    .filter((line) => looksLikeRow(line, starts))
                    .map((line) => starts.map((start, col) => cell(line, start, starts[col + 1])))
            });
        }
        i = end - 1;
    }

    return tables;
}

export function parseWingetColumns(rawOutput) {
    const entries = [];

    for (const table of parseWingetTables(rawOutput)) {
        const fourthIsSource = table.rows.length > 0 && table.rows.every((row) => {
            const value = (row[3] || '').toLowerCase();
            return !value || KNOWN_SOURCES.has(value);
        });

        for (const row of table.rows) {
            const [, id, version] = row;
            const available = fourthIsSource ? '' : (row[3] || '');
            const source = fourthIsSource ? (row[3] || '') : (row[4] || '');

            const looksLikeId = id && !/\s/.test(id) && (
                id.includes('.') || id.startsWith('{') || id.startsWith('ARP') || id.startsWith('MSIX')
                || (Boolean(source) && id.length >= 6)
            );
            if (looksLikeId && id.length >= 2) {
                entries.push({ id, version, available: available || null, source });
            }
        }
    }

    if (entries.length) return entries;

    const fallback = [];
    const idRegex = /(?:^|\s)((?:[A-Za-z0-9_-]+\.){1,}[A-Za-z0-9_-]+)\s+([\d][^\s]*)/;
    for (const line of toWingetLines(rawOutput)) {
        const match = idRegex.exec(line);
        if (match && match[1].trim().length >= 4) {
            fallback.push({ id: match[1].trim(), version: match[2].trim(), available: null, source: '' });
        }
    }
    return fallback;
}

export function parseWingetSearch(rawOutput) {
    const results = [];

    for (const table of parseWingetTables(rawOutput)) {
        let sourceColumn = -1;
        for (let col = table.columns - 1; col >= 3; col--) {
            const values = table.rows.map((row) => row[col]).filter(Boolean);
            if (values.length && values.every((value) => !value.includes(':') && !/\s/.test(value))) {
                sourceColumn = col;
                break;
            }
        }

        for (const row of table.rows) {
            const [name, id, version] = row;
            if (!name || !id || /\s/.test(id)) continue;
            results.push({
                name,
                id,
                version: version || '',
                source: (sourceColumn >= 0 ? row[sourceColumn] : '') || 'winget'
            });
        }
    }

    return results;
}

export function matchWingetId(appId, pkgId) {
    const a = String(appId).toLowerCase();
    const p = String(pkgId).toLowerCase();
    if (a === p) return true;
    if (p.startsWith(a) || a.startsWith(p)) return true;
    const aParts = a.split('.');
    const pParts = p.split('.');
    if (aParts.length >= 2 && pParts.length >= 2) {
        if (aParts[0] === pParts[0] && aParts[1] === pParts[1]) return true;
    }
    return false;
}

export function sanitizeSearchQuery(text) {
    return String(text ?? '')
        .replace(/[^\p{L}\p{N}\s.+#_-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 64);
}
