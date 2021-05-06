const express = require("express");
const cors = require('cors')
const { Worker } =  require("worker_threads");

const { getProcessedLMData, getProcessedVSData } = require('./process');
const { getUserData, getUserTimeSeriesData } = require('./user');

var port = process.env.PORT || 3000;
const app = express();
app.use(cors())

function watchForUpdates(onParsedDataUpdate, onError) {
  const worker = new Worker(`${__dirname}/process.worker.js`, {
      workerData: null
  });
  worker.on("message", onParsedDataUpdate);
  worker.on("error", onError);
  worker.on("exit", code  => {
    if (code  !==  0)
        onError(new  Error(`Worker stopped with exit code ${code}`));
    });
};
const lmData = getProcessedLMData();
const vsData = getProcessedVSData();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Should work: https://sif-cryptoecon-test.herokuapp.com/api?key=userData&address=sif1048c2lagwe84sz0sk4ncy2myrzxykjes40hn62with &timestamp

// Add a parameter for taking in a timestamp
app.get("/api/lm", (req, res, next) => {
  const key = req.query.key;
  let responseJSON = lmData[key]
  if (key === 'userTimeSeriesData') {
    const address = req.query.address
    responseJSON = getUserTimeSeriesData(lmData.processedData, address)
  }
  if (key === 'userData') {
    const address = req.query.address
    responseJSON = getUserData(lmData.processedData, address)
  }
  if (key === 'stack') {
    rewardData = lmData.stackClaimableRewardData
    responseJSON = { rewardData }
  }
  res.json(responseJSON)
});

app.get("/api/vs", (req, res, next) => {
  const key = req.query.key;
  let responseJSON = vsData[key]
  if (key === 'userTimeSeriesData') {
    const address = req.query.address
    responseJSON = getUserTimeSeriesData(vsData.processedData, address)
  }
  if (key === 'userData') {
    const address = req.query.address
    responseJSON = getUserData(vsData.processedData, address)
  }
  if (key === 'stack') {
    rewardData = vsData.stackClaimableRewardData
    responseJSON = { rewardData }
  }
  res.json(responseJSON)
});
