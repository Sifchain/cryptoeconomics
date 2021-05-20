const _ = require('lodash');
const moment = require('moment');
const { UserTicket } = require('./UserTicket');
const config = require('../config');

// currently just a single source of truth for the User data structure.
// May be useful for migrating the user mutation methods to in the future.
class User {
  constructor () {
    this.tickets = [];
    this.claimableRewardsOnWithdrawnAssets = 0;
    this.dispensed = 0;
    this.forfeited = 0;
    this.currentTotalClaimableReward = 0;
    this.reservedReward = 0;
    this.totalTicketsAmountSum = 0;
    this.totalClaimableCommissionsOnDelegatorRewards = 0;

    // neccessary because we can otherwise not calculate `totalClaimableCommissionsOnDelegatorRewards` if there are no remaining tickets
    // this.claimableCommissionsByDelegatorAddress = {};
    this.delegatorAddresses = [];

    this.totalRewardAtMaturity = 0;
    this.ticketAmountAtMaturity = 0;
    this.yieldAtMaturity = 0;
    this.nextRewardShare = 0;
    this.currentYieldOnTickets = 0;
    // dates
    this.maturityDate = undefined;
    this.maturityDateISO = undefined;
    this.yearsToMaturity = undefined;
    this.currentAPYOnTickets = undefined;
    this.maturityDateMs = undefined;
    // timevalues
    this.futureReward = undefined;
    this.nextReward = undefined;
    this.nextRewardProjectedFutureReward = undefined;
    this.nextRewardProjectedAPYOnTickets = undefined;
  }

  updateMaturityTimeProps (userAtFinalTimestamp, currentTimestampInMs) {
    this.maturityDate = userAtFinalTimestamp.maturityDate;
    this.maturityDateISO = userAtFinalTimestamp.maturityDateISO;
    const msToMaturity =
      userAtFinalTimestamp.maturityDateMs - currentTimestampInMs;
    this.yearsToMaturity = msToMaturity / 1000 / 60 / 60 / 24 / 365;
    this.currentAPYOnTickets =
      this.currentYieldOnTickets / this.yearsToMaturity;
  }

  static fromJSON (props) {
    let next = new this();
    Object.assign(next, props);
    // next.claimableCommissionsByDelegatorAddress = {
    //   ...props.claimableCommissionsByDelegatorAddress,
    // };
    next.tickets = next.tickets.map(t => UserTicket.fromJSON(t));
    return next;
  }

  cloneWith (props) {
    let next = new User();
    Object.assign(next, this);
    if (!props.tickets) {
      next.tickets = this.tickets.map(t => t.cloneWith({}));
    }
    next.delegatorAddresses = [...next.delegatorAddresses];
    // if (!props.claimableCommissionsByDelegatorAddress) {
    //   next.claimableCommissionsByDelegatorAddress = {
    //     ...next.claimableCommissionsByDelegatorAddress,
    //   };
    // }
    Object.assign(next, props);
    return next;
  }

  updateRewards (timestampTicketsAmountSum) {
    this.totalTicketsAmountSum = _.sum(this.tickets.map(t => t.amount));
    this.currentTotalClaimableReward =
      this.claimableRewardsOnWithdrawnAssets +
      _.sum(this.tickets.map(t => t.reward * t.mul)) +
      this.totalClaimableCommissionsOnDelegatorRewards;
    this.reservedReward =
      this.claimableRewardsOnWithdrawnAssets +
      _.sum(this.tickets.map(t => t.reward));
    this.nextRewardShare =
      this.totalTicketsAmountSum / timestampTicketsAmountSum;
  }

  updateUserMaturityDates (
    userAtPrevTimestamp,
    isAfterRewardPeriod,
    currentTimestampInMinutes,
    nextBucketGlobalReward
  ) {
    let maturityDate = userAtPrevTimestamp.maturityDate;
    let maturityDateISO = userAtPrevTimestamp.maturityDateISO;
    let maturityDateMs = userAtPrevTimestamp.maturityDateMs;
    let maturityDateMoment;
    if (
      maturityDate === undefined && // maturity date not yet reached
      isAfterRewardPeriod && // reward period is over
      this.currentTotalClaimableReward === this.reservedReward // rewards have matured
    ) {
      maturityDateMoment = moment
        .utc(config.START_DATETIME)
        .add(currentTimestampInMinutes, 'm');
      maturityDate = maturityDateMoment.format('MMMM Do YYYY, h:mm:ss a');
      maturityDateMs = maturityDateMoment.valueOf();
      maturityDateISO = maturityDateMoment.toISOString();
    }
    this.maturityDate = maturityDate;
    this.maturityDateISO = maturityDateISO;
    this.maturityDateMs = maturityDateMs;
    this.futureReward =
      this.totalRewardAtMaturity - this.currentTotalClaimableReward;
    this.currentYieldOnTickets =
      // likely scenario for validators (no tickets)
      this.totalTicketsAmountSum === 0
        ? 0
        : this.futureReward / this.totalTicketsAmountSum;
    this.nextReward = this.nextRewardShare * nextBucketGlobalReward;
    this.nextRewardProjectedFutureReward =
      (this.nextReward / 200) * 60 * 24 * 365;
    this.nextRewardProjectedAPYOnTickets =
      // likely scenario for validators (no tickets)
      this.totalTicketsAmountSum === 0
        ? 0
        : this.nextRewardProjectedFutureReward / this.totalTicketsAmountSum;
  }

  updateUserMaturityRewards (userAtMaturity) {
    this.totalRewardAtMaturity = userAtMaturity.currentTotalClaimableReward;
    this.ticketAmountAtMaturity = _.sum(
      userAtMaturity.tickets.map(ticket => ticket.amount)
    );

    // to avoid NaN (serialized as `null` in JSON) as a result of `0/0`
    // and when user is a validator (with a `ticketAmountAtMaturity` of zero)
    if (this.ticketAmountAtMaturity === 0) {
      this.yieldAtMaturity = 0;
    } else {
      this.yieldAtMaturity =
        this.totalRewardAtMaturity / this.ticketAmountAtMaturity;
    }
  }

  addTicket (ticket) {
    this.tickets = this.tickets.concat(ticket);
  }

  recalculateTotalClaimableCommissionsOnDelegatorRewards (
    getUserByAddress = addr => new User(),
    userAddress
  ) {
    let total = 0;
    this.delegatorAddresses.forEach(address => {
      const delegator = getUserByAddress(address);
      delegator.tickets.forEach(ticket => {
        total += ticket.getClaimableCommissionRewardByValidator(userAddress);
      });
    });
    this.totalClaimableCommissionsOnDelegatorRewards = total;
  }

  setClaimableCommissionOnDelegatorReward (
    claimableCommissionsOnDelegatorReward,
    delegatorSifAddress
  ) {
    // this.claimableCommissionsByDelegatorAddress[delegatorSifAddress] =
    //   claimableCommissionsOnDelegatorReward;
  }

  withdrawStakeAsDelegator (delegateEvent) {
    const burnedThisValTickets = this.removeBurnedTickets(delegateEvent);
    const { claimable, forfeited } = this.calculateClaimableReward(
      burnedThisValTickets
    );
    this.claimableRewardsOnWithdrawnAssets +=
      claimable * (1 - delegateEvent.commission);
    this.forfeited += forfeited;
    /*
      Skip adding validator rewards here because they are added in total via 
     `User#collectValidatorsCommissionsOnLatestUnclaimedRewards()` ?
    */
  }

  calculateClaimableReward (tickets) {
    return tickets.reduce(
      (accum, ticket) => {
        const forefeitedMultiplier = 1 - ticket.mul;
        const reward = ticket.reward || 0;
        const result = {
          claimable: accum.claimable + reward * ticket.mul,
          forfeited: accum.forfeited + reward * forefeitedMultiplier
        };
        return result;
      },
      { claimable: 0, forfeited: 0 }
    );
  }

  addDelegatorAddress (delegatorSifAddress) {
    if (!this.delegatorAddresses.includes(delegatorSifAddress)) {
      this.delegatorAddresses.push(delegatorSifAddress);
    }
  }

  collectValidatorsCommissionsOnLatestUnclaimedRewards (
    getUserByAddress = addr => new User(),
    delegatorSifAddress
  ) {
    /*
      Need to: 
        * Loop through delegator's (`this`) tickets with validator's `validatorSifAddress`
          * Calculate claimable reward
          * Calculate commission on reward
          * Subtract commission already claimed (`ticket#commissionRewardsClaimedByValidators`)
            * (to account for redelegation events) 
          * Add the result to `ticket#commissionRewardsClaimedByValidators`
          * Add to sum of all `ticket#commissionRewardsClaimedByValidators`'s (`validatorCommissionRewards`)
    */
    for (let ticket of this.tickets) {
      const validator = getUserByAddress(ticket.validatorSifAddress);
      let commissionOnReward = ticket.rewardDelta * ticket.commission;
      if (commissionOnReward < 0) {
        console.log('less than zero');
      }
      ticket.addCommissionRewardByValidator(
        commissionOnReward,
        ticket.validatorSifAddress
      );
      validator.addDelegatorAddress(delegatorSifAddress);
    }
  }

  removeBurnedTickets (delegateEvent) {
    const tickets = [];
    const otherValidatorTickets = [];
    this.tickets.forEach(ticket => {
      if (ticket.validatorSifAddress === delegateEvent.validatorSifAddress) {
        tickets.push(ticket);
      } else {
        otherValidatorTickets.push(ticket);
      }
    });
    const sortedTickets = _.sortBy(tickets, 'mul');
    let amountLeft = -delegateEvent.amount;
    const burnedTickets = [];
    const remainingTickets = [];
    sortedTickets.forEach(ticket => {
      if (amountLeft === 0) {
        remainingTickets.push(ticket);
        return;
      }
      let amountToRemove = Math.min(amountLeft, ticket.amount);
      const proportionBurned =
        ticket.amount === 0 ? 0 : +amountToRemove / parseFloat(ticket.amount);
      const burnedTicket = ticket.cloneWith({
        amount: amountToRemove,
        reward: proportionBurned * parseFloat(ticket.reward || 0)
      });
      burnedTickets.push(burnedTicket);
      amountLeft = amountLeft - amountToRemove;
      if (amountLeft === 0) {
        const remainingTicket = ticket.cloneWith({
          amount: ticket.amount - amountToRemove,
          reward: (1 - proportionBurned) * parseFloat(ticket.reward || 0)
        });
        remainingTickets.push(remainingTicket);
      }
    });
    this.tickets = otherValidatorTickets.concat(remainingTickets);
    return burnedTickets;
  }
}
module.exports = { User };
