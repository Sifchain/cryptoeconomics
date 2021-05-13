const { fetch } = require('cross-fetch');

module.exports.graphqlRequest = async function graphqlRequest (query) {
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
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({
      query
    })
  }).then(async r => {
    return r.json();
  });
};
