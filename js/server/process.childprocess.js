if (process.env.NODE_ENV === 'development') {
  require('dotenv').config()
}
const fs = require('fs');
const { loadLiquidityMinersSnapshot } = require('./loaders/loadLiquidityMinersSnapshot');
const { loadValidatorsSnapshot } = require('./loaders/loadValidatorsSnapshot');
const JSONStream = require("JSONStream");
const { getProcessedLMData, getProcessedVSData } = require('./process');
/* 
  Reloads & re-processes Miner & Validator data once every `RELOAD_INTERVAL`
*/
const RELOAD_INTERVAL = 10 * 60 * 1000;
// processing time included to ensure data has been processed by time client reloads
const PROCESSING_TIME = 60 * 1000;
// temp file. Do not access outside this function. Deleted before exit
const outputFilePath = `/tmp/cryptoecon-processing-result-${Date.now()}.json`

process.on('beforeExit', () => fs.unlink(outputFilePath, () => {}));

const saveJson = (data) => {
  const transformStream = JSONStream.stringify();
  const outputStream = fs.createWriteStream(outputFilePath);
  transformStream.pipe( outputStream );
  transformStream.write(data)
  transformStream.end();
  outputStream.on(
    "finish",
    function handleFinish() {
      console.log('finished!!!');
      process.send(outputFilePath);

    }
  );
}

async function executeBackgroundProcessing() {
  if (process.env.NODE_ENV === 'development') {
    console.log('loading: snapshot data')
  }
  try {
    const [lMSnapshot, vsSnapshot] = await Promise.all([loadLiquidityMinersSnapshot(), loadValidatorsSnapshot()]);
    console.log('| process.childprocess::loaded-snapshot-data')
    const lmDataParsed = getProcessedLMData(lMSnapshot);
    console.log('| process.childprocess::processed-lm-data');
    const vsDataParsed = getProcessedVSData(vsSnapshot);
    console.log('| process.childprocess::processed-vm-data');
    // // "vm": ${JSON.stringify(lmDataParsed)}, 
    // const jsonString = `{ 
    //   "vs": ${JSON.stringify(vsDataParsed)},
    //   "expiresAt": ${Date.now() + RELOAD_INTERVAL + PROCESSING_TIME}
    // }`
    // JSON.stringify({
    //   lm: lmDataParsed,
    //   vs: vsDataParsed,
    //   expiresAt: Date.now() + RELOAD_INTERVAL + PROCESSING_TIME
    // })
    // fs.writeFileSync(outputFilePath, jsonString);
    saveJson({
      lm: lmDataParsed,
      vs: vsDataParsed,
      expiresAt: Date.now() + RELOAD_INTERVAL + PROCESSING_TIME
    });
    console.log('wrote file ' + outputFilePath)
    // process.send(outputFilePath);
  } catch (e) {
    console.error(e)
  }
  setTimeout(executeBackgroundProcessing, RELOAD_INTERVAL)
}
executeBackgroundProcessing();
