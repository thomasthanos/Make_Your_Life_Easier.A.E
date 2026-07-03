const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { debug } = require('../modules/debug');

const STORES = ['TrustedPublisher'];

function getCertificatePath() {
    if (process.platform !== 'win32') return null;
    return app.isPackaged
        ? path.join(process.resourcesPath, 'bin', 'certificate.cer')
        : path.join(__dirname, '..', 'resources', 'bin', 'certificate.cer');
}

function computeThumbprint(der) {
    return crypto.createHash('sha1').update(der).digest('hex').toUpperCase();
}

function runCertutil(args) {
    return new Promise((resolve) => {
        execFile('certutil', args, (err, stdout, stderr) => {
            resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '' });
        });
    });
}

async function isInStore(store, thumbprint) {
    const { ok, stdout } = await runCertutil(['-user', '-store', store, thumbprint]);
    return ok && stdout.toUpperCase().includes(thumbprint);
}

async function ensureCertificateTrusted() {
    if (process.platform !== 'win32') return;

    const certPath = getCertificatePath();

    let der;
    try {
        der = await fs.promises.readFile(certPath);
    } catch {
        debug('warn', `Certificate file not found, skipping trust setup: ${certPath}`);
        return;
    }

    const thumbprint = computeThumbprint(der);

    for (const store of STORES) {
        try {
            if (await isInStore(store, thumbprint)) {
                debug('info', `Certificate already trusted in ${store}`);
                continue;
            }

            const { ok, stderr } = await runCertutil(['-addstore', '-user', store, certPath]);
            if (ok) {
                debug('info', `Certificate added to ${store}`);
            } else {
                debug('warn', `Failed to add certificate to ${store}: ${stderr.trim()}`);
            }
        } catch (err) {
            debug('warn', `Certificate trust check failed for ${store}: ${err.message}`);
        }
    }
}

module.exports = {
    ensureCertificateTrusted,
    getCertificatePath
};
