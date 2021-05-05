_ = require("lodash")

exports.parseData = data => {
  const users = _.uniq(_.flatten(data.map(timestamp => Object.keys(timestamp.users))))

  const dataWithRewards = data.map(timestamp => {
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
          nextRewardShare: totalTickets / timestampTotalTickets,
        }
      })
    }
  })

  const finalTimestamp = dataWithRewards[dataWithRewards.length - 1] || { users: [] };
  const dataWithRewardsAtMaturity = dataWithRewards.map(timestamp => {
    return {
      ...timestamp,
      users: _.mapValues(timestamp.users, (user, address) => {
        const userAtMaturity = finalTimestamp.users[address] || {}
        return {
          ...user,
          totalRewardAtMaturity: userAtMaturity.claimableReward
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

  const stackClaimableRewardData = dataWithRewardsAtMaturity.map(t => {
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

  return {
    users,
    dataWithRewardsAtMaturity,
    rewardBucketsTimeSeries,
    stackClaimableRewardData,
  }
}
