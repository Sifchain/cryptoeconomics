const { augmentLMData } = require('./augmentLMData');
const { augmentVSData } = require('./augmentVSData');

const { remapLMAddresses } = require('./util/lm-util');
const { remapVSAddresses } = require('./util/vs-util');

const { processLMGlobalState } = require('./process-lm');
const { processVSGlobalState } = require('./process-vs');

const {
  EVENT_INTERVAL_MINUTES,
  NUMBER_OF_INTERVALS_TO_RUN,
  VS_STARTING_GLOBAL_STATE,
  LM_STARTING_GLOBAL_STATE
} = require('./config');
// const { getTimeIndex } = require("./util/getTimeIndex");

// const snapshotLM = require("../snapshots/snapshot_lm_latest.json");
// const snapshotVS = require("../snapshots/snapshot_vs_latest.json");

exports.getProcessedLMData = snapshotLM => {
  const LMAddresses = snapshotLM.data.snapshots_new[0].snapshot_data;

  const LMTimeIntervalEvents = remapLMAddresses(
    LMAddresses,
    EVENT_INTERVAL_MINUTES
  );

  const LMGlobalStates = [LM_STARTING_GLOBAL_STATE];

  for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
    const lastGlobalState = LMGlobalStates[LMGlobalStates.length - 1];
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const events = LMTimeIntervalEvents['' + timestamp] || [];
    const newGlobalState = processLMGlobalState(
      lastGlobalState,
      timestamp,
      events
    );
    LMGlobalStates.push(newGlobalState);
  }

  // TODO: remove past dispensations
  // TODO: return unpaid balances
  return augmentLMData(LMGlobalStates);
};

exports.getProcessedVSData = snapshotVS => {
  const VSValidatorAddresses =
    snapshotVS.data.snapshots_validators[0].snapshot_data;

  const VSTimeIntervalEvents = remapVSAddresses(
    VSValidatorAddresses,
    EVENT_INTERVAL_MINUTES
  );

  const VSGlobalStates = [VS_STARTING_GLOBAL_STATE];
  for (let i = 0; i < NUMBER_OF_INTERVALS_TO_RUN; i++) {
    const lastGlobalState = VSGlobalStates[VSGlobalStates.length - 1];
    const timestamp = i * EVENT_INTERVAL_MINUTES;
    const events = VSTimeIntervalEvents['' + timestamp] || [];
    const newGlobalState = processVSGlobalState(
      lastGlobalState,
      timestamp,
      events
    );
    VSGlobalStates.push(newGlobalState);
  }

  // TODO: remove past dispensations
  // TODO: return unpaid balances
  return augmentVSData(VSGlobalStates);
};
