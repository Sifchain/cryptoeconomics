const _ = require('lodash');
const moment = require('moment');
const {
  START_DATETIME,
  MULTIPLIER_MATURITY,
  DEPOSITS_ALLOWED_DURATION_MS
} = require('./config');
const { GlobalTimestampState, User } = require('./types');
const { processRewardBuckets } = require('./util/bucket-util');

function processLMGlobalState (lastGlobalState, timestamp, events) {
  const { rewardBuckets, globalRewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent
  );
  let users = processUserTickets(lastGlobalState.users, globalRewardAccrued);
  users = processUserEvents(users, events);
  let globalState = new GlobalTimestampState();
  globalState.timestamp = timestamp;
  globalState.rewardBuckets = rewardBuckets;
  globalState.users = users;
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
    return {
      ...user,
      tickets: user.tickets.map(ticket => {
        const additionalAmount =
          (ticket.amount / (totalShares || 1)) * globalRewardAccrued;
        return {
          ...ticket,
          mul: Math.min(ticket.mul + 0.75 / MULTIPLIER_MATURITY, 1),
          reward: ticket.reward + additionalAmount
        };
      })
    };
  });
  return updatedUsers;
}

function processUserEvents (users, events) {
  events.forEach(event => {
    const user = users[event.address] || new User();
    if (event.amount > 0) {
      if (
        // is after deposits are allowed
        event.timestamp >
        DEPOSITS_ALLOWED_DURATION_MS / 1000 / 60
      ) {
        // skip
        return;
      }
      const newTicket = {
        amount: event.amount,
        mul: 0.25,
        reward: 0,
        timestamp: moment
          .utc(START_DATETIME)
          .add(event.timestamp, 'm')
          .format('MMMM Do YYYY, h:mm:ss a')
      };
      user.tickets = user.tickets.concat(newTicket);
    } else if (event.amount < 0) {
      const { burnedTickets, remainingTickets } = burnTickets(
        -event.amount,
        user.tickets
      );
      const { claimed, forfeited } = calculateClaimReward(burnedTickets);
      user.claimableRewardsOnWithdrawnAssets += claimed;
      user.forfeited += forfeited;
      user.tickets = remainingTickets;
    }
    if (event.claim) {
      const { claimed, forfeited } = calculateClaimReward(user.tickets);
      user.claimableRewardsOnWithdrawnAssets += claimed;
      user.forfeited += forfeited;
      user.tickets = resetTickets(user.tickets);
    }
    users[event.address] = user;
  });
  return users;
}

function burnTickets (amount, tickets) {
  const sortedTickets = _.sortBy(tickets, 'mul');

  let amountLeft = amount;
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
    const burnedTicket = {
      ...ticket,
      amount: amountToRemove,
      reward: proportionBurned * parseFloat(ticket.reward || 0)
    };
    burnedTickets.push(burnedTicket);
    amountLeft = amountLeft - amountToRemove;
    if (amountLeft === 0) {
      const remainingTicket = {
        ...ticket,
        amount: ticket.amount - amountToRemove,
        reward: (1 - proportionBurned) * parseFloat(ticket.reward || 0)
      };
      remainingTickets.push(remainingTicket);
    }
  });
  return { burnedTickets, remainingTickets };
}

function calculateClaimReward (tickets) {
  return tickets.reduce(
    (accum, ticket) => {
      const forefeitedMultiplier = 1 - ticket.mul;
      const reward = ticket.reward || 0;
      const result = {
        claimed: accum.claimed + reward * ticket.mul,
        forfeited: accum.forfeited + reward * forefeitedMultiplier
      };
      return result;
    },
    { claimed: 0, forfeited: 0 }
  );
}

function resetTickets (tickets) {
  return tickets.map(ticket => ({
    ...ticket,
    mul: 0,
    reward: 0
  }));
}

module.exports = {
  processLMGlobalState
};
