// const { fetch } = require('cross-fetch');
const { TESTNET } = require('../../constants/snapshot-source-names');
const slonik = require('slonik');
const { getDatabase } = require('./utils/getDatabase');
/* 
  WARNING: DO NOT ADD MORE QUERIES OR FIELDS TO THE GRAPHQL QUERY.
  QUERIES ARE CACHED USING THE LENGTH OF THE TEXT CONTENT OF THE RESPONSE OBJECT
*/

// const MAINNET_QUERY = /* GraphQL */ `
//   query GetSnapshot {
//     snapshots_new(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_lm_claims(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_lm_dispensation(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//   }
// `;
// const TESTNET_QUERY = /* GraphQL */ `
//   query GetDevSnapshot {
//     snapshots_new: snapshots_new_dev(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_lm_claims(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//     snapshots_lm_dispensation(limit: 1, order_by: { id: desc }) {
//       snapshot_data
//     }
//   }
// `;

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

const getSQLQueryByNetwork = (network) => {
  network = network ? network.toLowerCase() : network;
  switch (network) {
    case TESTNET: {
      return getDatabase().transaction(async (tx) => {
        const snapshots_new = await tx.many(
          slonik.sql`select snapshot_data from snapshots_new_dev ORDER BY created_at DESC LIMIT 1`
        );
        const snapshots_lm_claims = await tx.many(
          slonik.sql`select snapshot_data from snapshots_lm_claims ORDER BY created_at DESC LIMIT 1`
        );
        const snapshots_lm_dispensation = await tx.many(
          slonik.sql`select snapshot_data from snapshots_lm_dispensation ORDER BY created_at DESC LIMIT 1`
        );
        return {
          data: {
            snapshots_new,
            snapshots_lm_claims,
            snapshots_lm_dispensation,
          },
        };
      });
    }

    default: {
      return getDatabase().transaction(async (tx) => {
        const snapshots_new = tx.many(
          slonik.sql`select * from snapshots_lm rf where rf.snapshot_time = (select max(snapshot_time) from snapshots_lm)`
        );
        const snapshots_lm_claims = tx.any(
          slonik.sql`
            SELECT
              snapshots_claims.claim_time unix,
              address, reward_program, distribution_type
            FROM
              snapshots_claims
            WHERE
              is_current = true 
              AND reward_program = 'COSMOS_IBC_REWARDS_V1';
          `
        );
        const snapshots_lm_dispensation = tx.many(
          slonik.sql`select * from post_distribution pd
          where pd.is_current = true
            and reward_program = 'COSMOS_IBC_REWARDS_V1';`
        );
        const [...snapshotsNewLoaded] = await snapshots_new;
        const firstItemSnapshotData = snapshotsNewLoaded[0].snapshot_data;
        while (snapshotsNewLoaded.length > 1) {
          Object.assign(
            firstItemSnapshotData,
            snapshotsNewLoaded.pop().snapshot_data
          );
        }
        const [...snapshotsClaimsLoaded] = await snapshots_lm_claims;
        const firstItemClaimData = {};
        while (snapshotsClaimsLoaded.length) {
          const item = snapshotsClaimsLoaded.pop();
          firstItemClaimData[item.address] = [
            ...(firstItemClaimData[item.address] || []),
            item,
          ];
        }
        const [...snapshotsDispensationsLoaded] =
          await snapshots_lm_dispensation;
        const firstItemDispensationData = {};
        while (snapshotsDispensationsLoaded.length) {
          const item = snapshotsDispensationsLoaded.pop();
          firstItemDispensationData[item.recipient] = [
            ...(firstItemDispensationData[item.recipient] || []),
            item,
          ];
        }

        return {
          data: {
            snapshots_new: snapshotsNewLoaded,
            snapshots_lm_claims: [{ snapshot_data: firstItemClaimData }],
            // snapshots_lm_dispensation: await snapshots_lm_dispensation,
            // snapshots_lm_claims: [],
            snapshots_lm_dispensation: [
              { snapshot_data: firstItemDispensationData },
            ],
            // snapshots_lm_dispensation: [],
          },
        };
      });
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
  return getSQLQueryByNetwork(network);
  // return fetch(process.env.SNAPSHOT_URL, {
  //   method: 'POST',
  //   headers: Object.entries({
  //     'x-hasura-admin-secret': process.env.HEADER_SECRET,
  //     'Content-Type': 'application/json',
  //   }),
  //   body: JSON.stringify({
  //     query: getQueryByNetwork(network),
  //   }),
  // }).catch((err) => {
  //   console.error(err);
  //   throw err;
  // });
};
