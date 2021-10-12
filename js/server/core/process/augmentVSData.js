const _ = require('lodash');
const moment = require('moment');
const configs = require('../../config');
const { GlobalTimestampState, User } = require('../types');

exports.augmentVSData = (
  globalTimestampStates,
  snapshotTimeseriesFinalIndex
) => {
  // console.time('augmentVSData');
  const finalTimestampState =
    globalTimestampStates[globalTimestampStates.length - 1] ||
    new GlobalTimestampState();

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

  // console.time('augment/stackData');
  const stackClaimableRewardData = [];
  const finalTimestampStateUsers = _.map(
    finalTimestampState.users,
    (u, address) => u.cloneWith({ address })
  );
  const top50Users = _.orderBy(
    finalTimestampStateUsers,
    ['totalAccruedCommissionsAndClaimableRewards'],
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
          userAtTimestamp.totalAccruedCommissionsAndClaimableRewards +
          userAtTimestamp.dispensed +
          userAtTimestamp.claimedCommissionsAndRewardsAwaitingDispensation;
      }
      return accum;
    }, {});
    stackClaimableRewardData.push({
      timestamp: timestamp.timestamp,
      ...blankUserRewards,
      ...userRewards,
    });
  }
  // console.timeEnd('augment/stackData');

  const uniqueUserAddresses = _.uniq(
    _.flatten(globalTimestampStates.map((state) => Object.keys(state.users)))
  );
  // console.timeEnd('augmentVSData');
  return {
    users: uniqueUserAddresses,
    processedData: globalTimestampStates,
    rewardBucketsTimeSeries,
    stackClaimableRewardData,
    snapshotTimeseriesFinalIndex,
  };
};

exports.augmentUserVSData = (
  userAddress,
  globalTimestampStates,
  rewardProgram
) => {
  const { START_DATETIME } = configs[rewardProgram];

  const finalTimestampState =
    globalTimestampStates[globalTimestampStates.length - 1] ||
    new GlobalTimestampState();

  // console.time('augmentUserVSData');
  // can be lazy evaluated
  globalTimestampStates.forEach((timestamp) => {
    const user = timestamp.users[userAddress];
    if (!user) return;
    const userAtMaturity = finalTimestampState.users[userAddress] || new User();
    user.updateUserMaturityRewards(userAtMaturity);
  });

  // can be lazy evaluated
  globalTimestampStates.forEach((timestampState, timestampIndex) => {
    const user = timestampState.users[userAddress];
    if (!user) return;
    const prevTimestamp =
      globalTimestampStates[timestampIndex - 1] || new GlobalTimestampState();
    const userAtPrevTimestamp = prevTimestamp.users[userAddress] || new User();
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
      nextBucketGlobalReward,
      rewardProgram
    );
  });

  // fill in old timestamps with maturity date now that we have it
  const lastTimestamp =
    globalTimestampStates[globalTimestampStates.length - 1] ||
    new GlobalTimestampState();

  // can be lazy evaluated
  globalTimestampStates.forEach((timestampState) => {
    const user = timestampState.users[userAddress];
    if (!user) return;
    const timestampDate = moment
      .utc(START_DATETIME)
      .add(timestampState.timestamp, 'm');
    const lastUser = lastTimestamp.users[userAddress] || new User();
    user.updateMaturityTimeProps(lastUser, timestampDate.valueOf());
  });
  // console.timeEnd('augmentUserVSData');
};
