
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
