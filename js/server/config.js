const config = {
  STARTING_GLOBAL_STATE: {
    timestamp: -1,
    rewardBuckets: [],
    users: {
      /* 
      [*]: {
        
      }
      */
    },
    bucketEvent: {
      rowan: 30000000,
      initialRowan: 30000000,
      duration: 872 // ~871.2 200min periods or 121 days
    }
  },
  TIME_INTERVAL: 200, // in minutes
  MULTIPLIER_MATURITY: 864, // 4 months in in 200minute intervals,
  NUMBER_OF_INTERVALS_TO_RUN: 872 + 864, // duration of bucket drain + duration to latest possible multiplier maturity
  START_DATETIME: '2021-02-11T11:59:14.685903388Z'
}

module.exports = config
