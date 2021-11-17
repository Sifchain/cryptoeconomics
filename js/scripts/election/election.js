const _fetch = require('cross-fetch').fetch;
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const RateLimitProtector =
  require('../../server/util/RateLimitProtector').RateLimitProtector;
const fetch = new RateLimitProtector({ padding: 50 }).buildAsyncShield(
  _fetch,
  _fetch
);
async function election() {
  const {
    result: {
      response: { last_block_height: latestBlockHeight },
    },
  } = await fetch(`https://rpc.sifchain.finance/abci_info?`).then((r) =>
    r.json()
  );

  const proposals = fs
    .readdirSync(path.join(__dirname, './proposals'))
    .sort((a, b) => a.localeCompare(b));

  const proposalName =
    config.proposal === 'latest'
      ? proposals[proposals.length - 1].replace('.json', '')
      : config.proposal;

  if (!proposals.includes(`${proposalName}.json`))
    throw new Error('proposal not found with name ' + config.proposal);
  const proposal = require(`./proposals/${proposalName}.json`);

  const startHeight = proposal.startHeight;
  const endHeight = Math.min(latestBlockHeight, proposal.endHeight);

  const ballotsByAddress =
    await require(`./aggregators/${proposal.aggregator}`).default(
      { startHeight, endHeight },
      { fetch }
    );

  const strategies = proposal.strategies.map(
    (strategy) => require(`./strategies/${strategy.name}`).default
  );

  const promises = [];
  let index = 0;
  const weightedVotes = {};
  for (let _address in ballotsByAddress) {
    const address = _address;
    const promise = (async () => {
      const ballotList = ballotsByAddress[address];
      for (let ballot of ballotList) {
        const strategyOutput = await strategies.reduce(
          (prev, strategy) =>
            prev.then((prevOut) =>
              strategy({ startHeight, endHeight, address }, { fetch }).then(
                (out) => prevOut + out
              )
            ),
          Promise.resolve(0n)
        );

        weightedVotes[ballot] = (weightedVotes[ballot] || 0n) + strategyOutput;
      }
    })();
    promises.push(promise);
  }
  await Promise.all(promises.map((r) => r.catch(console.error)));
  const votes = [];
  for (let ballot in weightedVotes) {
    votes.push({
      selection: ballot,
      votingPower: +(+weightedVotes[ballot].toString() / 10 ** 18).toFixed(2),
      accounts: Object.entries(ballotsByAddress).filter(([k, v]) => {
        return v.join(',').toUpperCase().includes(ballot.toUpperCase());
      }).length,
    });
  }
  const formattedElectionResults = votes
    .sort((a, b) => b.votingPower - a.votingPower)
    .map((obj) => ({
      selection: obj.selection,
      'voting power': obj.votingPower,
      accounts: obj.accounts,
    }));
  console.table(formattedElectionResults);
  require('fs').writeFileSync(
    require('path').join(
      __dirname,
      `./results/${proposalName}.${
        endHeight < latestBlockHeight
          ? 'final'
          : `${new Date().getFullYear()}-${
              new Date().getMonth() + 1
            }-${new Date().getDate()}`
      }.json`
    ),
    JSON.stringify(formattedElectionResults, null, 2)
  );
  // console.log('FINAL:', pollState);
  console.log('COMPLETE.');
}
election();
