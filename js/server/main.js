const express = require("express");
const cors = require('cors')

const { getProcessedLMData, getProcessedVSData } = require('./process');
const { getUserData, getUserTimeSeriesData } = require('./user');

var port = process.env.PORT || 3000;
const app = express();
app.use(cors())

const lmData = getProcessedLMData();
const vsData = getProcessedVSData();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/status", (req, res, next) => {
  res.status(200).send({ status: "OK" });
});

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
