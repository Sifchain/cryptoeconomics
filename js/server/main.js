const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { getTimeIndex } = require('./util/getTimeIndex');
const compression = require('compression');
const configs = require('./config');
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
  GET_LM_CURRENT_APY_SUMMARY,
} = require('./constants/action-names');
const moment = require('moment');
const { encrypt, decrypt } = require('./util/encrypt');
const {
  createGenericDispensationJob,
} = require('./core/transform/createGenericDispensationJob.js');
const { gql } = require('apollo-server-core');
const { ApolloServer } = require('apollo-server-express');

if (process.env.DATABASE_URL) {
  const encrypted = encrypt(process.env.DATABASE_URL);
  fs.writeFileSync('./DATABASE_URL.enc', encrypted.encryptedData);
} else {
  const dburlEnc = fs.readFileSync('./DATABASE_URL.enc').toString();
  const data = decrypt(dburlEnc);
  process.env.DATABASE_URL = data;
}

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

let createTestnetHandler = () => {
  const testnetHandler = ProcessingHandler.init(TESTNET, 'harvest');
  createTestnetHandler = () => testnetHandler;
  return testnetHandler;
};
const processingHandlers = {
  [MAINNET]: {
    ['harvest']: ProcessingHandler.init(MAINNET, 'harvest'),
    COSMOS_IBC_REWARDS_V1: ProcessingHandler.init(
      MAINNET,
      'COSMOS_IBC_REWARDS_V1'
    ),
  },
  get [DEVNET]() {
    return createTestnetHandler();
  },
  get [TESTNET]() {
    return createTestnetHandler();
  },
};

// const processingHandler = BackgroundProcessor.startAsMainProcess();

const SNAPSHOT_SOURCE_KEY = 'snapshot-source';
const port = process.env.PORT || 3000;
const app = express();

app.use(cors());

// compress responses
app.use(compression());
const server = new ApolloServer({
  typeDefs: gql`
    type Participant {
      claimableRewardsOnWithdrawnAssets: Float
      dispensed: Float
      forfeited: Float
      totalAccruedCommissionsAndClaimableRewards: Float
      totalClaimableCommissionsAndClaimableRewards: Float
      reservedReward: Float
      totalDepositedAmount: Float
      totalClaimableRewardsOnDepositedAssets: Float
      currentTotalCommissionsOnClaimableDelegatorRewards: Float
      totalAccruedCommissionsAtMaturity: Float
      totalCommissionsAndRewardsAtMaturity: Float
      claimableCommissions: Float
      forfeitedCommissions: Float
      claimedCommissionsAndRewardsAwaitingDispensation: Float
      totalRewardsOnDepositedAssetsAtMaturity: Float
      ticketAmountAtMaturity: Float
      yieldAtMaturity: Float
      nextRewardShare: Float
      currentYieldOnTickets: Float
      maturityDate: Float
      maturityDateISO: Float
      yearsToMaturity: Float
      currentAPYOnTickets: Float
      maturityDateMs: Float
      futureReward: Float
      nextReward: Float
      nextRewardProjectedFutureReward: Float
      nextRewardProjectedAPYOnTickets: Float
      delegatorAddresses: [String]
      tickets: [String]
    }
    enum Network {
      mainnet
    }
    enum RewardProgramType {
      vs
      lm
    }
    enum RewardProgramName {
      COSMOS_IBC_REWARDS_V1
      harvest
    }
    enum DistributionPattern {
      GEYSER
      LINEAR
    }
    type RewardProgram {
      participant(address: String!): Participant
      displayName: String!
      rewardProgramType: RewardProgramType!
      rewardProgramName: RewardProgramName!
      summaryAPY(percentage: Boolean = true): Float!
      incentivizedPoolSymbols: [String!]!
      isUniversal: Boolean!
      startDateTimeISO: String!
      endDateTimeISO: String!
      documentationURL: String!
      distributionPattern: DistributionPattern!
    }
    type Query {
      rewardPrograms: [RewardProgram!]!
    }
  `,
  resolvers: {
    RewardProgram: {
      async participant({ rewardProgramName }, { address }) {
        let responseJSON = {};
        const timeIndex = getTimeIndex('now', rewardProgramName);
        const processingHandler =
          processingHandlers[MAINNET][rewardProgramName];
        await processingHandler.waitForReadyState();
        responseJSON = await processingHandler.dispatch('GET_LM_USER_DATA', {
          address,
          timeIndex,
          rewardProgram: rewardProgramName,
        });
        if (responseJSON) {
          if (responseJSON.user) {
            if (responseJSON.user.currentAPYOnTickets) {
              responseJSON.user.currentAPYOnTickets =
                responseJSON.user.currentAPYOnTickets * 100;
            }
          }
        }
        return responseJSON.user;
      },
      async summaryAPY(rewardProgram, { percentage }) {
        console.log(rewardProgram.name);
        const processingHandler =
          processingHandlers[MAINNET][rewardProgram.rewardProgramName];
        await processingHandler.waitForReadyState();
        return (
          (await processingHandler.dispatch(GET_LM_CURRENT_APY_SUMMARY, {
            programName: rewardProgram.rewardProgramName,
          })) * (percentage ? 1 : 1 / 100)
        );
      },
    },
    Query: {
      async rewardPrograms(root, args, context, info) {
        return [
          {
            displayName: `Sif's Harvest`,
            rewardProgramType: 'lm',
            rewardProgramName: 'harvest',
            incentivizedPoolSymbols: ['*'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs#sifs-harvest-liquidity-mining-program',
            isUniversal: true,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `.42 Liquidity Mining`,
            rewardProgramType: 'lm',
            rewardProgramName: 'COSMOS_IBC_REWARDS_V1',
            incentivizedPoolSymbols: [
              'akt',
              'dvpn',
              'atom',
              'iris',
              'xprt',
              'basecro',
              'regen',
            ],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs#42-liquidity-mining-program',
            isUniversal: false,
            distributionPattern: 'GEYSER',
          },
        ].map((rewardProgram) => {
          const config = configs[rewardProgram.rewardProgramName];
          return {
            ...rewardProgram,
            startDateTimeISO: config.START_DATETIME,
            endDateTimeISO: config.END_OF_REWARD_ACCRUAL_DATETIME,
          };
        });
      },
    },
  },
});
server.start().then(() => server.applyMiddleware({ app }));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  // console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
});

const logFilePath = '/tmp/cryptoecon.log';

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
console.log(createDispensationFileName('vs', 'mainnet', 'sunset'));
console.log(createDispensationFileName('lm', 'mainnet', 'sunset'));
console.log(createDispensationFileName('airdrop', 'mainnet', 'sunset'));
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
  console.log();
  const rewardProgram = req.query.program || 'COSMOS_IBC_REWARDS_V1';
  let processingHandler =
    processingHandlers[snapshotSource] || processingHandlers[MAINNET];
  processingHandler =
    processingHandler[rewardProgram + ''] || processingHandler;

  console.log({ snapshotSource, rewardProgram, processingHandler });
  const key = req.query.key;
  let responseJSON;
  await processingHandler.waitForReadyState();
  switch (key) {
    case 'apy-summary': {
      const summaryAPY = await processingHandler.dispatch(
        GET_LM_CURRENT_APY_SUMMARY,
        {
          programName: rewardProgram,
        }
      );
      console.log({ summaryAPY });
      responseJSON = { summaryAPY };
      break;
    }
    case 'userDispensationJob': {
      const { job, internalEpochTimestamp } = await processingHandler.dispatch(
        GET_LM_DISPENSATION_JOB,
        { programName: rewardProgram }
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
      const timeIndex = getTimeIndex(req.query.timestamp, rewardProgram);
      responseJSON = await processingHandler.dispatch('GET_LM_USER_DATA', {
        address,
        timeIndex,
        rewardProgram: rewardProgram,
      });
      if (responseJSON) {
        if (responseJSON.user) {
          if (responseJSON.user.currentAPYOnTickets) {
            responseJSON.user.currentAPYOnTickets =
              responseJSON.user.currentAPYOnTickets * 100;
          }
        }
      }
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
  return res.send('deprecated');
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
