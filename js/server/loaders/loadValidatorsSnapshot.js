const { TESTNET } = require('../constants/snapshot-source-names');
const slonik = require('slonik');
/* 
  WARNING: DO NOT ADD MORE QUERIES OR FIELDS TO THE GRAPHQL QUERY.
  QUERIES ARE CACHED USING A HASH OF THE TEXT CONTENT OF THE RESPONSE OBJECT
*/

const Database = slonik.createPool(process.env.DATABASE_URL);

// const MAINNET_QUERY = /* GraphQL */ `
//   query GetSnapshot {
//     snapshots_validators(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_vs_claims(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_vs_dispensation(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//   }
// `;
// const TESTNET_QUERY = /* GraphQL */ `
//   query GetDevSnapshot {
//     snapshots_validators: snapshots_validators_dev(
//       limit: 1
//       order_by: { id: desc }
//     ) {
//       snapshot_data
//     }
//     snapshots_vs_claims(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_vs_dispensation(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//   }
// `;

const getSQLQueryByNetwork = network => {
  network = network ? network.toLowerCase() : network;
  switch (network) {
    case TESTNET: {
      return Database.transaction(async tx => {
        const snapshots_validators = await tx.many(
          slonik.sql`select snapshot_data from snapshots_validators_dev ORDER BY created_at DESC LIMIT 1`
        );
        const snapshots_vs_claims = await tx.many(
          slonik.sql`select snapshot_data from snapshots_vs_claims ORDER BY created_at DESC LIMIT 1`
        );
        const snapshots_vs_dispensation = await tx.many(
          slonik.sql`select snapshot_data from snapshots_vs_dispensation ORDER BY created_at DESC LIMIT 1`
        );
        return {
          data: {
            snapshots_validators,
            snapshots_vs_claims,
            snapshots_vs_dispensation
          }
        };
      });
    }
    default: {
      return Database.transaction(async tx => {
        const snapshots_validators = await tx.many(
          slonik.sql`select snapshot_data from snapshots_validators ORDER BY created_at DESC LIMIT 1`
        );
        const snapshots_vs_claims = await tx.many(
          slonik.sql`select snapshot_data from snapshots_vs_claims ORDER BY created_at DESC LIMIT 1`
        );
        const snapshots_vs_dispensation = await tx.many(
          slonik.sql`select snapshot_data from snapshots_vs_dispensation ORDER BY created_at DESC LIMIT 1`
        );
        return {
          data: {
            snapshots_validators,
            snapshots_vs_claims,
            snapshots_vs_dispensation
          }
        };
      });
    }
  }
};

// const getQueryByNetwork = (network) => {
//   network = network ? network.toLowerCase() : network;
//   switch (network) {
//     case TESTNET: {
//       return TESTNET_QUERY;
//     }
//     default: {
//       return MAINNET_QUERY;
//     }
//   }
// };

exports.loadValidatorsSnapshot = async function (network) {
  if (!process.env.HEADER_SECRET) {
    throw new Error('process.env.HEADER_SECRET not defined!');
  }
  if (!process.env.SNAPSHOT_URL) {
    throw new Error('process.env.SNAPSHOT_URL not defined!');
  }
  return getSQLQueryByNetwork(network);
  // return fetch(process.env.SNAPSHOT_URL, {
  //   method: 'POST',
  //   headers: {
  //     'x-hasura-admin-secret': process.env.HEADER_SECRET,
  //     'Content-Type': 'application/json',
  //   },
  //   // snapshots_validators_dev
  //   body: JSON.stringify({
  //     query: getQueryByNetwork(network),
  //   }),
  // });
};
