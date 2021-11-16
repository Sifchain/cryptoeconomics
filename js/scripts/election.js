const fetch = require('cross-fetch').fetch;
async function election() {
  let totalCount = Infinity;
  const allTxs = [];
  let page = 0;
  while (page++ * 100 < totalCount) {
    const { result } = await fetch(
      `https://rpc.sifchain.finance/tx_search?query="transfer.recipient='sif1seftxu8l6v7d50ltm3v7hl55jlyxrps53rmjl8'"&per_page=100&page=${page}`
    ).then((r) => r.json());
    totalCount = +result.total_count;
    allTxs.push(...result.txs);
  }
  const pollState = {
    ballotsByAddress: {},
    weightedVotes: {},
    startHeight: 4215336,
    endHeight: 1000000000,
  };

  const abciInfo = await fetch(`https://rpc.sifchain.finance/abci_info?`).then(
    (r) => r.json()
  );
  const latestBlockHeight = abciInfo.result.response.last_block_height;
  const queryHeight = Math.min(latestBlockHeight, pollState.endHeight);

  await Promise.all(
    allTxs
      .sort((a, b) => +a.height - +b.height)
      .map(async ({ height, hash }) => {
        if (+height < pollState.startHeight || +height > pollState.endHeight)
          return;
        const json = await fetch(
          `https://api.sifchain.finance/cosmos/tx/v1beta1/txs/${hash}`
        ).then((r) => r.json());
        const userAddress = json.tx.body.messages[0].from_address;
        pollState.ballotsByAddress[userAddress] =
          json.tx.body.memo.toUpperCase().trim() || '_empty_';
      })
  );

  const promises = [];
  let index = 0;
  for (let addr in pollState.ballotsByAddress) {
    const currentIndex = index++;
    const promise = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 100 * currentIndex));
      const balanceRes = await fetch(
        `https://api.sifchain.finance/cosmos/bank/v1beta1/balances/${addr}/rowan?height=${queryHeight}`
      ).then((r) => r.json());
      const { liquidity_provider_data: accountLiquidityPools } = await fetch(
        `https://api.sifchain.finance/sifchain/clp/v1/liquidity_provider_data/${addr}`
      ).then((r) => r.json());
      const pooledSum = accountLiquidityPools.reduce((prev, curr) => {
        return prev + BigInt(curr.native_asset_balance);
      }, 0n);

      const { validators } = await fetch(
        `https://api.sifchain.finance/cosmos/staking/v1beta1/delegators/${addr}/validators`
      ).then((r) => r.json());
      let totalStaked = 0n;
      for (let validator of validators) {
        const delegationInfo = await fetch(
          `https://api.sifchain.finance/cosmos/staking/v1beta1/validators/${validator.operator_address}/delegations/${addr}?height=${queryHeight}`
        ).then((r) => r.json());
        totalStaked += BigInt(
          delegationInfo.delegation_response.balance.amount
        );
      }
      const ballotEntry = pollState.ballotsByAddress[addr];
      const ballotList = ballotEntry
        .split(/[^a-z0-9]/gim)
        .filter((v) => !!v)
        .slice(0, 4);
      for (let rawBallot of ballotList) {
        const ballot = rawBallot.trim().toUpperCase();
        pollState.weightedVotes[ballot] =
          (pollState.weightedVotes[ballot] || 0n) +
          BigInt(balanceRes.balance.amount) +
          BigInt(totalStaked) +
          BigInt(pooledSum);
      }
    })();
    promises.push(promise);
  }
  await Promise.all(promises.map((r) => r.catch(console.error)));
  const votes = [];
  for (let symbol in pollState.weightedVotes) {
    votes.push({
      token: symbol,
      votes: +(+pollState.weightedVotes[symbol].toString() / 10 ** 18).toFixed(
        2
      ),
      accounts: Object.values(pollState.ballotsByAddress).filter((v) =>
        v.toUpperCase().includes(symbol.toUpperCase())
      ).length,
    });
  }
  const formattedElectionResults = votes
    .sort((a, b) => b.votes - a.votes)
    .map((obj) => ({
      token: obj.token,
      'voting power': obj.votes,
      accounts: obj.accounts,
    }));
  console.table(formattedElectionResults);
  require('fs').writeFileSync(
    require('path').join(__dirname, './election-output.json'),
    JSON.stringify(formattedElectionResults, null, 2)
  );
  // console.log('FINAL:', pollState);
  console.log('COMPLETE.');
}
election();
