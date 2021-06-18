const { graphqlRequest } = require('./graphqlRequest');
exports.loadLatestWinners = function loadLatestWinners () {
  return graphqlRequest(/* GraphQL */ `
    query winners {
      users: latest_trade_winners {
        address
        amount
      }
    }
  `);
};
