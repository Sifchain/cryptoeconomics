function processRewardBuckets (lastBuckets, bucketEvent) {
  let globalRewardAccrued = 0;
  let rewardBuckets = lastBuckets
    .map(bucket => {
      let accrueAmount = bucket.initialRowan / (bucket.duration - 1);
      globalRewardAccrued += accrueAmount;
      return {
        rowan: bucket.rowan - accrueAmount,
        initialRowan: bucket.initialRowan,
        duration: bucket.duration
      };
    })
    .filter(bucket => bucket.rowan > 0);
  if (bucketEvent) {
    rewardBuckets.push(bucketEvent);
  }
  return { rewardBuckets, globalRewardAccrued };
}

module.exports = {
  processRewardBuckets
};
