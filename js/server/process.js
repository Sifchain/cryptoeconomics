_ = require("lodash")
const { parseData } = require('./dataParsed')

const { remapAddresses } = require("./util");
const { TIME_INTERVAL, NUMBER_OF_INTERVALS_TO_RUN, MULTIPLIER_MATURITY, STARTING_GLOBAL_STATE } = require("./config");

const snapshot = require("../snapshots/snapshot_start_until_mid_april_fixed.json");

const addresses = snapshot.data.snapshots_new[0].snapshot_data

const timeIntervalEvents = remapAddresses(addresses, TIME_INTERVAL)

const globalStates = [STARTING_GLOBAL_STATE]
for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
  const lastGlobalState = globalStates[globalStates.length - 1]
  const timestamp = i * TIME_INTERVAL
  const events = timeIntervalEvents['' + timestamp] || []
  const newGlobalState = processGlobalState(lastGlobalState, timestamp, events)
  globalStates.push(newGlobalState)
}

// calculate total payouts at maturity
// remove past dispensations
// return unpaid balances
// destroyPrintGlobalStates(globalStates)
// console.log(JSON.stringify(globalStates))
exports.getParsedData = _ => {
  return parseData(globalStates)
}

function processGlobalState(lastGlobalState, timestamp, events) {
  const { rewardBuckets, globalRewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent,
    NUMBER_OF_INTERVALS_TO_RUN
  )
  let users = processUserTickets(lastGlobalState.users, globalRewardAccrued)
  users = processUserEvents(users, events)
  return {
    timestamp,
    rewardBuckets,
    users
  };
}

function processRewardBuckets(lastBuckets, bucketEvent, intervals) {
  let globalRewardAccrued = 0;
  let rewardBuckets = lastBuckets.map(bucket => {
    accrueAmount = bucket.initialRowan / (intervals - 1)
    globalRewardAccrued += accrueAmount
    return {
      rowan: bucket.rowan - accrueAmount,
      initialRowan: bucket.initialRowan
    }
  }).filter(bucket => bucket.rowan > 0)
  if (bucketEvent) {
    rewardBuckets.push(bucketEvent)
  }
  return { rewardBuckets, globalRewardAccrued }
}

function processUserTickets(users, globalRewardAccrued) {
  // process reward accruals and multiplier updates
  const totalShares = _.sum(_.flatten(_.map(users, (user, address) => {
    return user.tickets.map(ticket => ticket.amount)
  })))
  const updatedUsers = _.mapValues(users, user => {
    return {
      ...user,
      tickets: user.tickets.map(ticket => {
        const additionalAmount = ((ticket.amount / (totalShares || 1)) * globalRewardAccrued)
        return {
          ...ticket,
          mul: Math.min(ticket.mul + (0.75 / MULTIPLIER_MATURITY), 1),
          reward: ticket.reward + additionalAmount
        }
      })
    }
  })
  return updatedUsers
}

function processUserEvents(users, events) {
  events.forEach(event => {
    const user = users[event.address] || {
      tickets: [],
      claimed: 0,
      dispensed: 0,
      forfeited: 0,
    }
    if (event.amount > 0) {
      const newTicket = {
        amount: event.amount,
        mul: 0.25,
        reward: 0
      }
      user.tickets = user.tickets.concat(newTicket)
    } else if (event.amount < 0) {
      const { burnedTickets, remainingTickets }
        = burnTickets(-event.amount, user.tickets)
      const { claimed, forfeited } = calculateClaimReward(burnedTickets)
      user.claimed += claimed
      user.forfeited += forfeited
      user.tickets = remainingTickets
    }
    if (event.claim) {
      const { claimed, forfeited } = calculateClaimReward(user.tickets)
      user.claimed += claimed
      user.forfeited += forfeited
      user.tickets = resetTickets(user.tickets)
    }
    users[event.address] = user
  })
  return users;
}

function burnTickets(amount, tickets) {
  const sortedTickets = _.sortBy(tickets, 'mul')

  let amountLeft = amount;
  const burnedTickets = [];
  const remainingTickets = [];
  sortedTickets.forEach(ticket => {
    if (amountLeft === 0) {
      remainingTickets.push(ticket)
      return
    }
    let amountToRemove = Math.min(amountLeft, ticket.amount)
    const proportionBurned = ticket.amount === 0 ? 0 : parseFloat(amountToRemove) / parseFloat(ticket.amount)
    const burnedTicket = {
      ...ticket,
      amount: amountToRemove,
      reward: proportionBurned * parseFloat(ticket.reward || 0),
    }
    burnedTickets.push(burnedTicket)
    amountLeft = amountLeft - amountToRemove
    if (amountLeft === 0) {
      const remainingTicket = {
        ...ticket,
        amount: ticket.amount - amountToRemove,
        reward: (1 - proportionBurned) * parseFloat(ticket.reward || 0),
      }
      remainingTickets.push(remainingTicket)
    }
  })
  return { burnedTickets, remainingTickets }
}

function calculateClaimReward(tickets) {
  return tickets.reduce((accum, ticket) => {
    const forefeitedMultiplier = 1 - ticket.mul
    const reward = ticket.reward || 0
    const result = {
      claimed: accum.claimed + (reward * ticket.mul),
      forfeited: accum.forfeited + (reward * forefeitedMultiplier),
    }
    return result
  }, { claimed: 0, forfeited: 0 })
}

function resetTickets(tickets) {
  return tickets.map(ticket => ({
    ...ticket,
    mul: 0,
    reward: 0
  }))
}

function destroyPrintGlobalStates(globalStates, filterAddress) {
  if (filterAddress) {
    globalStates.map(globalState => {
      _.forEach(globalState.users, (user, address) => {
        if (address !== filterAddress) {
          delete globalState.users[address]
        }
      })
      return globalState
    })
  }
  console.dir({
    globalStates: globalStates.filter(globalState => globalState.users[filterAddress] !== undefined)
  }, { depth: null })
  console.dir(globalStates[globalStates.length - 3], { depth: null })
  console.dir(globalStates[globalStates.length - 2], { depth: null })
  console.dir(globalStates[globalStates.length - 1], { depth: null })
}
