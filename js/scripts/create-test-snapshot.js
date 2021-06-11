const { loadValidatorsSnapshot } = require('../server/loaders');

const { fetch } = require('cross-fetch');

const ENV = [null, 'production', 'devnet', 'testnet'][1];
const serverURL = (() => {
  switch (ENV) {
    case 'production':
      return 'https://api-cryptoeconomics.sifchain.finance/api';
    case 'devnet':
      return 'https://api-cryptoeconomics-devnet.sifchain.finance/api';
    case 'testnet':
      return 'https://api-cryptoeconomics-testnet.sifchain.finance/api';
    default:
      return 'http://localhost:3000/api';
  }
})();

(async () => {
  // Get Data

  const results = { /* lm: [], */ vs: [] };
  // Get Data
  for (let type in results) {
    let data;
    if (type === 'lm') continue;
    switch (type) {
      case 'vs': {
        data = await loadValidatorsSnapshot().then(r => r.json());
        break;
      }
      case 'lm': {
        break;
      }
    }
    console.log(data);
    const outputPath = require('path').join(
      __dirname,
      `../snapshots/test.${type}.json`
    );
    const url = `${serverURL}/${type}`;
    const users = await fetch(`${url}?key=users`).then(r => r.json());

    let topAddresses = users.slice(0, 5);
    data.data.snapshots_validators[0].snapshot_data = Object.fromEntries(
      Object.entries(data.data.snapshots_validators[0].snapshot_data).filter(
        ([k, v], index) => {
          return topAddresses.includes(k);
        }
      )
    );
    require('fs').writeFileSync(outputPath, JSON.stringify(data));
  }
})();
