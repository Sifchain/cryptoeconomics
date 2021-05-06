const { parentPort, workerData } = require('worker_threads');
const { loadLiquidityMinersSnapshot } = require('./loaders/loadLiquidityMinersSnapshot');
const { getParsedData } = require('./process');

const RELOAD_INTERVAL = 10 * 60 * 1000;
const PROCESSING_TIME = 60 * 1000;
async function executeBackgroundProcessing() {
  const lMSnapshot = await loadLiquidityMinersSnapshot()
  const parsedData = getParsedData(lMSnapshot);
	parentPort.postMessage({
    ...parsedData,
    reloadAt: Date.now() + RELOAD_INTERVAL + PROCESSING_TIME
  });
  setTimeout(executeBackgroundProcessing, RELOAD_INTERVAL)
}
executeBackgroundProcessing();
