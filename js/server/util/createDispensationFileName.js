const moment = require('moment');

module.exports.createDispensationFileName = (
  type,
  network,
  internalEpochTimestamp,
  noSuffix = false
) => {
  // filename-friendly ISO-8601 to enable date-based sorting
  const fileNameDate = moment.utc().format(`YYYY[]MM[]DD[T]HH[]mm[]ss`);
  return `${fileNameDate}-${type.toLowerCase()}-${network.toLowerCase()}-${internalEpochTimestamp}-dispensation${
    noSuffix ? '' : `.json`
  }`;
};
