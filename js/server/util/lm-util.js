const _ = require('lodash');
const { EVENT_INTERVAL_MINUTES } = require('../config');
const { DelegateEvent } = require('../types');

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
function remapLMAddresses (addresses) {
  const mapped = _.map(addresses, (tokens, address) => {
    const addressTokenEvents = _.map(tokens, timeIntervals => {
      return timeIntervals
        .map((amount, index) => {
          if (amount < 0) {
            // debugger;
          }
          return DelegateEvent.fromJSON({
            timestamp: (index + 1) * EVENT_INTERVAL_MINUTES,
            amount,
            delegateAddress: address
          });
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
      return timeIntervalEvents.map(event => {
        event.clearTimestamp();
        return event;
      });
    }
  );

  let allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalEvents,
    timeIntervalEvents => {
      return _.groupBy(timeIntervalEvents, 'delegateAddress');
    }
  );

  allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalAddressEvents,
    (timeIntervalAddressEvents, timeInterval) => {
      return _.mapValues(
        timeIntervalAddressEvents,
        (addressEvents, address) => {
          return [
            DelegateEvent.fromJSON({
              timestamp: parseInt(timeInterval),
              delegateAddress: address,
              amount: addressEvents.reduce((accum, addressEvent) => {
                return accum + parseFloat(addressEvent.amount);
              }, 0)
            })
          ];
        }
      );
    }
  );

  return allTimeIntervalAddressEvents;
}

function createClaimEvents (addresses) {
  const claimEventsByUserByTimestamp = {};
  for (const addr in addresses) {
    const claimEventsTimeSeries = addresses[addr];
    for (let i = 0; i < claimEventsTimeSeries.length; i++) {
      const didClaim = !!claimEventsTimeSeries[i];
      const timestamp = (i + 1) * EVENT_INTERVAL_MINUTES;
      claimEventsByUserByTimestamp[timestamp] =
        claimEventsByUserByTimestamp[timestamp] || {};
      if (didClaim) {
        claimEventsByUserByTimestamp[timestamp][addr] = true;
      }
    }
  }
  return claimEventsByUserByTimestamp;
}

module.exports = {
  remapLMAddresses,
  createClaimEvents
};
