_ = require("lodash")

const { remapAddresses } = require("./util");
const { TIME_INTERVAL, NUMBER_OF_INTERVALS_TO_RUN, MULTIPLIER_MATURITY, STARTING_GLOBAL_STATE } = require("./config");

const snapshot = require("../snapshots/snapshot_start_until_mid_april.json");


const addresses = snapshot.data.snapshots_new[0].snapshot_data

const timeIntervalEvents = remapAddresses(addresses, TIME_INTERVAL)

const startTime = 0;
const globalStates = [STARTING_GLOBAL_STATE]
for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
  const lastGlobalState = globalStates[globalStates.length - 1]
  const timestamp = i * TIME_INTERVAL
  const events = timeIntervalEvents['' + timestamp] || []
  const newGlobalState = processGlobalState(lastGlobalState, timestamp, events)
  globalStates.push(newGlobalState)
}

// calculate total payouts at end
// remove past dispensations
// return unpaid balances
destroyPrintGlobalStates(globalStates, 'sif1hjkgsq0wcmwdh8pr3snhswx5xyy4zpgs833akh')

function processGlobalState(lastGlobalState, timestamp, events) {
  const { rewardBuckets, rewardAccrued } = processRewardBuckets(
    lastGlobalState.rewardBuckets,
    lastGlobalState.bucketEvent,
    NUMBER_OF_INTERVALS_TO_RUN
  )
  let users = processUserTickets(lastGlobalState.users, rewardAccrued)
  users = processUserEvents(users, events)
  return {
    timestamp,
    rewardBuckets,
    users
  };
}

function processRewardBuckets(lastBuckets, bucketEvent, intervals) {
  let rewardAccrued = 0;
  let rewardBuckets = lastBuckets.map(bucket => {
    accrueAmount = bucket.initialRowan / (intervals - 1)
    rewardAccrued += accrueAmount
    return {
      rowan: bucket.rowan - accrueAmount,
      initialRowan: bucket.initialRowan
    }
  }).filter(bucket => bucket.rowan > 0)
  if (bucketEvent) {
    rewardBuckets.push(bucketEvent)
  }
  return { rewardBuckets, rewardAccrued }
}

function processUserTickets(users, rewardAccrued) {
  // process reward accruals and multiplier updates
  const totalShares = _.sum(_.flatten(_.map(users, (user, address) => {
    return user.tickets.map(ticket => ticket.size * ticket.multiplier)
  })))
  const updatedUsers = _.mapValues(users, user => {
    return {
      ...user,
      tickets: user.tickets.map(ticket => {
        const ticketShares = ticket.size * ticket.multiplier
        return {
          ...ticket,
          multiplier: Math.min(ticket.multiplier + (0.75 / MULTIPLIER_MATURITY), 1),
          reward: ticket.reward + ((ticketShares / totalShares) * rewardAccrued)
        }
      })
    }
  })
  return updatedUsers
}

function processUserEvents(users, events) {
  events.forEach(event => {
    users[event.address] = users[event.address] || {
      tickets: [],
      claimedReward: 0,
      dispensedReward: 0
    }
    //process amount
    if (event.amount > 0) {
      //create tickets
      const newTicket = {
        size: event.amount,
        multiplier: 0.25,
        reward: 0
      }
      users[event.address].tickets = users[event.address].tickets.concat(newTicket)
    } else if (event.amount < 0) {
      //destroy tickets and release rewards
    }
    if (event.claim) {
      //reset tickets and release rewards
    }
  })
  return users;
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
