
const { Worker } =  require("worker_threads");

function createProcessingWorkerHandler() {
  let hasLoaded = false;
  let didExit = false;
  let didError = false;
  let currentState = {
    lmData: null,
    vsData: null,
    // denotes the time at which client is suggested to reload data
    expiresAt: null
  }
  const worker = new Worker(`${__dirname}/process.worker.js`, {
      workerData: null
  });
  worker.on("message", ({
    lm,
    vs,
    expiresAt
  }) => {
    hasLoaded = true;
    currentState = {
      ...currentState,
      lmData: lm,
      vsData: vs,
      expiresAt
    }
  });
  worker.on("error", e => {
    didError = true;
    console.error(e);
  });
  worker.on("exit", code  => {
    didExit = true;
    if (code  !==  0) {
      console.error(new Error(`Worker stopped with exit code ${code}`));
    }
  });
  return {
    getCurrentState () {
      if (!hasLoaded) {
        throw new Error('Await workerThreadProcessor#waitForReadyState before accessing state')
      }
      return currentState;
    },
    async waitForReadyState () {
      return new Promise(async (r, rj) => {
        while (true) {
          if (didError) rj('errored');
          if (didExit) rj('exited');
          if (hasLoaded) r(true);
          await new Promise(r => setTimeout(r, 100))
        }
      })
    }
  }
};

module.exports = {
  createProcessingWorkerHandler
}