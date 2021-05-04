const express = require("express");
const cors = require('cors')

const { getParsedData } = require('./process');
const { getUserData, getUserTimeSeriesData } = require('./user');

const SERVER_PORT = 3001
const app = express();
app.use(cors())

const data = getParsedData();

app.listen(SERVER_PORT, () => {
  console.log(`Server running on port ${SERVER_PORT}`);
});

app.get("/api", (req, res, next) => {
  const key = req.query.key;
  let responseJSON = data[key]
  if (key === 'userTimeSeriesData') {
    const address = req.query.address
    responseJSON = getUserTimeSeriesData(data.dataAugmented, address)
  }
  if (key === 'userData') {
    const address = req.query.address
    responseJSON = getUserData(data.dataAugmented, address)
  }
  if (key === 'stack') {
    rewardData = data.stackClaimableRewardData
    responseJSON = { rewardData }
  }
  res.json(responseJSON)
});
