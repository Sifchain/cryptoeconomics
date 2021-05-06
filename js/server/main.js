if (process.env.NODE_ENV === 'development') {
  require('dotenv').config()
}
const express = require("express");
const cors = require('cors')
const { getUserData, getUserTimeSeriesData } = require('./user');

// implements process.js in separate thread
const { createProcessingWorkerHandler } = require('./process-worker-handler');
const processingWorkerHandler = createProcessingWorkerHandler()

const port = process.env.PORT || 3000;
const app = express();
app.use(cors())



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


app.get("/status", (req, res, next) => {
  res.status(200).send({ status: "OK" });
});

/* 
 TODO: Add timestamp parameter to endpoints 
  e.g. https://sif-cryptoecon-test.herokuapp.com/api?key=userData&address=sif1048c2lagwe84sz0sk4ncy2myrzxykjes40hn62with&timestamp=XYZ
*/
app.get("/api/lm", async (req, res, next) => {
  const key = req.query.key;
  await processingWorkerHandler.waitForReadyState().catch(console.error);
  const { lmData } = processingWorkerHandler.getCurrentState();
  let responseJSON = lmData[key];
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

app.get("/api/vs", async (req, res, next) => {
  const key = req.query.key;
  await processingWorkerHandler.waitForReadyState().catch(console.error);
  const { vsData } = processingWorkerHandler.getCurrentState();
  let responseJSON = vsData[key];
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
