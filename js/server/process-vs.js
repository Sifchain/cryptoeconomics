const _ = require("lodash");
const moment = require("moment");
const { START_DATETIME, MULTIPLIER_MATURITY } = require("./config");

const { processRewardBuckets } = require("./util/bucket-util");

function processVSGlobalState(lastGlobalState, timestamp, eventsByUser) {
  const { rewardBuckets, globalRewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent
  );
  let users = processUserTickets(lastGlobalState.users, globalRewardAccrued);
  users = processUserEvents(users, eventsByUser);
  debugger;
  return {
    timestamp,
    rewardBuckets,
    users,
  };
}

function processUserTickets(users, globalRewardAccrued) {
  // process reward accruals and multiplier updates
  const totalShares = _.sum(
    _.flatten(
      _.map(users, (user, address) => {
        return user.tickets.map((ticket) => ticket.amount);
      })
    )
  );
  const updatedUsers = _.mapValues(users, (user) => {
    return {
      ...user,
      tickets: user.tickets.map((ticket) => {
        const additionalAmount =
          (ticket.amount / (totalShares || 1)) * globalRewardAccrued;
        return {
          ...ticket,
          mul: Math.min(ticket.mul + 0.75 / MULTIPLIER_MATURITY, 1),
          reward: ticket.reward + additionalAmount,
        };
      }),
    };
  });
  return updatedUsers;
}

function processUserEvents(users, eventsByUser) {
  _.forEach(eventsByUser, (userEvents) => {
    userEvents.forEach((event) => {
      const user = users[event.delegateAddress] || {
        tickets: [],
        claimed: 0,
        dispensed: 0,
        forfeited: 0,
      };
      users[event.delegateAddress] = user;
      const validator = users[event.valSifAddress] || {
        tickets: [],
        claimed: 0,
        dispensed: 0,
        forfeited: 0,
      };
      users[event.valSifAddress] = validator;
      validator.commisionClaimed = validator.commisionClaimed || 0;
      if (event.amount > 0) {
        const newTicket = {
          commision: event.commision,
          valSifAddress: event.valSifAddress,
          amount: event.amount,
          mul: 0.25,
          reward: 0,
          timestamp: moment
            .utc(START_DATETIME)
            .add(event.timestamp, "m")
            .format("MMMM Do YYYY, h:mm:ss a"),
        };
        user.tickets = user.tickets.concat(newTicket);
      } else if (event.amount < 0) {
        const thisValTickets = user.tickets.filter(
          (ticket) => ticket.valSifAddress === event.valSifAddress
        );
        const otherValTickets = user.tickets.filter(
          (ticket) => ticket.valSifAddress !== event.valSifAddress
        );
        const burnResult = burnTickets(-event.amount, thisValTickets);
        const burnedThisValTickets = burnResult.burnedTickets;
        const remainingThisValTickets = burnResult.remainingTickets;
        const { claimed, forfeited } = calculateClaimReward(
          burnedThisValTickets
        );
        user.claimed += claimed * (1 - event.commision);
        validator.claimed += claimed * event.commision;
        validator.commisionClaimed += claimed * event.commision;
        user.forfeited += forfeited;
        user.tickets = otherValTickets.concat(remainingThisValTickets);
      }
      if (event.claim) {
        const { claimed, forfeited } = calculateClaimReward(user.tickets);
        user.claimed += claimed * (1 - event.commision);
        validator.claimed += claimed * event.commision;
        validator.commisionClaimed += claimed * event.commision;
        user.forfeited += forfeited;
        user.tickets = resetTickets(user.tickets);
      }
    });
  });
  return users;
}

function burnTickets(amount, tickets) {
  const sortedTickets = _.sortBy(tickets, "mul");

  let amountLeft = amount;
  const burnedTickets = [];
  const remainingTickets = [];
  sortedTickets.forEach((ticket) => {
    if (amountLeft === 0) {
      remainingTickets.push(ticket);
      return;
    }
    let amountToRemove = Math.min(amountLeft, ticket.amount);
    const proportionBurned =
      ticket.amount === 0
        ? 0
        : parseFloat(amountToRemove) / parseFloat(ticket.amount);
    const burnedTicket = {
      ...ticket,
      amount: amountToRemove,
      reward: proportionBurned * parseFloat(ticket.reward || 0),
    };
    burnedTickets.push(burnedTicket);
    amountLeft = amountLeft - amountToRemove;
    if (amountLeft === 0) {
      const remainingTicket = {
        ...ticket,
        amount: ticket.amount - amountToRemove,
        reward: (1 - proportionBurned) * parseFloat(ticket.reward || 0),
      };
      remainingTickets.push(remainingTicket);
    }
  });
  return { burnedTickets, remainingTickets };
}

function calculateClaimReward(tickets) {
  return tickets.reduce(
    (accum, ticket) => {
      const forefeitedMultiplier = 1 - ticket.mul;
      const reward = ticket.reward || 0;
      const result = {
        claimed: accum.claimed + reward * ticket.mul,
        forfeited: accum.forfeited + reward * forefeitedMultiplier,
      };
      return result;
    },
    { claimed: 0, forfeited: 0 }
  );
}

function resetTickets(tickets) {
  return tickets.map((ticket) => ({
    ...ticket,
    mul: 0,
    reward: 0,
  }));
}

module.exports = {
  processVSGlobalState,
};
