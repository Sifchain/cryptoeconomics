const _ = require('lodash');
const moment = require('moment');
const { UserTicket } = require('./UserTicket');
const configs = require('../../config');

// currently just a single source of truth for the User data structure.
// May be useful for migrating the user mutation methods to in the future.
class User {
  constructor() {
    this.tickets = [];
    this.claimableRewardsOnWithdrawnAssets = 0;
    this.dispensed = 0;
    this.forfeited = 0;
    this.totalAccruedCommissionsAndClaimableRewards = 0;
    this.totalClaimableCommissionsAndClaimableRewards = 0;
    this.reservedReward = 0;
    this.totalDepositedAmount = 0;
    this.totalClaimableRewardsOnDepositedAssets = 0;
    this.currentTotalCommissionsOnClaimableDelegatorRewards = 0;
    this.totalAccruedCommissionsAtMaturity = 0;
    this.totalCommissionsAndRewardsAtMaturity = 0;
    this.claimableCommissions = 0;
    this.forfeitedCommissions = 0;

    this.claimedCommissionsAndRewardsAwaitingDispensation = 0;
    // neccessary because we can otherwise not calculate `currentTotalCommissionsOnClaimableDelegatorRewards` if there are no remaining tickets
    // this.claimableCommissionsByDelegatorAddress = {};
    this.delegatorAddresses = [];

    this.totalRewardsOnDepositedAssetsAtMaturity = 0;
    this.ticketAmountAtMaturity = 0;
    this.yieldAtMaturity = 0;
    this.nextRewardShare = 0;
    this.currentYieldOnTickets = 0;
    // dates
    this.maturityDate = undefined;
    this.maturityDateISO = undefined;
    this.yearsToMaturity = undefined;
    this.currentAPYOnTickets = undefined;
    this.maturityDateMs = 0;
    // timevalues
    this.futureReward = undefined;
    this.nextReward = undefined;
    this.nextRewardProjectedFutureReward = undefined;
    this.nextRewardProjectedAPYOnTickets = undefined;
  }

  updateMaturityTimeProps(userAtFinalTimestamp, currentTimestampInMs) {
    this.maturityDate = userAtFinalTimestamp.maturityDate;
    this.maturityDateISO = userAtFinalTimestamp.maturityDateISO;
    const msToMaturity =
      userAtFinalTimestamp.maturityDateMs - currentTimestampInMs;
    this.yearsToMaturity = msToMaturity / 1000 / 60 / 60 / 24 / 365;
    this.currentAPYOnTickets =
      this.currentYieldOnTickets / this.yearsToMaturity;
  }

  redelegateTicketWithEvent(event, ticket) {
    this.tickets = this.tickets.map((t) => {
      if (t === ticket) {
        return t.cloneWith({
          commission: event.commission,
          validatorRewardAddress: event.validatorRewardAddress,
          validatorStakeAddress: event.validatorStakeAddress,
        });
      }
      return t;
    });
  }

  static fromJSON(props) {
    let next = new this();
    Object.assign(next, props);
    next.tickets = next.tickets.map((t) => UserTicket.fromJSON(t));
    return next;
  }

  cloneWith(props) {
    let next = new User();
    Object.assign(next, this);
    if (!props.tickets) {
      next.tickets = this.tickets.map((t) => t.cloneWith({}));
    }
    Object.assign(next, props);
    next.delegatorAddresses = [...next.delegatorAddresses];
    return next;
  }

  updateRewards(timestampTicketsAmountSum) {
    let totalAmount = 0;
    let totalReward = 0;
    let totalClaimableReward = 0;
    // console.log(`Calculating updateRewards commissions correctly?`);
    const tickets = this.tickets;
    const length = tickets.length;
    for (let i = 0; i < length; i++) {
      const t = tickets[i];
      const multiplier = t.mul;
      const remainingMultiplier = 1 - multiplier;
      const totalValidatorCommissions = t.calculateTotalValidatorCommissions();
      const claimableReward =
        (t.reward - totalValidatorCommissions) * multiplier;
      const remainingReward =
        remainingMultiplier * t.reward -
        remainingMultiplier * totalValidatorCommissions;
      const expectedReward = claimableReward + remainingReward;
      totalAmount += t.amount;
      totalReward += expectedReward;
      totalClaimableReward += claimableReward;
    }
    this.totalDepositedAmount = totalAmount;
    this.totalClaimableRewardsOnDepositedAssets = totalClaimableReward;
    const claimableOnWithdrawalsAndDeposits =
      this.claimableRewardsOnWithdrawnAssets +
      this.totalClaimableRewardsOnDepositedAssets;
    const claimableCommissions = this.claimableCommissions;
    this.totalClaimableCommissionsAndClaimableRewards =
      claimableOnWithdrawalsAndDeposits + claimableCommissions;
    this.totalAccruedCommissionsAndClaimableRewards =
      claimableOnWithdrawalsAndDeposits +
      this.currentTotalCommissionsOnClaimableDelegatorRewards +
      claimableCommissions;
    this.reservedReward = totalReward;
    this.nextRewardShare = totalAmount / timestampTicketsAmountSum;
  }

  updateUserMaturityDates(
    userAtPrevTimestamp,
    isAfterRewardPeriod,
    currentTimestampInMinutes,
    nextBucketGlobalReward,
    rewardProgram
  ) {
    let maturityDate = userAtPrevTimestamp.maturityDate;
    let maturityDateISO = userAtPrevTimestamp.maturityDateISO;
    let maturityDateMs = userAtPrevTimestamp.maturityDateMs;
    let maturityDateMoment;
    const config = configs[rewardProgram];
    if (
      maturityDate === undefined && // maturity date not yet reached
      isAfterRewardPeriod && // reward period is over
      this.totalClaimableRewardsOnDepositedAssets >= this.reservedReward // rewards have matured
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
      this.totalRewardsOnDepositedAssetsAtMaturity -
      this.totalClaimableRewardsOnDepositedAssets;
    this.currentYieldOnTickets =
      // likely scenario for validators (no tickets)
      this.totalDepositedAmount === 0
        ? 0
        : this.futureReward / this.totalDepositedAmount;
    this.nextReward = this.nextRewardShare * nextBucketGlobalReward;
    this.nextRewardProjectedFutureReward =
      (this.nextReward / config.EVENT_INTERVAL_MINUTES) * 60 * 24 * 365;
    this.nextRewardProjectedAPYOnTickets =
      // likely scenario for validators (no tickets)
      this.totalDepositedAmount === 0
        ? 0
        : this.nextRewardProjectedFutureReward / this.totalDepositedAmount;
  }

  updateUserMaturityRewards(userAtMaturity) {
    this.totalRewardsOnDepositedAssetsAtMaturity =
      userAtMaturity.totalClaimableRewardsOnDepositedAssets;
    this.totalAccruedCommissionsAtMaturity =
      userAtMaturity.currentTotalCommissionsOnClaimableDelegatorRewards;
    this.totalCommissionsAndRewardsAtMaturity =
      userAtMaturity.totalAccruedCommissionsAndClaimableRewards;
    this.ticketAmountAtMaturity = userAtMaturity.totalDepositedAmount;

    // to avoid NaN (serialized as `null` in JSON) as a result of `0/0`
    // and when user is a validator (with a `ticketAmountAtMaturity` of zero)
    if (this.ticketAmountAtMaturity === 0) {
      this.yieldAtMaturity = 0;
    } else {
      this.yieldAtMaturity =
        this.totalRewardsOnDepositedAssetsAtMaturity /
        this.ticketAmountAtMaturity;
    }
  }

  addTicket(ticket) {
    this.tickets = this.tickets.concat(ticket);
  }

  removeTicket(ticket) {
    this.tickets = this.tickets.filter((t) => t !== ticket);
  }

  addClaimableCommission(claimableCommission) {
    this.claimableCommissions += claimableCommission;
  }

  addForfeitedCommission(forfeitedCommission) {
    this.forfeitedCommissions += forfeitedCommission;
  }

  recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards(
    getUserByAddress = (addr) => new User(),
    userAddress
  ) {
    let total = 0;
    this.delegatorAddresses.forEach((address) => {
      const delegator = getUserByAddress(address);
      delegator.tickets.forEach((ticket) => {
        total += ticket.getClaimableCommissionRewardByValidator(userAddress);
      });
    });
    // console.error(
    //   'need to add `claimableCommissions` property for when delegator claims'
    // );
    this.currentTotalCommissionsOnClaimableDelegatorRewards = total;
  }
  // Locked, Claimable, Claimed, Dispensed

  calculateClaimableCommissionsAndAssignToValidator(
    getUserByAddress = (addr) => new User(),
    burnedTickets
  ) {
    let totalClaimableCommissions = 0;
    let totalForfeitedCommissions = 0;
    for (let ticket of burnedTickets)
      for (let validatorRewardAddress in ticket.commissionRewardsByValidator) {
        const validator = getUserByAddress(validatorRewardAddress);
        const claimableCommission =
          ticket.getClaimableCommissionRewardByValidator(
            validatorRewardAddress
          );
        const forfeitedCommission =
          ticket.getForfeitedCommissionRewardByValidator(
            validatorRewardAddress
          );
        validator.addClaimableCommission(claimableCommission);
        validator.addForfeitedCommission(forfeitedCommission);
        ticket.resetCommissionRewardsByValidator(validatorRewardAddress);
        totalClaimableCommissions += claimableCommission;
        totalForfeitedCommissions += forfeitedCommission;
      }
    return { totalClaimableCommissions, totalForfeitedCommissions };
  }

  distributeClaimedRewards(amountToDistribute) {
    const awaitingDispensation =
      this.claimedCommissionsAndRewardsAwaitingDispensation;

    if (amountToDistribute > awaitingDispensation) {
      // console.warn(
      //   `WARNING: Distributed amount: ${amountToDistribute} exceeds the user's maximum of ${awaitingDispensation}!`
      // );
      amountToDistribute = awaitingDispensation;
    }
    this.claimedCommissionsAndRewardsAwaitingDispensation -= amountToDistribute;
    this.dispensed += amountToDistribute;
  }

  claimAllCurrentCommissionsAndRewards(getUserByAddress, rewardProgram) {
    const { claimable, forfeited } = this.calculateClaimableReward(
      this.tickets
    );

    const {
      totalClaimableCommissions: totalCommissionsClaimedByValidators,
      totalForfeitedCommissions: totalCommissionsForfeitedByValidators,
    } = this.calculateClaimableCommissionsAndAssignToValidator(
      getUserByAddress,
      this.tickets
    );
    // important to set this _after_ assigning commissions to validators (for self-delegators)
    this.claimedCommissionsAndRewardsAwaitingDispensation +=
      this.claimableCommissions +
      this.claimableRewardsOnWithdrawnAssets +
      claimable -
      totalCommissionsClaimedByValidators;
    this.claimableCommissions = 0;
    this.claimableRewardsOnWithdrawnAssets = 0;
    this.tickets.forEach((t) => t.resetAfterClaim(rewardProgram));
    this.forfeited += forfeited - totalCommissionsForfeitedByValidators;
  }

  withdrawStakeAsDelegator(delegateEvent, getUserByAddress, burnedTickets) {
    if (!burnedTickets) {
      let { burnedTickets: newBurnedTickets } =
        this.removeBurnedTickets(delegateEvent);
      burnedTickets = newBurnedTickets;
    }
    const { claimable, forfeited } =
      this.calculateClaimableReward(burnedTickets);

    const {
      totalClaimableCommissions: totalCommissionsClaimedByValidators,
      totalForfeitedCommissions: totalCommissionsForfeitedByValidators,
    } = this.calculateClaimableCommissionsAndAssignToValidator(
      getUserByAddress,
      burnedTickets
    );
    this.claimableRewardsOnWithdrawnAssets +=
      claimable - totalCommissionsClaimedByValidators;
    this.forfeited += forfeited - totalCommissionsForfeitedByValidators;
  }

  calculateClaimableReward(tickets) {
    return tickets.reduce(
      (accum, ticket) => {
        const reward = ticket.reward || 0;
        const result = {
          claimable: accum.claimable + reward * ticket.mul,
          forfeited: accum.forfeited + reward * (1 - ticket.mul),
        };
        return result;
      },
      { claimable: 0, forfeited: 0 }
    );
  }

  addDelegatorAddress(delegatorSifAddress) {
    if (!this.delegatorAddresses.includes(delegatorSifAddress)) {
      this.delegatorAddresses.push(delegatorSifAddress);
    }
  }

  collectValidatorsCommissionsOnLatestUnclaimedRewards(
    getUserByAddress = (addr) => new User(),
    delegatorSifAddress
  ) {
    /*
      Need to: 
        * Loop through delegator's (`this`) tickets with validator's `validatorRewardAddress`
          * Calculate claimable reward
          * Calculate commission on reward
          * Subtract commission already claimed (`ticket#commissionRewardsClaimedByValidators`)
            * (to account for redelegation events) 
          * Add the result to `ticket#commissionRewardsClaimedByValidators`
          * Add to sum of all `ticket#commissionRewardsClaimedByValidators`'s (`validatorCommissionRewards`)
    */
    for (let ticket of this.tickets) {
      const validator = getUserByAddress(ticket.validatorRewardAddress);
      if (!validator) {
        // is LM
        continue;
      }
      let commissionOnReward = ticket.rewardDelta * ticket.commission;
      if (commissionOnReward < 0) {
        console.log('less than zero');
      }
      ticket.addCommissionRewardByValidator(
        commissionOnReward,
        ticket.validatorRewardAddress
      );
      validator.addDelegatorAddress(delegatorSifAddress);
    }
  }

  removeBurnedTickets(delegateEvent) {
    let tickets = [];
    const otherValidatorTickets = [];
    if (delegateEvent.validatorRewardAddress) {
      this.tickets.forEach((ticket) => {
        if (
          ticket.validatorRewardAddress === delegateEvent.validatorRewardAddress
        ) {
          tickets.push(ticket);
        } else {
          otherValidatorTickets.push(ticket);
        }
      });
    } else {
      tickets.push(...this.tickets);
    }
    const sortedTickets = _.sortBy(tickets, 'mul');

    // withdrawal events are identified by negative `DelegateEvent.amount` fields.
    let remainingWithdrawalAmount = Math.abs(delegateEvent.amount);
    const burnedTickets = [];
    const remainingTickets = [];
    sortedTickets.forEach((ticket) => {
      // if done withdrawing, keep the ticket
      if (remainingWithdrawalAmount === 0) {
        remainingTickets.push(ticket);
        return;
      }
      const amountToRemove = Math.min(remainingWithdrawalAmount, ticket.amount);

      const { burnedTicket, remainderTicket, hasRemainder } =
        ticket.burn(amountToRemove);

      burnedTickets.push(burnedTicket);
      remainingWithdrawalAmount -= amountToRemove;

      // if done withdrawing and ticket has remaining balance
      if (remainingWithdrawalAmount === 0 && hasRemainder) {
        remainingTickets.push(remainderTicket);
      }
    });
    this.tickets = otherValidatorTickets.concat(remainingTickets);
    return { burnedTickets, remainder: remainingWithdrawalAmount };
  }
}
module.exports = { User };