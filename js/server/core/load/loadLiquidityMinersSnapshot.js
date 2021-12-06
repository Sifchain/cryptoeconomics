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

const getSQLQueryByNetwork = (network, rewardProgram) => {
  const rewardProgramName =
    rewardProgram === 'harvest_reloaded' ? 'harvest' : rewardProgram;
  network = network ? network.toLowerCase() : network;
  switch (network) {
    // case TESTNET: {
    //   return getDatabase().transaction(async (tx) => {
    //     const snapshots_new = await tx.many(
    //       slonik.sql`select snapshot_data from snapshots_new_dev ORDER BY created_at DESC LIMIT 1`
    //     );
    //     const snapshots_lm_claims = await tx.many(
    //       slonik.sql`select snapshot_data from snapshots_lm_claims ORDER BY created_at DESC LIMIT 1`
    //     );
    //     const snapshots_lm_dispensation = await tx.many(
    //       slonik.sql`select snapshot_data from snapshots_lm_dispensation ORDER BY created_at DESC LIMIT 1`
    //     );
    //     return {
    //       data: {
    //         snapshots_new,
    //         snapshots_lm_claims,
    //         snapshots_lm_dispensation,
    //       },
    //     };
    //   });
    // }

    default: {
      return getDatabase().transaction(async (tx) => {
        const snapshots_new = (() => {
          if (rewardProgramName === 'COSMOS_IBC_REWARDS_V1') {
            return tx.many(
              slonik.sql`select * from snapshots_lm rf where rf.snapshot_time = (select max(snapshot_time) from snapshots_lm)`
            );
          }
          return tx
            .many(
              slonik.sql`select * from snapshots_reward_v2 where is_latest = true and reward_program=${rewardProgramName}`
            )
            .catch((e) => {
              console.error('\n\n\n' + rewardProgram + '\n\n\n');
              throw e;
            });
        })();
        // function augmentLMSnapshotToHideNonProgramLiquidityRemovals(
        //   snapshots_new
        // ) {
        //   for (let snapshot of snapshots_new) {
        //     const liquidityByTokens = snapshot.snapshot_data[snapshot.address];
        //     for (let token in liquidityByTokens) {
        //       let startingUserState = 0;
        //       const startingPoolState = lmHarvestStartingState[token];
        //       if (
        //         !startingPoolState &&
        //         Object.values(liquidityByTokens).filter((v) => v.length > 0)
        //           .length > 2
        //       ) {
        //         debugger;
        //       }
        //       if (startingPoolState) {
        //         startingUserState = startingPoolState[snapshot.address] || 0;
        //       }
        //       let liquidityDeltaEvents = liquidityByTokens[token];
        //       let total = 0;
        //       for (let deltaEvent of liquidityDeltaEvents) {
        //         if (
        //           snapshot.address ===
        //           'sif18vnw53wvw4q4pvus98pqjvy6mmuz4q0g5w5swx'
        //         ) {
        //           //
        //         }
        //         debugger;
        //         let nextTotal = total + deltaEvent.delta;
        //         if (nextTotal < 0) {
        //           deltaEvent.delta = -total;
        //           nextTotal = 0;
        //         }
        //         total = nextTotal;
        //       }
        //     }
        //   }
        // }
        // augmentLMSnapshotToHideNonProgramLiquidityRemovals(await snapshots_new);
        // console.log({ rewardProgram });
        const snapshots_lm_claims = tx.any(
          slonik.sql`
            SELECT
              snapshots_claims.claim_time unix,
              address, reward_program, distribution_type
            FROM
              snapshots_claims
            WHERE
              is_current = true 
          `
          // re-enable when multi-claims are enabled
          // AND reward_program = ${rewardProgram};
        );
        const snapshots_lm_dispensation = tx.any(
          slonik.sql`
            select
              recipient,
              MAX("timestamp") "timestamp",
              reward_program,
              MAX(amount) "amount",
              MAX("height") "height"
            from post_distribution pd
            GROUP BY pd.height, pd.recipient, pd.reward_program
            HAVING reward_program = ${rewardProgram}
            ORDER BY timestamp ASC
          `
        );
        const [...snapshotsNewLoaded] = await snapshots_new;
        const firstItemSnapshotData = snapshotsNewLoaded[0].snapshot_data;
        while (snapshotsNewLoaded.length > 1) {
          const snapshotItem = snapshotsNewLoaded.pop();
          const snapshotData = snapshotItem.snapshot_data;
          if (
            snapshotItem.address ===
            'sif18vnw53wvw4q4pvus98pqjvy6mmuz4q0g5w5swx'
          ) {
            // debugger;
          }
          try {
            delete snapshotData[snapshotItem.address][
              `ibc/7B8A3357032F3DB000ACFF3B2C9F8E77B932F21004FC93B5A8F77DE24161A573`
            ];
            delete snapshotData[snapshotItem.address][
              `ibc/ACA7D0100794F39DF3FF0C5E31638B24737321C24F32C2C486A24C78DD8F2029`
            ];
            // for (let token in snapshotData[snapshotItem.address]) {
            //   const events = [];
            //   for (let event of snapshotData[snapshotItem.address][token]) {
            //     events.push(event);
            //     if (event.unix_timestamp > 1635795480) {
            //       break;
            //     }
            //   }
            //   snapshotData[snapshotItem.address][token] = events;
            // }
          } catch (e) {}
          Object.assign(firstItemSnapshotData, snapshotData);
        }
        const [...snapshotsClaimsLoaded] = await snapshots_lm_claims;
        const firstItemClaimData = {};
        while (snapshotsClaimsLoaded.length) {
          const item = snapshotsClaimsLoaded.pop();
          if (item.address === 'sif10prgaf6ap3hkn8qtnzkys8vxm8ut0rr7jwzrqx') {
          }
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
module.exports.loadLiquidityMinersSnapshot = async function (
  network,
  rewardProgram
) {
  if (!process.env.HEADER_SECRET) {
    throw new Error('process.env.HEADER_SECRET not defined!');
  }
  if (!process.env.SNAPSHOT_URL) {
    throw new Error('process.env.SNAPSHOT_URL not defined!');
  }
  return getSQLQueryByNetwork(network, rewardProgram);
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
