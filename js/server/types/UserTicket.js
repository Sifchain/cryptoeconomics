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
    this.commissionRewardsClaimedByValidators = 0;
  }

  cloneWith (props) {
    return Object.assign(Object.assign(new UserTicket(), this), props);
  }

  addCommissionRewardClaimedByValidator (commissionReward) {
    this.commissionRewardsClaimedByValidators += commissionReward;
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
