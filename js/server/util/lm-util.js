const _ = require('lodash');
const { EVENT_INTERVAL_MINUTES } = require('../config');
const { DelegateEvent } = require('../types');

function remapLMAddresses (addresses) {
  const userEventsByTimestamp = new Map();
  const addUserEvent = (timestamp, address, event) => {
    let uEventsMapAtT = userEventsByTimestamp.get(timestamp);
    if (!uEventsMapAtT) {
      uEventsMapAtT = new Map();
      userEventsByTimestamp.set(timestamp, uEventsMapAtT);
    }
    let uEvents = uEventsMapAtT.get(address);
    if (!uEvents) {
      uEvents = [event];
      uEventsMapAtT.set(address, uEvents);
    } else {
      uEvents[0] = uEvents[0].cloneWith({
        amount: uEvents[0].amount + event.amount
      });
    }
  };
  _.forEach(addresses, (tokens, address) => {
    _.forEach(tokens, (timeIntervals, token) => {
      timeIntervals.forEach((amount, index) => {
        if (amount !== 0) {
          const timestamp = (index + 1) * EVENT_INTERVAL_MINUTES;
          const event = DelegateEvent.fromJSON({
            timestamp,
            amount,
            delegateAddress: address,
            token
          });
          addUserEvent(timestamp, address, event);
        }
      });
    });
  });
  return userEventsByTimestamp;
}

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
// function remapLMAddressesORIGINAL(addresses, timeInterval) {
//   const mapped = _.map(addresses, (tokens, address) => {
//     const addressTokenEvents = _.map(tokens, (timeIntervals, token) => {
//       return timeIntervals
//         .map((amount, index) => {
//           if (amount < 0) {
//             // debugger;
//           }
//           return DelegateEvent.fromJSON({
//             timestamp: (index + 1) * timeInterval,
//             amount,
//             delegateAddress: address,
//             token,
//           });
//         })
//         .filter((e) => e.amount !== 0);
//     }).filter((events) => events.length !== 0);
//     return addressTokenEvents;
//   });

//   const rawEvents = _.flattenDeep(mapped);
//   let allTimeIntervalEvents = _.groupBy(rawEvents, 'timestamp');
//   allTimeIntervalEvents = _.mapValues(
//     allTimeIntervalEvents,
//     (timeIntervalEvents) => {
//       return timeIntervalEvents.map((event) => _.omit(event, 'timestamp'));
//     }
//   );

//   let allTimeIntervalAddressEvents = _.mapValues(
//     allTimeIntervalEvents,
//     (timeIntervalEvents) => {
//       return _.groupBy(timeIntervalEvents, 'delegateAddress');
//     }
//   );

//   allTimeIntervalAddressEvents = _.mapValues(
//     allTimeIntervalAddressEvents,
//     (timeIntervalAddressEvents, timeInterval) => {
//       return _.mapValues(
//         timeIntervalAddressEvents,
//         (addressEvents, address) => {
//           return [
//             DelegateEvent.fromJSON({
//               timestamp: parseInt(timeInterval),
//               delegateAddress: address,
//               amount: addressEvents.reduce((accum, addressEvent) => {
//                 return accum + parseFloat(addressEvent.amount);
//               }, 0),
//             }),
//           ];
//         }
//       );
//     }
//   );

//   return allTimeIntervalAddressEvents;
// }

module.exports = {
  remapLMAddresses
};
