const fetch = require('cross-fetch').default;
const configs = require('../server/config');
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
      `https://api.sifchain.finance/clp/getLpList?symbol=${symbol}&height=${height}&offset=${offset}`
    ).then((r) => r.json());
    if (liquidityProviders === null) return userStates;
    for (let {
      liquidity_provider_units: userUnits,
      liquidity_provider_address: userAddress,
    } of liquidityProviders) {
      const totalPoolValueRowan = +poolNativeAssetBalance * 2;
      const userPoolShare = +userUnits / +poolUnits;
      const userPoolValue = BigInt(
        Math.floor(userPoolShare * totalPoolValueRowan)
      ).toString();
      if (userPoolValue !== '0') {
        userStates[userAddress] = userPoolValue;
      }
    }
    // console.log(JSON.stringify(userStates, null, 2));
    offset += liquidityProviders.length;
  }
};

const loadStateAtHeight = async (height, coinWhitelist = undefined) => {
  const userStatesByPool = {};
  const {
    result: { pools },
  } = await fetch(
    `https://api.sifchain.finance/clp/getPools?height=${height}`
  ).then((r) => r.json());
  for (let pool of pools) {
    if (coinWhitelist && !coinWhitelist.includes(pool.external_asset.symbol))
      continue;
    userStatesByPool[pool.external_asset.symbol] = await loadPoolStateAtHeight(
      height,
      pool
    );
  }
  console.log(userStatesByPool);
  return userStatesByPool;
};
const startingHeights = {
  // harvest: '3587345',
  // harvest_expansion: '4335023',
  // expansion_bonus: '4335023',
  // bonus_v2_luna: '4654182',
  expansion_v2_bonus: '4756424',
};
async function main() {
  for (let programName in startingHeights) {
    const { COIN_WHITELIST } = configs[programName];
    const preProgramHeight = (+startingHeights[programName] - 1).toFixed(0);
    const filePath = require('path').join(
      __dirname,
      `../server/core/load/starting-states/lm-${programName}-starting-state.json`
    );
    try {
      require('fs').unlinkSync(filePath);
    } catch (e) {}
    require('fs').writeFileSync(
      filePath,
      Buffer.from(
        JSON.stringify(
          await loadStateAtHeight(preProgramHeight, COIN_WHITELIST),
          null,
          2
        )
      )
    );
  }
}
main();
