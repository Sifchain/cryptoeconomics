const { getUserData, getUserTimeSeriesData } = require('../user');
const { augmentUserVSData } = require('../augmentVSData');
const {
  getDateFromSnapshotIndex
} = require('../util/getDateFromSnapshotIndex');
const {
  CHECK_IF_PARSED_DATA_READY,
  CLEAR_PARSED_DATA,
  GET_LM_KEY_VALUE,
  GET_LM_USER_TIME_SERIES_DATA,
  GET_LM_USER_DATA,
  GET_LM_STACK_DATA,
  GET_VS_KEY_VALUE,
  GET_VS_USER_TIME_SERIES_DATA,
  GET_VS_USER_DATA,
  GET_VS_STACK_DATA,
  RELOAD_AND_REPROCESS_SNAPSHOTS,
  GET_SNAPSHOT_UPDATE_TIME_STATS
} = require('../constants/action-names');
const { EVENT_INTERVAL_MINUTES } = require('../config');
/*
  Actions invokable from `./main.js` via `processingHandler#dispatch(...)`
  Actions can only take one argument. Consolidate multiple args into an object.
*/
// Use `KEY: () => {}` syntax to ensure `processor` is bound correctly.
function actions (processor) {
  return {
    [GET_SNAPSHOT_UPDATE_TIME_STATS] () {
      const lastUpdatedAt = getDateFromSnapshotIndex(
        processor.lmDataParsed.currentSnapshotTimeseriesLength - 1
      ).valueOf();
      // add 6 to account for maximum server reload delay
      // add 2 to account for maximum server processing time
      const nextExpectedUpdateAt =
        lastUpdatedAt + (EVENT_INTERVAL_MINUTES + 6 + 2) * 60 * 1000;
      return {
        lastUpdatedAt,
        nextExpectedUpdateAt
      };
    },
    [RELOAD_AND_REPROCESS_SNAPSHOTS]: async ({ network }) => {
      return processor.reloadAndReprocessSnapshots({ network });
    },
    /* Internal Actions */
    [CHECK_IF_PARSED_DATA_READY]: () => {
      return !!processor.lmDataParsed && !!processor.vsDataParsed;
    },
    [CLEAR_PARSED_DATA]: () => {
      processor.lmDataParsed = undefined;
      processor.vsDataParsed = undefined;
    },
    /* LM Actions */
    [GET_LM_KEY_VALUE]: key => {
      return processor.lmDataParsed[key];
    },
    [GET_LM_USER_TIME_SERIES_DATA]: address => {
      augmentUserVSData(address, processor.lmDataParsed.processedData);
      return getUserTimeSeriesData(
        processor.lmDataParsed.processedData,
        address
      );
    },
    [GET_LM_USER_DATA]: payload => {
      augmentUserVSData(payload.address, processor.lmDataParsed.processedData);
      return getUserData(processor.lmDataParsed.processedData, payload);
    },
    [GET_LM_STACK_DATA]: () => {
      return processor.lmDataParsed.stackClaimableRewardData;
    },

    /* VS Actions */
    // GET_VS_UNCLAIMED_DELEGATED_REWARDS: (key) => {
    //   processor.lmDataParsed;
    // },
    [GET_VS_KEY_VALUE]: key => {
      return processor.vsDataParsed[key];
    },
    [GET_VS_USER_TIME_SERIES_DATA]: address => {
      augmentUserVSData(address, processor.vsDataParsed.processedData);
      return getUserTimeSeriesData(
        processor.vsDataParsed.processedData,
        address
      );
    },
    [GET_VS_USER_DATA]: async ({ address, timeIndex }) => {
      augmentUserVSData(address, processor.vsDataParsed.processedData);
      const userDataOut = await getUserData(
        processor.vsDataParsed.processedData,
        {
          address,
          timeIndex
        }
      );
      return userDataOut;
    },
    [GET_VS_STACK_DATA]: () => {
      return processor.vsDataParsed.stackClaimableRewardData;
    }
  };
}

module.exports.createBoundActions = binding => {
  return actions(binding);
};
