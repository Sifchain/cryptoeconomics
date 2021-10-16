const { augmentVSData } = require('./augmentVSData');
const {
  remapLMAddresses,
  getLMTimeseriesFinalIndex,
  createClaimEvents,
  createDispensationEvents,
} = require('../transform/lm-util');
const {
  remapVSAddresses,
  getVSTimeseriesFinalIndex,
} = require('../transform/vs-util');
const { processVSGlobalState } = require('./process-vs');

const configs = require('../../config');
const { GlobalTimestampState } = require('../types');

const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING,
} = require('../../constants/reward-program-types');
const { mockMinerClaims, mockMinerDispensations } = require('../../mock');
const { getTimeIndex } = require('../../util/getTimeIndex');

exports.getProcessedLMData = (snapshotLM, deltaCoeff, rewardProgram) => {
  let {
    snapshots_new: [{ snapshot_data: minerSnapshotData }],
    snapshots_lm_claims: [{ snapshot_data: claimsSnapshotData = {} } = {}],
    snapshots_lm_dispensation: [
      { snapshot_data: dispensationsSnapshotData = {} } = {},
    ] = [],
  } = snapshotLM.data;

  // console.log(minerSnapshotData);
  const snapshotTimeseriesFinalIndex =
    getLMTimeseriesFinalIndex(minerSnapshotData);

  if (process.env.MOCK_DATA_ENABLED === 'true') {
    claimsSnapshotData = mockMinerClaims(snapshotLM).claimsSnapshotData;
    dispensationsSnapshotData =
      mockMinerDispensations(claimsSnapshotData).dispensationsSnapshotData;
  }

  const claimEventsByUserByTimestamp = createClaimEvents(
    claimsSnapshotData,
    rewardProgram
  );
  const dispensationEventsByUserByTimestamp = createDispensationEvents(
    dispensationsSnapshotData,
    rewardProgram
  );

  const userEventsByTimestamp = remapLMAddresses(
    minerSnapshotData,
    deltaCoeff,
    rewardProgram
  );

  return processUserEventsByTimestamp(
    userEventsByTimestamp,
    () => 0,
    LIQUIDITY_MINING,
    snapshotTimeseriesFinalIndex,
    claimEventsByUserByTimestamp,
    dispensationEventsByUserByTimestamp,
    rewardProgram
  );
};

exports.getProcessedVSData = (snapshotVS, rewardProgram) => {
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

  const claimEventsByUserByTimestamp = createClaimEvents(
    claimsSnapshotData,
    rewardProgram
  );
  const dispensationEventsByUserByTimestamp = createDispensationEvents(
    dispensationsSnapshotData,
    rewardProgram
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
  dispensationEventsByUserByTimestamp = {},
  rewardProgram
) {
  console.time('processvs');
  const VSGlobalStates = [GlobalTimestampState.getInitial({ rewardProgram })];
  const programConfig = configs[rewardProgram];
  const startBucketTimestamp =
    (getTimeIndex(
      new Date(programConfig.REWARD_BUCKET_START_DATETIME),
      rewardProgram
    ) +
      1) *
    programConfig.EVENT_INTERVAL_MINUTES;

  const junoBucketStartTimestamp =
    (getTimeIndex(new Date('2021-10-16T02:00:48.506Z'), rewardProgram) + 1) *
    programConfig.EVENT_INTERVAL_MINUTES;

  const endBucketTimestamp =
    (getTimeIndex(
      new Date(programConfig.REWARD_BUCKET_END_DATETIME),
      rewardProgram
    ) +
      1) *
    programConfig.EVENT_INTERVAL_MINUTES;
  const { EVENT_INTERVAL_MINUTES, NUMBER_OF_INTERVALS_TO_RUN, START_DATETIME } =
    programConfig;
  for (
    let i = getTimeIndex(new Date(START_DATETIME), rewardProgram) + 1;
    i <= NUMBER_OF_INTERVALS_TO_RUN;
    i++
  ) {
    let nextGlobalState;
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const lastGlobalState = VSGlobalStates[VSGlobalStates.length - 1];

    if (timestamp === startBucketTimestamp) {
      lastGlobalState.startBucket({ rewardProgram });
    }
    if (
      rewardProgram === 'bonus_v1' &&
      timestamp === junoBucketStartTimestamp
    ) {
      const REWARD_ACCRUAL_DURATION_MS = 1 * 7 * 24 * 60 * 60 * 1000;
      const REWARD_ACCRUAL_DURATION_INTERVAL_COUNT = Math.floor(
        REWARD_ACCRUAL_DURATION_MS / 1000 / 60 / EVENT_INTERVAL_MINUTES
      );
      console.log({
        REWARD_ACCRUAL_DURATION_MS___JUNO_BOOST: REWARD_ACCRUAL_DURATION_MS,
      });
      lastGlobalState.bucketEvent = {
        rowan: 500_000,
        initialRowan: 500_000,
        duration: REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
      };
    }
    if (
      timestamp ===
      endBucketTimestamp + programConfig.EVENT_INTERVAL_MINUTES * 2
    ) {
      lastGlobalState.endBuckets({ rewardProgram });
    }
    const isSimulatedFutureInterval = i > snapshotTimeseriesFinalIndex - 1;
    const isPendingInterval = i === snapshotTimeseriesFinalIndex - 1;
    const rewardProgramCache = history[rewardProgramType];
    const cachedTimestampState = rewardProgramCache[timestamp];
    if (cacheEnabled && cachedTimestampState && !isSimulatedFutureInterval) {
      nextGlobalState = cachedTimestampState;
    } else {
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
        dispensationEventsByUser,
        rewardProgram
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
