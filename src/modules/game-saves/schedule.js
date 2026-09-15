/**
 * Automatic backups through the Windows Task Scheduler.
 *
 * A scheduled task starts the app with --backup-saves at the chosen time, and
 * that launch backs up and exits without opening a window. Nothing stays
 * resident, and the backup still happens on a day the app was never opened.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runSpawnCommand } = require('../process-utils');
const { isWithin } = require('../security');

// A top-level task name: creating a task folder can be refused to a standard user.
const TASK_NAME = 'MakeYourLifeEasier Game Saves Backup';
const BACKUP_FLAG = '--backup-saves';
const WEEK_DAY_ELEMENTS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

function xmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function localDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Task Scheduler XML for a daily or weekly backup.
 *
 * XML rather than /SC arguments because of StartWhenAvailable: a laptop that is
 * off at the scheduled minute backs up at its next start instead of silently
 * skipping the day, and battery power does not block the run.
 * @param {{mode: string, time: string, day: string}} schedule - Normalised schedule
 * @param {string} exePath - Executable the task starts
 * @param {{now?: Date}} [options] - Date the trigger starts from
 * @returns {string} Task definition
 */
function buildTaskXml(schedule, exePath, { now = new Date() } = {}) {
  const trigger = schedule.mode === 'weekly'
    ? `<ScheduleByWeek><WeeksInterval>1</WeeksInterval><DaysOfWeek><${WEEK_DAY_ELEMENTS[schedule.day] || 'Sunday'} /></DaysOfWeek></ScheduleByWeek>`
    : '<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>';
  return [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    '  <RegistrationInfo><Description>Backs up game saves for Make Your Life Easier.</Description></RegistrationInfo>',
    '  <Triggers>',
    '    <CalendarTrigger>',
    `      <StartBoundary>${localDate(now)}T${schedule.time}:00</StartBoundary>`,
    '      <Enabled>true</Enabled>',
    `      ${trigger}`,
    '    </CalendarTrigger>',
    '  </Triggers>',
    '  <Principals>',
    '    <Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal>',
    '  </Principals>',
    '  <Settings>',
    '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
    '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
    '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
    '    <StartWhenAvailable>true</StartWhenAvailable>',
    '    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>',
    '    <Enabled>true</Enabled>',
    '  </Settings>',
    '  <Actions Context="Author">',
    `    <Exec><Command>${xmlText(exePath)}</Command><Arguments>${BACKUP_FLAG}</Arguments></Exec>`,
    '  </Actions>',
    '</Task>'
  ].join('\r\n');
}

/**
 * The executable a scheduled task should start.
 * @param {Object} options
 * @param {boolean} options.isPackaged - app.isPackaged
 * @returns {{path: string, portable: boolean, risky: boolean, error?: string}}
 *   risky: a portable build kept in Downloads or Temp, likely to be moved or deleted
 */
function resolveTaskExecutable({ isPackaged, env = process.env, execPath = process.execPath, homeDir = os.homedir(), tmpDir = os.tmpdir() } = {}) {
  if (!isPackaged) return { path: '', portable: false, risky: false, error: 'not-packaged' };
  // A portable build runs from a temporary extraction; the task has to start
  // the .exe the user actually keeps.
  const portableFile = env.PORTABLE_EXECUTABLE_FILE;
  const exe = portableFile || execPath;
  const risky = Boolean(portableFile) && [path.join(homeDir, 'Downloads'), tmpDir].some((dir) => isWithin(exe, dir));
  return { path: exe, portable: Boolean(portableFile), risky };
}

/**
 * Create, replace or remove the scheduled task.
 * @param {{mode: string, time: string, day: string}} schedule - Normalised schedule
 * @param {Object} options
 * @param {string} options.exePath - Executable to start (ignored when mode is off)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function applySchedule(schedule, { exePath, run = runSpawnCommand, fsImpl = fs, tmpDir = os.tmpdir(), now = new Date() } = {}) {
  const options = { windowsHide: true, _timeout: 30000 };
  if (!schedule || schedule.mode === 'off') {
    // Deleting a task that does not exist fails harmlessly.
    await run('schtasks', ['/Delete', '/TN', TASK_NAME, '/F'], options);
    return { success: true };
  }
  if (!exePath) return { success: false, error: 'There is no executable to schedule.' };

  const xmlPath = path.join(tmpDir, `myle-game-saves-task-${process.pid}.xml`);
  try {
    fsImpl.writeFileSync(xmlPath, `\ufeff${buildTaskXml(schedule, exePath, { now })}`, 'utf16le');
    const result = await run('schtasks', ['/Create', '/TN', TASK_NAME, '/XML', xmlPath, '/F'], options);
    if (result.error) {
      return { success: false, error: String(result.stderr || result.stdout || result.error).trim() };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { fsImpl.unlinkSync(xmlPath); } catch { /* already gone */ }
  }
}

/**
 * @returns {Promise<boolean>} Whether the task is registered
 */
async function scheduledTaskExists({ run = runSpawnCommand } = {}) {
  const result = await run('schtasks', ['/Query', '/TN', TASK_NAME], { windowsHide: true, _timeout: 15000 });
  return !result.error;
}

module.exports = {
  BACKUP_FLAG,
  TASK_NAME,
  applySchedule,
  buildTaskXml,
  resolveTaskExecutable,
  scheduledTaskExists
};
