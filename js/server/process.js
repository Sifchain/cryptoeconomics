const { augmentVSData } = require('./augmentVSData');
const {
  remapLMAddresses,
  getLMTimeseriesFinalIndex,
  createClaimEvents,
  createDispensationEvents,
} = require('./util/lm-util');
const {
  remapVSAddresses,
  getVSTimeseriesFinalIndex,
} = require('./util/vs-util');
const { processVSGlobalState } = require('./process-vs');

const {
  EVENT_INTERVAL_MINUTES,
  NUMBER_OF_INTERVALS_TO_RUN,
} = require('./config');
const { GlobalTimestampState } = require('./types');

const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING,
} = require('./constants/reward-program-types');
const { mockMinerClaims, mockMinerDispensations } = require('./mock');

exports.getProcessedLMData = (snapshotLM) => {
  let {
    snapshots_new: [{ snapshot_data: minerSnapshotData }],
    snapshots_lm_claims: [{ snapshot_data: claimsSnapshotData = {} } = {}],
    snapshots_lm_dispensation: [
      { snapshot_data: dispensationsSnapshotData = {} } = {},
    ] = [],
  } = snapshotLM.data;
  const snapshotTimeseriesFinalIndex =
    getLMTimeseriesFinalIndex(minerSnapshotData);

  if (process.env.MOCK_DATA_ENABLED === 'true') {
    claimsSnapshotData = mockMinerClaims(snapshotLM).claimsSnapshotData;
    dispensationsSnapshotData =
      mockMinerDispensations(claimsSnapshotData).dispensationsSnapshotData;
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
    snapshotTimeseriesFinalIndex,
    claimEventsByUserByTimestamp,
    dispensationEventsByUserByTimestamp
  );
};

exports.getProcessedVSData = (snapshotVS) => {
  let {
    snapshots_validators: [{ snapshot_data: validatorSnapshotData }],
    snapshots_vs_claims: [{ snapshot_data: claimsSnapshotData = {} } = {}],
    snapshots_vs_dispensation: [
      { snapshot_data: dispensationsSnapshotData = {} } = {},
    ] = [],
  } = snapshotVS.data;

  const snapshotTimeseriesFinalIndex = getVSTimeseriesFinalIndex(
    validatorSnapshotData
  );

  const claimEventsByUserByTimestamp = createClaimEvents(claimsSnapshotData);
  const dispensationEventsByUserByTimestamp = createDispensationEvents(
    dispensationsSnapshotData
  );

  console.time('remapVS');
  const { userEventsByTimestamp } = remapVSAddresses(validatorSnapshotData);
  console.timeEnd('remapVS');
  function getCurrentCommissionRate(validatorStakeAddress, stateIndex) {
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
    snapshotTimeseriesFinalIndex,
    claimEventsByUserByTimestamp,
    dispensationEventsByUserByTimestamp
  );
};

const cacheEnabled = false;
const history = {
  [VALIDATOR_STAKING]: {},
  [LIQUIDITY_MINING]: {},
};

function processUserEventsByTimestamp(
  userEventsByTimestamp,
  getCurrentCommissionRate = (address, stateIndex) => 0,
  rewardProgramType,
  snapshotTimeseriesFinalIndex,
  claimEventsByUserByTimestamp = {},
  dispensationEventsByUserByTimestamp = {}
) {
  console.time('processvs');
  const VSGlobalStates = [GlobalTimestampState.getInitial()];
  for (let i = 1; i <= NUMBER_OF_INTERVALS_TO_RUN; i++) {
    let nextGlobalState;
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const isSimulatedFutureInterval = i > snapshotTimeseriesFinalIndex - 1;
    const isPendingInterval = i === snapshotTimeseriesFinalIndex - 1;
    const rewardProgramCache = history[rewardProgramType];
    const cachedTimestampState = rewardProgramCache[timestamp];
    if (cacheEnabled && cachedTimestampState && !isSimulatedFutureInterval) {
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
        (address) => getCurrentCommissionRate(address, i),
        rewardProgramType,
        isSimulatedFutureInterval,
        claimEventsByUser,
        dispensationEventsByUser
      );
    }
    if (cacheEnabled && !isSimulatedFutureInterval && !cachedTimestampState) {
      rewardProgramCache[timestamp] = nextGlobalState;
    }
    if (isPendingInterval) {
      nextGlobalState.markAsPending();
    }
    VSGlobalStates.push(nextGlobalState);
  }
  console.timeEnd('processvs');

  return augmentVSData(VSGlobalStates, snapshotTimeseriesFinalIndex);
}
