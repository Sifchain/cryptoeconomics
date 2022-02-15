const fs = require('fs');
const path = require('path');
const fetch = require('cross-fetch').default;
const exec = require('child_process').execSync;
const {
  createDispensationFileName,
} = require('../server/util/createDispensationFileName');
const { MAINNET } = require('../server/constants/snapshot-source-names');

const dispensationName = createDispensationFileName(
  'all',
  MAINNET,
  '0.39-sunset',
  true
);

const rewardPrograms = {
  '39_SUNSET_LIQUIDITY_MINING': '39_LIQUIDITY_MINING',
  '39_SUNSET_VALIDATOR_SUBSIDY': '39_VALIDATOR_SUBSIDY',
  '39_AIRDROP': '39_AIRDROP',
  COSMOS_IBC_REWARDS_V1: 'COSMOS_IBC_REWARDS_V1',
  harvest: 'harvest',
  bonus_v1: 'bonus_v1',
  bonus_v1_ixo: 'bonus_v1_ixo',
  harvest_reloaded: 'harvest_reloaded',
  bonus_v1_osmo: 'bonus_v1_osmo',
  bonus_v1_ratom: 'bonus_v1_ratom',
  bonus_v1_luna: 'bonus_v1_luna',
  bonus_v1_usd: 'bonus_v1_usd',
  bonus_v1_eur: 'bonus_v1_eur',
  universal_vol: 'universal_vol',
  universal_txn: 'universal_txn',
  expansion_bonus: 'expansion_bonus',
  harvest_expansion: 'harvest_expansion',
  bonus_v2_luna: 'bonus_v2_luna',
};

const getOutputPath = (...paths) =>
  path.join(
    __dirname,
    `./output/divide-dispensations/${dispensationName}`,
    ...paths
  );
async function divideDispensations() {
  try {
    fs.rmdirSync(path.join(__dirname, `./output/divide-dispensations`), {
      recursive: true,
    });
  } catch (e) {}

  fs.mkdirSync(path.join(__dirname, `./output/divide-dispensations`), {});

  fs.mkdirSync(
    path.join(__dirname, `./output/divide-dispensations/${dispensationName}`)
  );

  for (let type of [
    // 'lm_juno',
    // 'lm_harvest',
    // 'lm_ibc',
    // 'lm_ixo',
    // 'lm_harvest_reloaded',
    // 'lm_osmo',
    // 'lm_ratom',
    // 'lm_usd',
    // 'lm_eur',
    // harvest expansion
    // 'lm_luna',
    // 'universal_txn',
    // 'universal_vol',
    // 'lm_harvest',
    // 'lm_bonus',
    // new names
    'harvest_expansion',
    'expansion_v2_bonus',
    'expansion_v3_bonus',
    // 'expansion_bonus',
    // 'bonus_v2_luna',
  ]) {
    const rawDist = await fetch(
      `https://data.sifchain.finance/beta/network/dispensation/${type}`
    ).then((r) => r.json());
    fs.writeFileSync(
      getOutputPath(`${type}.raw.json`),
      JSON.stringify(rawDist, null, 2)
    );
    const output = rawDist.Output;
    const splitAmount = 1000000000000;
    let iteration = 0;
    console.log({ type });
    while (output.length) {
      const splitOutput = output.splice(0, splitAmount);
      fs.writeFileSync(
        getOutputPath(
          `${type}.${(iteration * splitAmount + 1)
            .toString()
            .padStart(4, '0')}-${(
            iteration * splitAmount +
            Math.min(splitAmount, splitOutput.length)
          )
            .toString()
            .padStart(4, '0')}.split.json`
        ),
        JSON.stringify(
          {
            Output: splitOutput,
          },
          null,
          2
        )
      );
      iteration++;
    }
  }
}

function createTarball() {
  const dispensationNameComputed = fs.readdirSync(
    require('path').join(__dirname, `./output/divide-dispensations/`)
  )[0];
  const filePaths = fs
    .readdirSync(
      require('path').join(
        __dirname,
        `./output/divide-dispensations/${dispensationNameComputed}`
      )
    )
    .filter((f) => f.endsWith('.json'));
  exec(
    `cd ${__dirname}/output/divide-dispensations/${dispensationNameComputed} && tar -czvf ${dispensationNameComputed}.tar.gz ${filePaths.join(
      ' '
    )}`
  );
}

function createDispensationRunKit() {
  const dispensationNameComputed = fs
    .readdirSync(`${__dirname}/output/divide-dispensations/`)
    .find((f) => f.includes('dispensation'));
  const filePaths = fs
    .readdirSync(
      `${__dirname}/output/divide-dispensations/${dispensationNameComputed}`
    )
    .filter((f) => f.endsWith('.json'));
  let RUNNER_ADDRESS = 'sif1mprngjjx26srkyakm2rsczhnshutysw8rnsq85';
  let DISTRIBUTOR_ADDRESS = 'sif1ngfel80xak4hqegeg42vlx8lnvx5x42es57t8n';
  let RPC_ENDPOINT = 'tcp://rpc.sifchain.finance:80';
  let CHAIN_ID = 'sifchain-1';
  // RPC_ENDPOINT = 'tcp://rpc-testnet.sifchain.finance:80 ';
  // CHAIN_ID = 'sifchain-testnet-1';
  // RUNNER_ADDRESS = 'sif1pvnu2kh826vn8r0ttlgt82hsmfknvcnf7qmpvk';
  // DISTRIBUTOR_ADDRESS = 'sif1pvnu2kh826vn8r0ttlgt82hsmfknvcnf7qmpvk';
  function getRewardProgramNameByType(type) {
    return type;
    switch (type) {
      case 'vs':
        return rewardPrograms['39_SUNSET_VALIDATOR_SUBSIDY'];
      case 'lm':
        return rewardPrograms['39_SUNSET_LIQUIDITY_MINING'];
      case 'lm_harvest':
        return rewardPrograms['harvest_expansion'];
      case 'lm_bonus':
        return rewardPrograms['expansion_bonus'];
      case 'lm_ibc':
        return rewardPrograms['COSMOS_IBC_REWARDS_V1'];
      // case 'lm_harvest':
      //   return rewardPrograms['harvest'];
      case 'lm_juno':
        return rewardPrograms['bonus_v1'];
      case 'lm_harvest_reloaded':
        return rewardPrograms['harvest_reloaded'];
      case 'lm_ixo':
        return rewardPrograms['bonus_v1_ixo'];
      case 'airdrop':
        return rewardPrograms['39_AIRDROP'];
      case 'lm_osmo':
        return rewardPrograms['bonus_v1_osmo'];
      case 'lm_ratom':
        return rewardPrograms['bonus_v1_ratom'];
      case 'bonus_v2_luna':
        return rewardPrograms['bonus_v2_luna'];
      case 'lm_usd':
        return rewardPrograms['bonus_v1_usd'];
      case 'lm_eur':
        return rewardPrograms['bonus_v1_eur'];
      case 'universal_txn':
        return rewardPrograms['universal_txn'];
      case 'universal_vol':
        return rewardPrograms['universal_vol'];
    }
  }

  function getDistributionTypeByType(type) {
    switch (type) {
      case 'vs':
        return 'ValidatorSubsidy';
      case 'airdrop':
      case 'universal_txn':
      case 'universal_vol':
        return 'Airdrop';
      default:
        return 'LiquidityMining';
    }
  }

  const templateValues = {
    RUNNER_ADDRESS,
    DISTRIBUTOR_ADDRESS,
    CURRENT_DATE: new Date().toLocaleDateString(),
    DOWNLOAD_DIST_LIST_COMMAND: `curl "<TARBALL_FILE_URL>" -o ${dispensationName}.tar.gz && mkdir ./${dispensationName} && tar -xzvf ${dispensationName}.tar.gz -C ${dispensationName} && cd ${dispensationName}`,
    CREATE_DISTRIBUTIONS_COMMAND: filePaths
      .filter((p) => p.includes('.split.'))
      // NOTE: data services no longer depends on the memo field. However, it should remain anyway for historical purposes.
      .map(
        (p) =>
          `sleep 8;\n\n\n\nsifnoded tx dispensation create ${getDistributionTypeByType(
            p.split('.')[0]
          )} ${p} ${RUNNER_ADDRESS} --from ${DISTRIBUTOR_ADDRESS} --node ${RPC_ENDPOINT} --chain-id ${CHAIN_ID}  --gas 100000000 --gas-prices=0.5rowan --keyring-backend test --yes --broadcast-mode block --memo "program=${getRewardProgramNameByType(
            p.split('.')[0]
          )}";`
      )
      .join('\n\n\n\n'),
  };
  let runkit = fs.readFileSync('./Run-Kit-Template.sh').toString();
  for (let key in templateValues) {
    runkit = runkit.split(`<${key}>`).join(templateValues[key]);
  }
  const runkitFilename =
    './Run-Kit-' + templateValues.CURRENT_DATE.split('/').join('-') + '.sh';
  fs.writeFileSync(path.join(getOutputPath(), runkitFilename), runkit);
}

// createDispensationRunKit();
divideDispensations()
  .then(() => {
    return createTarball();
  })
  .then(() => {
    return createDispensationRunKit();
  });
