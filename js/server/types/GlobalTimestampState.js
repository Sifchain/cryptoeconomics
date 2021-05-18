const config = require('../config');
class GlobalTimestampState {
  constructor () {
    this.totalTicketsAmountSum = 0;
    this.users = {};
    this.timestamp = -1;
    this.rewardBuckets = [];
    this.bucketEvent = undefined;
  }

  static getInitial () {
    let instance = new this();
    instance.bucketEvent = {
      rowan: 45000000,
      initialRowan: 45000000,
      duration: config.REWARD_ACCRUAL_DURATION_INTERVAL_COUNT
    };
    return instance;
  }
}

module.exports = {
  GlobalTimestampState
};
