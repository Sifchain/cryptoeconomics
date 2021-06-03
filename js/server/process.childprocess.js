if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const { augmentUserVSData } = require('./augmentVSData');
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
    this.previousLMSnapshotLength = 0;
    this.previousVSSnapshotLength = 0;
  }

  dispatch (action, payload) {
    return this.actions[action](payload);
  }

  async waitForReadyState (processToWaitFor = undefined) {
    return new Promise((resolve, reject) => {
      // expires after 5 minutes
      const killAfter = 1000 * 60 * 5;
      let expiresAt = Date.now() + killAfter;
      (async () => {
        while (true) {
          const isReady = await this.dispatch('CHECK_IF_PARSED_DATA_READY');
          if (isReady) return resolve(true);
          if (Date.now() > expiresAt) {
            console.log('Timed out waiting for child process.');
            // this.restart();
            expiresAt = Date.now() + killAfter;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      })();
    });
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
      /* LM Actions */
      GET_LM_KEY_VALUE: key => {
        return this.lmDataParsed[key];
      },
      GET_LM_USER_TIME_SERIES_DATA: address => {
        augmentUserVSData(address, this.lmDataParsed.processedData);
        return getUserTimeSeriesData(this.lmDataParsed.processedData, address);
      },
      GET_LM_USER_DATA: payload => {
        augmentUserVSData(payload.address, this.lmDataParsed.processedData);
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
        augmentUserVSData(address, this.vsDataParsed.processedData);
        return getUserTimeSeriesData(this.vsDataParsed.processedData, address);
      },
      GET_VS_USER_DATA: async ({ address, timeIndex }) => {
        augmentUserVSData(address, this.vsDataParsed.processedData);
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
        console.error(e);
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
    const [lmSnapshotRes, vsSnapshotRes] = isInLocalSnapshotDevMode
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

    try {
      const lMSnapshotText = await lmSnapshotRes.text();
      const snapshotLen = lMSnapshotText.length;
      if (this.previousLMSnapshotLength < snapshotLen) {
        /*
          V8 performance hack.
          Remove reference to previous results so they can be garbage collected.
          Otherwise, we run out of memory on `--max-old-space-size=4096`
        */
        this.lmDataParsed = undefined;
        console.time('getProcessedLMData');
        const json = JSON.parse(lMSnapshotText);
        this.lmDataParsed = getProcessedLMData(json);
        console.timeEnd('getProcessedLMData');
        this.previousLMSnapshotLength = snapshotLen;
      } else {
        console.log('LM: ✅');
      }
    } catch (error) {
      console.error('Error processing LM data');
      console.error(error);
      throw error;
    }

    try {
      const vsSnapshotText = await vsSnapshotRes.text();
      const snapshotLen = vsSnapshotText.length;

      if (this.previousVSSnapshotLength < snapshotLen) {
        /*
          V8 performance hack.
          Remove reference to previous results so they can be garbage collected.
          Otherwise, we run out of memory on `--max-old-space-size=4096`
        */
        this.vsDataParsed = undefined;
        const json = JSON.parse(vsSnapshotText);
        console.time('getProcessedVSData');
        this.vsDataParsed = getProcessedVSData(json);
        console.timeEnd('getProcessedVSData');
        this.previousVSSnapshotLength = snapshotLen;
        const used = process.memoryUsage();
        for (let key in used) {
          console.log(
            `${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`
          );
        }
      } else {
        console.log('VS: ✅');
      }
    } catch (error) {
      console.error('Error processing VS data');
      console.error(error);
      throw error;
    }
  }

  static keepAlive () {
    setInterval(() => {}, 1 << 30);
  }

  static startAsChildProcess () {
    const instance = new this();
    instance.listenForParentThreadInvokations();
    instance.loadAndProcessSnapshots();
  }

  static startAsMainProcess () {
    const instance = new this();
    (async () => {
      while (true) {
        try {
          await retryOnFail({
            fn: () => instance.loadAndProcessSnapshots(),
            waitFor: 6000,
            iterations: 5
          });
          await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 6));
        } catch (e) {
          console.error(e);
        }
      }
    })();
    return instance;
  }
}
if (require.main === module) {
  BackgroundProcessor.keepAlive();
  BackgroundProcessor.startAsChildProcess();
}

module.exports = {
  BackgroundProcessor
};
