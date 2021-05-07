const moment = require('moment');
const { START_DATETIME } = require('../config');

// client may send ms since epoch, or "now" string, or nothing for entire time series
function getTimeIndex (timestampFromClient) {
  if (!timestampFromClient) {
    return;
  }
  let nowMoment;
  if (timestampFromClient === 'now') {
    nowMoment = moment(Date.parse(new Date()));
  } else {
    nowMoment = moment(timestampFromClient);
  }
  return Math.floor(
    moment.duration(nowMoment.diff(START_DATETIME)).asMinutes() / 200
  );
}

module.exports = {
  getTimeIndex
};
