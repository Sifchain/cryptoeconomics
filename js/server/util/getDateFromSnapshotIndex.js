const { START_DATETIME, EVENT_INTERVAL_MINUTES } = require('../config');
const moment = require('moment');

exports.getDateFromSnapshotIndex = index => {
  const start = moment.utc(START_DATETIME);
  const date = start.add((index + 1) * EVENT_INTERVAL_MINUTES, 'm');
  return date.toDate();
};
