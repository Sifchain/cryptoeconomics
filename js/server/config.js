const moment = require('moment');
function createConfig({
  startsAt,
  durationInWeeks,
  weeksToTotalMaturity,
  intervalDurationMinutes,
  initialRowan,
  initialRewardMultiplier,
  rewardBucketStartDateTime = startsAt,
  rewardBucketEndDateTime = undefined,
  ignoreInitialPoolState,
  timerBuckets = [],
}) {
  /*
  - The network was started prior to the DEX launch. There is roughly ~week worth of blocks that had no meaningful transactions as the product was not launched.
    Because the snapshots start at the genesis block, they include that week of null activity epochs. This has an impact on the reward distribution. The changes we make to the snapshot will remove those null epochs and balance out the rewards distribution.
    Because we are extending the program to June 30th(initially ended ~May 14th) there was initially a 6 week accumulation period after the official end of the program. So users could accumulate rewards up until ~June 19th.
  - We decided to extend the program eligibility to June 30th, but did not extend the accumulation of reward period relative to the same rules that were implemented when we started the program.
    Extending to August 4th will maintain our initial program details that were communicated to the community
*/

  // Rewards begin accruing
  // const START_DATETIME = '2021-08-16T06:00:00.000Z';

  // originally set to:
  const START_DATETIME = startsAt;
  // timestamp associated w/ block height 2976500: (verify dates before bumping. this will increase APY's)
  // const START_DATETIME = '2021-08-24T22:38:16.367386704Z';
  //  '2021-08-24T22:38:16.367386704Z';
  // Deposits are cut off earlier on
  const DEPOSIT_CUTOFF_DATETIME = moment
    .utc(START_DATETIME)
    .add(moment.duration(durationInWeeks, 'weeks'))
    .toISOString();
  // But they can continue to accrue rewards until the final end date
  const END_OF_REWARD_ACCRUAL_DATETIME = DEPOSIT_CUTOFF_DATETIME;
  // Snapshot of all Validator events is split into 200 minute intervals (https://github.com/Sifchain/Vanir/issues/13)
  const EVENT_INTERVAL_MINUTES = intervalDurationMinutes;

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

  console.log({ REWARD_ACCRUAL_DURATION_INTERVAL_COUNT });

  const config = {
    ACCOUNT_FOR_INITIAL_POOL_STATE: !ignoreInitialPoolState,
    INITIAL_ROWAN: initialRowan,
    START_DATETIME,
    REWARD_BUCKET_START_DATETIME: rewardBucketStartDateTime,
    REWARD_BUCKET_END_DATETIME:
      rewardBucketEndDateTime || END_OF_REWARD_ACCRUAL_DATETIME,
    DEPOSIT_CUTOFF_DATETIME,
    END_OF_REWARD_ACCRUAL_DATETIME,
    EVENT_INTERVAL_MINUTES,
    DEPOSITS_ALLOWED_DURATION_MS,
    MULTIPLIER_MATURITY:
      REWARD_ACCRUAL_DURATION_MS / 1000 / 60 / EVENT_INTERVAL_MINUTES, // 6 weeks in in 200minute intervals,
    NUMBER_OF_INTERVALS_TO_RUN:
      REWARD_ACCRUAL_DURATION_INTERVAL_COUNT *
      (weeksToTotalMaturity / durationInWeeks), // duration of bucket drain + duration to latest possible multiplier maturity
    REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
    INITIAL_REWARD_MULTIPLIER: initialRewardMultiplier,
  };
  return config;
}

function createTimerBucket({
  startsAt,
  durationInWeeks,
  amount,
  intervalDurationMinutes,
}) {
  const DEPOSIT_CUTOFF_DATETIME = moment
    .utc(startsAt)
    .add(moment.duration(durationInWeeks, 'weeks'))
    .toISOString();
  // But they can continue to accrue rewards until the final end date
  const END_OF_REWARD_ACCRUAL_DATETIME = DEPOSIT_CUTOFF_DATETIME;
  // Snapshot of all Validator events is split into 200 minute intervals (https://github.com/Sifchain/Vanir/issues/13)
  const EVENT_INTERVAL_MINUTES = intervalDurationMinutes;

  // Amount of time that users can accrue rewards
  const REWARD_ACCRUAL_DURATION_MS =
    new Date(END_OF_REWARD_ACCRUAL_DATETIME).getTime() -
    new Date(startsAt).getTime();
  return {
    duration: Math.floor(
      REWARD_ACCRUAL_DURATION_MS / 1000 / 60 / intervalDurationMinutes
    ),
    startsAt,
    amount,
  };
}

const HARVEST_RELOAD_DATETIME = '2021-10-15T17:26:13.441Z';

module.exports = {
  COSMOS_IBC_REWARDS_V1: createConfig({
    initialRowan: 10_000_000,
    startsAt: '2021-08-24T20:06:15.000Z',
    durationInWeeks: 6,
    weeksToTotalMaturity: 12,
    intervalDurationMinutes: 200,
    initialRewardMultiplier: 0.25,
    ignoreInitialPoolState: true,
  }),
  harvest: createConfig({
    initialRowan: 40_000_000,
    startsAt: '2021-10-04T00:00:00.000Z',
    durationInWeeks: 6,
    rewardBucketEndDateTime: HARVEST_RELOAD_DATETIME,
    weeksToTotalMaturity: 6.1,
    intervalDurationMinutes: 59,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
  harvest_reloaded: createConfig({
    initialRowan: 40_000_000, // + 20_000_000,
    startsAt: '2021-10-04T00:00:00.000Z',
    durationInWeeks: 6,
    rewardBucketStartDateTime: HARVEST_RELOAD_DATETIME,
    weeksToTotalMaturity: 7,
    intervalDurationMinutes: 59,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: false,
  }),
  bonus_v1: createConfig({
    initialRowan: 1_000_000,
    startsAt: '2021-10-05T19:00:00.000Z',
    rewardBucketEndDateTime: '2021-10-28T23:00:00.000Z',
    durationInWeeks: 2,
    weeksToTotalMaturity: 4,
    intervalDurationMinutes: 60,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
  bonus_v1_ixo: createConfig({
    initialRowan: 100_000,
    startsAt: '2021-10-12T13:29:01.255Z',
    durationInWeeks: 2,
    weeksToTotalMaturity: 3,
    intervalDurationMinutes: 60,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
  bonus_v1_osmo: createConfig({
    initialRowan: 250_000,
    startsAt: '2021-10-18T23:00:00.000Z',
    rewardBucketEndDateTime: '2021-11-01T23:00:00.000Z',
    durationInWeeks: 2,
    weeksToTotalMaturity: 3,
    intervalDurationMinutes: 60,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
  bonus_v1_ratom: createConfig({
    initialRowan: 250_000,
    startsAt: '2021-10-21T06:00:00.000Z',
    durationInWeeks: 2,
    weeksToTotalMaturity: 3,
    intervalDurationMinutes: 60,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
  bonus_v1_luna: createConfig({
    initialRowan: 500_000,
    startsAt: '2021-10-27T19:30:00.000Z',
    durationInWeeks: 2,
    weeksToTotalMaturity: 3,
    intervalDurationMinutes: 60,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
  bonus_v1_usd: createConfig({
    initialRowan: 500_000,
    startsAt: '2021-10-27T19:30:00.000Z',
    durationInWeeks: 2,
    weeksToTotalMaturity: 3,
    intervalDurationMinutes: 60,
    initialRewardMultiplier: 1,
    ignoreInitialPoolState: true,
  }),
};
