const moment = require('moment');
/*
  - The network was started prior to the DEX launch. There is roughly ~week worth of blocks that had no meaningful transactions as the product was not launched.
    Because the snapshots start at the genesis block, they include that week of null activity epochs. This has an impact on the reward distribution. The changes we make to the snapshot will remove those null epochs and balance out the rewards distribution.
    Because we are extending the program to June 30th(initially ended ~May 14th) there was initially a 6 week accumulation period after the official end of the program. So users could accumulate rewards up until ~June 19th.
  - We decided to extend the program eligibility to June 30th, but did not extend the accumulation of reward period relative to the same rules that were implemented when we started the program.
    Extending to August 4th will maintain our initial program details that were communicated to the community
*/

// Rewards begin accruing
const START_DATETIME = '2021-08-16T06:00:00.000Z';
// Deposits are cut off earlier on
const DEPOSIT_CUTOFF_DATETIME = '2021-09-27T06:00:00.000Z';
// But they can continue to accrue rewards until the final end date
const END_OF_REWARD_ACCRUAL_DATETIME = '2021-09-27T06:00:00.000Z';
// Snapshot of all Validator events is split into 200 minute intervals (https://github.com/Sifchain/Vanir/issues/13)
const EVENT_INTERVAL_MINUTES = 200;

// Amount of time that users can accrue rewards
const REWARD_ACCRUAL_DURATION_MS =
  moment.utc(END_OF_REWARD_ACCRUAL_DATETIME).valueOf() -
  moment.utc(START_DATETIME).valueOf();

// Amount of time that users can deposit with opportunity to gain rewards
const DEPOSITS_ALLOWED_DURATION_MS =
  moment.utc(DEPOSIT_CUTOFF_DATETIME).valueOf() -
  moment.utc(START_DATETIME).valueOf();

// Amount of 200min intervals before users can no-longer gain rewards
const REWARD_ACCRUAL_DURATION_INTERVAL_COUNT = Math.floor(
  REWARD_ACCRUAL_DURATION_MS / 1000 / 60 / EVENT_INTERVAL_MINUTES
);

const config = {
  START_DATETIME,
  DEPOSIT_CUTOFF_DATETIME,
  END_OF_REWARD_ACCRUAL_DATETIME,
  EVENT_INTERVAL_MINUTES,
  DEPOSITS_ALLOWED_DURATION_MS,
  MULTIPLIER_MATURITY: 864, // 4 months in in 200minute intervals,
  NUMBER_OF_INTERVALS_TO_RUN: REWARD_ACCRUAL_DURATION_INTERVAL_COUNT + 864, // duration of bucket drain + duration to latest possible multiplier maturity
  REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
};

module.exports = config;
