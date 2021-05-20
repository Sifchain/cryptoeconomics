const _ = require('lodash');

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
function remapLMAddresses (addresses, timeInterval) {
  const mapped = _.map(addresses, (tokens, address) => {
    const addressTokenEvents = _.map(tokens, (timeIntervals, token) => {
      return timeIntervals
        .map((amount, index) => {
          if (amount < 0) {
            // debugger;
          }
          return {
            timestamp: (index + 1) * timeInterval,
            amount,
            address,
            token
          };
        })
        .filter(e => e.amount !== 0);
    }).filter(events => events.length !== 0);
    return addressTokenEvents;
  });

  const rawEvents = _.flattenDeep(mapped);
  let allTimeIntervalEvents = _.groupBy(rawEvents, 'timestamp');
  allTimeIntervalEvents = _.mapValues(
    allTimeIntervalEvents,
    timeIntervalEvents => {
      return timeIntervalEvents.map(event => _.omit(event, 'timestamp'));
    }
  );

  let allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalEvents,
    timeIntervalEvents => {
      return _.groupBy(timeIntervalEvents, 'address');
    }
  );

  allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalAddressEvents,
    (timeIntervalAddressEvents, timeInterval) => {
      return _.map(timeIntervalAddressEvents, (addressEvents, address) => {
        return {
          timestamp: parseInt(timeInterval),
          address,
          amount: addressEvents.reduce((accum, addressEvent) => {
            return accum + parseFloat(addressEvent.amount);
          }, 0)
        };
      });
    }
  );

  return allTimeIntervalAddressEvents;
}

module.exports = {
  remapLMAddresses
};
