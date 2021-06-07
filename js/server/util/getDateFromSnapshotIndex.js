const { START_DATETIME } = require('../config');
const moment = require('moment');

exports.getDateFromSnapshotIndex = timestamp => {
  const start = moment.utc(START_DATETIME);
  const date = start.add(timestamp, 'm');
  return date.toDate();
};
