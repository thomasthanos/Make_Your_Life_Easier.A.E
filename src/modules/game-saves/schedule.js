
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runSpawnCommand } = require('../process-utils');
const { isWithin } = require('../security');

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

function resolveTaskExecutable({ isPackaged, env = process.env, execPath = process.execPath, homeDir = os.homedir(), tmpDir = os.tmpdir() } = {}) {
  if (!isPackaged) return { path: '', portable: false, risky: false, error: 'not-packaged' };
  const portableFile = env.PORTABLE_EXECUTABLE_FILE;
  const exe = portableFile || execPath;
  const risky = Boolean(portableFile) && [path.join(homeDir, 'Downloads'), tmpDir].some((dir) => isWithin(exe, dir));
  return { path: exe, portable: Boolean(portableFile), risky };
}

async function applySchedule(schedule, { exePath, run = runSpawnCommand, fsImpl = fs, tmpDir = os.tmpdir(), now = new Date() } = {}) {
  const options = { windowsHide: true, _timeout: 30000 };
  if (!schedule || schedule.mode === 'off') {
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
    try { fsImpl.unlinkSync(xmlPath); } catch {  }
  }
}

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
