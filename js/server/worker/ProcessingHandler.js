const { fork } = require('child_process');
const path = require('path');
const {
  CHECK_IF_PARSED_DATA_READY,
  RELOAD_AND_REPROCESS_SNAPSHOTS
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
  constructor (network = MAINNET) {
    this.network = network;
    this.freshProcess = new SubscriberProcess({ network: network });
    this.staleProcess = new SubscriberProcess({ network: network });
    this.readyStatePromise = undefined;
  }

  static init (network = MAINNET) {
    const instance = new this(network);
    instance.start();
    return instance;
  }

  dispatch (...args) {
    return retryOnFail({
      fn: () => this.freshProcess.dispatch(...args),
      iterations: 5,
      waitFor: 1000
    });
  }

  async start () {
    this.beginProcessRotation();
  }

  async waitForReadyState () {
    if (this.readyStatePromise) {
      return this.readyStatePromise;
    }
    const promise = new Promise(resolve => {
      // expires after 5 minutes
      (async () => {
        while (true) {
          try {
            let processToWaitFor = this.freshProcess.isSleeping
              ? this.staleProcess
              : this.freshProcess;
            const isReady = await processToWaitFor.dispatch(
              CHECK_IF_PARSED_DATA_READY
            );
            if (isReady) {
              this.readyStatePromise = undefined;
              return resolve(true);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (e) {
            console.error(e);
          }
        }
      })();
    });
    this.readyStatePromise = promise;
    return promise;
  }

  log (msg) {
    console.log(`${this.network}:`, msg);
  }

  async beginProcessRotation () {
    this.freshProcess.wake();
    this.staleProcess.wake();
    while (true) {
      try {
        this.log(`Waking stale process: #${this.staleProcess.id}.`);
        // this.staleProcess.wake();
        await this.staleProcess.dispatch(RELOAD_AND_REPROCESS_SNAPSHOTS, {
          network: this.network
        });
        // await this.waitForReadyState(this.staleProcess);

        [this.freshProcess, this.staleProcess] = [
          this.staleProcess,
          this.freshProcess
        ];
        this.log(
          `#${this.freshProcess.id}-ready-Rotated-#${this.staleProcess.id}-to-#${this.freshProcess.id}`
        );
        // free up the memory in what was previously `this.freshProcess`
        // this.staleProcess.sleep();
        this.log(`Waiting for snapshot data to expire...`);
        const onErrorOrExit = this.freshProcess.waitForErrorOrExit();
        await Promise.race([
          onErrorOrExit.promise,
          new Promise(resolve =>
            setTimeout(() => {
              resolve();
              onErrorOrExit.cancel();
            }, RELOAD_INTERVAL)
          )
        ]);
        this.log(`Snapshot data expired.`);
      } catch (e) {
        this.log('🔁 Process Rotation Error:');
        console.error(e);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Wait until snapshot data is expired
    }
  }
}

let idCounter = 0;
let invokationCounter = 0;
class SubscriberProcess {
  constructor ({ network }) {
    this.network = network;
    this.id = idCounter++;
    this.childProcess = null;
    this.isRestarting = false;
    this.isSleeping = true;
  }

  wake () {
    this.isSleeping = false;
    this.childProcess = this.fork();
  }

  sleep () {
    this.isSleeping = true;
    if (this.childProcess && this.childProcess.connected) {
      this.childProcess.kill();
    }
  }

  log (msg) {
    console.log(`${this.network}:${msg}`);
  }

  dispatch (method, arg) {
    const invokationId = (invokationCounter++).toString();
    this.log(`${method}:DISPATCH`);
    const invokation = {
      action: 'invoke',
      payload: {
        fn: method,
        args: [arg],
        id: invokationId
      }
    };
    return new Promise((resolve, reject) => {
      let timerName = `${this.network}:${method}:${invokationId}`;
      console.time(timerName);
      const errorHandler = async error => {
        this.log(`${method}:KILLED`);
        console.timeEnd(timerName);
        reject(new Error(error));
      };
      const messageHandler = async msg => {
        const isValidInvokationResponse =
          typeof msg === 'object' &&
          msg.payload &&
          msg.action === 'return' &&
          msg.payload.id === invokationId;
        if (!isValidInvokationResponse) return;
        this.childProcess.off('message', messageHandler);
        this.childProcess.off('error', errorHandler);
        this.childProcess.off('exit', errorHandler);
        console.timeEnd(timerName);
        if (msg.payload.error) {
          this.log(`${method}:REJECT`);
          reject(msg.payload.error);
        } else {
          this.log(`${method}:RESOLVE`);
          resolve(msg.payload.out);
        }
      };
      this.childProcess.on('message', messageHandler);
      this.childProcess.on('error', errorHandler);
      this.childProcess.on('exit', errorHandler);
      this.childProcess.send(invokation);
    });
  }

  async restart () {
    this.isRestarting = true;
    try {
      let exited = Promise.resolve();
      if (this.childProcess.connected) {
        exited = new Promise(resolve => {
          this.childProcess.once('exit', () => {
            // new childProcess is created above in `exit` event handler, which will execute before this
            resolve();
          });
          this.childProcess.kill();
        });
      }
      await Promise.all([exited]);
      this.childProcess = this.fork();
    } catch (e) {
      console.error(e);
    }
    this.isRestarting = false;
  }

  waitForErrorOrExit () {
    let cancel = () => {};
    let promise = new Promise(resolve => {
      this.childProcess.once('error', resolve);
      this.childProcess.once('exit', resolve);
      cancel = () => {
        this.childProcess.off('error', resolve);
        this.childProcess.off('exit', resolve);
      };
    });
    return {
      promise,
      cancel
    };
  }

  fork () {
    const p = fork(path.join(__dirname, `process.childprocess.js`));
    p.setMaxListeners(100000);
    p.on('error', e => {
      if (!this.isRestarting) this.restart();
      this.log(`ERROR:`);
      console.error(e);
    });
    p.on('exit', (code, signal) => {
      if (!this.isRestarting && !this.isSleeping) this.restart();
      const prefix = this.isRestarting
        ? 'RESTART:'
        : this.isSleeping
        ? 'SLEEP:'
        : 'EXIT:';
      this.log(
        `${prefix} childprocess exited with code ${code}, signal: ${signal}`
      );
    });
    return p;
  }
}

module.exports = {
  ProcessingHandler
};
