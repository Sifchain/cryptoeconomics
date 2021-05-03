const config = {
  STARTING_GLOBAL_STATE: {
    timestamp: -1,
    rewardBuckets: [],
    users: {},
    bucketEvent: { rowan: 30000000, initialRowan: 30000000 } // 871.2 200min period or 121 days
  },
  TIME_INTERVAL: 200, // in minutes
  MULTIPLIER_MATURITY: 864, // 4 months in in 200minute intervals,
  NUMBER_OF_INTERVALS_TO_RUN: 871 - 1,
  START_DATETIME: '2021-02-19T05:00'
}

module.exports = config
