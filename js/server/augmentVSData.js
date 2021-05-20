const _ = require('lodash');
const moment = require('moment');
const { START_DATETIME } = require('./config');
const { GlobalTimestampState, User } = require('./types');

exports.augmentVSData = (globalTimestampStates) => {
  globalTimestampStates.forEach((state) => {
    state.users = _.forEach(state.users, (user, delegatorSifAddress) => {
      /*
        Must be run first on every user because delegators
        store validators' addresses as references (and vice-versa) to be used in
        `User(Validator)#recalculateTotalClaimableCommissionsOnDelegatorRewards`
        via the user getter function passed as a callback.

        If `User#recalculateTotalClaimableCommissionsOnDelegatorRewards` is run
        immediately after this, within this loop iteration, it will only
        account for delegate rewards on delegates that were processed before it
        and leave out all those processed after.
      */
      user.collectValidatorsCommissionsOnLatestUnclaimedRewards(
        (validatorSifAddress) => {
          return state.users[validatorSifAddress];
        },
        delegatorSifAddress
      );
    });
  });

  globalTimestampStates.forEach((state) => {
    const timestampTicketsAmountSum = _.sum(
      _.map(state.users, (user) => {
        return _.sum(user.tickets.map((t) => t.amount));
      })
    );
    state.totalTicketsAmountSum = timestampTicketsAmountSum;
    _.forEach(state.users, (user, address) => {
      /*
        used to calculate ROI stats (APY, yield, etc.)
        in `User#updateRewards`
      */
      user.recalculateTotalClaimableCommissionsOnDelegatorRewards(
        (addr) => state.users[addr],
        address
      );
      /*
        Must be run on every user before `User#updateUserMaturityRewards`
        `User#updateUserMaturityRewards` uses the rewards calulated here.
        Must be run after `User#recalculateTotalClaimableCommissionsOnDelegatorRewards`
        because `User#updateRewards` uses `User.totalClaimableCommissionsOnDelegatorRewards`,
        which is calculated in the former method.
      */
      user.updateRewards(timestampTicketsAmountSum);
    });
  });

  const finalTimestampState =
    globalTimestampStates[globalTimestampStates.length - 1] ||
    new GlobalTimestampState();

  globalTimestampStates.forEach((timestamp) => {
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
  globalTimestampStates.forEach((timestampState) => {
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
      const totalCurrentRowan = _.sum(rewardBuckets.map((b) => b.rowan));
      const totalInitialRowan = _.sum(rewardBuckets.map((b) => b.initialRowan));
      return {
        timestamp,
        totalCurrentRowan,
        totalInitialRowan,
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
    ['totalRewardAtMaturity'],
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
      if (userAtTimestamp.currentTotalClaimableReward) {
        accum[user.address] = userAtTimestamp.currentTotalClaimableReward;
      }
      return accum;
    }, {});
    stackClaimableRewardData.push({
      timestamp: timestamp.timestamp,
      ...blankUserRewards,
      ...userRewards,
    });
  }

  const uniqueUserAddresses = _.uniq(
    _.flatten(globalTimestampStates.map((state) => Object.keys(state.users)))
  );

  return {
    users: uniqueUserAddresses,
    processedData: globalTimestampStates,
    rewardBucketsTimeSeries,
    stackClaimableRewardData,
  };
};
