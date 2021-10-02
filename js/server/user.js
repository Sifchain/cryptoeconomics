const { fetch } = require('cross-fetch');
const { RateLimitProtector } = require('./util/RateLimitProtector');
const configs = require('./config');
const clpFetch = new RateLimitProtector({ padding: 100 }).buildAsyncShield(
  fetch,
  fetch
);
exports.getUserTimeSeriesData = (all, address) => {
  const rtn = all.map((timestampData) => {
    const userData = timestampData.users[address];
    // maintain compatibility with older dev branches until mainnet server is stable
    // return userData.totalAccruedCommissionsAndClaimableRewards;
    return {
      timestamp: timestampData.timestamp,
      userClaimableReward: !userData
        ? 0
        : userData.totalAccruedCommissionsAndClaimableRewards +
          userData.dispensed +
          userData.claimedCommissionsAndRewardsAwaitingDispensation,
    };
  });
  rtn.shift();
  return rtn;
};

exports.getUserData = async (all, { timeIndex, address, rewardProgram }) => {
  if (!timeIndex) {
    const data = all.map((timestampGlobalState) => {
      let user = timestampGlobalState.users[address];
      if (user) {
        user.delegatorAddresses = [];
      }
      return {
        ...timestampGlobalState,
        users: undefined,
        user: user,
      };
    });
    return data;
  }
  try {
    const { users, ...globalState } = all[timeIndex];
    const user = users[address];
    const matureUser =
      all[configs[rewardProgram].NUMBER_OF_INTERVALS_TO_RUN - 1];
    return {
      ...globalState,
      user: user
        ? {
            ...user,
            delegatorAddresses: [],
            __allDelegatorAddressesAtMaturity: matureUser
              ? matureUser.delegatorAddresses
              : null,
            maturityAPY: await getUserMaturityAPY(user, address),
          }
        : null,
    };
  } catch (e) {
    console.error(e);
  }
};

async function getUserMaturityAPY(user, address) {
  if (!user) {
    return 0;
  }
  try {
    const assets = await clpFetch(
      `https://api.sifchain.finance/clp/getAssets?lpAddress=${address}`
    ).then((r) => r.json());
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
        (a) =>
          clpFetch(
            `https://api.sifchain.finance/clp/getLiquidityProvider?symbol=${a.symbol}&lpAddress=${address}`
          ).then((r) => r.json())
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

    let totalPooled = 0.0;
    const EROWAN_PRECISION = 1e18;
    providerData.forEach(({ result }) => {
      const nativeBalance = result.native_asset_balance;
      totalPooled += (parseFloat(nativeBalance) / EROWAN_PRECISION) * 2;
    });
    // Only works for "now" timestamp
    const nextRewardProjectedAPYOnCurrentLiquidity =
      user.nextRewardProjectedFutureReward / totalPooled;
    return nextRewardProjectedAPYOnCurrentLiquidity;

    /* UI Version (calculates APY, but we're actually looking for realizable ROI as measured above) */
    // let alreadyEarned = userData.totalAccruedCommissionsAndClaimableRewards;
    // let futureTotalEarningsAtMaturity = userData.totalRewardsOnDepositedAssetsAtMaturity;
    // let remainingFutureYieldAmount =
    //   futureTotalEarningsAtMaturity - alreadyEarned;
    // let remainingYieldPercent = remainingFutureYieldAmount / totalPooled;
    // let msUntilMaturity = Date.parse(userData.maturityDateISO) - Date.now();
    // let yearsUntilMaturity = Math.ceil(
    //   msUntilMaturity / (1000 * 60 * 60 * 24 * 365)
    // );

    // let currentAPY =
    //   remainingYieldPercent / yearsUntilMaturity > 0
    //     ? remainingYieldPercent / yearsUntilMaturity
    //     : 0;

    // // Alter calculation to show 4 months rate instead of 12 months
    // return currentAPY * 3;
  } catch (e) {
    console.error(e);
    throw new Error('failed to getUserMaturityAPY');
  }
}
