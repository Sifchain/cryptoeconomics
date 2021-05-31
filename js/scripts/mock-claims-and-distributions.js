// const {
//   loadValidatorsSnapshot,
//   loadLiquidityMinersSnapshot,
// } = require('../server/loaders');

// const ENV = [null, 'production', 'devnet', 'testnet'][1];
// const serverURL = (() => {
//   switch (ENV) {
//     case 'production':
//       return 'https://api-cryptoeconomics.sifchain.finance/api';
//     case 'devnet':
//       return 'https://api-cryptoeconomics-devnet.sifchain.finance/api';
//     case 'testnet':
//       return 'https://api-cryptoeconomics-testnet.sifchain.finance/api';
//     default:
//       return 'http://localhost:3000/api';
//   }
// })();

// (async () => {
//   // Get Data

//   const results = { lm: [], vs: [] };
//   // Get Data
//   for (let type in results) {
//     const validatorSnapshot = await loadValidatorsSnapshot();
//     const minerSnapshot = await loadLiquidityMinersSnapshot();
//     debugger;
//     const outputClaimsPath = require('path').join(
//       __dirname,
//       `../snapshots/mock-${type}-claims.json`
//     );
//     const outputDistributionsPath = require('path').join(
//       __dirname,
//       `../snapshots/mock-${type}-distributions.json`
//     );
//     const mockClaims = {
//       data: {
//         claim_snapshot: [
//           {
//             [`snapshots_${type}_claims`]: {
//               ADDR: [0, 1, 0],
//               ...Object.fromEntries(
//                 [
//                   Object.entries(
//                     {}
//                     // data.data.snapshots_validators[0].snapshot_data
//                   ),
//                 ].filter(([k, v], index) => {
//                   // return topAddresses.includes(k);
//                 })
//               ),
//             },
//           },
//         ],
//       },
//     };
//     const mockDistributions = {
//       data: {
//         distribution_snapshot: [
//           {
//             [`snapshots_${type}_claims`]: {
//               ADDR: [0, 1, 0],
//             },
//           },
//         ],
//       },
//     };
//     // require('fs').writeFileSync(outputClaimsPath, JSON.stringify(data));
//   }
// })();
