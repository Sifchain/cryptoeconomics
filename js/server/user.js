const { fetch } = require('cross-fetch');

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

const getUserData = (exports.getUserData = (all, address, timeIndex) => {
  const data = all.map(timestampGlobalState => {
    return {
      ...timestampGlobalState,
      users: undefined,
      user: timestampGlobalState.users[address]
    };
  });
  if (!timeIndex) {
    return data;
  }
  return data[timeIndex];
});

exports.getUserMaturityAPY = async (all, address) => {
  const accountpools = await fetch(
    `https://api.sifchain.finance/clp/getLiquidityProvider?symbol=${address}`
  ).then(r => r.json());
  const lmRewards = {
    value: getUserData(all, address, 'now')
  };
  let totalPooled = 0.0;
  accountpools[address].forEach(ap => {
    const nativeBalance = ap.amounts[0];
    totalPooled += parseFloat(nativeBalance) * 2;
  });
  let alreadyEarned = lmRewards.value.user.claimableReward;
  let futureTotalEarningsAtMaturity =
    lmRewards.value.user.totalRewardAtMaturity;
  let remainingFutureYieldAmount =
    futureTotalEarningsAtMaturity - alreadyEarned;
  let remainingYieldPercent = remainingFutureYieldAmount / totalPooled;
  let msUntilMaturity =
    Date.parse(lmRewards.value.user.maturityDate) - Date.now();
  let yearsUntilMaturity = Math.ceil(
    msUntilMaturity / (1000 * 60 * 60 * 24 * 365)
  );
  let currentAPY =
    remainingYieldPercent / yearsUntilMaturity > 0
      ? remainingYieldPercent / yearsUntilMaturity
      : 0;
  return {
    currentAPY: currentAPY
  };
};
