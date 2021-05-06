
const { fork } = require("child_process")

function createProcessingHandler() {
  let hasLoaded = false;
  let didExit = false;
  let didError = false;
  let currentState = {
    lmData: null,
    vsData: null,
    // denotes the time at which client is suggested to reload data
    expiresAt: null
  }

  const childProcess = fork(`${__dirname}/process.childprocess.js`) //the first argument to fork() is the name of the js file to be run by the child process
  // childProcess.send({ number: parseInt(req.query.number) }) //send method is used to send message to child process through IPC
  childProcess.on("message", async outputFilePath => {
    hasLoaded = true;
    const dataString = await new Promise(r => require('fs').readFile(outputFilePath.toString(), undefined, (err, data) => r(data)))
    const {
      lm,
      vs,
      expiresAt
    } = JSON.parse(dataString)
    currentState = {
      ...currentState,
      lmData: lm,
      vsData: vs,
      expiresAt
    }
  })
  childProcess.on("error", e => {
    didError = true;
    console.error(e);
  });
  childProcess.on("exit", code  => {
    didExit = true;
    if (code  !==  0) {
      console.error(new Error(`Child processs stopped with exit code ${code}`));
    }
  });
  return {
    getCurrentState () {
      if (!hasLoaded) {
        throw new Error('Await #waitForReadyState before accessing state')
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
  createProcessingHandler
}