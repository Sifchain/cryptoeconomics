if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const {
  loadLiquidityMinersSnapshot
} = require('./loaders/loadLiquidityMinersSnapshot');
const { loadValidatorsSnapshot } = require('./loaders/loadValidatorsSnapshot');
// eslint-disable-next-line
const { getProcessedLMData, getProcessedVSData } = require('./process');
const { getUserData, getUserTimeSeriesData } = require('./user');
const { retryOnFail } = require('./util/retryOnFail');
process.setMaxListeners(100000);

/*
  Handles:
    * Snapshot reloading
    * Snapshot processing
    * Remote invokation of getter actions on processor outputs
*/
class BackgroundProcessor {
  constructor () {
    // Set in this#reloadAndReprocessOnLoop
    this.lmDataParsed = null;
    this.vsDataParsed = null;
  }

  /*
    Actions invokable from `./main.js` via `processingHandler#dispatch(...)`
    Actions can only take one argument. Consolidate multiple args into an object.
  */
  get actions () {
    // Use `KEY: () => {}` syntax to ensure `this` is bound correctly.
    return {
      /* Internal Actions */
      CHECK_IF_PARSED_DATA_READY: () => {
        return !!this.lmDataParsed && !!this.vsDataParsed;
      },
      CLEAR_PARSED_DATA: () => {
        this.lmDataParsed = undefined;
        this.vsDataParsed = undefined;
      },
      LOAD_AND_PROCESS_SNAPSHOTS: () => {
        return this.loadAndProcessSnapshots();
      },
      /* LM Actions */
      GET_LM_KEY_VALUE: key => {
        return this.lmDataParsed[key];
      },
      GET_LM_USER_TIME_SERIES_DATA: address => {
        return getUserTimeSeriesData(this.lmDataParsed.processedData, address);
      },
      GET_LM_USER_DATA: payload => {
        return getUserData(this.lmDataParsed.processedData, payload);
      },
      GET_LM_STACK_DATA: () => {
        return this.lmDataParsed.stackClaimableRewardData;
      },

      /* VS Actions */
      // GET_VS_UNCLAIMED_DELEGATED_REWARDS: (key) => {
      //   this.lmDataParsed;
      // },
      GET_VS_KEY_VALUE: key => {
        return this.vsDataParsed[key];
      },
      GET_VS_USER_TIME_SERIES_DATA: address => {
        return getUserTimeSeriesData(this.vsDataParsed.processedData, address);
      },
      GET_VS_USER_DATA: async ({ address, timeIndex }) => {
        const userDataOut = await getUserData(this.vsDataParsed.processedData, {
          address,
          timeIndex
        });
        return userDataOut;
      },
      GET_VS_STACK_DATA: () => {
        return this.vsDataParsed.stackClaimableRewardData;
      }
    };
  }

  // listens for actions dispatched to child process (this one)
  async listenForParentThreadInvokations () {
    process.on('message', async msg => {
      if (
        typeof msg !== 'object' ||
        msg.action !== 'invoke' ||
        !msg.payload ||
        !this.actions[msg.payload.fn]
      )
        return;
      try {
        const out = await this.actions[msg.payload.fn](...msg.payload.args);
        process.send({
          action: 'return',
          payload: {
            id: msg.payload.id,
            out,
            error: undefined
          }
        });
      } catch (e) {
        process.send({
          action: 'return',
          payload: {
            id: msg.payload.id,
            out: undefined,
            error: e
          }
        });
      }
    });
  }

  async loadAndProcessSnapshots () {
    if (process.env.LOCAL_SNAPSHOT_DEV_MODE === 'enabled') {
      console.log(
        'LOCAL_SNAPSHOT_DEV_MODE enabled - Will not refresh or reprocess snapshots.'
      );
    }

    const isInLocalSnapshotDevMode =
      process.env.LOCAL_SNAPSHOT_DEV_MODE === 'enabled';
    if (isInLocalSnapshotDevMode) {
      console.warn(
        'Local Snapshot Dev Mode Enabled! Will not load fresh snapshot data!'
      );
    }
    const [lMSnapshot, vsSnapshot] = isInLocalSnapshotDevMode
      ? [
          require('../snapshots/snapshot_lm_latest.json'),
          require('../snapshots/snapshot_vs_latest.json')
        ]
      : await Promise.all([
          retryOnFail({
            fn: () => loadLiquidityMinersSnapshot(),
            iterations: 5,
            waitFor: 1000
          }),
          retryOnFail({
            fn: () => loadValidatorsSnapshot(),
            iterations: 5,
            waitFor: 1000
          })
        ]);

    /*
      V8 performance hack.
      Remove reference to previous results so they can be garbage collected.
      Otherwise, we run out of memory on `--max-old-space-size=4096`
    */
    this.lmDataParsed = undefined;
    this.vsDataParsed = undefined;

    try {
      console.time('getProcessedLMData');
      this.lmDataParsed = getProcessedLMData(lMSnapshot);
      console.timeEnd('getProcessedLMData');
    } catch (error) {
      console.error('Error processing LM data');
      console.error(error);
      throw error;
    }

    try {
      console.time('getProcessedVSData');
      this.vsDataParsed = getProcessedVSData(vsSnapshot);
      console.timeEnd('getProcessedVSData');
    } catch (error) {
      console.error('Error processing VS data');
      console.error(error);
      throw error;
    }

    const used = process.memoryUsage();
    for (let key in used) {
      console.log(
        `${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`
      );
    }
  }

  static start () {
    const instance = new this();
    instance.listenForParentThreadInvokations();
  }
}
BackgroundProcessor.start();
