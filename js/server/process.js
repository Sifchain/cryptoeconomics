const { augmentVSData } = require('./augmentVSData');
const {
  remapLMAddresses,
  getCurrentLMTimeseriesLength,
  createClaimEvents,
  createDispensationEvents
} = require('./util/lm-util');
const {
  remapVSAddresses,
  getCurrentVSTimeseriesLength
} = require('./util/vs-util');
const { processVSGlobalState } = require('./process-vs');

const {
  EVENT_INTERVAL_MINUTES,
  NUMBER_OF_INTERVALS_TO_RUN
} = require('./config');
const { GlobalTimestampState } = require('./types');

const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING
} = require('./constants/reward-program-types');
const { mockMinerClaims, mockMinerDispensations } = require('./mock');

exports.getProcessedLMData = snapshotLM => {
  let {
    snapshots_new: [{ snapshot_data: minerSnapshotData }],
    snapshots_lm_claims: [{ snapshot_data: claimsSnapshotData = {} } = {}]
  } = snapshotLM.data;

  const snapshotTimeseriesLength = getCurrentLMTimeseriesLength(
    minerSnapshotData
  );

  let dispensationsSnapshotData = {};
  if (process.env.MOCK_DATA_ENABLED === 'true') {
    claimsSnapshotData = mockMinerClaims(snapshotLM).claimsSnapshotData;
    dispensationsSnapshotData = mockMinerDispensations(claimsSnapshotData)
      .dispensationsSnapshotData;
  }

  const claimEventsByUserByTimestamp = createClaimEvents(claimsSnapshotData);
  const dispensationEventsByUserByTimestamp = createDispensationEvents(
    dispensationsSnapshotData
  );

  const userEventsByTimestamp = remapLMAddresses(minerSnapshotData);

  return processUserEventsByTimestamp(
    userEventsByTimestamp,
    () => 0,
    LIQUIDITY_MINING,
    snapshotTimeseriesLength,
    claimEventsByUserByTimestamp,
    dispensationEventsByUserByTimestamp
  );
};

exports.getProcessedVSData = snapshotVS => {
  let {
    snapshots_validators: [{ snapshot_data: validatorSnapshotData }],
    snapshots_vs_claims: [{ snapshot_data: claimsSnapshotData = {} } = {}]
  } = snapshotVS.data;
  let dispensationsSnapshotData = {};

  const snapshotTimeseriesLength = getCurrentVSTimeseriesLength(
    validatorSnapshotData
  );

  const claimEventsByUserByTimestamp = createClaimEvents(claimsSnapshotData);
  const dispensationEventsByUserByTimestamp = createDispensationEvents(
    dispensationsSnapshotData
  );

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
    VALIDATOR_STAKING,
    snapshotTimeseriesLength,
    claimEventsByUserByTimestamp,
    dispensationEventsByUserByTimestamp
  );
};

const history = {
  [VALIDATOR_STAKING]: {},
  [LIQUIDITY_MINING]: {}
};

function processUserEventsByTimestamp (
  userEventsByTimestamp,
  getCurrentCommissionRate = (address, stateIndex) => 0,
  rewardProgramType,
  snapshotTimeseriesLength,
  claimEventsByUserByTimestamp = {},
  dispensationEventsByUserByTimestamp = {}
) {
  console.time('processvs');
  const VSGlobalStates = [GlobalTimestampState.getInitial()];
  let cacheEnabled = true;
  for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
    let nextGlobalState;
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const isSimulatedFutureInterval = i >= snapshotTimeseriesLength;
    const rewardProgramCache = history[rewardProgramType];
    const cachedTimestampState = rewardProgramCache[timestamp];
    if (cachedTimestampState && !isSimulatedFutureInterval && cacheEnabled) {
      nextGlobalState = cachedTimestampState;
    } else {
      const lastGlobalState = VSGlobalStates[VSGlobalStates.length - 1];
      const userEvents = userEventsByTimestamp['' + timestamp] || [];
      const claimEventsByUser =
        claimEventsByUserByTimestamp['' + timestamp] || {};
      const dispensationEventsByUser =
        dispensationEventsByUserByTimestamp['' + timestamp];
      nextGlobalState = processVSGlobalState(
        lastGlobalState,
        timestamp,
        userEvents,
        address => getCurrentCommissionRate(address, i),
        rewardProgramType,
        isSimulatedFutureInterval,
        claimEventsByUser,
        dispensationEventsByUser
      );
    }
    if (cacheEnabled && !isSimulatedFutureInterval && !cachedTimestampState) {
      rewardProgramCache[timestamp] = nextGlobalState;
    }
    VSGlobalStates.push(nextGlobalState);
  }
  console.timeEnd('processvs');

  return augmentVSData(VSGlobalStates, snapshotTimeseriesLength);
}
