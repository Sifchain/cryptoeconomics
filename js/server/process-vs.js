const _ = require('lodash');
const { MULTIPLIER_MATURITY } = require('./config');
const { processRewardBuckets } = require('./util/bucket-util');
const config = require('./config');
const { User, GlobalTimestampState, UserTicket } = require('./types');

/*
  Filter out deposit events after config.DEPOSIT_CUTOFF_DATETIME,
  but continue accruing rewards until config.END_OF_REWARD_ACCRUAL_DATETIME
*/
function processVSGlobalState (lastGlobalState, timestamp, eventsByUser) {
  const { rewardBuckets, globalRewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent
  );
  let users = processUserTickets(lastGlobalState.users, globalRewardAccrued);
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

function processUserTickets (users, globalRewardAccrued) {
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
          poolDominanceRatio
        });
      })
    });
  });
  return updatedUsers;
}

function processUserEvents (users, eventsByUser) {
  _.forEach(eventsByUser, userEvents => {
    const previousUser =
      userEvents.length > 0 && users[userEvents[0].delegateAddress];

    const previousTickets = previousUser ? previousUser.tickets : [];

    userEvents.forEach(event => {
      // find or create user/delegator
      const user = users[event.delegateAddress] || new User();
      users[event.delegateAddress] = user;

      // find or create validator
      const validator = users[event.validatorSifAddress] || new User();
      users[event.validatorSifAddress] = validator;

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
      validatorSifAddress => {
        return users[validatorSifAddress];
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
