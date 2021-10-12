class DelegateEvent {
  constructor() {
    this.timestamp = 0;
    this.delegateAddress = null;
    this.validatorRewardAddress = null;
    this.validatorStakeAddress = null;
    this.commission = 0;
    this.amount = 0;
    this.token = '';
    this.rawTimestamp = 0;
  }

  clearTimestamp() {
    this.timestamp = undefined;
  }

  static fromJSON(props) {
    return Object.assign(new this(), props);
  }

  cloneWith(props) {
    return Object.assign(Object.assign(new DelegateEvent(), this), props);
  }
}

module.exports = {
  DelegateEvent,
};
