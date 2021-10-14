const { BackgroundProcessor } = require('../worker/process.childprocess');
const _ = require('lodash');
const { MAINNET } = require('../constants/snapshot-source-names');
const { GET_LM_CURRENT_APY_SUMMARY } = require('../constants/action-names');
const { getTimeIndex } = require('../util/getTimeIndex');

const runTests = (type, parsedData, network, programName, cutoffDate) => {
  const timeIndex = getTimeIndex(cutoffDate, programName);
  console.log({ timeIndex, cutoffDate });
  const finalGlobalTimestampState =
    parsedData.processedData[parsedData.processedData.length - 1];
  const users = Object.values(finalGlobalTimestampState.users);

  const userBalancesSnapshot = {};
  const totalValuePerUser = Object.entries(
    parsedData.processedData[timeIndex].users
  ).reduce((prev, [addr, curr]) => {
    if (!curr) return prev;
    userBalancesSnapshot[addr] = {
      dispensed: curr.dispensed,
      forfeited: curr.forfeited + curr.forfeitedCommissions,
      claimed: curr.claimedCommissionsAndRewardsAwaitingDispensation,
      accrued: curr.totalAccruedCommissionsAndClaimableRewards,
    };
    prev[addr] =
      curr.totalAccruedCommissionsAndClaimableRewards +
      curr.claimedCommissionsAndRewardsAwaitingDispensation +
      curr.forfeitedCommissions +
      curr.forfeited +
      curr.dispensed;
    return prev;
  }, {});

  require('fs').writeFileSync(
    require('path').join(__dirname, './harvest-exit-states.json'),
    Buffer.from(
      JSON.stringify(
        {
          rewardProgram: programName,
          balances: userBalancesSnapshot,
          date: cutoffDate,
        },
        null,
        2
      )
    )
  );

  // const totalPoolDominanceRatio = _.sum(
  //   _.flattenDeep(
  //     _.map(users, (u) => u.tickets.map((t) => t.poolDominanceRatio))
  //   )
  // );

  // console.log({ totalPoolDominanceRatio });
  /* 
          expect devnet rewards to be lower than 45,000,000 because 
          devnet users don't show up until ~500 intervals. Whereas, all rewards
          allocated for mainnet users have been given to mainnet users. And we shifted
          the reward program to start _after_ the genesis block to ensure this.
        */

  // need to include forfeited validator commissions ?
  // const totalRewards = users.reduce((prev, curr) => {
  //   return (
  //     prev +
  //     curr.totalAccruedCommissionsAndClaimableRewards +
  //     curr.claimedCommissionsAndRewardsAwaitingDispensation +
  //     curr.forfeitedCommissions +
  //     curr.forfeited +
  //     curr.dispensed
  //   );
  // }, 0);
};

const bp = new BackgroundProcessor();
// const bp2 = new BackgroundProcessor();
const programName = 'harvest';
bp.reloadAndReprocessSnapshots({
  network: MAINNET,
  rewardProgram: programName,
})
  // test reload caching
  // .then(async () => bp.reloadAndReprocessSnapshots({ network: MAINNET }))
  .then(async () => {
    await runTests(
      'lm',
      bp.lmDataParsed,
      MAINNET,
      programName,
      `2021-10-12T01:25:20.952Z`
    );
    console.log(
      bp.dispatch(GET_LM_CURRENT_APY_SUMMARY, {
        programName: programName,
      })
    );
    // await runTests('vs', bp.vsDataParsed, MAINNET);
  });
