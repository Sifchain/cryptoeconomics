const express = require('express');
const cors = require('cors');
const { getTimeIndex } = require('./util/getTimeIndex');
const compression = require('compression');
const fs = require('fs');
// implements process.js in separate thread
const { ProcessingHandler } = require('./worker');
const { DEVNET, MAINNET } = require('./constants/snapshot-source-names');
// const { BackgroundProcessor } = require('./process.childprocess.js');
// require("./simple").createValidatorStakingTimeSeries();
// interfaces with `./process.childprocess.js`

let devnetHandler;
const processingHandlers = {
  [MAINNET]: ProcessingHandler.init(MAINNET),
  get [DEVNET] () {
    if (devnetHandler) {
      return devnetHandler;
    }
    devnetHandler = ProcessingHandler.init(DEVNET);
    return devnetHandler;
  }
};

// const processingHandler = BackgroundProcessor.startAsMainProcess();

const SNAPSHOT_SOURCE_KEY = 'snapshot-source';
const port = process.env.PORT || 3000;
const app = express();

app.use(cors());

// compress responses
app.use(compression());

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const logFilePath = '/tmp/cryptoecon.log';

app.get('/kill', (req, res, next) => {
  process.exit();
});

app.get('/os/:method', (req, res, next) => {
  res.send(require('os')[req.params.method]());
});

app.get('/logs', (req, res, next) => {
  fs.readFile(logFilePath, (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    res.setHeader('Content-Type', 'text/plain');
    res.send(data.toString());
  });
});

app.get('/env', (req, res, next) => {
  res.send(Object.keys(process.env).join('<br/>'));
});

app.get('/status', (req, res, next) => {
  res.status(200).send({ status: 'OK' });
});

app.get('/api/lm', async (req, res, next) => {
  const snapshotSource =
    req.query[SNAPSHOT_SOURCE_KEY] ||
    req.headers[SNAPSHOT_SOURCE_KEY] ||
    MAINNET;
  const processingHandler =
    processingHandlers[snapshotSource] || processingHandlers[MAINNET];
  const key = req.query.key;
  let responseJSON;
  await processingHandler.waitForReadyState();
  switch (key) {
    case 'userTimeSeriesData': {
      const address = req.query.address;
      responseJSON = await processingHandler.dispatch(
        'GET_LM_USER_TIME_SERIES_DATA',
        address
      );
      break;
    }
    case 'userData': {
      const address = req.query.address;
      const timeIndex = getTimeIndex(req.query.timestamp);
      responseJSON = await processingHandler.dispatch('GET_LM_USER_DATA', {
        address,
        timeIndex
      });
      break;
    }
    case 'stack': {
      responseJSON = await processingHandler.dispatch(
        'GET_LM_STACK_DATA',
        null
      );
      break;
    }
    default: {
      responseJSON = await processingHandler.dispatch('GET_LM_KEY_VALUE', key);
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(responseJSON);
});

app.get('/api/vs', async (req, res, next) => {
  const snapshotSource =
    req.query[SNAPSHOT_SOURCE_KEY] ||
    req.headers[SNAPSHOT_SOURCE_KEY] ||
    MAINNET;
  const processingHandler =
    processingHandlers[snapshotSource] || processingHandlers[MAINNET];
  const key = req.query.key;
  let responseJSON;
  await processingHandler.waitForReadyState();
  switch (key) {
    case 'unclaimedDelegatedRewards': {
      break;
    }
    case 'userTimeSeriesData': {
      const address = req.query.address;
      responseJSON = await processingHandler.dispatch(
        'GET_VS_USER_TIME_SERIES_DATA',
        address
      );
      break;
    }
    case 'userData': {
      const address = req.query.address;
      const timeIndex = getTimeIndex(req.query.timestamp);
      responseJSON = await processingHandler.dispatch('GET_VS_USER_DATA', {
        address,
        timeIndex
      });
      break;
    }
    case 'stack': {
      responseJSON = await processingHandler.dispatch(
        'GET_VS_STACK_DATA',
        null
      );
      break;
    }
    default: {
      responseJSON = await processingHandler.dispatch('GET_VS_KEY_VALUE', key);
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(responseJSON);
});
