_ = require("lodash")
d3 = require("d3")

exports.parseData = data => {
  const users = _.uniq(_.flatten(data.map(timestamp => Object.keys(timestamp.users))))

  const dataAugmented = data.map(timestamp => {
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

  const rewardBucketsTimeSeries = data.map((timestampData, timestamp) => {
    const rewardBuckets = timestampData.rewardBuckets
    const totalCurrentRowan = _.sum(rewardBuckets.map(b => b.rowan))
    const totalInitialRowan = _.sum(rewardBuckets.map(b => b.initialRowan))
    return {
      timestamp, totalCurrentRowan, totalInitialRowan
    }
  }).slice(1)

  const stackClaimableRewardData = dataAugmented.map(t => {
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

  const stackedClaimableRewardSeries = d3.stack().keys(users)(stackClaimableRewardData)

  return {
    users,
    dataAugmented,
    rewardBucketsTimeSeries,
    stackClaimableRewardData,
    stackedClaimableRewardSeries,
  }
}
