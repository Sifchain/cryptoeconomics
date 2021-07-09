const express = require('express');
const cors = require('cors');
const { getTimeIndex } = require('./util/getTimeIndex');
const compression = require('compression');
const fs = require('fs');
// implements process.js in separate thread
const { ProcessingHandler } = require('./worker');
const {
  DEVNET,
  MAINNET,
  TESTNET,
} = require('./constants/snapshot-source-names');
const {
  GET_LM_DISPENSATION_JOB,
  GET_VS_DISPENSATION_JOB,
} = require('./constants/action-names');
const moment = require('moment');
const { encrypt, decrypt } = require('./util/encrypt');
const {
  createGenericDispensationJob,
} = require('./util/createGenericDispensationJob');

if (process.env.DATABASE_URL) {
  const encrypted = encrypt(process.env.DATABASE_URL);
  require('fs').writeFileSync('./DATABASE_URL.enc', encrypted.encryptedData);
} else {
  const dburlEnc = require('fs').readFileSync('./DATABASE_URL.enc').toString();
  const data = decrypt(dburlEnc);
  process.env.DATABASE_URL = data;
}

const os = require('os');
const { execSync } = require('child_process');

console.log(execSync(`df -h`).toString());
console.log(os.cpus());
console.log(os.totalmem());
console.log(os.freemem());
/* 


  const algorithm = 'aes-256-ctr',
    password = 'test@1234';
  var iv = Buffer.from(
    Array.prototype.map.call(Buffer.alloc(16), () => {
      return Math.floor(Math.random() * 256);
    })
  );
  var key = Buffer.concat([Buffer.from(password)], Buffer.alloc(32).length);
  var cipher = crypto.createCipheriv(algorithm, password, iv);

  */
// const { BackgroundProcessor } = require('./process.childprocess.js');
// require("./simple").createValidatorStakingTimeSeries();
// interfaces with `./process.childprocess.js`

const testnetHandler = ProcessingHandler.init(TESTNET);
const processingHandlers = {
  [MAINNET]: ProcessingHandler.init(MAINNET),
  [DEVNET]: testnetHandler,
  [TESTNET]: testnetHandler,
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

app.post('/api/restart', (req, res, next) => {
  Object.values(processingHandlers).forEach((handler) => handler.restart());
  res.sendStatus(200);
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

const createDispensationFileName = (type, network, internalEpochTimestamp) => {
  // filename-friendly ISO-8601 to enable date-based sorting
  const fileNameDate = moment.utc().format(`YYYY[]MM[]DD[T]HH[]mm[]ss`);
  return `${fileNameDate}-${type.toLowerCase()}-${network.toLowerCase()}-${internalEpochTimestamp}-dispensation.json`;
};
// 20210616T221025-vs-mainnet-169600.json

app.get('/api/disp/:type', async (req, res, next) => {
  const { job } = await createGenericDispensationJob(req.params.type);
  if (req.query.download === 'true') {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${createDispensationFileName(
        req.params.type,
        MAINNET,
        ''
      )}`
    );
  }
  res.setHeader('Content-Type', 'application/json');
  return res.send(JSON.stringify(job, null, '  '));
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
    case 'userDispensationJob': {
      const { job, internalEpochTimestamp } = await processingHandler.dispatch(
        GET_LM_DISPENSATION_JOB
      );
      if (req.query.download === 'true') {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${createDispensationFileName(
            'lm',
            snapshotSource,
            internalEpochTimestamp
          )}`
        );
      }
      return res.send(JSON.stringify(job, null, '  '));
    }
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
    case 'userDispensationJob': {
      const { job, internalEpochTimestamp } = await processingHandler.dispatch(
        GET_VS_DISPENSATION_JOB
      );
      if (req.query.download === 'true') {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${createDispensationFileName(
            'vs',
            snapshotSource,
            internalEpochTimestamp
          )}`
        );
      }
      return res.send(JSON.stringify(job, null, '  '));
    }
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
