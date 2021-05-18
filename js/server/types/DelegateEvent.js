class DelegateEvent {
  constructor () {
    this.timestamp = 0;
    this.delegateAddress = null;
    this.validatorSifAddress = null;
    this.commission = 0;
    this.amount = 0;
  }

  clearTimestamp () {
    this.timestamp = undefined;
  }

  cloneWith (props) {
    return Object.assign(Object.assign(new DelegateEvent(), this), props);
  }
}

module.exports = {
  DelegateEvent
};
