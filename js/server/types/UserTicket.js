const config = require('../config');
const moment = require('moment');
class UserTicket {
  constructor () {
    this.commission = 0;
    this.amount = 0;
    this.mul = 0;
    this.reward = 0;
    this.validatorSifAddress = null;
    this.timestamp = null;
    this.rewardDelta = 0;
    this.poolDominanceRatio = 0;
    this.commissionRewardsByValidator = {};
  }

  static fromJSON (props) {
    return Object.assign(new this(), props);
  }

  cloneWith (props) {
    let next = new UserTicket();
    next = Object.assign(Object.assign(next, this), props);
    if (props.commissionRewardsByValidator) {
      next.commissionRewardsByValidator = {
        ...next.commissionRewardsByValidator
      };
    }
    return next;
  }

  addCommissionRewardByValidator (commissionReward, validatorSifAddress) {
    let currentClaims =
      this.commissionRewardsByValidator[validatorSifAddress] || 0;
    this.commissionRewardsByValidator[validatorSifAddress] =
      currentClaims + commissionReward;
  }

  getClaimableCommissionRewardByValidator (validatorSifAddress) {
    let currentClaims =
      this.commissionRewardsByValidator[validatorSifAddress] || 0;
    return currentClaims * this.mul;
  }

  static fromEvent (event, mul) {
    let instance = new this();
    Object.assign(instance, {
      commission: event.commission,
      validatorSifAddress: event.validatorSifAddress,
      amount: event.amount,
      mul,
      reward: 0,
      timestamp: moment
        .utc(config.START_DATETIME)
        .add(event.timestamp, 'm')
        .format('MMMM Do YYYY, h:mm:ss a')
    });
    return instance;
  }
}

module.exports = {
  UserTicket
};
