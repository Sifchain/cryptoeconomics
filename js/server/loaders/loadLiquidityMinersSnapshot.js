const { fetch } = require("cross-fetch");
const fs = require("fs");
const cacheFilePath = "/tmp/last-successful-lm-snapshot.json";

module.exports.loadLiquidityMinersSnapshot = async function () {
  if (!process.env.HEADER_SECRET) {
    throw new Error("process.env.HEADER_SECRET not defined!");
  }
  if (!process.env.SNAPSHOT_URL) {
    throw new Error("process.env.SNAPSHOT_URL not defined!");
  }
  return fetch(process.env.SNAPSHOT_URL, {
    method: "POST",
    headers: Object.entries({
      "x-hasura-admin-secret": process.env.HEADER_SECRET,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      query: /* GraphQL */ `
        query GetSnapshot {
          snapshots_new(limit: 1, order_by: { id: desc }) {
            snapshot_data
          }
        }
      `,
    }),
  })
    .then(async (r) => {
      return r.json();
    })
};
