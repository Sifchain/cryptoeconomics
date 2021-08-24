const moment = require('moment');
const { START_DATETIME } = require('../config');

// client may send ms since epoch, or "now" string, or nothing for entire time series
function getTimeIndex(timestampFromClient) {
  if (!timestampFromClient) {
    return;
  }
  let nowMoment;
  if (timestampFromClient === 'now') {
    nowMoment = moment.utc(new Date());
  } else {
    nowMoment = moment.utc(new Date(timestampFromClient));
  }
  const diff = nowMoment.diff(moment.utc(START_DATETIME));
  const rtn = Math.floor(moment.duration(diff).asMinutes() / 200) + 1;
  return rtn;
}

module.exports = {
  getTimeIndex,
};
