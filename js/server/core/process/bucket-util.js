const configs = require('../../config');
function processRewardBuckets(lastBuckets, bucketEvent, rewardProgram) {
  const programConfig = configs[rewardProgram];
  let globalRewardAccrued = 0;
  let rewardBuckets = lastBuckets
    .map((bucket) => {
      let accrueAmount = bucket.initialRowan / bucket.duration;
      globalRewardAccrued += accrueAmount;
      return {
        rowan: bucket.rowan - accrueAmount,
        initialRowan: bucket.initialRowan,
        duration: bucket.duration,
      };
    })
    .filter((bucket) => bucket.rowan > 0);
  if (bucketEvent) {
    rewardBuckets.push(bucketEvent);
  }
  return { rewardBuckets, globalRewardAccrued };
}

module.exports = {
  processRewardBuckets,
};
