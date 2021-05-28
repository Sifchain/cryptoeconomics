const express = require('express');
const cors = require('cors');
const { getTimeIndex } = require('./util/getTimeIndex');
const compression = require('compression');

// implements process.js in separate thread
const { createMultiprocessActionDispatcher } = require('./processing-handler');

// require("./simple").createValidatorStakingTimeSeries();
// interfaces with `./process.childprocess.js`
const processingHandler = createMultiprocessActionDispatcher();

const port = process.env.PORT || 3000;
const app = express();

// compress responses
app.use(compression());

app.use(cors());

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get('/status', (req, res, next) => {
  res.status(200).send({ status: 'OK' });
});

app.get('/api/lm', async (req, res, next) => {
  const key = req.query.key;
  let responseJSON;
  const activeProcess = processingHandler.getActiveProcess();
  await activeProcess.waitForReadyState();
  switch (key) {
    case 'userTimeSeriesData': {
      const address = req.query.address;
      responseJSON = await activeProcess.dispatch(
        'GET_LM_USER_TIME_SERIES_DATA',
        address
      );
      break;
    }
    case 'userData': {
      const address = req.query.address;
      const timeIndex = getTimeIndex(req.query.timestamp);
      responseJSON = await activeProcess.dispatch('GET_LM_USER_DATA', {
        address,
        timeIndex
      });
      break;
    }
    case 'stack': {
      responseJSON = await activeProcess.dispatch('GET_LM_STACK_DATA', null);
      break;
    }
    default: {
      responseJSON = await activeProcess.dispatch('GET_LM_KEY_VALUE', key);
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(responseJSON);
});

app.get('/api/vs', async (req, res, next) => {
  const key = req.query.key;
  let responseJSON;
  const activeProcess = processingHandler.getActiveProcess();
  await activeProcess.waitForReadyState();
  switch (key) {
    case 'unclaimedDelegatedRewards': {
      break;
    }
    case 'userTimeSeriesData': {
      const address = req.query.address;
      responseJSON = await activeProcess.dispatch(
        'GET_VS_USER_TIME_SERIES_DATA',
        address
      );
      break;
    }
    case 'userData': {
      const address = req.query.address;
      const timeIndex = getTimeIndex(req.query.timestamp);
      responseJSON = await activeProcess.dispatch('GET_VS_USER_DATA', {
        address,
        timeIndex
      });
      break;
    }
    case 'stack': {
      responseJSON = await activeProcess.dispatch('GET_VS_STACK_DATA', null);
      break;
    }
    default: {
      responseJSON = await activeProcess.dispatch('GET_VS_KEY_VALUE', key);
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(responseJSON);
});
