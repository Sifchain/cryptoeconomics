const { augmentVSData } = require('./augmentVSData');
const { remapLMAddresses } = require('./util/lm-util');
const { remapVSAddresses } = require('./util/vs-util');
const { processVSGlobalState } = require('./process-vs');

const {
  EVENT_INTERVAL_MINUTES,
  NUMBER_OF_INTERVALS_TO_RUN
} = require('./config');
const { GlobalTimestampState } = require('./types');

const { getTimeIndex } = require('./util/getTimeIndex');
const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING
} = require('./constants/reward-program-types');

exports.getProcessedLMData = snapshotLM => {
  const LMAddresses = snapshotLM.data.snapshots_new[0].snapshot_data;

  const userEventsByTimestamp = remapLMAddresses(LMAddresses);

  return processUserEventsByTimestamp(
    userEventsByTimestamp,
    () => 0,
    LIQUIDITY_MINING
  );

  // TODO: remove past dispensations
  // TODO: return unpaid balances
};

exports.getProcessedVSData = snapshotVS => {
  const validatorSnapshotData =
    snapshotVS.data.snapshots_validators[0].snapshot_data;

  console.time('remapVS');
  const { userEventsByTimestamp } = remapVSAddresses(validatorSnapshotData);
  console.timeEnd('remapVS');
  function getCurrentCommissionRate (validatorStakeAddress, stateIndex) {
    const validatorCommissionData =
      validatorSnapshotData[validatorStakeAddress].commission;
    const commissionIndex =
      stateIndex < validatorCommissionData.length
        ? stateIndex
        : validatorCommissionData.length - 1;
    const rate = validatorCommissionData[commissionIndex];
    return rate;
  }
  return processUserEventsByTimestamp(
    userEventsByTimestamp,
    getCurrentCommissionRate,
    VALIDATOR_STAKING
  );
};

const history = {
  [VALIDATOR_STAKING]: {},
  [LIQUIDITY_MINING]: {}
};

function processUserEventsByTimestamp (
  userEventsByTimestamp,
  getCurrentCommissionRate = (address, stateIndex) => 0,
  rewardProgramType
) {
  console.time('processvs');
  const VSGlobalStates = [GlobalTimestampState.getInitial()];
  let currentTimeIndex = getTimeIndex('now');
  let cacheEnabled = true;
  for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
    const lastGlobalState = VSGlobalStates[VSGlobalStates.length - 1];
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const userEvents = userEventsByTimestamp['' + timestamp] || [];
    let nextGlobalState;
    const isSimulatedFutureInterval = currentTimeIndex < i;
    if (
      history[rewardProgramType][timestamp] &&
      !isSimulatedFutureInterval &&
      cacheEnabled
    ) {
      nextGlobalState = history[rewardProgramType][timestamp];
    } else {
      nextGlobalState = processVSGlobalState(
        lastGlobalState,
        timestamp,
        userEvents,
        address => getCurrentCommissionRate(address, i),
        rewardProgramType,
        isSimulatedFutureInterval
      );
    }
    if (
      cacheEnabled &&
      !isSimulatedFutureInterval &&
      !history[rewardProgramType][timestamp]
    ) {
      history[rewardProgramType][timestamp] = nextGlobalState;
    }
    VSGlobalStates.push(nextGlobalState);
  }
  console.timeEnd('processvs');

  // TODO: remove past dispensations
  // TODO: return unpaid balances
  return augmentVSData(VSGlobalStates);
}
