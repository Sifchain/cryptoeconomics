const _ = require('lodash');
const { MULTIPLIER_MATURITY } = require('./config');
const { processRewardBuckets } = require('./util/bucket-util');
const config = require('./config');
const { User, GlobalTimestampState, UserTicket } = require('./types');

/*
  Filter out deposit events after config.DEPOSIT_CUTOFF_DATETIME,
  but continue accruing rewards until config.END_OF_REWARD_ACCRUAL_DATETIME
*/
function processVSGlobalState (
  lastGlobalState,
  timestamp,
  eventsByUser,
  getCurrentCommissionRateByValidatorStakeAddress
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
  users = processUserEvents(users, eventsByUser);
  users = calculateUserCommissions(users);
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
  Determine redelegation by if the absolute value of the sum 
  of all withdrawal event amounts is equal to the amount of 
  one deposit event.

  Example 1.
    -1, -4, +5 

  Example 2.
    -1, -1, -1, +2, -2, +5 

  Warning: This too is problematic because it does not handle edge cases.
  Could instead filter by only including negative amount events where a 
  corresponding ticket exist, but this might not include withdrawals made
  on desposits within the event series. Need to debug.

  Real-World Example: (Adds deposit, creating 1 ticket, then redelegates all 3 tickets to new validator) 
    https://blockexplorer.sifchain.finance/account/sif1zfxa20g8j2hqhxencyqtfhd95wvxsnen08pw97
*/
// function checkForBulkRedelegation(userEvents) {
//   let sumOfNegativeEvents = 0;
//   for (let event of userEvents) {
//     if (event.amount < 0) {
//       sumOfNegativeEvents += event.amount;
//     }
//   }
//   sumOfNegativeEvents = Math.abs(sumOfNegativeEvents);
//   for (let event of userEvents) {
//     if (event.amount === sumOfNegativeEvents) {
//       return true;
//     }
//   }
//   return false;
// }

function processUserEvents (users, eventsByUser) {
  _.forEach(eventsByUser, userEvents => {
    // const burnedThisValTickets = this.removeBurnedTickets(delegateEvent);

    const previousUser =
      userEvents.length > 0 && users[userEvents[0].delegateAddress];
    const previousTickets = previousUser ? previousUser.tickets : [];

    userEvents.forEach(event => {
      // const isBulkRedelegation = checkForBulkRedelegation(userEvents);
      // find or create user/delegator
      const user = users[event.delegateAddress] || new User();
      users[event.delegateAddress] = user;
      // find or create validator
      const validator = users[event.validatorRewardAddress] || new User();
      users[event.validatorRewardAddress] = validator;

      // is this really proof of redelegation?
      // or just a probable scenario during redelegation?
      const isRedelegation =
        userEvents.length > 1 &&
        userEvents.some(other => {
          return other.amount === -event.amount;
        });

      // Is deposit (adding funds)
      if (event.amount > 0) {
        const redelegatedTicket = isRedelegation
          ? previousTickets.find(t => t.amount === event.amount)
          : false;
        const isAfterDepositsAreAllowed =
          event.timestamp > config.DEPOSITS_ALLOWED_DURATION_MS / 1000 / 60;

        if (!isRedelegation && isAfterDepositsAreAllowed) {
          // nada
        } else {
          if (isRedelegation && !!redelegatedTicket) {
            user.redelegateTicketWithEvent(event, redelegatedTicket);
          } else {
            // need to clone previous ticket instead to maintain
            const newTicket = UserTicket.fromEvent(event);
            user.addTicket(newTicket);
          }
        }
      }

      // Withdrawing funds
      if (event.amount < 0) {
        if (isRedelegation) {
          // nada
        } else {
          user.withdrawStakeAsDelegator(event, address => {
            const validator = users[address] || new User();
            users[address] = validator;
            return validator;
          });
        }
      }

      /* 
          Never reached in debug. What does this do?
          Probably for future integration w / claims api ?
      */
      // if (event.claim) {
      //   const { claimed, forfeited } = calculateClaimReward(user.tickets);
      //   user.claimableRewardsOnWithdrawnAssets +=
      //     claimed * (1 - event.commission);
      //   validator.claimableRewardsOnWithdrawnAssets +=
      //     claimed * event.commission;
      //   validator.currentTotalCommissionsOnClaimableDelegatorRewards +=
      //     claimed * event.commission;
      //   user.forfeited += forfeited;
      //   user.tickets = resetTickets(user.tickets);
      // }
    });
  });
  return users;
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
