module.exports.default = async ({ endHeight, address }, { fetch }) => {
  const { liquidity_provider_data: accountLiquidityPools } = await fetch(
    // should use archive node & endHeight for easy verifiability
    `https://api-archive.sifchain.finance/sifchain/clp/v1/liquidity_provider_data/${address}?height=${endHeight}`
  ).then((r) => r.json());
  const pooledSum = accountLiquidityPools.reduce((prev, curr) => {
    return prev + BigInt(curr.native_asset_balance);
  }, 0n);
  return pooledSum;
};
