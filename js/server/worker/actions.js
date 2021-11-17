const { getUserData, getUserTimeSeriesData } = require('../user');
const { augmentUserVSData } = require('../core/process/augmentVSData');
const {
  getDateFromSnapshotIndex,
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
  GET_SNAPSHOT_UPDATE_TIME_STATS,
  GET_LM_DISPENSATION_JOB,
  GET_VS_DISPENSATION_JOB,
  GET_LM_CURRENT_APY_SUMMARY,
} = require('../constants/action-names');
const configs = require('../config');
const { getTimeIndex } = require('../util/getTimeIndex');
// const { retryOnFail } = require('../util/retryOnFail');
/*
  Actions invokable from `./main.js` via `processingHandler#dispatch(...)`
  Actions can only take one argument. Consolidate multiple args into an object.
*/
// Use `KEY: () => {}` syntax to ensure `processor` is bound correctly.
function actions(processor) {
  return {
    [GET_LM_CURRENT_APY_SUMMARY]({ programName }) {
      console.log(programName);
      const { EVENT_INTERVAL_MINUTES } = configs[programName];
      // could easily make this a FOMO calculator endpoint
      const timeIndex = getTimeIndex('now', programName);
      const currentTimestampState =
        processor.lmDataParsed.processedData[timeIndex] ||
        processor.lmDataParsed.processedData[
          processor.lmDataParsed.processedData.length - 1
        ];
      const currentTotal = currentTimestampState.totalDepositedAmount;
      const sampleDeposit = 10;
      const sampleDepositDominanceRatio =
        sampleDeposit / (currentTotal + sampleDeposit);
      const bucketEvent = currentTimestampState.rewardBuckets[0];
      console.log(
        bucketEvent,
        timeIndex,
        sampleDepositDominanceRatio,
        currentTotal
      );
      if (!bucketEvent) return 0;
      let rewardPerInterval = bucketEvent.initialRowan / bucketEvent.duration;
      if (currentTimestampState.rewardBuckets[1]) {
        const bucket2 = currentTimestampState.rewardBuckets[1];
        rewardPerInterval += bucket2.initialRowan / bucket2.duration;
      }
      const sampleRewardsPerInterval =
        sampleDepositDominanceRatio * rewardPerInterval;
      const intervalsPerYear = (60 * 24 * 365) / EVENT_INTERVAL_MINUTES;
      console.log({
        intervalsPerYear,
        sampleRewardsPerInterval,
        rewardPerInterval,
        sampleDepositDominanceRatio,
      });
      const sampleRewardProjectedOneYear =
        sampleRewardsPerInterval * intervalsPerYear;
      // convert to percentage
      return (sampleRewardProjectedOneYear / sampleDeposit) * 100;
    },
    [GET_LM_DISPENSATION_JOB]({ programName, timestamp = 'now' }) {
      const timeIndex = getTimeIndex(timestamp, programName);
      const currentTimestampState =
        processor.lmDataParsed.processedData[timeIndex];
      return currentTimestampState.createDispensationJob({
        rewardProgramName: programName,
      });
    },
    [GET_VS_DISPENSATION_JOB]({ programName, timestamp = 'now' }) {
      const timeIndex = getTimeIndex(timestamp, programName);
      const currentTimestampState =
        processor.vsDataParsed.processedData[timeIndex];
      return currentTimestampState.createDispensationJob({
        rewardProgramName: programName,
      });
    },
    [GET_SNAPSHOT_UPDATE_TIME_STATS]({ rewardProgram }) {
      const { EVENT_INTERVAL_MINUTES } = configs[rewardProgram];
      const lastUpdatedAt = getDateFromSnapshotIndex(
        processor.lmDataParsed.snapshotTimeseriesFinalIndex - 1,
        rewardProgram
      ).valueOf();
      // add 6 to account for maximum server reload delay
      // add 2 to account for maximum server processing time
      const nextExpectedUpdateAt =
        lastUpdatedAt + (EVENT_INTERVAL_MINUTES + 6 + 2) * 60 * 1000;
      return {
        lastUpdatedAt,
        nextExpectedUpdateAt,
      };
    },
    [RELOAD_AND_REPROCESS_SNAPSHOTS]: async ({ network, rewardProgram }) => {
      // For testing fault-tolerance
      // if (Math.random() > 0.25) {
      //   process.exit();
      // }
      // if (Math.random() > 0.5) {
      //   throw new Error('SAMPLE ERROR!JSLFJSFJ');
      // }
      return processor.reloadAndReprocessSnapshots({ network, rewardProgram });
    },
    /* Internal Actions */
    [CHECK_IF_PARSED_DATA_READY]: () => {
      return !!processor.lmDataParsed; //&& !!processor.vsDataParsed;
    },
    [CLEAR_PARSED_DATA]: () => {
      processor.lmDataParsed = undefined;
      processor.vsDataParsed = undefined;
    },
    /* LM Actions */
    [GET_LM_KEY_VALUE]: (key) => {
      return processor.lmDataParsed[key];
    },
    [GET_LM_USER_TIME_SERIES_DATA]: ({ rewardProgram, address }) => {
      augmentUserVSData(
        address,
        processor.lmDataParsed.processedData,
        rewardProgram
      );
      return getUserTimeSeriesData(
        processor.lmDataParsed.processedData,
        address
      );
    },
    [GET_LM_USER_DATA]: (payload) => {
      augmentUserVSData(
        payload.address,
        processor.lmDataParsed.processedData,
        payload.rewardProgram
      );
      return getUserData(processor.lmDataParsed.processedData, payload);
    },
    [GET_LM_STACK_DATA]: () => {
      return processor.lmDataParsed.stackClaimableRewardData;
    },
    /* VS Actions */
    // GET_VS_UNCLAIMED_DELEGATED_REWARDS: (key) => {
    //   processor.lmDataParsed;
    // },
    [GET_VS_KEY_VALUE]: (key) => {
      return processor.vsDataParsed[key];
    },
    [GET_VS_USER_TIME_SERIES_DATA]: (address) => {
      // needs to take in programName
      augmentUserVSData(address, processor.vsDataParsed.processedData);
      return getUserTimeSeriesData(
        processor.vsDataParsed.processedData,
        address
      );
    },
    [GET_VS_USER_DATA]: async ({ address, timeIndex, rewardProgram }) => {
      augmentUserVSData(
        address,
        processor.vsDataParsed.processedData,
        rewardProgram
      );
      const userDataOut = await getUserData(
        processor.vsDataParsed.processedData,
        {
          address,
          timeIndex,
          rewardProgram,
        }
      );
      return userDataOut;
    },
    [GET_VS_STACK_DATA]: () => {
      return processor.vsDataParsed.stackClaimableRewardData;
    },
  };
}

module.exports.createBoundActions = (binding) => {
  return actions(binding);
};
