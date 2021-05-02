import data from './data.json';
import _ from 'lodash';

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
        claimableReward: _.sum(user.tickets.map(t => t.reward * t.multiplier)),
        reservedReward: _.sum(user.tickets.map(t => t.reward)),
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
