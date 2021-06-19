const { fork } = require('child_process');
const path = require('path');
const {
  CHECK_IF_PARSED_DATA_READY,
  RELOAD_AND_REPROCESS_SNAPSHOTS,
} = require('../constants/action-names');
const { MAINNET } = require('../constants/snapshot-source-names');
const { retryOnFail } = require('../util/retryOnFail');

/* 
  Reloads & re-processes Miner & Validator data once every `RELOAD_INTERVAL`
*/

const minutesUntilReload = 1;
const RELOAD_INTERVAL = minutesUntilReload * 60 * 1000;

if (RELOAD_INTERVAL < 6 * 60 * 1000) {
  console.warn('RELOAD INTERVAL SET EXTREMELY LOW');
}

// Provides #dispatch method by which the express router endpoints can interact with processed data
class ProcessingHandler {
  constructor(network = MAINNET) {
    this.network = network;
    this.freshProcess = new SubscriberProcess();
    this.staleProcess = new SubscriberProcess();
  }

  static init(network = MAINNET) {
    const instance = new this(network);
    instance.start();
    return instance;
  }

  dispatch(...args) {
    return retryOnFail({
      fn: () => this.freshProcess.dispatch(...args),
      iterations: 5,
      waitFor: 1000,
    });
  }

  async start() {
    this.beginProcessRotation();
  }

  async waitForReadyState(processToWaitFor = undefined) {
    return new Promise((resolve) => {
      // expires after 5 minutes
      (async () => {
        while (true) {
          try {
            processToWaitFor =
              processToWaitFor ||
              (this.freshProcess.isSleeping
                ? this.staleProcess
                : this.freshProcess);
            const isReady = await processToWaitFor.dispatch(
              CHECK_IF_PARSED_DATA_READY
            );
            if (isReady) return resolve(true);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (e) {
            console.error(e);
          }
        }
      })();
    });
  }

  async beginProcessRotation() {
    this.freshProcess.wake();
    this.staleProcess.wake();
    this.freshProcess.dispatch(RELOAD_AND_REPROCESS_SNAPSHOTS, {
      network: this.network,
    });
    while (true) {
      try {
        console.log(`Waiting for snapshot data to expire...`);
        // Wait until snapshot data is expired
        await new Promise((resolve) => setTimeout(resolve, RELOAD_INTERVAL));
        console.log(`Snapshot data expired.`);

        // console.log(`Waking stale process: #${this.staleProcess.id}.`);
        // this.staleProcess.wake();
        await this.staleProcess.dispatch(RELOAD_AND_REPROCESS_SNAPSHOTS, {
          network: this.network,
        });
        await this.waitForReadyState(this.staleProcess);

        console.log(
          `Process #${this.staleProcess.id} ready. Rotated from Process #${this.freshProcess.id} to Process #${this.staleProcess.id}`
        );
        [this.freshProcess, this.staleProcess] = [
          this.staleProcess,
          this.freshProcess,
        ];
        // free up the memory in what was previously `this.freshProcess`
        // this.staleProcess.sleep();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

let idCounter = 0;
let invokationCounter = 0;
class SubscriberProcess {
  constructor() {
    this.id = idCounter++;
    this.childProcess = null;
    this.isRestarting = false;
    this.isSleeping = true;
    this.pendingActions = new Map();
  }

  wake() {
    this.isSleeping = false;
    this.childProcess = this.fork();
  }

  sleep() {
    this.isSleeping = true;
    if (this.childProcess && this.childProcess.connected) {
      this.childProcess.kill();
    }
  }

  dispatch(method, arg) {
    const invokationId = (invokationCounter++).toString();
    console.log(`Dispatch #${invokationId}: ${method}`);
    const invokation = {
      action: 'invoke',
      payload: {
        fn: method,
        args: [arg],
        id: invokationId,
      },
    };
    const promise = new Promise((resolve, reject) => {
      const handler = async (msg) => {
        const isValidInvokationResponse =
          typeof msg === 'object' &&
          msg.payload &&
          msg.action === 'return' &&
          msg.payload.id === invokationId;
        if (!isValidInvokationResponse) return;
        this.pendingActions.delete(invokationId);
        this.childProcess.off('message', handler);
        if (msg.payload.error) {
          console.log(`Reject #${invokationId}: ${method}`);
          reject(msg.payload.error);
        } else {
          console.log(`Resolve #${invokationId}: ${method}`);
          resolve(msg.payload.out);
        }
      };
      this.childProcess.on('message', handler);
    });
    this.pendingActions.set(invokationId, {
      invokation,
      promise,
    });
    this.childProcess.send(invokation);
  }

  async resendEachPendingAction() {
    for (let [_id, pendingAction] of this.pendingActions) {
      try {
        this.childProcess.send(pendingAction.invokation);
        await pendingAction.promise;
      } catch (e) {
        console.error(e);
      }
    }
  }

  async restart() {
    this.isRestarting = true;
    try {
      let exited = Promise.resolve();
      if (this.childProcess.connected) {
        exited = new Promise((resolve) => {
          this.childProcess.once('exit', () => {
            // new childProcess is created above in `exit` event handler, which will execute before this
            resolve();
          });
          this.childProcess.kill();
        });
      }
      await Promise.all([exited]);
      this.childProcess = this.fork();
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.resendEachPendingAction();
    } catch (e) {
      console.error(e);
    }
    this.isRestarting = false;
  }

  fork() {
    const p = fork(path.join(__dirname, `process.childprocess.js`));
    p.setMaxListeners(100000);
    p.on('error', (e) => {
      if (!this.isRestarting) this.restart();
      console.error(e);
    });
    p.on('exit', (code, signal) => {
      if (!this.isRestarting && !this.isSleeping) this.restart();
      const prefix = this.isRestarting
        ? 'RESTART:'
        : this.isSleeping
        ? 'SLEEP:'
        : 'EXIT:';
      console.log(
        `${prefix} childprocess exited with code ${code}, signal: ${signal}`
      );
    });
    return p;
  }
}

module.exports = {
  ProcessingHandler,
};
