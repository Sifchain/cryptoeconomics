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
      tickets: user.tickets.map(ticket => {
        const additionalAmount =
          (ticket.amount / (totalShares || 1)) * globalRewardAccrued;
        return ticket.cloneWith({
          mul: Math.min(ticket.mul + 0.75 / MULTIPLIER_MATURITY, 1),
          reward: ticket.reward + additionalAmount
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

      // Is deposit (adding funds)
      if (event.amount > 0) {
        // is this really proof of redelegation?
        // or just a probable scenario during redelegation?
        const isRedelegation =
          userEvents.length > 1 &&
          userEvents.some(other => {
            return other.amount === -event.amount;
          });

        const isAfterDepositsAreAllowed =
          event.timestamp > config.DEPOSITS_ALLOWED_DURATION_MS / 1000 / 60;

        if (!isRedelegation && isAfterDepositsAreAllowed) {
          return;
        }
        const redelegatedTicket = isRedelegation
          ? previousTickets.find(t => t.amount === event.amount)
          : false;

        const newTicket = UserTicket.fromEvent(
          event,
          redelegatedTicket ? redelegatedTicket.mul : 0.25
        );
        user.addTicket(newTicket);
      }

      // Collect commission before tickets can be altered by withdrawal
      user.collectValidatorCommissionOnLatestUnclaimedRewards(
        event,
        validator,
        previousTickets
      );

      // Withdrawing funds
      if (event.amount < 0) {
        user.withdrawStakeAsDelegator(event, validator);
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
      //   validator.claimableCommissionsOnDelegatorRewards +=
      //     claimed * event.commission;
      //   user.forfeited += forfeited;
      //   user.tickets = resetTickets(user.tickets);
      // }
    });
  });
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
