import data from './data.json';
import _ from 'lodash';
import * as d3 from 'd3';

export const users = _.uniq(_.flatten(data.map(timestamp => Object.keys(timestamp.users))))
export const raw = data

export const rawAugmented = data.map(timestamp => {
  const timestampTotalTickets = _.sum(_.map(timestamp.users, user => {
    return _.sum(user.tickets.map(t => t.amount))
  }))
  return {
    ...timestamp,
    totalTickets: timestampTotalTickets,
    users: _.mapValues(timestamp.users, user => {
      const totalTickets = _.sum(user.tickets.map(t => t.amount))
      return {
        ...user,
        claimableReward: user.claimed + _.sum(user.tickets.map(t => t.reward * t.mul)),
        reservedReward: user.claimed + _.sum(user.tickets.map(t => t.reward)),
        totalTickets,
        nextRewardShare: totalTickets / timestampTotalTickets
      }
    })
  }
})

export const rewardBucketsTimeSeries = data.map((timestampData, timestamp) => {
  const rewardBuckets = timestampData.rewardBuckets
  const totalCurrentRowan = _.sum(rewardBuckets.map(b => b.rowan))
  const totalInitialRowan = _.sum(rewardBuckets.map(b => b.initialRowan))
  return {
    timestamp, totalCurrentRowan, totalInitialRowan
  }
}).slice(1)

export const stackClaimableRewardData = rawAugmented.map(t => {
  const blankUsers = users.reduce((accum, user) => {
    accum[user] = 0
    return accum
  }, {});
  const blankUserRewards = _.mapValues(blankUsers, u => 0)
  const userRewards = _.mapValues(t.users, u => u.claimableReward)
  return {
    timestamp: t.timestamp,
    ...blankUserRewards,
    ...userRewards
  }
}).slice(1)

export const stackedClaimableRewardSeries = d3.stack().keys(users)(stackClaimableRewardData)
