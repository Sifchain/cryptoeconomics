const configs = require('../config');
const moment = require('moment');

exports.getDateFromSnapshotIndex = (index, rewardProgram) => {
  const { START_DATETIME, EVENT_INTERVAL_MINUTES } = configs[rewardProgram];
  const start = moment.utc(START_DATETIME);
  const date = start.add((index + 1) * EVENT_INTERVAL_MINUTES, 'm');
  return date.toDate();
};
