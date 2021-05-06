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

function destroyPrintGlobalStates(globalStates, filterAddress) {
  if (filterAddress) {
    globalStates.map(globalState => {
      _.forEach(globalState.users, (user, address) => {
        if (address !== filterAddress) {
          delete globalState.users[address]
        }
      })
      return globalState
    })
  }
  console.dir({
    globalStates: globalStates.filter(globalState => globalState.users[filterAddress] !== undefined)
  }, { depth: null })
  console.dir(globalStates[globalStates.length - 3], { depth: null })
  console.dir(globalStates[globalStates.length - 2], { depth: null })
  console.dir(globalStates[globalStates.length - 1], { depth: null })
}
