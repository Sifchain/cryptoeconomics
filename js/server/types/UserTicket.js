const config = require('../config');
const moment = require('moment');
class UserTicket {
  constructor () {
    this.commission = 0;
    this.amount = 0;
    this.mul = 0;
    this.reward = 0;
    this.validatorRewardAddress = null;
    this.validatorStakeAddress = null;
    this.timestamp = null;
    this.rewardDelta = 0;
    this.poolDominanceRatio = 0;
    this.commissionRewardsByValidator = {};
  }

  calculateTotalValidatorCommissions () {
    let sum = 0;
    for (let prop in this.commissionRewardsByValidator) {
      sum += this.commissionRewardsByValidator[prop];
    }
    return sum;
  }

  static fromJSON (props) {
    return Object.assign(new this(), props);
  }

  burn (amountToBurn) {
    if (amountToBurn < 0) {
      throw new Error('amountToBurn must be a non-negative number');
    }
    if (amountToBurn > this.amount) {
      throw new Error(
        'amountToBurn must be less than or equal to `UserTicket.amount`'
      );
    }
    const ratioToBurn = this.amount === 0 ? 0 : amountToBurn / this.amount;
    const ratioToKeep = 1 - ratioToBurn;
    const hasRemainder = ratioToBurn !== 1;
    const burnedTicket = this.cloneWith({
      amount: this.amount * ratioToBurn,
      reward: this.reward * ratioToBurn,
      rewardDelta: this.rewardDelta * ratioToBurn,
      poolDominanceRatio: this.poolDominanceRatio * ratioToBurn,
      commissionRewardsByValidator: Object.fromEntries(
        Object.entries(this.commissionRewardsByValidator).map(([k, v]) => {
          return [k, v * ratioToBurn];
        })
      )
    });
    let remainderTicket = null;
    if (hasRemainder) {
      remainderTicket = this.cloneWith({
        amount: this.amount * ratioToKeep,
        reward: this.reward * ratioToKeep,
        rewardDelta: this.rewardDelta * ratioToKeep,
        poolDominanceRatio: this.poolDominanceRatio * ratioToKeep,
        commissionRewardsByValidator: Object.fromEntries(
          Object.entries(this.commissionRewardsByValidator).map(([k, v]) => {
            return [k, v * ratioToKeep];
          })
        )
      });
    }
    return {
      burnedTicket,
      remainderTicket,
      hasRemainder
    };
  }

  cloneWith (props) {
    let next = new UserTicket();
    next = Object.assign(Object.assign(next, this), props);
    next.commissionRewardsByValidator = {
      ...next.commissionRewardsByValidator
    };
    return next;
  }

  cloneAndRedelegateFromEvent (event) {
    return this.cloneWith({
      commission: event.commission,
      validatorRewardAddress: event.validatorRewardAddress,
      validatorStakeAddress: event.validatorStakeAddress
    });
  }

  addCommissionRewardByValidator (commissionReward, validatorRewardAddress) {
    let currentClaims =
      this.commissionRewardsByValidator[validatorRewardAddress] || 0;
    this.commissionRewardsByValidator[validatorRewardAddress] =
      currentClaims + commissionReward;
  }

  getClaimableCommissionRewardByValidator (validatorRewardAddress) {
    let currentClaims =
      this.commissionRewardsByValidator[validatorRewardAddress] || 0;
    return currentClaims * this.mul;
  }

  getForfeitedCommissionRewardByValidator (validatorRewardAddress) {
    let currentClaims =
      this.commissionRewardsByValidator[validatorRewardAddress] || 0;
    return currentClaims * (1 - this.mul);
  }

  resetCommissionRewardsByValidator (validatorRewardAddress) {
    this.commissionRewardsByValidator[validatorRewardAddress] = 0;
  }

  static fromEvent (event) {
    let instance = new this();
    Object.assign(instance, {
      commission: event.commission,
      validatorRewardAddress: event.validatorRewardAddress,
      validatorStakeAddress: event.validatorStakeAddress,
      amount: event.amount,
      mul: 0.25,
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
