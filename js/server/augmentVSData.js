const _ = require('lodash');
const moment = require('moment');
const { START_DATETIME } = require('./config');
const { GlobalTimestampState, User } = require('./types');

exports.augmentVSData = globalTimestampStates => {
  globalTimestampStates.forEach((state, stateIndex) => {
    const timestampTicketsAmountSum = _.sum(
      _.map(state.users, user => {
        return _.sum(user.tickets.map(t => t.amount));
      })
    );
    state.totalDepositedAmount = timestampTicketsAmountSum;
    _.forEach(state.users, (user, address) => {
      /*
        Must be run on every user before `User#updateUserMaturityRewards`
        `User#updateUserMaturityRewards` uses the rewards calulated here.
        Must be run after `User#recalculateCurrentTotalCommissionsOnClaimableDelegatorRewards`
        because `User#updateRewards` uses `User.currentTotalCommissionsOnClaimableDelegatorRewards`,
        which is calculated in the former method.
      */
      user.updateRewards(timestampTicketsAmountSum);
    });
  });

  const finalTimestampState =
    globalTimestampStates[globalTimestampStates.length - 1] ||
    new GlobalTimestampState();

  globalTimestampStates.forEach(timestamp => {
    _.forEach(timestamp.users, (user, address) => {
      const userAtMaturity = finalTimestampState.users[address] || new User();
      user.updateUserMaturityRewards(userAtMaturity);
    });
  });

  globalTimestampStates.forEach((timestampState, timestampIndex) => {
    _.forEach(timestampState.users, (user, address) => {
      const prevTimestamp =
        globalTimestampStates[timestampIndex - 1] || new GlobalTimestampState();
      const userAtPrevTimestamp = prevTimestamp.users[address] || new User();
      const isAfterRewardPeriod = timestampState.rewardBuckets.length === 0;
      const currentTimestampInMinutes = timestampState.timestamp;
      const nextBucketGlobalReward = timestampState.rewardBuckets.reduce(
        (accum, bucket) => {
          return accum + bucket.initialRowan / bucket.duration;
        },
        0
      );
      user.updateUserMaturityDates(
        userAtPrevTimestamp,
        isAfterRewardPeriod,
        currentTimestampInMinutes,
        nextBucketGlobalReward
      );
    });
  });

  // fill in old timestamps with maturity date now that we have it
  const lastTimestamp =
    globalTimestampStates[globalTimestampStates.length - 1] ||
    new GlobalTimestampState();
  globalTimestampStates.forEach(timestampState => {
    const timestampDate = moment
      .utc(START_DATETIME)
      .add(timestampState.timestamp, 'm');
    _.forEach(timestampState.users, (user, address) => {
      const lastUser = lastTimestamp.users[address] || new User();
      user.updateMaturityTimeProps(lastUser, timestampDate.valueOf());
    });
  });

  const rewardBucketsTimeSeries = globalTimestampStates
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
  const finalTimestampStateUsers = _.map(
    finalTimestampState.users,
    (u, address) => u.cloneWith({ address })
  );
  const top50Users = _.orderBy(
    finalTimestampStateUsers,
    ['totalRewardsOnDepositedAssetsAtMaturity'],
    ['desc']
  ).slice(0, 50);
  const blankUserRewards = top50Users.reduce((accum, user) => {
    accum[user.address] = 0;
    return accum;
  }, {});
  for (let i = 1; i < globalTimestampStates.length; i++) {
    const timestamp = globalTimestampStates[i];
    const userRewards = top50Users.reduce((accum, user) => {
      const userAtTimestamp = timestamp.users[user.address] || new User();
      if (userAtTimestamp.totalAccruedCommissionsAndClaimableRewards) {
        accum[user.address] =
          userAtTimestamp.totalAccruedCommissionsAndClaimableRewards;
      }
      return accum;
    }, {});
    stackClaimableRewardData.push({
      timestamp: timestamp.timestamp,
      ...blankUserRewards,
      ...userRewards
    });
  }

  const uniqueUserAddresses = _.uniq(
    _.flatten(globalTimestampStates.map(state => Object.keys(state.users)))
  );

  return {
    users: uniqueUserAddresses,
    processedData: globalTimestampStates,
    rewardBucketsTimeSeries,
    stackClaimableRewardData
  };
};
