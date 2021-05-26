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
    this.currentTotalCommissionsOnClaimableDelegatorRewards = 0;
    this.claimableCommissions = 0;

    // neccessary because we can otherwise not calculate `currentTotalCommissionsOnClaimableDelegatorRewards` if there are no remaining tickets
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

  redelegateTicketWithEvent (event, ticket) {
    this.tickets = this.tickets.map(t => {
      if (t === ticket) {
        return t.cloneWith({
          commission: event.commission,
          validatorSifAddress: event.validatorSifAddress
        });
      }
      return t;
    });
  }

  static fromJSON (props) {
    let next = new this();
    Object.assign(next, props);
    next.tickets = next.tickets.map(t => UserTicket.fromJSON(t));
    return next;
  }

  cloneWith (props) {
    let next = new User();
    Object.assign(next, this);
    if (!props.tickets) {
      next.tickets = this.tickets.map(t => t.cloneWith({}));
    }
    Object.assign(next, props);
    next.delegatorAddresses = [...next.delegatorAddresses];
    return next;
  }

  updateRewards (timestampTicketsAmountSum) {
    let totalAmount = 0;
    let totalReward = 0;
    let totalClaimableReward = 0;
    // console.log(`Calculating updateRewards commissions correctly?`);
    this.tickets.forEach(t => {
      const totalValidatorCommissions = t.calculateTotalValidatorCommissions();
      const claimableReward =
        t.reward * t.mul - totalValidatorCommissions * t.mul;
      const remainingReward =
        (1 - t.mul) * t.reward - (1 - t.mul) * totalValidatorCommissions;
      const expectedReward = claimableReward + remainingReward;
      totalAmount += t.amount;
      totalReward += expectedReward;
      totalClaimableReward += claimableReward;
    });
    this.totalTicketsAmountSum = totalAmount;
    this.currentTotalClaimableReward =
      this.claimableRewardsOnWithdrawnAssets +
      totalClaimableReward +
      this.currentTotalCommissionsOnClaimableDelegatorRewards +
      this.claimableCommissions;
    this.reservedReward = this.claimableRewardsOnWithdrawnAssets + totalReward;
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

  removeTicket (ticket) {
    this.tickets = this.tickets.filter(t => t !== ticket);
  }

  addClaimableCommission (claimableCommission) {
    this.claimableCommissions += claimableCommission;
  }

  recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards (
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
    // console.error(
    //   'need to add `claimableCommissions` property for when delegator claims'
    // );
    this.currentTotalCommissionsOnClaimableDelegatorRewards = total;
  }
  // Locked, Claimable, Claimed, Dispensed

  calculateClaimableCommissionsAndAssignToValidator (
    getUserByAddress = addr => new User(),
    burnedTickets
  ) {
    let totalClaimableCommissions = 0;
    let totalForfeitedCommissions = 0;
    for (let ticket of burnedTickets)
      for (let validatorSifAddress in ticket.commissionRewardsByValidator) {
        const validator = getUserByAddress(validatorSifAddress);
        const claimableCommission = ticket.getClaimableCommissionRewardByValidator(
          validatorSifAddress
        );
        const forfeitedCommission = ticket.getForfeitedCommissionRewardByValidator(
          validatorSifAddress
        );
        validator.addClaimableCommission(claimableCommission);
        ticket.resetCommissionRewardsByValidator(validatorSifAddress);
        totalClaimableCommissions += claimableCommission;
        totalForfeitedCommissions += forfeitedCommission;
      }
    return { totalClaimableCommissions, totalForfeitedCommissions };
  }

  withdrawStakeAsDelegator (delegateEvent, getUserByAddress) {
    const burnedThisValTickets = this.removeBurnedTickets(delegateEvent);
    const { claimable, forfeited } = this.calculateClaimableReward(
      burnedThisValTickets
    );

    const {
      totalClaimableCommissions: totalCommissionsClaimedByValidators,
      totalForfeitedCommissions: totalCommissionsForfeitedByValidators
    } = this.calculateClaimableCommissionsAndAssignToValidator(
      getUserByAddress,
      burnedThisValTickets
    );
    this.claimableRewardsOnWithdrawnAssets +=
      claimable - totalCommissionsClaimedByValidators;
    this.forfeited += forfeited - totalCommissionsForfeitedByValidators;
  }

  calculateClaimableReward (tickets) {
    return tickets.reduce(
      (accum, ticket) => {
        const reward = ticket.reward || 0;
        const result = {
          claimable: accum.claimable + reward * ticket.mul,
          forfeited: accum.forfeited + reward * (1 - ticket.mul)
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

    // withdrawal events are identified by negative `DelegateEvent.amount` fields.
    let remainingWithdrawalAmount = Math.abs(delegateEvent.amount);
    const burnedTickets = [];
    const remainingTickets = [];
    sortedTickets.forEach(ticket => {
      // if done withdrawing, keep the ticket
      if (remainingWithdrawalAmount === 0) {
        remainingTickets.push(ticket);
        return;
      }
      const amountToRemove = Math.min(remainingWithdrawalAmount, ticket.amount);

      const { burnedTicket, remainderTicket, hasRemainder } = ticket.burn(
        amountToRemove
      );

      burnedTickets.push(burnedTicket);
      remainingWithdrawalAmount -= amountToRemove;

      // if done withdrawing and ticket has remaining balance
      if (remainingWithdrawalAmount === 0 && hasRemainder) {
        remainingTickets.push(remainderTicket);
      }
    });
    this.tickets = otherValidatorTickets.concat(remainingTickets);
    return burnedTickets;
  }
}
module.exports = { User };
