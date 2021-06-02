const express = require('express');
const cors = require('cors');
const { getTimeIndex } = require('./util/getTimeIndex');
const compression = require('compression');
const fs = require('fs');
// implements process.js in separate thread
const { ProcessingHandler } = require('./processing-handler');

// require("./simple").createValidatorStakingTimeSeries();
// interfaces with `./process.childprocess.js`
const processingHandler = ProcessingHandler.init();

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

app.get('/status', (req, res, next) => {
  res.status(200).send({ status: 'OK' });
});

app.get('/env', (req, res, next) => {
  res.send(Object.keys(process.env).join('<br/>'));
});

app.get('/api/lm', async (req, res, next) => {
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
        timeIndex,
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
        timeIndex,
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
