if (process.env.NODE_ENV === 'development') {
  require('dotenv').config()
}
const { parentPort, workerData } = require('worker_threads');
const { loadLiquidityMinersSnapshot } = require('./loaders/loadLiquidityMinersSnapshot');
const { loadValidatorsSnapshot } = require('./loaders/loadValidatorsSnapshot');
const { getProcessedLMData, getProcessedVSData } = require('./process');
/* 
  Reloads & re-processes Miner & Validator data once every `RELOAD_INTERVAL`
*/
const RELOAD_INTERVAL = 10 * 60 * 1000;
// processing time included to ensure data has been processed by time client reloads
const PROCESSING_TIME = 60 * 1000;
async function executeBackgroundProcessing() {
  if (process.env.NODE_ENV === 'development') {
    console.log('loading: snapshot data')
  }
  try {
    const [lMSnapshot, vsSnapshot] = await Promise.all([loadLiquidityMinersSnapshot(), loadValidatorsSnapshot()]);
    console.log('| process.worker::loaded-snapshot-data')
    const lmDataParsed = getProcessedLMData(lMSnapshot);
    console.log('| process.worker::processed-lm-data')
    const vsDataParsed = getProcessedVSData(vsSnapshot);
    console.log('| process.worker::processed-vm-data')
    parentPort.postMessage({
      lm: lmDataParsed,
      vs: vsDataParsed,
      expiresAt: Date.now() + RELOAD_INTERVAL + PROCESSING_TIME
    });
  } catch (e) {
    console.error(e)
  }
  setTimeout(executeBackgroundProcessing, RELOAD_INTERVAL)
}
executeBackgroundProcessing();
