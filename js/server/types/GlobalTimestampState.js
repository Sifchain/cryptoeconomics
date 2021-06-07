const config = require('../config');
const { User } = require('./User');
class GlobalTimestampState {
  constructor () {
    this.totalDepositedAmount = 0;
    this.users = {};
    this.timestamp = -1;
    this.rewardBuckets = [];
    this.bucketEvent = undefined;
    this.isSimulated = false;
  }

  markAsSimulated () {
    this.isSimulated = true;
  }

  setTotalDepositedAmount (totalDepositedAmount) {
    this.totalDepositedAmount = totalDepositedAmount;
  }

  updateTotalDepositedAmount () {
    const users = this.users;
    let timestampTicketsAmountSum = 0;
    for (let addr in users) {
      users[addr].tickets.forEach(t => {
        timestampTicketsAmountSum += t.amount;
      });
    }
    this.totalDepositedAmount = timestampTicketsAmountSum;
    return timestampTicketsAmountSum;
  }

  static fromJSON (props) {
    let next = Object.assign(new this(), props);
    next.users = Object.fromEntries(
      Object.entries(next.users).map(([k, v]) => {
        return [k, User.fromJSON(v)];
      })
    );
    return next;
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
