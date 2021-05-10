if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const {
  loadLiquidityMinersSnapshot
} = require('./loaders/loadLiquidityMinersSnapshot');
const { loadValidatorsSnapshot } = require('./loaders/loadValidatorsSnapshot');
// eslint-disable-next-line
const { getProcessedLMData, getProcessedVSData } = require('./process');
const { getUserData, getUserTimeSeriesData } = require('./user');

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
    // Use `KEY: VALUE` syntax to ensure `this` is bound correctly.
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
      GET_VS_KEY_VALUE: key => {
        return this.vsDataParsed[key];
      },
      GET_VS_USER_TIME_SERIES_DATA: address => {
        return getUserTimeSeriesData(this.vsDataParsed.processedData, address);
      },
      GET_VS_USER_DATA: ({ address, timeIndex }) => {
        return getUserData(this.vsDataParsed.processedData, {
          address,
          timeIndex
        });
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
    const [lMSnapshot, vsSnapshot] =
      process.env.LOCAL_SNAPSHOT_DEV_MODE === 'enabled'
        ? [
            require('../snapshots/snapshot_lm_latest.json'),
            require('../snapshots/snapshot_vs_latest.json')
          ]
        : await Promise.all([
            loadLiquidityMinersSnapshot(),
            loadValidatorsSnapshot()
          ]);
    /*
      V8 performance hack.
      Remove reference to previous results so they can be garbage collected.
      Otherwise, we run out of memory on `--max-old-space-size=4096`
    */
    this.lmDataParsed = undefined;
    this.vsDataParsed = undefined;

    console.time('getProcessedLMData');
    this.lmDataParsed = getProcessedLMData(lMSnapshot);
    console.timeEnd('getProcessedLMData');

    console.time('getProcessedVSData');
    this.vsDataParsed = getProcessedVSData(vsSnapshot);
    console.timeEnd('getProcessedVSData');
  }

  static start () {
    const instance = new this();
    instance.listenForParentThreadInvokations();
  }
}
BackgroundProcessor.start();

// Async JSON Serialization, if remiplementation is desired in future
// const saveJson = async (data) => {
//   await require('bfj').write(outputFilePath, data, {
//     Promise,
//     bufferLength: 512,
//     yieldRate: 500
//   })
//   console.log('finished!!!');
//   process.send(outputFilePath);
//   console.log('wrote file ' + outputFilePath)
// }
