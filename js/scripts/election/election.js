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
const election = (module.exports.election = async function election(
  params = {
    proposal: 'latest',
  }
) {
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
    params.proposal === 'latest'
      ? proposals[proposals.length - 1].replace('.json', '')
      : params.proposal;

  console.log(`running election for proposal ${proposalName}`);
  if (!proposals.includes(`${proposalName}.json`))
    throw new Error('proposal not found with name ' + params.proposal);
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

  const powerByStrategyByAddress = {};
  const powerByStrategyByBallot = {};
  const promises = [];
  let index = 0;
  const weightedVotes = {};
  for (let _address in ballotsByAddress) {
    const address = _address;
    const promise = (async () => {
      const ballotsRaw = ballotsByAddress[address];
      const ballotList = [...new Set(ballotsRaw)].slice(
        0,
        proposal.maxBallots || ballotsRaw.length
      );
      if (ballotList.includes('USDR')) {
        console.log(`${address} has a USDR ballot`);
      }
      const strategyOutput = await strategies.reduce(
        (prev, strategy, strategyIndex) =>
          prev.then((prevOut) =>
            strategy({ startHeight, endHeight, address }, { fetch }).then(
              (out) => {
                const strategyConfig = proposal.strategies[strategyIndex];
                const power = Math.floor(
                  +out.toString() * strategyConfig.weight
                );
                powerByStrategyByAddress[address] =
                  powerByStrategyByAddress[address] || {};
                powerByStrategyByAddress[address][strategyConfig.name] = power;

                return prevOut + BigInt(power);
              }
            )
          ),
        Promise.resolve(0n)
      );
      for (let i = 0; i < ballotList.length; i++) {
        const ballot = ballotList[i];
        const rankWeight = 1 / 2 ** i;
        const ballotWeight = +strategyOutput.toString() * rankWeight;
        powerByStrategyByBallot[ballot] = powerByStrategyByBallot[ballot] || {};
        for (let strategyName in powerByStrategyByAddress[address]) {
          powerByStrategyByBallot[ballot][strategyName] =
            (powerByStrategyByBallot[ballot][strategyName] || 0) +
            powerByStrategyByAddress[address][strategyName] * rankWeight;
        }
        weightedVotes[ballot] =
          (weightedVotes[ballot] || 0n) + BigInt(Math.floor(ballotWeight));
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
      voteCount: Object.entries(ballotsByAddress).filter(([k, v]) => {
        return v.join(',').toUpperCase().includes(ballot.toUpperCase());
      }).length,
      ...Object.fromEntries(
        Object.entries(powerByStrategyByBallot[ballot]).map(([k, v]) => [
          k + ` power`,
          new Intl.NumberFormat('en-US', {}).format(
            +(+v.toString() / 10 ** 18).toFixed(2)
          ),
        ])
      ),
    });
  }
  const formattedElectionResults = votes.sort(
    (a, b) => b.votingPower - a.votingPower
  );

  console.table(
    formattedElectionResults.map((r) => ({
      ...r,
      votingPower: new Intl.NumberFormat('en-US').format(r.votingPower),
    }))
  );

  // console.log('FINAL:', pollState);
  console.log('COMPLETE.');
  return {
    formattedElectionResults,
    ballotsByAddress,
    endHeight,
    latestBlockHeight,
    proposalName,
    votes,
  };
});

// if script is being run directly
if (require.main === module) {
  (async () => {
    const {
      formattedElectionResults,
      endHeight,
      latestBlockHeight,
      proposalName,
      ballotsByAddress,
      votes,
    } = await election(config);
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
    require('fs').writeFileSync(
      require('path').join(
        __dirname,
        `./results/${proposalName}.${
          endHeight < latestBlockHeight
            ? 'final'
            : `${new Date().getFullYear()}-${
                new Date().getMonth() + 1
              }-${new Date().getDate()}`
        }.cache.json`
      ),
      JSON.stringify(ballotsByAddress, null, 2)
    );
  })();
  // if being executed as a script, save the output to a file
}
