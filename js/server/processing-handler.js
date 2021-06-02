const { fork } = require('child_process');
const path = require('path');
const { retryOnFail } = require('./util/retryOnFail');
/* 
  Reloads & re-processes Miner & Validator data once every `RELOAD_INTERVAL`
*/

const minutesUntilReload = process.env.NODE_ENV === 'production' ? 6 : 0.1;
const RELOAD_INTERVAL = minutesUntilReload * 60 * 1000;

if (RELOAD_INTERVAL < 6 * 60 * 1000) {
  console.warn('RELOAD INTERVAL SET EXTREMELY LOW');
}

// Provides #dispatch method by which the express router endpoints can interact with processed data
class ProcessingHandler {
  constructor () {
    this.freshProcess = new SubscriberProcess();
    this.staleProcess = new SubscriberProcess();
  }

  static init () {
    const instance = new this();
    instance.start();
    return instance;
  }

  dispatch (...args) {
    return this.freshProcess.dispatch(...args);
  }

  async start () {
    await Promise.all([this.freshProcess.start(), this.staleProcess.start()]);
    this.beginProcessRotation();
  }

  async beginProcessRotation () {
    this.freshProcess.dispatch('LOAD_AND_PROCESS_SNAPSHOTS');
    await this.freshProcess.waitForReadyState();
    while (true) {
      try {
        /* 
					a little buffer for any code still using a reference to staleProcess
					before we clear out the data
				*/
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.staleProcess.dispatch('CLEAR_PARSED_DATA');
        // await this.staleProcess.restart();
        // Wait until snapshot data is expired
        await new Promise(resolve => setTimeout(resolve, RELOAD_INTERVAL));
        await this.staleProcess.dispatch('LOAD_AND_PROCESS_SNAPSHOTS');
        console.log('switching child processes');
        [this.freshProcess, this.staleProcess] = [
          this.staleProcess,
          this.freshProcess
        ];
      } catch (e) {
        console.error(e);
      }
    }
  }
}

class SubscriberProcess {
  constructor () {
    this.childProcess = null;
    this.isRestarting = false;
  }

  start () {
    this.childProcess = this.fork();
    return new Promise(resolve => {
      this.childProcess.on('spawn', resolve);
    });
  }

  dispatch (...args) {
    return retryOnFail({
      fn: () => this.unsafeDispatch(...args),
      iterations: 20,
      waitFor: 250
    });
  }

  unsafeDispatch (method, payload) {
    const invokationId = Math.random().toString();
    this.childProcess.send({
      action: 'invoke',
      payload: {
        fn: method,
        args: [payload],
        id: invokationId
      }
    });
    return new Promise((resolve, reject) => {
      const handler = async msg => {
        if (typeof msg !== 'object' || msg.action !== 'return' || !msg.payload)
          return;
        if (msg.payload.id !== invokationId) return;
        if (msg.payload.error) {
          reject(msg.payload.error);
        }
        resolve(msg.payload.out);
        this.childProcess.off('message', handler);
      };
      this.childProcess.on('message', handler);
    });
  }

  async waitForReadyState () {
    return new Promise((resolve, reject) => {
      // expires after 5 minutes
      const killAfter = 1000 * 60 * 5;
      let expiresAt = Date.now() + killAfter;
      (async () => {
        while (true) {
          let isReady = await this.dispatch('CHECK_IF_PARSED_DATA_READY');
          if (isReady) return resolve(true);
          if (Date.now() > expiresAt) {
            console.log('Timed out waiting for child process. Reloading');
            this.restart();
            expiresAt = Date.now() + killAfter;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })();
    });
  }

  async restart () {
    this.isRestarting = true;
    try {
      const exited = this.childProcess.killed
        ? Promise.resolve()
        : new Promise(resolve => {
            this.childProcess.once('exit', () => {
              // new childProcess is created above in `exit` event handler, which will execute before this
              resolve();
            });
            this.childProcess.kill();
          });
      this.childProcess = this.fork();
      const restarted = this.childProcess.connected
        ? Promise.resolve()
        : new Promise(resolve => {
            this.childProcess.once('spawn', () => {
              // new childProcess is created above in `exit` event handler, which will execute before this
              resolve();
            });
          });
      await Promise.all([exited, restarted]);
    } catch (e) {
      console.error(e);
    }
    this.isRestarting = false;
  }

  fork () {
    const p = fork(path.join(__dirname, `process.childprocess.js`));

    p.setMaxListeners(100000);
    p.on('error', e => {
      if (!this.isRestarting) this.restart();
      console.error(e);
    });
    p.on('exit', code => {
      if (!this.isRestarting) this.restart();
      console.log('childprocess exited with code ' + code);
    });
    return p;
  }
}

module.exports = {
  ProcessingHandler
};
