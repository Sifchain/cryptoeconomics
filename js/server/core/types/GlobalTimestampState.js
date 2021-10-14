const configs = require('../../config');
const { User } = require('./User');
const { validateSifAddress } = require('../../util/validateSifAddress');
class GlobalTimestampState {
  constructor() {
    this.totalDepositedAmount = 0;
    this.users = {};
    this.timestamp = -1;
    this.rewardBuckets = [];
    this.bucketEvent = undefined;
    this.isSimulated = false;
    this.isPending = false;
  }

  // as designated here: https://github.com/Sifchain/sifnode/blob/develop/x/dispensation/Flow-Distribute.md
  createDispensationJob() {
    const EROWAN_PRECISION = 1e18;
    const users = this.users;
    const output = [];
    for (const address in users) {
      const { isValid } = validateSifAddress(address);
      if (!isValid) {
        console.warn(
          `WARNING: ${address} is not valid. Commissions and/or rewards will not be dispensed.`
        );
        continue;
      }
      const user = users[address];
      const claimed = user.claimedCommissionsAndRewardsAwaitingDispensation;
      if (!claimed) {
        continue;
      }
      const bigIntAmount = BigInt(Math.floor(claimed * EROWAN_PRECISION));
      if (bigIntAmount === BigInt('0') || !bigIntAmount) {
        continue;
      }
      const formattedAmount = bigIntAmount.toString();
      output.push({
        address: address,
        coins: [
          {
            denom: 'rowan',
            amount: formattedAmount,
          },
        ],
      });
    }
    return {
      internalEpochTimestamp: this.timestamp,
      job: {
        Output: output,
      },
    };
  }

  markAsSimulated() {
    this.isSimulated = true;
  }

  markAsPending() {
    this.isPending = true;
  }

  setTotalDepositedAmount(totalDepositedAmount) {
    this.totalDepositedAmount = totalDepositedAmount;
  }

  updateTotalDepositedAmount() {
    const users = this.users;
    let timestampTicketsAmountSum = 0;
    for (let addr in users) {
      users[addr].tickets.forEach((t) => {
        timestampTicketsAmountSum += t.amount;
      });
    }
    this.totalDepositedAmount = timestampTicketsAmountSum;
    return timestampTicketsAmountSum;
  }

  static fromJSON(props) {
    let next = Object.assign(new this(), props);
    next.users = Object.fromEntries(
      Object.entries(next.users).map(([k, v]) => {
        return [k, User.fromJSON(v)];
      })
    );
    return next;
  }
  startBucket({ rewardProgram }) {
    const programConfig = configs[rewardProgram];
    this.bucketEvent = {
      rowan: programConfig.INITIAL_ROWAN,
      initialRowan: programConfig.INITIAL_ROWAN,
      duration: programConfig.REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
    };
  }
  endBuckets({ rewardProgram }) {
    const programConfig = configs[rewardProgram];
    this.bucketEvent = undefined;
    this.rewardBuckets = [];
  }
  static getInitial({ rewardProgram }) {
    const programConfig = configs[rewardProgram];
    let instance = new this();
    // instance.bucketEvent = {
    //   rowan: programConfig.INITIAL_ROWAN,
    //   initialRowan: programConfig.INITIAL_ROWAN,
    //   duration: programConfig.REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
    // };
    return instance;
  }
}

module.exports = {
  GlobalTimestampState,
};
