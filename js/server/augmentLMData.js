_ = require("lodash")
moment = require("moment")
const { START_DATETIME } = require("./config");

exports.augmentLMData = data => {
  const users = _.uniq(_.flatten(data.map(timestamp => Object.keys(timestamp.users))))

  data.forEach(timestamp => {
    const timestampTotalTickets = _.sum(_.map(timestamp.users, user => {
      return _.sum(user.tickets.map(t => t.amount))
    }))
    timestamp.totalTickets = timestampTotalTickets
    timestamp.users = _.forEach(timestamp.users, user => {
      const totalTickets = _.sum(user.tickets.map(t => t.amount))
      user.claimableReward = user.claimed + _.sum(user.tickets.map(t => t.reward * t.mul))
      user.reservedReward = user.claimed + _.sum(user.tickets.map(t => t.reward))
      user.totalTickets = totalTickets
      user.nextRewardShare = totalTickets / timestampTotalTickets
    })
  })

  const finalTimestamp = data[data.length - 1] || { users: [] };
  data.forEach((timestamp) => {
    _.forEach(timestamp.users, (user, address) => {
      const userAtMaturity = finalTimestamp.users[address] || {}
      user.totalRewardAtMaturity = userAtMaturity.claimableReward
      user.ticketAmountAtMaturity = _.sum(finalTimestamp.users[address].tickets.map(ticket => ticket.amount))
      user.yieldAtMaturity = user.totalRewardAtMaturity / user.ticketAmountAtMaturity
    })
  })

  data.forEach((timestamp, timestampIndex) => {
    _.forEach(timestamp.users, (user, address) => {
      const prevTimestamp = data[timestampIndex - 1] || { users: [] }
      const lastUser = prevTimestamp.users[address] || {}
      const lastUserMaturityDate = lastUser.maturityDate
      let maturityDate = lastUserMaturityDate
      const userClaimableReward = user.claimableReward
      const userReservedReward = user.reservedReward
      if (maturityDate === undefined &&                       // maturity date not yet reached
        timestamp.rewardBuckets.length === 0 &&               // reward period is over
        userClaimableReward === userReservedReward            // rewards have matured
      ) {
        maturityDate = moment.utc(START_DATETIME).add(timestamp.timestamp, 'm').format("MMMM Do YYYY, h:mm:ss a")
      }
      user.maturityDate = maturityDate
    })
  })

  // fill in old timestamps with maturity date now that we have it
  const lastTimestamp = data[data.length - 1] || { users: [] }
  data.forEach((timestamp) => {
    _.forEach(timestamp.users, (user, address) => {
      const lastUser = lastTimestamp.users[address] || {}
      user.maturityDate = lastUser.maturityDate
    })
  })

  const rewardBucketsTimeSeries = data.map((timestampData, timestamp) => {
    const rewardBuckets = timestampData.rewardBuckets
    const totalCurrentRowan = _.sum(rewardBuckets.map(b => b.rowan))
    const totalInitialRowan = _.sum(rewardBuckets.map(b => b.initialRowan))
    return {
      timestamp, totalCurrentRowan, totalInitialRowan
    }
  }).slice(1)

  // const stackClaimableRewardData = dataWithRewards.map(t => {
  //   const blankUsers = users.reduce((accum, user) => {
  //     accum[user] = 0
  //     return accum
  //   }, {});
  //   const blankUserRewards = _.mapValues(blankUsers, u => 0)
  //   const userRewards = _.mapValues(t.users, u => u.claimableReward)
  //   return {
  //     timestamp: t.timestamp,
  //     ...blankUserRewards,
  //     ...userRewards
  //   }
  // }).slice(1)

  return {
    users,
    processedData: data,
    rewardBucketsTimeSeries,
    // stackClaimableRewardData,
  }
}
