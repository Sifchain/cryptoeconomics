exports.getUserTimeSeriesData = (all, address) => {
  return all
    .map(timestampData => {
      const userData = timestampData.users[address] || {
        tickets: [],
        reservedReward: 0,
        claimableReward: 0
      };
      const userClaimableReward = userData.claimableReward;
      const userReservedReward = userData.reservedReward;
      return {
        timestamp: timestampData.timestamp,
        userClaimableReward,
        userReservedReward
      };
    })
    .slice(1);
};

exports.getUserData = (all, address) => {
  return all.map(timestampGlobalState => {
    return {
      ...timestampGlobalState,
      users: undefined,
      user: timestampGlobalState.users[address]
    };
  });
};
