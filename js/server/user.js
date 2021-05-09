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

exports.getUserData = async (all, payload) => {
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
  const userData = data[payload.timeIndex];
  return {
    ...userData,
    user: {
      ...userData.user,
      maturityAPY: await getUserMaturityAPY(userData, payload.address)
    }
  };
};

async function getUserMaturityAPY (userData, address) {
  try {
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
    if (!assets.result) {
      return 0;
    }

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
      value: userData
    };
    let totalPooled = 0.0;
    const EROWAN_PRECISION = 1e18;
    providerData.forEach(({ result }) => {
      const nativeBalance = result.native_asset_balance;
      totalPooled += (parseFloat(nativeBalance) / EROWAN_PRECISION) * 2;
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

    // Alter calculation to show 4 months rate instead of 12 months
    return currentAPY * 3;
  } catch (e) {
    console.error(e);
    throw new Error('failed to getUserMaturityAPY');
  }
}
