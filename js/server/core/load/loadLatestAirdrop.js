const { graphqlRequest } = require('./utils/graphqlRequest');
exports.loadLatestAirdrop = function loadLatestWinners() {
  return graphqlRequest(/* GraphQL */ `
    query LatestAirdropMainnet {
      users: latestairdrop {
        address
        amount: totalamt
      }
    }
  `);
};
