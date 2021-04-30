_ = require("lodash")

snapshot = require("../snapshots/snapshot_start_until_mid_april.json");

const TIME_INTERVAL = 200; // minutes

addresses = snapshot.data.snapshots_new[0].snapshot_data

numberOfTimestamps = getNumberOfTimestamps(addresses)

startingGlobalState = [{
  minutesSinceStart: 0,
  state: {
    lockedPool: 30000000,
    unlockedPool: 0,
    users: [],
  }
}];

// Mapreduce address liquidity event entries from address->token->timeIntervals->event structure
// into timeIntervals->address->token->event structure

mapped = _.map(addresses, (tokens, address) => {
  addressTokenEvents = _.map(tokens, (timeIntervals, token) => {
    return timeIntervals.map((event, index) => {
      return {
        minutesSinceStart: (index + 1) * TIME_INTERVAL,
        event, address, token
      }
    }).filter(e => e.event !== 0)
  }).filter(events => events.length !== 0)
  return addressTokenEvents
});

rawEvents = _.flattenDeep(mapped)
let allTimeIntervalEvents = _.groupBy(rawEvents, 'minutesSinceStart')
allTimeIntervalEvents = _.mapValues(allTimeIntervalEvents, timeIntervalEvents => {
  return timeIntervalEvents.map(event => _.omit(event, 'minutesSinceStart'))
})
let allTimeIntervalAddressEvents = _.mapValues(allTimeIntervalEvents, timeIntervalEvents => {
  return _.groupBy(timeIntervalEvents, 'address')
})
allTimeIntervalAddressEvents = _.mapValues(allTimeIntervalAddressEvents, timeIntervalAddressEvents => {
  return _.mapValues(timeIntervalAddressEvents, addressEvents => {
    return addressEvents.map(event => _.omit(event, 'address'))
  })
})

console.dir({ allTimeIntervalAddressEvents }, { depth: null })
return;

const addressKeys = Object.keys(addressEntries)
let timestampIndex = 0;
while (timestampIndex < numberOfTimestamps) {
  for (addressKey of addressKeys) {
    console.log(addressKey)
    const tokens = addresses[addressKey]
    const tokenKeys = Object.keys(tokens)
    for (tokenKey of tokenKeys) {
      liquidityEvent = tokens[tokenKey][timestampIndex]
      console.log(liquidityEvent)
    }
  }
}

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

const ExampleGlobalState = [{
  minutesSinceStart: 200,
  state: {
    lockedPool: 123,
    unlockedPool: 123,
    users: [{
      address: 'sif...',
      tokens: [
        {
          token: 'eth', tickets: [
            {
              count: 2,
              multiplier: 3,
              shares: 200
            }
          ]
        }
      ]
    }]
  },
  newLiquidityEvents: {
    users: [{
      address: 'sif...',
      tokens: [
        {
          token: 'ceth',
          event: 0,
        }
      ]
    }]
  },
}]
