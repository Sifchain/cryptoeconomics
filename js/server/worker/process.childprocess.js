if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const {
  CHECK_IF_PARSED_DATA_READY,
  RELOAD_AND_REPROCESS_SNAPSHOTS,
} = require('../constants/action-names');
const { createBoundActions } = require('./actions');
const {
  getProcessedLMData,
  getProcessedVSData,
} = require('../core/process/process');
const { retryOnFail } = require('../util/retryOnFail');
const {
  loadValidatorsSnapshot,
  loadLiquidityMinersSnapshot,
} = require('../core/load');
process.setMaxListeners(100000);
const crypto = require('crypto');

/*
  Handles:
    * Snapshot reloading
    * Snapshot processing
    * Remote invokation of getter actions on processor outputs
*/
class BackgroundProcessor {
  constructor() {
    // Set in this#reloadAndReprocessOnLoop
    this.lmDataParsed = null;
    this.vsDataParsed = null;
    this.previousLMSnapshotIdentifier = '';
    this.previousVSSnapshotIdentifier = '';
    this.actions = createBoundActions(this);
  }

  dispatch(action, payload) {
    return this.actions[action](payload);
  }

  async reloadAndReprocessSnapshots({ network }) {
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
          require('../../snapshots/snapshot_lm_latest.json'),
          require('../../snapshots/snapshot_vs_latest.json'),
        ]
      : await Promise.all([
          retryOnFail({
            fn: () => loadLiquidityMinersSnapshot(network),
            iterations: 5,
            waitFor: 1000,
          }),
          // retryOnFail({
          //   fn: () => loadValidatorsSnapshot(network),
          //   iterations: 5,
          //   waitFor: 1000,
          // }),
        ]);
    // require('fs').writeFileSync(
    //   require('path').join(__dirname, '../output.json'),
    //   JSON.stringify(lmSnapshotRes)
    // );
    try {
      const text = isInLocalSnapshotDevMode
        ? lmSnapshotRes
        : JSON.stringify(lmSnapshotRes);

      const snapshotIdentifier = crypto
        .createHash('md5')
        .update(text, 'utf8')
        .digest()
        .toString('hex');
      // const snapshotIdentifier = Object.values(json.data)
      // .map((queryRes) => queryRes[0].id)
      // .join('---');
      if (true || this.previousLMSnapshotIdentifier !== snapshotIdentifier) {
        /*
          V8 performance hack.
          Remove reference to previous results so they can be garbage collected.
          Otherwise, we run out of memory on `--max-old-space-size=4096`
        */
        const json = lmSnapshotRes;
        this.lmDataParsed = undefined;
        console.time('getProcessedLMData');
        this.lmDataParsed = getProcessedLMData(json);
        console.timeEnd('getProcessedLMData');
        this.previousLMSnapshotIdentifier = snapshotIdentifier;
      } else {
        console.log('LM: ✅');
      }
    } catch (error) {
      console.error('Error processing LM data');
      console.error(error);
      throw error;
    }
    return;
    try {
      const text = isInLocalSnapshotDevMode
        ? vsSnapshotRes
        : JSON.stringify(vsSnapshotRes);
      // const snapshotIdentifier = Object.values(json.data)
      //   .map((queryRes) => queryRes[0].id)
      //   .join('---');
      const snapshotIdentifier = crypto
        .createHash('md5')
        .update(text, 'utf8')
        .digest()
        .toString('hex');
      if (this.previousVSSnapshotIdentifier !== snapshotIdentifier) {
        /*
          V8 performance hack.
          Remove reference to previous results so they can be garbage collected.
          Otherwise, we run out of memory on `--max-old-space-size=4096`
        */
        const json = vsSnapshotRes;
        this.vsDataParsed = undefined;
        console.time('getProcessedVSData');
        this.vsDataParsed = getProcessedVSData(json);
        console.timeEnd('getProcessedVSData');
        this.previousVSSnapshotIdentifier = snapshotIdentifier;
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

  async waitForReadyState(processToWaitFor = undefined) {
    return new Promise((resolve, reject) => {
      // expires after 5 minutes
      const killAfter = 1000 * 60 * 5;
      let expiresAt = Date.now() + killAfter;
      (async () => {
        while (true) {
          const isReady = await this.dispatch(CHECK_IF_PARSED_DATA_READY);
          if (isReady) return resolve(true);
          if (Date.now() > expiresAt) {
            console.log('Timed out waiting for child process.');
            // this.restart();
            expiresAt = Date.now() + killAfter;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      })();
    });
  }

  // listens for actions dispatched to child process (this one)
  async listenForParentThreadInvokations() {
    process.on('message', async (msg) => {
      if (
        typeof msg !== 'object' ||
        msg.action !== 'invoke' ||
        !msg.payload ||
        !this.actions[msg.payload.fn]
      )
        return;
      // console.log(`ACTION: ${msg.payload.fn}`);
      try {
        const out = await this.actions[msg.payload.fn](...msg.payload.args);
        process.send({
          action: 'return',
          payload: {
            id: msg.payload.id,
            out,
            error: undefined,
          },
        });
      } catch (e) {
        console.error(e);
        process.send({
          action: 'return',
          payload: {
            id: msg.payload.id,
            out: undefined,
            error: e,
          },
        });
      }
    });
  }

  static keepAlive() {
    setInterval(() => {}, 1 << 30);
  }

  static startAsChildProcess() {
    const instance = new this();
    instance.listenForParentThreadInvokations();
  }

  static startAsMainProcess(network) {
    const instance = new this();
    (async () => {
      while (true) {
        try {
          await retryOnFail({
            fn: () =>
              instance.dispatch(RELOAD_AND_REPROCESS_SNAPSHOTS, {
                network: network,
              }),
            waitFor: 6000,
            iterations: 5,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 6));
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
  BackgroundProcessor,
};
