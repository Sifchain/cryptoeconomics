const _ = require('lodash');
const { EVENT_INTERVAL_MINUTES } = require('../config');
const { DelegateEvent } = require('../types');

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
// function remapVSAddressesORIGINAL(vaLAddresses) {
//   const mapped = _.map(
//     vaLAddresses,
//     ({ commission: commissionEvents, ...valAddressData }, valStakeAddress) => {
//       // Per data team, commission rates with value of zero are actually 0% commissions
//       // and shouldn't be ignored as in `processCommissionEvents(commissionEvents)`
//       // const commissionTimeIntervals = processCommissionEvents(commissionEvents);
//       const commissionTimeIntervals = commissionEvents;

//       /*
//         `rewardAddressDesignatedByValidator` is purposefully being set by the data team
//          as the first property key in the validator's delegate dictionary
//       */
//       const delegates = Object.keys(valAddressData);
//       const rewardAddressDesignatedByValidator = delegates[0];

//       const valDelegateEvents = delegates
//         .map((delegateAddress) => {
//           const delegateTimeIntervals = valAddressData[delegateAddress].rowan;
//           return delegateTimeIntervals
//             .map((amount, index) => {
//               const commissionRate = commissionTimeIntervals[index];
//               if (commissionRate < 0) {
//                 console.log('COMMISSION RATE < 0. NEEDS HANDLING');
//               }
//               return DelegateEvent.fromJSON({
//                 timestamp: (index + 1) * EVENT_INTERVAL_MINUTES,
//                 commission: commissionRate,
//                 amount,
//                 delegateAddress,
//                 validatorStakeAddress: valStakeAddress,
//                 validatorRewardAddress: rewardAddressDesignatedByValidator,
//               });
//             })
//             .filter((e) => e.amount !== 0);
//         })
//         .filter((events) => events.length !== 0);
//       return valDelegateEvents;
//     }
//   );
//   const rawEvents = _.flattenDeep(mapped);

//   let allTimeIntervalEvents = _.groupBy(rawEvents, 'timestamp');
//   allTimeIntervalEvents = _.mapValues(
//     allTimeIntervalEvents,
//     (timeIntervalEvents) => {
//       return timeIntervalEvents.map((event) => {
//         event.clearTimestamp();
//         return event;
//       });
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
//       return _.map(
//         timeIntervalAddressEvents,
//         (addressEvents, delegateAddress) => {
//           return addressEvents.map((addressEvent) => {
//             return addressEvent.cloneWith({
//               timestamp: parseInt(timeInterval),
//               delegateAddress,
//             });
//           });
//         }
//       );
//     }
//   );

//   return {
//     userEventsByTimestamp: allTimeIntervalAddressEvents,
//   };
// }

function remapVSAddresses (vaLAddresses) {
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
      uEvents.push(event);
    }
  };
  _.forEach(
    vaLAddresses,
    ({ commission: commissionEvents, ...valAddressData }, valStakeAddress) => {
      // Per data team, commission rates with value of zero are actually 0% commissions
      // and shouldn't be ignored as in `processCommissionEvents(commissionEvents)`
      // const commissionTimeIntervals = processCommissionEvents(commissionEvents);
      const commissionTimeIntervals = commissionEvents;

      /*
        `rewardAddressDesignatedByValidator` is purposefully being set by the data team 
         as the first property key in the validator's delegate dictionary
      */
      const delegates = Object.keys(valAddressData);
      const rewardAddressDesignatedByValidator = delegates[0];

      const valDelegateEvents = delegates.forEach(delegateAddress => {
        const delegateTimeIntervals = valAddressData[delegateAddress].rowan;
        return delegateTimeIntervals.forEach((amount, index) => {
          const commissionRate = commissionTimeIntervals[index];
          if (commissionRate < 0) {
            console.log('COMMISSION RATE < 0. NEEDS HANDLING');
          }
          const timestamp = (index + 1) * EVENT_INTERVAL_MINUTES;
          const event = DelegateEvent.fromJSON({
            timestamp,
            commission: commissionRate,
            amount,
            delegateAddress,
            validatorStakeAddress: valStakeAddress,
            validatorRewardAddress: rewardAddressDesignatedByValidator
          });
          addUserEvent(timestamp, delegateAddress, event);
        });
      });
      return valDelegateEvents;
    }
  );

  return { userEventsByTimestamp };
}
// function processCommissionEvents(commissionEvents) {
//   const commission = [commissionEvents[0]];
//   for (let i = 1; i < commissionEvents.length; i++) {
//     const event = commissionEvents[i];
//     if (event < 0) {
//       console.log('COMMISSION RATE < 0. NEEDS HANDLING');
//     }
//     if (event === 0) {
//       const lastEvent = commission[i - 1];
//       commission.push(lastEvent);
//     } else {
//       commission.push(event);
//     }
//   }
//   return commission;
// }

module.exports = {
  remapVSAddresses
};
