const { fork } = require('child_process');
const path = require('path');
const { retryOnFail } = require('./util/retryOnFail');
/* 
  Reloads & re-processes Miner & Validator data once every `RELOAD_INTERVAL`
*/
const RELOAD_INTERVAL = 6 * 60 * 1000;
console.log('RELOAD INTERVAL SET EXTREMELY LOW');

// Provides #dispatch method by which the express router endpoints can interact with processed data
function createMultiprocessActionDispatcher () {
  let freshProcess = createDispatchableChildProcess();
  let staleProcess = createDispatchableChildProcess();
  freshProcess.dispatch('LOAD_AND_PROCESS_SNAPSHOTS');
  (async () => {
    if (process.env.LOCAL_SNAPSHOT_DEV_MODE === 'enabled') {
      staleProcess.childProcess.kill();
      return;
    }
    await freshProcess.waitForReadyState();
    while (true) {
      try {
        /* 
					a little buffer for any code still using a reference to staleProcess
					before we clear out the data
				*/
        await new Promise(resolve => setTimeout(resolve, 5000));
        await staleProcess.dispatch('CLEAR_PARSED_DATA');
        // await staleProcess.restart();
        // Wait until snapshot data is expired
        await new Promise(resolve => setTimeout(resolve, RELOAD_INTERVAL));
        await staleProcess.dispatch('LOAD_AND_PROCESS_SNAPSHOTS');
        console.log('switching child processes');
        [freshProcess, staleProcess] = [staleProcess, freshProcess];
      } catch (e) {
        console.error(e);
      }
    }
  })();

  return {
    getActiveProcess () {
      return freshProcess;
    }
  };
}

function createDispatchableChildProcess () {
  const createChildProcess = () => {
    const p = fork(path.join(__dirname, `process.childprocess.js`));
    p.setMaxListeners(100000);
    return p;
  };
  let childProcess = createChildProcess();

  childProcess.on('error', e => {
    if (!childProcess.killed) childProcess.kill();
    childProcess = createChildProcess();
    console.error(e);
  });
  childProcess.on('exit', code => {
    childProcess = createChildProcess();
    if (code !== 0) {
      // ignore
    }
  });

  const dispatch = (...args) => {
    return createChildProcessActionDispatcher(childProcess)(...args);
  };

  async function waitForReadyState () {
    return new Promise((resolve, reject) => {
      let didExpire = false;
      setTimeout(() => {
        didExpire = true;
        // expires after 5 minutes
      }, 1000 * 60 * 5);
      (async () => {
        while (true) {
          let isReady = await dispatch('CHECK_IF_PARSED_DATA_READY');
          if (isReady) return resolve(true);
          if (didExpire) {
            return reject(new Error('Timed out waiting for child process'));
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })();
    });
  }
  return {
    restart () {
      if (childProcess.killed) {
        return Promise.resolve();
      }
      const promise = new Promise(resolve => {
        childProcess.once('exit', () => {
          // new childProcess is created above in `exit` event handler, which will execute before this
          resolve(childProcess);
        });
      });
      childProcess.kill();
      return promise;
    },
    // Remotely invokes child process actions in `./process.childprocess.js` `BackgroundProcessor#actions`
    dispatch: (...args) =>
      retryOnFail({
        fn: () => dispatch(...args),
        iterations: 20,
        waitFor: 250
      }),
    waitForReadyState,
    get childProcess () {
      return childProcess;
    }
  };
}

function createChildProcessActionDispatcher (childProcess) {
  return async function dispatch (method, payload) {
    const invokationId = Math.random().toString();
    childProcess.send({
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
        childProcess.off('message', handler);
      };
      childProcess.on('message', handler);
    });
  };
}

module.exports = {
  createMultiprocessActionDispatcher
};
