const { BackgroundProcessor } = require('./process.childprocess');
const _ = require('lodash');
const { MAINNET } = require('../constants/snapshot-source-names');
const { GET_LM_CURRENT_APY_SUMMARY } = require('../constants/action-names');
const { getTimeIndex } = require('../util/getTimeIndex');
const fs = require('fs');
const { encrypt, decrypt } = require('../util/encrypt');
const configs = require('../config');
const fetch = require('cross-fetch').fetch;

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    'PASSWORD',
    encodeURIComponent(process.env.DATABASE_PASSWORD)
  );
  const encrypted = encrypt(process.env.DATABASE_URL);
  fs.writeFileSync('./DATABASE_URL.enc', encrypted.encryptedData);
} else {
  const dburlEnc = fs.readFileSync('./DATABASE_URL.enc').toString();
  const data = decrypt(dburlEnc);
  process.env.DATABASE_URL = data;
}

// simple test setup
const describe = async (description, describer) => {
  console.group(description);
  try {
    console.log('running');
    const logs = [];
    await describer({
      test: async (msg, fn) => {
        const expects = [];
        try {
          await fn({
            expect(condition) {
              if (condition) {
                expects.push(`\n  ✅ ${msg}`);
              } else {
                expects.push(`\n  🚨 ${msg}`);
              }
            },
            log(msg) {
              logs.push(`    >_ ` + msg);
            },
          });
        } catch (e) {
          expects.push(`\n  🚨 ${msg}`);
          logs.push(e);
        }
        expects.forEach((l) => console.info(l));
      },
    });
    logs.forEach((l) => console.log(l));
  } catch (e) {
    console.error(e);
  }
  console.groupEnd();
};

const runTests = async (type, parsedData, network, programName) => {
  const config = configs[programName];
  const currentTimeIndex = getTimeIndex('now', programName);
  const finalGlobalTimestampState =
    parsedData.processedData[parsedData.processedData.length - 1];
  const currentGlobalTimestampState =
    parsedData.processedData[currentTimeIndex];

  const rankedAddresses = parsedData.users;
  let addressIndexToCheck = 50;
  const intervalsInADay = (24 * 60) / config.EVENT_INTERVAL_MINUTES;
  const sampleStates = [
    parsedData.processedData[currentTimeIndex],
    parsedData.processedData[currentTimeIndex + intervalsInADay],
  ];
  const expectedDailyRate = config.STATIC_APR_PERCENTAGE / 365;
  function checkCurrentPoolValueInRowan(address) {
    return fetch(
      `https://api.sifchain.finance/sifchain/clp/v1/liquidity_provider_data/${address}`
    )
      .then((r) => r.json())
      .then((r) => {
        return (
          +r.liquidity_provider_data
            .reduce((prev, curr) => {
              if (
                config.COIN_WHITELIST &&
                !config.COIN_WHITELIST.includes(
                  curr.liquidity_provider.asset.symbol
                )
              )
                return prev;
              return prev + BigInt(curr.native_asset_balance) * 2n;
            }, 0n)
            .toString() /
          10 ** 18
        );
      });
  }
  while (addressIndexToCheck--) {
    const address = rankedAddresses[addressIndexToCheck];
    const sample1 = sampleStates[0].users[address];
    const sample2 = sampleStates[1].users[address];
    const rewardDelta =
      sample2.totalAccruedCommissionsAndClaimableRewards -
      sample1.totalAccruedCommissionsAndClaimableRewards;
    if (!(sample1.totalDepositedAmount || sample2.totalDepositedAmount)) {
      continue;
    }
    if (sample1.totalDepositedAmount !== sample2.totalDepositedAmount) continue;
    const actualDailyRate = (rewardDelta / sample1.totalDepositedAmount) * 100;
    // console.log(
    //   address,
    //   expectedDailyRate.toFixed(4) === actualDailyRate.toFixed(4),
    //   expectedDailyRate,
    //   actualDailyRate
    // );
    const expectedPoolValueInRowan = await checkCurrentPoolValueInRowan(
      address
    );
    const actualPoolValueInRowan = sample1.totalDepositedAmount;
    const diff = Math.abs(expectedPoolValueInRowan - actualPoolValueInRowan);
    console.log(
      address,
      diff / expectedPoolValueInRowan,
      expectedPoolValueInRowan,
      actualPoolValueInRowan
    );
  }
  const users = Object.values(currentGlobalTimestampState.users);

  // const totalValuePerUser = Object.entries(
  //   parsedData.processedData[
  //     getTimeIndex('2021-10-15T17:26:13.441Z', programName)
  //   ].users
  // ).reduce((prev, [addr, curr]) => {
  //   if (!curr) return prev;
  //   prev[addr] =
  //     curr.totalAccruedCommissionsAndClaimableRewards +
  //     curr.claimedCommissionsAndRewardsAwaitingDispensation +
  //     curr.forfeitedCommissions +
  //     curr.forfeited +
  //     curr.dispensed;
  //   return prev;
  // }, {});

  // require('fs').writeFileSync(
  //   './user-exit-states.with-readds.json',
  //   Buffer.from(JSON.stringify(totalValuePerUser, null, 2))
  // );

  const totalPoolDominanceRatio = _.sum(
    _.flattenDeep(
      _.map(users, (u) => u.tickets.map((t) => t.poolDominanceRatio))
    )
  );

  console.log({ totalPoolDominanceRatio });
  describe('Verify Rewards', ({ test }) => {
    /* 
          expect devnet rewards to be lower than 45,000,000 because 
          devnet users don't show up until ~500 intervals. Whereas, all rewards
          allocated for mainnet users have been given to mainnet users. And we shifted
          the reward program to start _after_ the genesis block to ensure this.
        */
    test(`totalRewards (${type.toUpperCase()}, ${network.toUpperCase()})`, ({
      expect,
      log,
    }) => {
      // need to include forfeited validator commissions ?
      const totalRewards = users.reduce((prev, curr) => {
        return (
          prev +
          curr.totalAccruedCommissionsAndClaimableRewards +
          curr.claimedCommissionsAndRewardsAwaitingDispensation +
          curr.forfeitedCommissions +
          curr.forfeited +
          curr.dispensed
        );
      }, 0);
      const totalAccrued = users.reduce((prev, curr) => {
        return (
          prev + curr.totalAccruedCommissionsAndClaimableRewards //+
          // curr.claimedCommissionsAndRewardsAwaitingDispensation //+
          // curr.forfeitedCommissions +
          // curr.forfeited +
          // curr.dispensed
        );
      }, 0);
      log('totalRewards: ' + new Intl.NumberFormat().format(totalRewards));
      log('totalAccrued: ' + new Intl.NumberFormat().format(totalAccrued));
      expect(Math.round(totalRewards) === 45000000);
    });
    test('totalPoolDominanceRatio', ({ expect, log }) => {
      log(totalPoolDominanceRatio);
      expect(Math.round(totalPoolDominanceRatio) === 1);
    });
    test('all users included in final snapshot', ({ expect, log }) => {
      log('users ' + users.length);
      expect(parsedData.users.length === users.length);
    });
  });
};

const bp = new BackgroundProcessor();
// const bp2 = new BackgroundProcessor();
// const programName = 'harvest_expansion';
const programName = 'expansion_bonus';
bp.reloadAndReprocessSnapshots({
  network: MAINNET,
  rewardProgram: programName,
})
  // test reload caching
  // .then(async () => bp.reloadAndReprocessSnapshots({ network: MAINNET }))
  .then(async () => {
    await runTests('lm', bp.lmDataParsed, MAINNET, programName);
    console.log(
      bp.dispatch(GET_LM_CURRENT_APY_SUMMARY, {
        programName: programName,
      })
    );
    // await runTests('vs', bp.vsDataParsed, MAINNET);
  });
