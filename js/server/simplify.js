const { graphqlRequest } = require('./loaders/graphqlRequest');
const { loadValidatorsSnapshot } = require('./loaders/loadValidatorsSnapshot');
const config = require('./config');
async function createValidatorStakingTimeSeries () {
  const snapshotRes = await loadValidatorsSnapshot();
  const data = await graphqlRequest(`{
    events_audit
  }`);
  const snapshot = snapshotRes.data.snapshots_validators[0].snapshot_data;
  const totalInitialRowan = 45000000;
  let totalRowanRewardRemaining = totalInitialRowan;
  let totalRowanRewardAllocated = 0;
  const timeInterval = 200 * 60 * 60 * 1000;
  let i = 0;
  let done = false;
  const currentCommissionRatesByValidator = {};
  const allocatedAmount =
    totalInitialRowan / (config.REWARD_ACCRUAL_DURATION_INTERVAL_COUNT - 1);
  while (!done) {
    let epochDelta = (i + 1) * timeInterval;
    for (let validatorAddress in snapshot) {
      const { commission, ...delegateSnapshot } = snapshot[validatorAddress];
      if (commission.length === i) {
        done = true;
        break;
      }
      let commissionRate = commission[i];
      if (commissionRate === 0) {
        commissionRate =
          currentCommissionRatesByValidator[validatorAddress] || 0;
      }
      for (let delegateAddress in delegateSnapshot) {
        const delegateAmountDelta = delegateSnapshot[delegateAddress].rowan[i];
        debugger;
      }
    }
    i++;
  }
}
if (require.main === module) {
  // if its being called as a node script, run it.
  createValidatorStakingTimeSeries();
}

module.exports = {
  createValidatorStakingTimeSeries
};
