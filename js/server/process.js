// const { augmentLMData } = require('./augmentLMData');
const { augmentVSData } = require('./augmentVSData');

const { remapLMAddresses } = require('./util/lm-util');
const { remapVSAddresses } = require('./util/vs-util');

// const { processLMGlobalState } = require('./process-lm');
const { processVSGlobalState } = require('./process-vs');

const {
  EVENT_INTERVAL_MINUTES,
  NUMBER_OF_INTERVALS_TO_RUN
} = require('./config');
const { GlobalTimestampState } = require('./types');

const fs = require('fs');
const path = require('path');
const { getTimeIndex } = require('./util/getTimeIndex');
const {
  VALIDATOR_STAKING,
  LIQUIDITY_MINING
} = require('./constants/reward-program-types');
// const { getTimeIndex } = require("./util/getTimeIndex");

// const snapshotLM = require("../snapshots/snapshot_lm_latest.json");
// const snapshotVS = require("../snapshots/snapshot_vs_latest.json");

// exports.getProcessedLMData = snapshotLM => {
//   const LMAddresses = snapshotLM.data.snapshots_new[0].snapshot_data;

//   const LMTimeIntervalEvents = remapLMAddresses(
//     LMAddresses,
//     EVENT_INTERVAL_MINUTES
//   );

//   const LMGlobalStates = [GlobalTimestampState.getInitial()];

//   for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
//     const lastGlobalState = LMGlobalStates[LMGlobalStates.length - 1];
//     const timestamp = i * EVENT_INTERVAL_MINUTES;
//     const events = LMTimeIntervalEvents['' + timestamp] || [];
//     const newGlobalState = processLMGlobalState(
//       lastGlobalState,
//       timestamp,
//       events
//     );
//     LMGlobalStates.push(newGlobalState);
//   }

//   // TODO: remove past dispensations
//   // TODO: return unpaid balances
//   // return augmentLMData(LMGlobalStates);
// };

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
  // return augmentLMData(LMGlobalStates);
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

function processUserEventsByTimestamp (
  userEventsByTimestamp,
  getCurrentCommissionRate = (address, stateIndex) => 0,
  rewardProgramType
) {
  console.time('processvs');
  const VSGlobalStates = [GlobalTimestampState.getInitial()];
  let currentTimeIndex = getTimeIndex('now');
  const snapshotOrigin =
    process.env.LOCAL_SNAPSHOT_DEV_MODE === 'enabled' ? 'local' : 'live';
  let cacheEnabled = false;
  for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
    const isSimulatedFutureInterval = currentTimeIndex < i;
    const cachePath = path.join(
      __dirname,
      `./cache/state.${snapshotOrigin}.${i}.json`
    );
    if (!isSimulatedFutureInterval && cacheEnabled) {
      if (fs.existsSync(cachePath)) {
        try {
          let cached = JSON.parse(fs.readFileSync(cachePath).toString());
          VSGlobalStates.push(GlobalTimestampState.fromJSON(cached));
          continue;
        } catch (e) {}
      }
    }

    const lastGlobalState = VSGlobalStates[VSGlobalStates.length - 1];
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const userEvents = userEventsByTimestamp.get(timestamp) || [];
    const newGlobalState = processVSGlobalState(
      lastGlobalState,
      timestamp,
      userEvents,
      address => getCurrentCommissionRate(address, i),
      rewardProgramType
    );
    if (cacheEnabled) {
      fs.writeFileSync(cachePath, JSON.stringify(newGlobalState));
    }
    VSGlobalStates.push(newGlobalState);
  }
  console.timeEnd('processvs');

  // TODO: remove past dispensations
  // TODO: return unpaid balances
  return augmentVSData(VSGlobalStates);
}
