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
const backwardsCompensationForHarvestUsers = require('../server/scripts/diffs.json');
const RateLimitProtector =
  require('./util/RateLimitProtector').RateLimitProtector;
const path = require('path');
const { election } = require('../scripts/election/election');
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    'PASSWORD',
    encodeURIComponent(process.env.DATABASE_PASSWORD)
  );
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
    ...Object.keys(configs).reduce((prev, key) => {
      return {
        ...prev,
        [key]: ProcessingHandler.init(MAINNET, key),
      };
    }, {}),
  },
  get [DEVNET]() {
    return createTestnetHandler();
  },
  get [TESTNET]() {
    return createTestnetHandler();
  },
};

const proposals = fs
  .readdirSync(path.join(__dirname, '../scripts/election/proposals'))
  .sort((a, b) => {
    return a.localeCompare(b);
  })
  .filter((file) => !file.includes('[SAMPLE]'))
  .map((fileName) => ({
    ...JSON.parse(
      fs
        .readFileSync(
          path.join(__dirname, '../scripts/election/proposals', fileName)
        )
        .toString()
    ),
    id: fileName.split('.')[0],
  }))
  .map((proposal) => {
    return;
  });

const electionResultCache = {
  exampleProposalName: {
    output: null,
    updatedAt: null,
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
    type ElectionStrategy {
      name: String!
      weight: Float!
    }
    type ElectionProposal {
      id: ID!
      title: String!
      description: String!
      aggregator: String!
      strategies: [ElectionStrategy!]!
      startHeight: Int!
      endHeight: Int!
    }
    type ElectionSelectionResult {
      selection: String!
      votingPower: Float!
      voteCount: Int!
    }
    enum ElectionStatus {
      # before election starts
      DORMANT
      # election is running
      PENDING
      # election is over
      COMPLETE
    }
    type ElectionResult {
      proposal: ElectionProposal!
      results: [ElectionSelectionResult!]!
      status: ElectionStatus!
    }
    enum Network {
      mainnet
    }
    enum RewardProgramType {
      vs
      lm
    }
    enum DistributionPattern {
      GEYSER
      LINEAR
      STATIC_APR
    }
    type RewardProgram {
      participant(address: String!): Participant
      displayName: String!
      description: String!
      rewardProgramType: RewardProgramType!
      rewardProgramName: String!
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
      electionResults: [ElectionResult!]!
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
            if (
              rewardProgramName === 'harvest' &&
              Date.now() < new Date('2021-10-16T09:30:55.377Z').getTime()
            ) {
              const bonus = backwardsCompensationForHarvestUsers[address] || 0;
              responseJSON.user.claimedCommissionsAndRewardsAwaitingDispensation +=
                bonus;
            }
          }
        }
        function reducePrecisionForJsonNumbers({ ...obj }) {
          for (let key in obj) {
            switch (typeof obj[key]) {
              case 'number':
                obj[key] = +obj[key].toFixed(10);
                break;
              case 'object':
                if (!Array.isArray(obj[key]) && !!obj[key]) {
                  obj[key] = reducePrecisionForJsonNumbers(obj[key]);
                }
            }
          }
          return obj;
        }
        return !!responseJSON && !!responseJSON.user
          ? reducePrecisionForJsonNumbers(responseJSON.user)
          : null;
      },
      async summaryAPY(rewardProgram, { percentage }) {
        if (
          rewardProgram.rewardProgramName === 'COSMOS_IBC_REWARDS_V1' ||
          new Date(rewardProgram.endDateTimeISO).getTime() <
            new Date().getTime()
        ) {
          return 0;
        }
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
    ElectionResult: {
      async results({ title }) {
        const cached = electionResultCache[title];
        // if it hasn't been updated in the last 20 minutes, update it
        if (
          cached.updatedAt &&
          Date.now() - cached.updatedAt < 1000 * 60 * 60
        ) {
          return cached.output;
        }
        try {
          const results = election({ proposal });
        } catch (e) {
          console.log(e);
        }
      },
    },
    Query: {
      async electionResults(root, args, context, info) {
        // get all files in folder and sort by name
        return proposals.map((proposal) => ({
          proposal,
        }));
        return [
          {
            proposal: {},
            results: [],
            status: 'COMPLETE',
          },
        ];
      },
      async rewardPrograms(root, args, context, info) {
        // eeur
        return [
          {
            displayName: `Sif's Luna Bonus`,
            description: `300% total APR (Expansion included). Elected by the community.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v2_luna',
            incentivizedPoolSymbols: ['luna'],
            documentationURL:
              'https://docs.sifchain.finance/using-the-website/web-ui-step-by-step/rewards/liquidity-mining-rewards-programs',
            isUniversal: false,
            distributionPattern: 'STATIC_APR',
          },
          {
            displayName: `Sif's Expansion`,
            description: `100% APR. All pools.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'harvest_expansion',
            incentivizedPoolSymbols: ['*'],
            documentationURL:
              'https://docs.sifchain.finance/using-the-website/web-ui-step-by-step/rewards/liquidity-mining-rewards-programs',
            isUniversal: true,
            distributionPattern: 'STATIC_APR',
          },
          {
            displayName: `Pools of the People (v3)`,
            description: `300% total APR (Expansion included). 7 pools. Selected by the community.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'expansion_v3_bonus',
            incentivizedPoolSymbols: [
              'zcx',
              'eth',
              'lgcy',
              'usdc',
              // JUNØ
              'juno',
              // LUNA
              'luna',
              // ATOM
              'atom',
            ],
            documentationURL:
              'https://docs.sifchain.finance/using-the-website/web-ui-step-by-step/rewards/liquidity-mining-rewards-programs',
            isUniversal: false,
            distributionPattern: 'STATIC_APR',
          },
          {
            displayName: `Pools of the People (v2)`,
            description: `300% total APR (Expansion included). 6 pools. Selected by the community.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'expansion_v2_bonus',
            incentivizedPoolSymbols: [
              'zcx',
              'eth',
              'lgcy',
              // JUNØ
              'juno',
              // LUNA
              'luna',
              // ATOM
              'atom',
            ],
            documentationURL:
              'https://docs.sifchain.finance/using-the-website/web-ui-step-by-step/rewards/liquidity-mining-rewards-programs',
            isUniversal: false,
            distributionPattern: 'STATIC_APR',
          },
          {
            displayName: `Pools of the People (v1)`,
            description: `300% total APR (Expansion included). 5 pools. Selected by the community.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'expansion_bonus',
            incentivizedPoolSymbols: ['atom', 'usd', 'juno', 'zcx', 'eth'],
            documentationURL:
              'https://docs.sifchain.finance/using-the-website/web-ui-step-by-step/rewards/liquidity-mining-rewards-programs',
            isUniversal: false,
            distributionPattern: 'STATIC_APR',
          },
          /*          {
            displayName: `Sif's EEUR Bonus Pool`,
            description: `Earn Rowan rewards by pooling EEUR.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1_eur',
            incentivizedPoolSymbols: ['eur'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's Luna Bonus Pool`,
            description: `Earn Rowan rewards by pooling Terra LUNA.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1_luna',
            incentivizedPoolSymbols: ['luna'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's UST Bonus Pool`,
            description: `Earn Rowan rewards by pooling Terra UST.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1_usd',
            incentivizedPoolSymbols: ['usd'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's rATOM Bonus Pool`,
            description: `Earn Rowan rewards by pooling Stafi rATOM.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1_ratom',
            incentivizedPoolSymbols: ['ratom'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's OSMO Bonus Pool+`,
            description: `Earn Rowan rewards by pooling OSMO.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1_osmo',
            incentivizedPoolSymbols: ['osmo'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's Harvest (Bloom)`,
            description: `Earn rewards of mythological proportions by providing liquidity to any of Sifchain's token pools. Now including liquidity re-adds.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'harvest_reloaded',
            incentivizedPoolSymbols: ['*'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs#sifs-harvest-liquidity-mining-program',
            isUniversal: true,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's Junø Bonus Pool`,
            description: `Earn Rowan rewards by pooling JUNØ.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1',
            incentivizedPoolSymbols: ['juno'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },
          {
            displayName: `Sif's IXO Bonus Pool`,
            description: `Earn Rowan rewards by pooling IXO.`,
            rewardProgramType: 'lm',
            rewardProgramName: 'bonus_v1_ixo',
            incentivizedPoolSymbols: ['ixo'],
            documentationURL:
              'https://docs.sifchain.finance/resources/rewards-programs',
            isUniversal: false,
            distributionPattern: 'LINEAR',
          },

          {
            displayName: `Sif's Harvest (Legacy)`,
            description: `Earn rewards of mythological proportions by providing liquidity to any of Sifchain's token pools.`,
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
            description: `Earn additional rewards by providing liquidity to any of Sifchain's Cosmos IBC token pools.`,
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
          */
        ]
          .map((rewardProgram) => {
            const config = configs[rewardProgram.rewardProgramName];
            return {
              ...rewardProgram,
              startDateTimeISO: config.REWARD_BUCKET_START_DATETIME,
              endDateTimeISO:
                rewardProgram.rewardProgramName === 'bonus_v1'
                  ? '2021-10-23T02:00:48.506Z'
                  : config.REWARD_BUCKET_END_DATETIME,
            };
          })
          .filter((r) => new Date(r.startDateTimeISO).getTime() <= Date.now());
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
  const rewardProgram =
    req.query.program ||
    Object.keys(configs).filter((n) => n === 'harvest_expansion')[0] ||
    Object.keys(configs)[0];
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
        { programName: rewardProgram, timestamp: req.query.timestamp || 'now' }
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
        { address, rewardProgram }
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
