/**
 * Entry point of the utility process that runs one game-saves job.
 *
 * A scan reads thousands of directories and the first one parses a 17 MB YAML
 * file: synchronous work that would freeze the window in the main process.
 * Each job gets a fresh process, which the main process discards afterwards.
 */

const { runJob } = require('./jobs');

process.parentPort.once('message', async ({ data }) => {
  const post = (message) => process.parentPort.postMessage(message);
  try {
    const result = await runJob(data.type, data.payload, {
      onProgress: (progress) => post({ kind: 'progress', progress })
    });
    post({ kind: 'result', result });
  } catch (err) {
    post({ kind: 'error', error: err && err.message ? err.message : String(err) });
  }
});
