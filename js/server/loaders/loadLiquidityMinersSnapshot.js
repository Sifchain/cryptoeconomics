
module.exports.loadLiquidityMinersSnapshot = async function () {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error("process.env.HASURA_ADMIN_SECRET not defined!")
  }
  const { data } = await fetch('https://cute-toucan-88.hasura.app/v1/graphql', {
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
    },
    body: JSON.stringify({
      query: /* GraphQL */`query GetSnapshot { 
        snapshots_new(
          limit: 1,
          order_by: { id: desc }
        ) { 
          snapshot_data 
        } 
      }"}`
    })
  }).then(r => r.json());
  
}