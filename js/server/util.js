function getNumberOfTimestamps(addresses) {
  const snapshotEventLengths = []
  _.map(addresses, (tokens, address) => {
    _.map(tokens, (liquidityEvents, token) => {
      snapshotEventLengths.push(liquidityEvents.length)
    })
  });

  uniqueSnapshotEventLengths = _.uniq(snapshotEventLengths);

  if (uniqueSnapshotEventLengths.length !== 1) {
    console.log('error with snapshot - inconsistent times');
    console.log(uniqueSnapshotEventLengths);
    process.exit(1);
  }

  return uniqueSnapshotEventLengths[0];
}

// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
function remapAddresses(addresses, timeInterval) {

  mapped = _.map(addresses, (tokens, address) => {
    addressTokenEvents = _.map(tokens, (timeIntervals, token) => {
      return timeIntervals.map((amount, index) => {
        return {
          timestamp: (index + 1) * timeInterval,
          amount, address, token
        }
      }).filter(e => e.amount !== 0)
    }).filter(events => events.length !== 0)
    return addressTokenEvents
  });

  rawEvents = _.flattenDeep(mapped)
  let allTimeIntervalEvents = _.groupBy(rawEvents, 'timestamp')
  allTimeIntervalEvents = _.mapValues(allTimeIntervalEvents, timeIntervalEvents => {
    return timeIntervalEvents.map(event => _.omit(event, 'timestamp'))
  })

  let allTimeIntervalAddressEvents = _.mapValues(allTimeIntervalEvents, timeIntervalEvents => {
    return _.groupBy(timeIntervalEvents, 'address')
  })
  allTimeIntervalAddressEvents = _.mapValues(allTimeIntervalAddressEvents, timeIntervalAddressEvents => {
    return _.map(timeIntervalAddressEvents, (addressEvents, address) => {
      return {
        address,
        amount: addressEvents.reduce((accum, addressEvent) => {
          return accum + parseFloat(addressEvent.amount)
        }, 0)
      }
    })
  })
  return allTimeIntervalAddressEvents
}

module.exports = {
  remapAddresses, getNumberOfTimestamps
}
