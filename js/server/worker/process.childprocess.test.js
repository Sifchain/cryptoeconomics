const { BackgroundProcessor } = require('./process.childprocess');
const _ = require('lodash');
const { MAINNET } = require('../constants/snapshot-source-names');

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
            expect (condition) {
              if (condition) {
                expects.push(`\n  ✅ ${msg}`);
              } else {
                expects.push(`\n  🚨 ${msg}`);
              }
            },
            log (msg) {
              logs.push(`    >_ ` + msg);
            }
          });
        } catch (e) {
          expects.push(`\n  🚨 ${msg}`);
          logs.push(e);
        }
        expects.forEach(l => console.info(l));
      }
    });
    logs.forEach(l => console.log(l));
  } catch (e) {
    console.error(e);
  }
  console.groupEnd();
};

const runTests = (type, parsedData, network) => {
  const users = Object.values(
    parsedData.processedData[parsedData.processedData.length - 1].users
  );

  const totalPoolDominanceRatio = _.sum(
    _.flattenDeep(_.map(users, u => u.tickets.map(t => t.poolDominanceRatio)))
  );

  describe('Verify Rewards', ({ test }) => {
    /* 
          expect devnet rewards to be lower than 45,000,000 because 
          devnet users don't show up until ~500 intervals. Whereas, all rewards
          allocated for mainnet users have been given to mainnet users. And we shifted
          the reward program to start _after_ the genesis block to ensure this.
        */
    test(`totalRewards (${type.toUpperCase()}, ${network.toUpperCase()})`, ({
      expect,
      log
    }) => {
      // need to include forfeited validator commissions ?
      const totalRewards = users.reduce((prev, curr) => {
        return (
          prev +
          curr.totalAccruedCommissionsAndClaimableRewards +
          curr.forfeitedCommissions +
          curr.forfeited +
          curr.dispensed
        );
      }, 0);
      log('totalRewards: ' + totalRewards);
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
bp.reloadAndReprocessSnapshots({ network: MAINNET })
  // test reload caching
  .then(async () => bp.reloadAndReprocessSnapshots({ network: MAINNET }))
  .then(async () => {
    await runTests('lm', bp.lmDataParsed, MAINNET);
    await runTests('vs', bp.vsDataParsed, MAINNET);
  });
