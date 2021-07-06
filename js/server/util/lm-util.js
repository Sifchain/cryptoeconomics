const _ = require('lodash');
const { EVENT_INTERVAL_MINUTES } = require('../config');
const { DelegateEvent } = require('../types');

const getLMTimeseriesFinalIndex = snapshotData => {
  // Snapshot timeseries (generated by Vanir) overshoots by 1 extra interval. Account for this.
  const finalIndex = [
    ...Object.values(snapshotData).reduce((prev, curr) => {
      Object.values(curr).forEach(val => {
        if (!val.length) return;
        prev.add(val[val.length - 1][0]);
      });
      return prev;
    }, new Set())
  ]
    .sort((a, b) => a - b)
    .pop();
  return finalIndex;
};

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
function remapLMAddresses (addresses) {
  const mapped = _.map(addresses, (tokens, address) => {
    const addressTokenEvents = _.map(tokens, (timeIntervals, token) => {
      return timeIntervals
        .map(([timelineIndex, amount]) => {
          return DelegateEvent.fromJSON({
            timestamp: (timelineIndex + 1) * EVENT_INTERVAL_MINUTES,
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
      const [timelineIndex, binaryClaimEvent] = claimEventsTimeSeries[i];
      const didClaim = !!binaryClaimEvent;
      const timestamp = (i + timelineIndex) * EVENT_INTERVAL_MINUTES;
      claimEventsByUserByTimestamp[timestamp] =
        claimEventsByUserByTimestamp[timestamp] || {};
      if (didClaim) {
        claimEventsByUserByTimestamp[timestamp][addr] = true;
      }
    }
  }
  return claimEventsByUserByTimestamp;
}

function createDispensationEvents (addresses) {
  const dispensationEventsByUserByTimestamp = {};
  for (const addr in addresses) {
    const dispensationEventsTimeSeries = addresses[addr];
    for (let i = 0; i < dispensationEventsTimeSeries.length; i++) {
      const [timelineIndex, amountToDistribute] = dispensationEventsTimeSeries[
        i
      ];

      const timestamp = (timelineIndex + 1) * EVENT_INTERVAL_MINUTES;
      dispensationEventsByUserByTimestamp[timestamp] =
        dispensationEventsByUserByTimestamp[timestamp] || {};
      if (amountToDistribute) {
        dispensationEventsByUserByTimestamp[timestamp][
          addr
        ] = amountToDistribute;
      }
    }
  }
  return dispensationEventsByUserByTimestamp;
}

module.exports = {
  remapLMAddresses,
  createClaimEvents,
  createDispensationEvents,
  getLMTimeseriesFinalIndex
};
