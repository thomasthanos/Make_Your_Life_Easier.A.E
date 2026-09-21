import { loadStandaloneText } from '../i18n/standalone-text.js';

const card = document.querySelector('.update-card');
const bar = document.querySelector('.progress-bar');
const track = document.querySelector('.progress-bar-bg');
const status = document.getElementById('status');
const percentText = document.getElementById('progress-percent');
const size = document.getElementById('progress-size');
const speed = document.getElementById('progress-speed');
const eta = document.getElementById('progress-eta');
const phaseLabel = document.getElementById('progress-label');
const cancel = document.getElementById('cancel-btn');
let t, latest = { status: 'checking' }, cancelling = false;

function measuredProgress(percent) {
  const measured = Number.isFinite(percent);
  const value = measured ? Math.max(0, Math.min(100, percent)) : null;
  bar.classList.toggle('indeterminate', !measured);
  bar.style.width = measured ? `${value}%` : '35%';
  if (measured) track.setAttribute('aria-valuenow', String(Math.round(value)));
  else track.removeAttribute('aria-valuenow');
  percentText.textContent = measured ? `${Math.round(value)}%` : '—';
}
function decimal(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(document.documentElement.lang, { maximumFractionDigits: 2 }) : '—';
}
function render(data) {
  latest = data;
  if (!t) return;
  // Older main processes report app boot milestones as "downloading".
  const boot = data.appLoading === true || /Loading|Initializing|Building|Finalizing|Almost|Launching/.test(data.message || '');
  const downloading = data.status === 'downloading' && !boot;
  const installing = data.status === 'extracting';
  card.classList.toggle('is-downloading', downloading);
  card.classList.toggle('is-installing', installing);
  card.classList.toggle('is-message', !downloading && !installing);
  cancel.hidden = !downloading || cancelling;
  cancel.textContent = t('cancel');
  const key = boot ? 'loading' : ({ checking: 'checking', available: 'available', downloading: 'downloading', extracting: 'installing', error: data.canRetry ? 'retrying' : 'failed' }[data.status] || 'loading');
  status.textContent = t(key);
  phaseLabel.textContent = t(key);
  track.setAttribute('aria-label', t(key));
  measuredProgress(downloading ? data.percent : null);
  if (downloading) {
    const downloaded = data.downloaded ?? (Number(data.transferred) / 1048576);
    const total = data.total ?? (Number(data.totalBytes) / 1048576);
    const rate = data.speed ?? (Number(data.bytesPerSecond) / 1048576);
    size.textContent = `${decimal(downloaded)} / ${decimal(total)} MB`;
    speed.textContent = `${decimal(rate)} MB/s`;
    const bytesLeft = Number(data.totalBytes) - Number(data.transferred);
    const seconds = Number(data.bytesPerSecond) > 0 ? Math.ceil(bytesLeft / Number(data.bytesPerSecond)) : null;
    const remaining = seconds != null && seconds >= 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : /^\d/.test(String(data.eta || '')) ? data.eta : null;
    eta.textContent = data.percent >= 100 ? t('done') : remaining ? `${remaining} ${t('left')}` : t('calculating');
  }
}
cancel.addEventListener('click', async () => {
  if (cancelling) return;
  cancelling = true;
  render(latest);
  try { await window.api.cancelUpdate(); }
  catch { cancelling = false; render(latest); }
});
window.api?.onUpdateStatus?.(render);
(async () => {
  let lang;
  try { lang = await window.api?.getSetting?.('lang'); } catch { /* Use system language. */ }
  t = await loadStandaloneText(lang, 'updater_ui');
  render(latest);
})();
