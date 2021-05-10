const _ = require('lodash');

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
function remapVSAddresses (vaLAddresses, timeInterval) {
  const mapped = _.map(vaLAddresses, (valAddressData, valStakeAddress) => {
    const keys = Object.keys(valAddressData);
    const commisionEvents = valAddressData[keys[0]];
    const commisionTimeIntervals = processCommisionEvents(commisionEvents);
    const valSifAddress = keys[1];
    const delegates = keys.slice(1);

    const valDelegateEvents = _.map(delegates, delegateAddress => {
      const delegateTimeIntervals = valAddressData[delegateAddress].rowan;
      return delegateTimeIntervals
        .map((amount, index) => {
          return {
            timestamp: (index + 1) * timeInterval,
            commision: commisionTimeIntervals[index],
            amount,
            delegateAddress,
            valSifAddress,
            valStakeAddress
          };
        })
        .filter(e => e.amount !== 0);
    }).filter(events => events.length !== 0);
    return valDelegateEvents;
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
      return _.groupBy(timeIntervalEvents, 'delegateAddress');
    }
  );

  allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalAddressEvents,
    (timeIntervalAddressEvents, timeInterval) => {
      return _.map(
        timeIntervalAddressEvents,
        (addressEvents, delegateAddress) => {
          return addressEvents.map(addressEvent => {
            return {
              ...addressEvent,
              timestamp: parseInt(timeInterval),
              delegateAddress
            };
          });
        }
      );
    }
  );

  return allTimeIntervalAddressEvents;
}

function processCommisionEvents (commisionEvents) {
  const commision = [commisionEvents[0]];
  for (let i = 1; i < commisionEvents.length; i++) {
    const event = commisionEvents[i];
    if (event === 0) {
      const lastEvent = commision[i - 1];
      commision.push(lastEvent);
    } else {
      commision.push(event);
    }
  }
  return commision;
}

module.exports = {
  remapVSAddresses
};
