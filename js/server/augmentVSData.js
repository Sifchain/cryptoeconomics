const _ = require('lodash');
const moment = require('moment');
const { START_DATETIME } = require('./config');

exports.augmentVSData = data => {
  const users = _.uniq(
    _.flatten(data.map(timestamp => Object.keys(timestamp.users)))
  );

  data.forEach(timestamp => {
    const timestampTotalTickets = _.sum(
      _.map(timestamp.users, user => {
        return _.sum(user.tickets.map(t => t.amount));
      })
    );
    timestamp.totalTickets = timestampTotalTickets;
    timestamp.users = _.forEach(timestamp.users, user => {
      const totalTickets = _.sum(user.tickets.map(t => t.amount));
      user.claimableReward =
        user.claimed + _.sum(user.tickets.map(t => t.reward * t.mul));
      user.reservedReward =
        user.claimed + _.sum(user.tickets.map(t => t.reward));
      user.totalTickets = totalTickets;
      user.nextRewardShare = totalTickets / timestampTotalTickets;
    });
  });

  const finalTimestamp = data[data.length - 1] || { users: [] };
  data.forEach(timestamp => {
    _.forEach(timestamp.users, (user, address) => {
      const userAtMaturity = finalTimestamp.users[address] || {};
      user.totalRewardAtMaturity = userAtMaturity.claimableReward;
      user.ticketAmountAtMaturity = _.sum(
        finalTimestamp.users[address].tickets.map(ticket => ticket.amount)
      );
      user.yieldAtMaturity =
        user.totalRewardAtMaturity / user.ticketAmountAtMaturity;
    });
  });

  data.forEach((timestamp, timestampIndex) => {
    _.forEach(timestamp.users, (user, address) => {
      const prevTimestamp = data[timestampIndex - 1] || { users: [] };
      const lastUser = prevTimestamp.users[address] || {};
      const lastUserMaturityDate = lastUser.maturityDate;
      const lastUserMaturityDateISO = lastUser.maturityDateISO;
      let maturityDate = lastUserMaturityDate;
      let maturityDateISO = lastUserMaturityDateISO;
      const userClaimableReward = user.claimableReward;
      const userReservedReward = user.reservedReward;
      if (
        maturityDate === undefined && // maturity date not yet reached
        timestamp.rewardBuckets.length === 0 && // reward period is over
        userClaimableReward === userReservedReward // rewards have matured
      ) {
        maturityDate = moment
          .utc(START_DATETIME)
          .add(timestamp.timestamp, 'm')
          .format('MMMM Do YYYY, h:mm:ss a');
      }
      if (
        maturityDateISO === undefined && // maturity date not yet reached
        timestamp.rewardBuckets.length === 0 && // reward period is over
        userClaimableReward === userReservedReward // rewards have matured
      ) {
        maturityDateISO = user.maturityDateISO = moment
          .utc(START_DATETIME)
          .add(timestamp.timestamp, 'm')
          .toISOString();
      }
      user.maturityDate = maturityDate;
      user.maturityDateISO = maturityDateISO;
    });
  });

  // fill in old timestamps with maturity date now that we have it
  const lastTimestamp = data[data.length - 1] || { users: [] };
  data.forEach(timestamp => {
    _.forEach(timestamp.users, (user, address) => {
      const lastUser = lastTimestamp.users[address] || {};
      user.maturityDate = lastUser.maturityDate;
      user.maturityDateISO = lastUser.maturityDateISO;
    });
  });

  const rewardBucketsTimeSeries = data
    .map((timestampData, timestamp) => {
      const rewardBuckets = timestampData.rewardBuckets;
      const totalCurrentRowan = _.sum(rewardBuckets.map(b => b.rowan));
      const totalInitialRowan = _.sum(rewardBuckets.map(b => b.initialRowan));
      return {
        timestamp,
        totalCurrentRowan,
        totalInitialRowan
      };
    })
    .slice(1);

  const stackClaimableRewardData = [];
  const finalTimestampUsers = _.map(finalTimestamp.users, (u, address) => ({
    ...u,
    address
  }));
  const top50Users = _.orderBy(
    finalTimestampUsers,
    ['totalRewardAtMaturity'],
    ['desc']
  ).slice(0, 50);
  const blankUserRewards = top50Users.reduce((accum, user) => {
    accum[user.address] = 0;
    return accum;
  }, {});
  for (let i = 1; i < data.length; i++) {
    const timestamp = data[i];
    const userRewards = top50Users.reduce((accum, user) => {
      const userAtTimestamp = timestamp.users[user.address] || {};
      if (userAtTimestamp.claimableReward) {
        accum[user.address] = userAtTimestamp.claimableReward;
      }
      return accum;
    }, {});
    stackClaimableRewardData.push({
      timestamp: timestamp.timestamp,
      ...blankUserRewards,
      ...userRewards
    });
  }

  return {
    users,
    processedData: data,
    rewardBucketsTimeSeries,
    stackClaimableRewardData
  };
};
