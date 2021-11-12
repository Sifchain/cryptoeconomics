const fetch = require('cross-fetch').fetch;
async function election() {
  const { result } = await fetch(
    `https://rpc.sifchain.finance/tx_search?query="transfer.recipient='sif1seftxu8l6v7d50ltm3v7hl55jlyxrps53rmjl8'"&per_page=1000&page=1`
  ).then((r) => r.json());
  const pollState = {
    ballotsByAddress: {},
    weightedVotes: {},
    startHeight: 0,
    endHeight: 1000000000,
  };
  const abciInfo = await fetch(`https://rpc.sifchain.finance/abci_info?`).then(
    (r) => r.json()
  );
  const {
    result: { pools },
  } = await fetch('https://api.sifchain.finance/clp/getPools').then((r) =>
    r.json()
  );
  const latestBlockHeight = abciInfo.result.response.last_block_height;
  const txs = result.txs.sort((a, b) => +a.height - +b.height);
  for (let { hash, height } of txs) {
    if (+height < pollState.startHeight || +height > pollState.endHeight)
      continue;
    const json = await fetch(
      `https://api.sifchain.finance/cosmos/tx/v1beta1/txs/${hash}`
    ).then((r) => r.json());
    const userAddress = json.tx.body.messages[0].from_address;
    pollState.ballotsByAddress[userAddress] =
      json.tx.body.memo.toUpperCase().trim() || '_empty_';
  }
  for (let addr in pollState.ballotsByAddress) {
    const balanceRes = await fetch(
      `https://api.sifchain.finance/cosmos/bank/v1beta1/balances/${addr}/rowan?height=${Math.min(
        latestBlockHeight,
        pollState.endHeight
      )}`
    ).then((r) => r.json());
    const poolAmounts = await Promise.all(
      pools.map((p) =>
        fetch(
          `https://api.sifchain.finance/clp/getLiquidityProvider?lpAddress=${addr}&symbol=${p.external_asset.symbol}`
        )
          .then((r) => r.json())
          .then((r) => {
            const poolRatio = +r.pool_units / +r.pool_units;
            const amountOfRowan =
              (poolRatio || 0) * (+p.native_asset_balance || 0);
            return amountOfRowan;
          })
          .catch((e) => console.log('failed') || 0)
      )
    );
    const pooledSum = BigInt(
      poolAmounts
        .reduce((prev, curr) => {
          return prev + curr;
        }, 0)
        .toFixed(0)
    );
    const { validators } = await fetch(
      `https://api.sifchain.finance/cosmos/staking/v1beta1/delegators/${addr}/validators`
    ).then((r) => r.json());
    let totalStaked = 0n;
    for (let validator of validators) {
      const delegationInfo = await fetch(
        `https://api.sifchain.finance/cosmos/staking/v1beta1/validators/${validator.operator_address}/delegations/${addr}`
      ).then((r) => r.json());
      totalStaked += BigInt(delegationInfo.delegation_response.balance.amount);
    }
    const ballot = pollState.ballotsByAddress[addr];
    pollState.weightedVotes[ballot] =
      (pollState.weightedVotes[ballot] || 0n) +
      BigInt(balanceRes.balance.amount) +
      BigInt(totalStaked) +
      BigInt(pooledSum);
    console.log(JSON.stringify(pollState, null, 2));
  }
  console.log(pollState);
}
election();
