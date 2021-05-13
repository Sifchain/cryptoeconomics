const _ = require('lodash');

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
function remapVSAddresses (vaLAddresses, timeInterval) {
  const mapped = _.map(
    vaLAddresses,
    ({ commission: commissionEvents, ...valAddressData }, valStakeAddress) => {
      const commissionTimeIntervals = processCommissionEvents(commissionEvents);
      const delegates = Object.keys(valAddressData);

      const valDelegateEvents = delegates
        .map(delegateAddress => {
          const delegateTimeIntervals = valAddressData[delegateAddress].rowan;
          return delegateTimeIntervals
            .map((amount, index) => {
              const commissionRateDelta = commissionTimeIntervals[index];
              if (commissionRateDelta < 0) {
                console.log('COMMISSION RATE < 0. NEEDS HANDLING');
              }
              return {
                timestamp: (index + 1) * timeInterval,
                commission: commissionRateDelta,
                amount,
                delegateAddress,
                validatorSifAddress: valStakeAddress
              };
            })
            .filter(e => e.amount !== 0);
        })
        .filter(events => events.length !== 0);
      return valDelegateEvents;
    }
  );

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

function processCommissionEvents (commissionEvents) {
  const commission = [commissionEvents[0]];
  for (let i = 1; i < commissionEvents.length; i++) {
    const event = commissionEvents[i];
    if (event < 0) {
      console.log('COMMISSION RATE < 0. NEEDS HANDLING');
    }
    if (event === 0) {
      const lastEvent = commission[i - 1];
      commission.push(lastEvent);
    } else {
      commission.push(event);
    }
  }
  return commission;
}

module.exports = {
  remapVSAddresses
};
