const fetch = require('cross-fetch').default;
const loadPoolStateAtHeight = async (
  height,
  {
    external_asset: { symbol },
    native_asset_balance: poolNativeAssetBalance,
    external_asset_balance: poolExternalAssetBalance,
    pool_units: poolUnits,
  }
) => {
  const userStates = {};
  let offset = 0;
  while (true) {
    const { result: liquidityProviders } = await fetch(
      `https://api-archive.sifchain.finance/clp/getLpList?symbol=${symbol}&height=${height}&offset=${offset}`
    ).then((r) => r.json());
    if (liquidityProviders === null) return userStates;
    for (let {
      liquidity_provider_units: userUnits,
      liquidity_provider_address: userAddress,
    } of liquidityProviders) {
      const totalPoolValueRowan = +poolNativeAssetBalance * 2;
      const userPoolShare = +userUnits / +poolUnits;
      const userPoolValue = BigInt(
        userPoolShare * totalPoolValueRowan
      ).toString();
      if (userPoolValue !== '0') {
        userStates[userAddress] = userPoolValue;
      }
    }
    // console.log(JSON.stringify(userStates, null, 2));
    offset += liquidityProviders.length;
  }
};

const loadStateAtHeight = async (height) => {
  const userStatesByPool = {};
  const {
    result: { pools },
  } = await fetch(
    `https://api-archive.sifchain.finance/clp/getPools?height=${height}`
  ).then((r) => r.json());
  for (let pool of pools) {
    userStatesByPool[pool.external_asset.symbol] = await loadPoolStateAtHeight(
      height,
      pool
    );
  }
  console.log(userStatesByPool);
  return userStatesByPool;
};
async function main() {
  require('fs').writeFileSync(
    './data.json',
    Buffer.from(JSON.stringify(await loadStateAtHeight('3587345'), null, 2))
  );
}
main();
