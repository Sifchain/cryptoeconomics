const { fetch } = require('cross-fetch');
const { TESTNET } = require('../constants/snapshot-source-names');

/* 
  WARNING: DO NOT ADD MORE QUERIES OR FIELDS TO THE GRAPHQL QUERY.
  QUERIES ARE CACHED USING THE LENGTH OF THE TEXT CONTENT OF THE RESPONSE OBJECT
*/

const MAINNET_QUERY = /* GraphQL */ `
  query GetSnapshot {
    snapshots_new(limit: 1, order_by: { id: desc }) {
      snapshot_data
    }
    snapshots_lm_claims(limit: 1, order_by: { id: desc }) {
      snapshot_data
    }
    snapshots_lm_dispensation(limit: 1, order_by: { id: desc }) {
      snapshot_data
    }
  }
`;
const TESTNET_QUERY = /* GraphQL */ `
  query GetDevSnapshot {
    snapshots_new: snapshots_new_dev(limit: 1, order_by: { id: desc }) {
      snapshot_data
    }
    snapshots_lm_claims(limit: 1, order_by: { id: desc }) {
      snapshot_data
    }
    snapshots_lm_dispensation(limit: 1, order_by: { id: desc }) {
      snapshot_data
    }
  }
`;

const getQueryByNetwork = (network) => {
  network = network ? network.toLowerCase() : network;
  switch (network) {
    case TESTNET: {
      return TESTNET_QUERY;
    }
    default: {
      return MAINNET_QUERY;
    }
  }
};

module.exports.loadLiquidityMinersSnapshot = async function (network) {
  if (!process.env.HEADER_SECRET) {
    throw new Error('process.env.HEADER_SECRET not defined!');
  }
  if (!process.env.SNAPSHOT_URL) {
    throw new Error('process.env.SNAPSHOT_URL not defined!');
  }
  return fetch(process.env.SNAPSHOT_URL, {
    method: 'POST',
    headers: Object.entries({
      'x-hasura-admin-secret': process.env.HEADER_SECRET,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      query: getQueryByNetwork(network),
    }),
  }).catch((err) => {
    console.error(err);
    throw err;
  });
};
