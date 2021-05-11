const START_DATETIME = '2021-02-11T11:59:14.685903388Z';
const END_DATETIME = '2021-06-30T23:59:59';
const TIME_INTERVAL = 200;

const DURATION_MS = new Date(END_DATETIME) - new Date(START_DATETIME);
const DURATION_INTERVALS = Math.floor(DURATION_MS / 1000 / 60 / TIME_INTERVAL);

const config = {
  LM_STARTING_GLOBAL_STATE: {
    timestamp: -1,
    rewardBuckets: [],
    users: {},
    bucketEvent: {
      rowan: 45_000_000,
      initialRowan: 45_000_000,
      duration: DURATION_INTERVALS
    }
  },
  VS_STARTING_GLOBAL_STATE: {
    timestamp: -1,
    rewardBuckets: [],
    users: {
      /* 
      [*]: {
        
      }
      */
    },
    bucketEvent: {
      rowan: 45_000_000,
      initialRowan: 45_000_000,
      duration: DURATION_INTERVALS
    }
  },
  START_DATETIME,
  TIME_INTERVAL,
  MULTIPLIER_MATURITY: 864, // 4 months in in 200minute intervals,
  NUMBER_OF_INTERVALS_TO_RUN: DURATION_INTERVALS + 864 // duration of bucket drain + duration to latest possible multiplier maturity
};

module.exports = config;
