_ = require("lodash")
moment = require("moment")
const { START_DATETIME } = require("./config");

exports.augmentVSData = data => {
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
  const processedData = dataWithRewards.map((timestamp) => {
    return {
      ...timestamp,
      users: _.mapValues(timestamp.users, (user, address) => {
        const userAtMaturity = finalTimestamp.users[address] || {}
        const totalRewardAtMaturity = userAtMaturity.claimableReward
        const ticketAmountAtMaturity = _.sum(finalTimestamp.users[address].tickets.map(ticket => ticket.amount))
        const yieldAtMaturity = totalRewardAtMaturity / ticketAmountAtMaturity
        return {
          ...user,
          totalRewardAtMaturity,
          ticketAmountAtMaturity,
          yieldAtMaturity,
        }
      })
    }
  })

  processedData.forEach((timestamp, timestampIndex) => {
    _.forEach(timestamp.users, (user, address) => {
      const prevTimestamp = processedData[timestampIndex - 1] || { users: [] }
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
  const lastTimestamp = processedData[processedData.length - 1] || { users: [] }
  processedData.forEach((timestamp) => {
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

  const stackClaimableRewardData = processedData.map(t => {
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
    processedData,
    rewardBucketsTimeSeries,
    stackClaimableRewardData,
  }
}
