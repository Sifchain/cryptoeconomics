const _ = require('lodash');
const configs = require('../../config');
const { processRewardBuckets } = require('./bucket-util');
const {
  User,
  GlobalTimestampState,
  UserTicket,
  DelegateEvent,
} = require('../types');
const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING,
} = require('../../constants/reward-program-types');
const lmHarvestHardResetState = require('../../scripts/harvest-exit-states.json');
const { getTimeIndex } = require('../../util/getTimeIndex');

/*
  Filter out deposit events after config.DEPOSIT_CUTOFF_DATETIME,
  but continue accruing rewards until config.END_OF_REWARD_ACCRUAL_DATETIME
*/
function processVSGlobalState(
  lastGlobalState,
  timestamp,
  eventsByUser,
  getCurrentCommissionRateByValidatorStakeAddress,
  rewardProgramType = VALIDATOR_STAKING,
  isSimulatedFutureInterval,
  claimEventsByUser,
  dispensationEventsByUser,
  rewardProgram
) {
  const {
    MULTIPLIER_MATURITY,
    NUMBER_OF_INTERVALS_TO_RUN,
    EVENT_INTERVAL_MINUTES,
  } = configs[rewardProgram];
  const { rewardBuckets, globalRewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent,
    rewardProgram
  );

  // console.time('processUserTickets');
  let users = processUserTickets(
    lastGlobalState,
    globalRewardAccrued,
    getCurrentCommissionRateByValidatorStakeAddress,
    rewardProgramType,
    isSimulatedFutureInterval,
    rewardProgram
  );
  // if (
  //   lmHarvestHardResetState.rewardProgram === rewardProgram &&
  //   lastGlobalState.timestamp ===
  //     (getTimeIndex(new Date(lmHarvestHardResetState.date), rewardProgram) +
  //       1) *
  //       configs[rewardProgram].EVENT_INTERVAL_MINUTES
  // ) {
  //   // for (let addr in users) {
  //   //   const userState = lmHarvestHardResetState.balances[addr];
  //   //   if (!userState) continue;
  //   //   users[addr] = User.fromJSON({
  //   //     dispensed: userState.dispensed,
  //   //     claimedCommissionsAndRewardsAwaitingDispensation: userState.claimed,
  //   //     totalAccruedCommissionsAndClaimableRewards: userState.accrued,
  //   //     totalClaimableRewardsOnWithdrawnAssets: userState.accrued,
  //   //     forfeited: userState.forfeited,
  //   //     tickets: [
  //   //       UserTicket.fromEvent(
  //   //         DelegateEvent.fromJSON({
  //   //           timestamp: lastGlobalState.timestamp,
  //   //           delegateAddress: addr,
  //   //           amount: userState.accrued,
  //   //         }),
  //   //         rewardProgram
  //   //       ),
  //   //     ],
  //   //   });
  //   // }
  // }
  const autoclaimTimeIndex = getTimeIndex(
    `2021-11-19T17:10:46.096Z`,
    rewardProgram
  );
  users = processUserClaims(users, claimEventsByUser, rewardProgram);
  const i = timestamp / EVENT_INTERVAL_MINUTES;
  if (i === autoclaimTimeIndex || i === NUMBER_OF_INTERVALS_TO_RUN) {
    for (let address in lastGlobalState.users) {
      const getUserByAddress = (address) => {
        return lastGlobalState.users[address];
      };
      lastGlobalState.users[address].claimAllCurrentCommissionsAndRewards(
        getUserByAddress,
        rewardProgram
      );
    }
  }
  users = processUserDispensations(users, dispensationEventsByUser);
  users = processUserEvents(
    users,
    eventsByUser,
    rewardProgramType,
    rewardProgram
  );

  if (rewardProgramType === VALIDATOR_STAKING) {
    users = calculateUserCommissions(users);
  }
  let globalState = new GlobalTimestampState();
  Object.assign(globalState, {
    timestamp,
    rewardBuckets,
    users,
  });
  if (isSimulatedFutureInterval) {
    globalState.markAsSimulated();
  }
  // console.time('processUserRewards');
  processUserRewards(globalState);
  // console.timeEnd('processUserRewards');
  return globalState;
}

function processUserClaims(users, claimEventsByUser, rewardProgram) {
  const getUserByAddress = (address) => {
    const user = users[address] || new User();
    users[address] = user;
    return user;
  };
  for (const address in claimEventsByUser) {
    const didClaim = claimEventsByUser[address];
    if (!didClaim) {
      continue;
    }
    const user = getUserByAddress(address);
    user.claimAllCurrentCommissionsAndRewards(getUserByAddress, rewardProgram);
  }
  return users;
}

function processUserDispensations(users, dispensationEventsByUser) {
  const getUserByAddress = (address) => {
    const user = users[address] || new User();
    users[address] = user;
    return user;
  };
  for (const address in dispensationEventsByUser) {
    const amountToDistribute = dispensationEventsByUser[address];
    if (amountToDistribute === 0) {
      continue;
    }

    const user = getUserByAddress(address);
    if (amountToDistribute > 0) {
      user.distributeClaimedRewards(amountToDistribute);
    }
  }
  return users;
}

function processUserRewards(state) {
  const timestampTicketsAmountSum = state.updateTotalDepositedAmount();
  // can be lazy evaluated
  _.forEach(state.users, (user) => {
    /*
        Must be run on every user before `User#updateUserMaturityRewards`
        `User#updateUserMaturityRewards` uses the rewards calulated here.
        Must be run after `User#recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards`
        because `User#updateRewards` uses `User.currentTotalCommissionsOnClaimableDelegatorRewards`,
        which is calculated in the former method.
      */
    user.updateRewards(timestampTicketsAmountSum);
  });
}
const prevUserRewardsByProgramType = {
  [VALIDATOR_STAKING]: {},
  [LIQUIDITY_MINING]: {},
};
function processUserTickets(
  lastGlobalState,
  globalRewardAccrued,
  getCurrentCommissionRateByValidatorStakeAddress,
  rewardProgramType,
  isSimulatedFutureInterval,
  rewardProgram
) {
  const { MULTIPLIER_MATURITY } = configs[rewardProgram];
  const users = lastGlobalState.users;
  const lastStateWasPending = lastGlobalState.isPending;
  const lastStateWasSimulated = lastGlobalState.isSimulated;
  // process reward accruals and multiplier updates
  let totalShares = 0;
  for (let addr in users) {
    users[addr].tickets.forEach((t) => {
      totalShares += t.amount;
    });
  }
  const prevUserRewards = prevUserRewardsByProgramType[rewardProgramType];
  const updatedUsers = _.mapValues(users, (user, address) => {
    // Don't deep clone users whose rewards can no longer change
    const rewardSynopsis =
      user.totalClaimableCommissionsAndClaimableRewards +
      user.totalAccruedCommissionsAndClaimableRewards +
      user.claimedCommissionsAndRewardsAwaitingDispensation +
      user.dispensed;
    if (
      !lastStateWasPending &&
      lastStateWasSimulated &&
      isSimulatedFutureInterval &&
      prevUserRewards[address] === rewardSynopsis
    ) {
      // skip cloning
      return user;
    }
    prevUserRewards[address] = rewardSynopsis;
    return user.cloneWith({
      // reset each round because this is both incrementally calculated and based upon multiplier
      currentTotalCommissionsOnClaimableDelegatorRewards: 0,
      tickets: user.tickets.map((ticket) => {
        const poolDominanceRatio = ticket.amount / (totalShares || 1);
        const rewardDelta = poolDominanceRatio * globalRewardAccrued;
        const nextMul = ticket.mul + 0.75 / MULTIPLIER_MATURITY;
        return ticket.cloneWith({
          mul: nextMul < 1 ? nextMul : 1,
          reward: ticket.reward + rewardDelta,
          rewardDelta: rewardDelta,
          poolDominanceRatio,
          commission: getCurrentCommissionRateByValidatorStakeAddress(
            ticket.validatorStakeAddress
          ),
        });
      }),
    });
  });
  return updatedUsers;
}

/* 
  Real-World Example: (Adds deposit, creating 1 ticket, then redelegates all 3 tickets to new validator) 
    https://blockexplorer.sifchain.finance/account/sif1zfxa20g8j2hqhxencyqtfhd95wvxsnen08pw97
*/
function processUserEvents(
  users,
  eventsByUser,
  rewardProgramType = VALIDATOR_STAKING,
  rewardProgram
) {
  const getUserByAddress = (address) => {
    let user = users[address];
    if (!user) {
      user = new User();
      users[address] = user;
    }
    return user;
  };
  switch (rewardProgramType) {
    case VALIDATOR_STAKING: {
      _.forEach(eventsByUser, (userEvents, address) => {
        if (userEvents.length > 1) {
          processRedelegationEvents(
            userEvents,
            getUserByAddress,
            rewardProgram
          );
        } else {
          processAccountEvents(userEvents, getUserByAddress, rewardProgram);
        }
      });
      break;
    }
    case LIQUIDITY_MINING: {
      _.forEach(eventsByUser, (userEvents) => {
        processAccountEvents(userEvents, getUserByAddress, rewardProgram);
      });
      break;
    }
  }
  return users;
}

function processAccountEvents(userEvents, getUserByAddress, rewardProgram) {
  const len = userEvents.length;
  for (let i = 0; i < len; i++) {
    const uEvent = userEvents[i];
    const user = getUserByAddress(uEvent.delegateAddress);
    if (uEvent.amount < 0) {
      user.withdrawStakeAsDelegator(uEvent, getUserByAddress);
    } else if (uEvent.amount > 0) {
      user.addTicket(UserTicket.fromEvent(uEvent, rewardProgram));
    }
  }
}

function processRedelegationEvents(
  userEvents,
  getUserByAddress,
  rewardProgram
) {
  const config = configs[rewardProgram];
  userEvents = _.orderBy(userEvents, ['amount'], ['asc']);
  let withdrawalAmount = 0;
  let depositAmount = 0;
  const withdrawalEvents = [];
  const depositEvents = [];

  let uELen = userEvents.length;
  for (let i = 0; i < uELen; i++) {
    const uEvent = userEvents[i];
    if (uEvent.amount < 0) {
      // turn amount to positive and add
      withdrawalAmount += -uEvent.amount;
      withdrawalEvents.push(uEvent);
    }
    if (uEvent.amount > 0) {
      depositAmount += uEvent.amount;
      depositEvents.push(uEvent);
    }
  }

  let ticketsToRedelegate = [];

  let amountToRedelegate = Math.min(depositAmount, withdrawalAmount);
  const wELen = withdrawalEvents.length;
  for (let i = 0; i < wELen; i++) {
    const wEvent = withdrawalEvents[i];
    const user = getUserByAddress(wEvent.delegateAddress);
    const amountOfWithdrawalToRedelegate = Math.max(
      -amountToRedelegate,
      wEvent.amount
    );
    amountToRedelegate -= Math.abs(amountOfWithdrawalToRedelegate);
    const amountOfWithdrawalToWithdraw =
      wEvent.amount - amountOfWithdrawalToRedelegate;

    if (amountOfWithdrawalToRedelegate !== 0) {
      const redelegateWithdrawalEvent = wEvent.cloneWith({
        amount: amountOfWithdrawalToRedelegate,
      });
      const { burnedTickets: burnedTicketsForRedelegation } =
        user.removeBurnedTickets(redelegateWithdrawalEvent);
      ticketsToRedelegate.push(...burnedTicketsForRedelegation);
    }
    if (amountOfWithdrawalToWithdraw !== 0) {
      const traditionalWithdrawalEvent = wEvent.cloneWith({
        amount: amountOfWithdrawalToWithdraw,
      });
      user.withdrawStakeAsDelegator(
        traditionalWithdrawalEvent,
        getUserByAddress
      );
    }
  }

  /* 
    Match the tickets with the highest remaining rewards
    with the validators with the lowest commissions to maximize 
    their gains over time.
  */
  const sortedDepositEvents = _.sortBy(depositEvents, (event) => {
    return event.commission;
  });
  ticketsToRedelegate = _.sortBy(ticketsToRedelegate, (t) => {
    const remainingReward =
      (t.reward - t.calculateTotalValidatorCommissions()) * (1 - t.mul);
    const remainingRatio = remainingReward / t.reward;
    // make negative to sort in descending order
    return -remainingRatio;
  });
  for (let i = 0; i < sortedDepositEvents.length; i++) {
    const dEvent = sortedDepositEvents[i];
    const user = getUserByAddress(dEvent.delegateAddress);
    let nextTicketsToRedelegate = [];
    let amountToDeposit = dEvent.amount;
    for (let redelegatedTicket of ticketsToRedelegate) {
      if (amountToDeposit === 0) {
        nextTicketsToRedelegate.push(redelegatedTicket);
        continue;
      }
      const amountToRemove = Math.min(
        redelegatedTicket.amount,
        amountToDeposit
      );
      amountToDeposit -= amountToRemove;
      const { burnedTicket, remainderTicket, hasRemainder } =
        redelegatedTicket.burn(amountToRemove);
      user.addTicket(burnedTicket.cloneAndRedelegateFromEvent(dEvent));
      if (hasRemainder) {
        nextTicketsToRedelegate.push(remainderTicket);
      }
    }
    ticketsToRedelegate = nextTicketsToRedelegate;
    const isAfterDepositsAreAllowed =
      dEvent.timestamp > config.DEPOSITS_ALLOWED_DURATION_MS / 1000 / 60;
    if (amountToDeposit > 0 && !isAfterDepositsAreAllowed) {
      user.addTicket(
        UserTicket.fromEvent(
          dEvent.cloneWith({
            amount: amountToDeposit,
          }),
          rewardProgram
        )
      );
    }
  }
}

function calculateUserCommissions(users) {
  for (let addr in users) {
    /*
        Must be run first on every user because delegators
        store validators' addresses as references (and vice-versa) to be used in
        `User(Validator)#recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards`
        via the user getter function passed as a callback.

        If `User#recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards` is run
        immediately after this, within this loop iteration, it will only
        account for delegate rewards on delegates that were processed before it
        and leave out all those processed after.
      */
    users[addr].collectValidatorsCommissionsOnLatestUnclaimedRewards(
      (validatorRewardAddress) => {
        return users[validatorRewardAddress];
      },
      addr
    );
  }
  for (let addr in users) {
    /*
        used to calculate ROI stats (APY, yield, etc.)
        in `User#updateRewards`
      */
    users[addr].recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards(
      (address) => users[address],
      addr
    );
  }
  return users;
}

// function resetTickets(tickets) {
//   return tickets.map((ticket) =>
//     ticket.cloneWith({
//       mul: 0,
//       reward: 0,
//     })
//   );
// }

module.exports = {
  processVSGlobalState,
};