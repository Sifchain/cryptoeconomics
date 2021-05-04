const { getParsedData } = require('../lib/process');
const { getUserData, getUserTimeSeriesData } = require('../src/utils');

module.exports = (req, res) => {
  data = getParsedData();
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
}
