const moment = require('moment');
const configs = require('../config');

// client may send ms since epoch, or "now" string, or nothing for entire time series
function getTimeIndex(timestampFromClient, programName) {
  let config =
    typeof programName === 'object' ? programName : configs[programName];
  const { START_DATETIME, EVENT_INTERVAL_MINUTES } = config;
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
  const rtn =
    Math.floor(moment.duration(diff).asMinutes() / EVENT_INTERVAL_MINUTES) + 1;
  return rtn;
}

module.exports = {
  getTimeIndex,
};
