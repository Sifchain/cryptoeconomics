const _ = require('lodash');
const { MULTIPLIER_MATURITY } = require('./config');
const { processRewardBuckets } = require('./util/bucket-util');
const config = require('./config');
const { User, GlobalTimestampState, UserTicket } = require('./types');
const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING
} = require('./constants/reward-program-types');

/*
  Filter out deposit events after config.DEPOSIT_CUTOFF_DATETIME,
  but continue accruing rewards until config.END_OF_REWARD_ACCRUAL_DATETIME
*/
function processVSGlobalState (
  lastGlobalState,
  timestamp,
  eventsByUser,
  getCurrentCommissionRateByValidatorStakeAddress,
  rewardProgramType = VALIDATOR_STAKING
) {
  const { rewardBuckets, globalRewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent
  );

  let users = processUserTickets(
    lastGlobalState.users,
    globalRewardAccrued,
    getCurrentCommissionRateByValidatorStakeAddress
  );
  users = processUserEvents(users, eventsByUser, rewardProgramType);
  if (rewardProgramType === VALIDATOR_STAKING) {
    users = calculateUserCommissions(users);
  }
  let globalState = new GlobalTimestampState();
  Object.assign(globalState, {
    timestamp,
    rewardBuckets,
    users
  });
  return globalState;
}

function processUserTickets (
  users,
  globalRewardAccrued,
  getCurrentCommissionRateByValidatorStakeAddress
) {
  // process reward accruals and multiplier updates
  const totalShares = _.sum(
    _.flatten(
      _.map(users, (user, address) => {
        return user.tickets.map(ticket => ticket.amount);
      })
    )
  );
  const updatedUsers = _.mapValues(users, user => {
    return user.cloneWith({
      // reset each round because this is both incrementally calculated and based upon multiplier
      currentTotalCommissionsOnClaimableDelegatorRewards: 0,
      tickets: user.tickets.map(ticket => {
        const poolDominanceRatio = ticket.amount / (totalShares || 1);
        const rewardDelta = poolDominanceRatio * globalRewardAccrued;
        return ticket.cloneWith({
          mul: Math.min(ticket.mul + 0.75 / MULTIPLIER_MATURITY, 1),
          reward: ticket.reward + rewardDelta,
          rewardDelta: rewardDelta,
          poolDominanceRatio,
          commission: getCurrentCommissionRateByValidatorStakeAddress(
            ticket.validatorStakeAddress
          )
        });
      })
    });
  });
  return updatedUsers;
}

/* 
  Real-World Example: (Adds deposit, creating 1 ticket, then redelegates all 3 tickets to new validator) 
    https://blockexplorer.sifchain.finance/account/sif1zfxa20g8j2hqhxencyqtfhd95wvxsnen08pw97
*/
function processUserEvents (
  users,
  eventsByUser,
  rewardProgramType = VALIDATOR_STAKING
) {
  const getUserByAddress = address => {
    const user = users[address] || new User();
    users[address] = user;
    return user;
  };
  switch (rewardProgramType) {
    case VALIDATOR_STAKING: {
      _.forEach(eventsByUser, userEvents => {
        if (userEvents.length > 1) {
          processRedelegationEvents(userEvents, getUserByAddress);
        } else {
          processAccountEvents(userEvents, getUserByAddress);
        }
      });
      break;
    }
    case LIQUIDITY_MINING: {
      _.forEach(eventsByUser, userEvents => {
        processAccountEvents(userEvents, getUserByAddress);
      });
      break;
    }
  }
  return users;
}

function processAccountEvents (userEvents, getUserByAddress) {
  for (let uEvent of userEvents) {
    const user = getUserByAddress(uEvent.delegateAddress);
    if (uEvent.amount < 0) {
      user.withdrawStakeAsDelegator(uEvent, getUserByAddress);
    } else if (uEvent.amount > 0) {
      user.addTicket(UserTicket.fromEvent(uEvent));
    }
  }
}

function processRedelegationEvents (userEvents, getUserByAddress) {
  userEvents = _.orderBy(userEvents, ['amount'], ['asc']);
  let withdrawalAmount = 0;
  let depositAmount = 0;
  const withdrawalEvents = [];
  const depositEvents = [];
  for (let uEvent of userEvents) {
    if (uEvent.amount < 0) {
      withdrawalAmount += Math.abs(uEvent.amount);
      withdrawalEvents.push(uEvent);
    }
    if (uEvent.amount > 0) {
      depositAmount += Math.abs(uEvent.amount);
      depositEvents.push(uEvent);
    }
  }

  let ticketsToRedelegate = [];

  let amountToRedelegate = Math.min(depositAmount, withdrawalAmount);
  for (let wEvent of withdrawalEvents) {
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
        amount: amountOfWithdrawalToRedelegate
      });
      const {
        burnedTickets: burnedTicketsForRedelegation
      } = user.removeBurnedTickets(redelegateWithdrawalEvent);
      ticketsToRedelegate.push(...burnedTicketsForRedelegation);
    }
    if (amountOfWithdrawalToWithdraw !== 0) {
      const traditionalWithdrawalEvent = wEvent.cloneWith({
        amount: amountOfWithdrawalToWithdraw
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
  const sortedDepositEvents = _.sortBy(depositEvents, event => {
    return event.commission;
  });
  ticketsToRedelegate = _.sortBy(ticketsToRedelegate, t => {
    const remainingReward =
      (t.reward - t.calculateTotalValidatorCommissions()) * (1 - t.mul);
    const remainingRatio = remainingReward / t.reward;
    // make negative to sort in descending order
    return -remainingRatio;
  });
  for (let dEvent of sortedDepositEvents) {
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
      const {
        burnedTicket,
        remainderTicket,
        hasRemainder
      } = redelegatedTicket.burn(amountToRemove);
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
            amount: amountToDeposit
          })
        )
      );
    }
  }
}

function calculateUserCommissions (users) {
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
      validatorRewardAddress => {
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
      address => users[address],
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
  processVSGlobalState
};
