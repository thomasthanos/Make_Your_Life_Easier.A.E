
const ANSI_COLOURS = /\x1b\[[0-9;]*m/g;
const SEPARATOR_LINE = /^[\s\-─═]+$/;
const KNOWN_SOURCES = new Set(['winget', 'msstore', 'winget-font']);

const isSeparator = (line) => SEPARATOR_LINE.test(line) && line.trim().length > 5;

function toWingetLines(rawOutput) {
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

const CLIPPED = /(?:…|\.\.\.)$/;

function cell(line, start, end) {
    if (start < 0 || line.length <= start) return { value: '', clipped: false };
    const raw = line.substring(start, end === undefined ? line.length : Math.min(end, line.length)).trim();
    return { value: raw.replace(/[….]+$/, '').trim(), clipped: CLIPPED.test(raw) };
}

const looksLikeRow = (line, starts) => starts.length > 1 && line.length > starts[1] && line[starts[1]] !== ' ';

function parseWingetTables(rawOutput) {
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
                    .map((line) => {
                        const cells = starts.map((start, col) => cell(line, start, starts[col + 1]));
                        return { cells: cells.map((c) => c.value), clipped: cells.map((c) => c.clipped) };
                    })
            });
        }
        i = end - 1;
    }

    return tables;
}

export function parseWingetColumns(rawOutput) {
    const entries = [];

    for (const table of parseWingetTables(rawOutput)) {
        const fourthIsSource = table.rows.length > 0 && table.rows.every(({ cells }) => {
            const value = (cells[3] || '').toLowerCase();
            return !value || KNOWN_SOURCES.has(value);
        });

        for (const { cells, clipped } of table.rows) {
            const [, id, version] = cells;
            const available = fourthIsSource ? '' : (cells[3] || '');
            const source = fourthIsSource ? (cells[3] || '') : (cells[4] || '');

            const looksLikeId = id && !/\s/.test(id) && (
                id.includes('.') || id.startsWith('{') || id.startsWith('ARP') || id.startsWith('MSIX')
                || (Boolean(source) && id.length >= 6)
            );
            if (looksLikeId && id.length >= 2) {
                const entry = { id, version, available: available || null, source };
                if (clipped[1]) entry.truncated = true;
                entries.push(entry);
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
            const values = table.rows.map(({ cells }) => cells[col]).filter(Boolean);
            if (values.length && values.every((value) => !value.includes(':') && !/\s/.test(value))) {
                sourceColumn = col;
                break;
            }
        }

        for (const { cells } of table.rows) {
            const [name, id, version] = cells;
            if (!name || !id || /\s/.test(id)) continue;
            results.push({
                name,
                id,
                version: version || '',
                source: (sourceColumn >= 0 ? cells[sourceColumn] : '') || 'winget'
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

// Upgrades go through `winget upgrade --id <id> -e`, so only the same package counts:
// Discord.Discord must not pick up the update that belongs to Discord.Discord.PTB.
export function isSameWingetPackage(appId, entry) {
    const a = String(appId).toLowerCase();
    const p = String(entry?.id || '').toLowerCase();
    if (!p) return false;
    return a === p || (entry.truncated === true && a.startsWith(p));
}

// HRESULTs from AppInstallerErrors.h that change what the app does next.
const WINGET_EXIT_REASONS = new Map([
    [0x8A15002B, 'no_update'],      // UPDATE_NOT_APPLICABLE: nothing newer, or nothing that fits this PC
    [0x8A15004F, 'no_update'],      // UPGRADE_VERSION_NOT_NEWER
    [0x8A150114, 'self_updating'],  // INSTALL_UPGRADE_NOT_SUPPORTED: the manifest denies upgrades
    [0x8A150101, 'in_use'],         // INSTALL_PACKAGE_IN_USE
    [0x8A150103, 'in_use'],         // INSTALL_FILE_IN_USE
    [0x8A150111, 'in_use'],         // INSTALL_PACKAGE_IN_USE_BY_APPLICATION
    [0x8A150109, 'restart']         // INSTALL_REBOOT_REQUIRED_TO_FINISH: installed, needs a restart
]);

export function wingetExitReason(code) {
    const value = Number(code);
    if (!Number.isFinite(value) || value === 0) return null;
    return WINGET_EXIT_REASONS.get(value >>> 0) || null;
}

export function formatWingetCode(code) {
    const value = Number(code);
    return code != null && Number.isFinite(value) ? `0x${(value >>> 0).toString(16).toUpperCase()}` : '';
}

// The last line winget printed that is a message rather than a spinner or a progress bar.
export function wingetMessage(rawOutput) {
    const lines = toWingetLines(rawOutput)
        .map((line) => line.trim())
        .filter((line) => line
            && !/^[-\\|/]$/.test(line)
            && !/[█▒]/.test(line)
            && !/^\d+(?:\.\d+)?\s*[KMG]?B\s*\/\s*\d/i.test(line)
            && !isSeparator(line));
    return lines[lines.length - 1] || '';
}

export function sanitizeSearchQuery(text) {
    return String(text ?? '')
        .replace(/[^\p{L}\p{N}\s.+#_-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 64);
}
