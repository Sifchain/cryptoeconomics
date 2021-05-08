const { fetch } = require('cross-fetch');
const { getTimeIndex } = require('./util/getTimeIndex');

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

const getUserData = (exports.getUserData = (all, payload) => {
  const data = all.map(timestampGlobalState => {
    return {
      ...timestampGlobalState,
      users: undefined,
      user: timestampGlobalState.users[payload.address]
    };
  });
  if (!payload.timeIndex) {
    return data;
  }
  return data[payload.timeIndex];
});

exports.getUserMaturityAPY = async (all, address) => {
  const assets = await fetch(
    `https://api.sifchain.finance/clp/getAssets?lpAddress=${address}`
  ).then(r => r.json());
  /* 
    Returns: {
      "height":"1304365",
      "result":[
        {
          "symbol": "cdai"
        }
      ]
    }
  */
  // https://api.sifchain.finance/clp/getLiquidityProvider?symbol=cusdt&lpAddress=${address}
  // https://api.sifchain.finance/clp/getLiquidityProvider?symbol=cbat&lpAddress=${address}
  // https://api.sifchain.finance/clp/getPools`
  const providerData = await Promise.all(
    assets.result.map(
      a =>
        fetch(
          `https://api.sifchain.finance/clp/getLiquidityProvider?symbol=${a.symbol}&lpAddress=${address}`
        ).then(r => r.json())
      /* 
        Returns: {"height":"1304422","result":{
          "LiquidityProvider": {
            "asset": {
              "symbol": "cdai"
            },
            "liquidity_provider_units": "3452075226446986434921",
            "liquidity_provider_address": "sif10u9j54gmk75j3y27x9hrw372f6fsdgf3d055ku"
          },
          "native_asset_balance": "3400691875700719857630",
          "external_asset_balance": "2095098211145169234653",
          "height": "1304422"
        }}
      */
    )
  );

  const lmRewards = {
    value: getUserData(all, {
      address,
      timeIndex: getTimeIndex('now')
    })
  };
  let totalPooled = 0.0;
  providerData.forEach(({ result }) => {
    const nativeBalance = result.native_asset_balance;
    totalPooled += parseFloat(nativeBalance) * 2;
  });
  let alreadyEarned = lmRewards.value.user.claimableReward;
  let futureTotalEarningsAtMaturity =
    lmRewards.value.user.totalRewardAtMaturity;
  let remainingFutureYieldAmount =
    futureTotalEarningsAtMaturity - alreadyEarned;
  let remainingYieldPercent = remainingFutureYieldAmount / totalPooled;
  let msUntilMaturity =
    Date.parse(lmRewards.value.user.maturityDateISO) - Date.now();
  let yearsUntilMaturity = Math.ceil(
    msUntilMaturity / (1000 * 60 * 60 * 24 * 365)
  );

  let currentAPY =
    remainingYieldPercent / yearsUntilMaturity > 0
      ? remainingYieldPercent / yearsUntilMaturity
      : 0;
  // console.log({
  //   totalPooled,
  //   alreadyEarned,
  //   futureTotalEarningsAtMaturity,
  //   remainingFutureYieldAmount,
  //   remainingYieldPercent,
  //   yearsUntilMaturity,
  //   currentAPY,
  //   user: lmRewards.value.user
  // });
  return {
    maturityAPY: currentAPY
  };
};
