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

  for (let type of ['vs', 'lm', 'airdrop']) {
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
    `./output/divide-dispensations/`
  )[0];
  const filePaths = fs
    .readdirSync(`./output/divide-dispensations/${dispensationNameComputed}`)
    .filter((f) => f.endsWith('.json'));
  exec(
    `cd ./output/divide-dispensations/${dispensationNameComputed} && tar -czvf ${dispensationNameComputed}.tar.gz ${filePaths.join(
      ' '
    )}`
  );
}

function createDispensationRunKit() {
  const dispensationNameComputed = fs
    .readdirSync(`./output/divide-dispensations/`)
    .find((f) => f.includes('dispensation'));
  const filePaths = fs
    .readdirSync(`./output/divide-dispensations/${dispensationNameComputed}`)
    .filter((f) => f.endsWith('.json'));
  let RUNNER_ADDRESS = 'sif1mprngjjx26srkyakm2rsczhnshutysw8rnsq85';
  let DISTRIBUTOR_ADDRESS = 'sif1ngfel80xak4hqegeg42vlx8lnvx5x42es57t8n';
  let RPC_ENDPOINT = 'tcp://rpc.sifchain.finance:80';
  let CHAIN_ID = 'sifchain-1';
  // RPC_ENDPOINT = 'tcp://rpc-testnet.sifchain.finance:80 ';
  // CHAIN_ID = 'sifchain-testnet-1';
  // RUNNER_ADDRESS = 'sif1pvnu2kh826vn8r0ttlgt82hsmfknvcnf7qmpvk';
  // DISTRIBUTOR_ADDRESS = 'sif1pvnu2kh826vn8r0ttlgt82hsmfknvcnf7qmpvk';
  const templateValues = {
    RUNNER_ADDRESS,
    DISTRIBUTOR_ADDRESS,
    CURRENT_DATE: new Date().toLocaleDateString(),
    DOWNLOAD_DIST_LIST_COMMAND: `curl "<TARBALL_FILE_URL>" -o ${dispensationName}.tar.gz && mkdir ./${dispensationName} && tar -xzvf ${dispensationName}.tar.gz -C ${dispensationName} && cd ${dispensationName}`,
    CREATE_DISTRIBUTIONS_COMMAND: filePaths
      .filter((p) => p.includes('.split.'))

      .map(
        (p) =>
          `sleep 8;\n\n\n\nsifnoded tx dispensation create ${
            p.startsWith('lm')
              ? 'LiquidityMining'
              : p.startsWith('vs')
              ? 'ValidatorSubsidy'
              : 'Airdrop'
          } ${p} ${RUNNER_ADDRESS} --from ${DISTRIBUTOR_ADDRESS} --node ${RPC_ENDPOINT} --chain-id ${CHAIN_ID}  --gas 100000000 --gas-prices=0.5rowan --keyring-backend test --yes --broadcast-mode block;`
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