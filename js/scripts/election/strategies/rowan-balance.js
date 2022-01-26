module.exports.default = async ({ endHeight, address }, { fetch }) => {
  return await fetch(
    // should use archive node & endHeight for easy verifiability
    `https://api-archive.sifchain.finance/cosmos/bank/v1beta1/balances/${address}/rowan?height=${endHeight}`
  )
    .then((r) => r.json())
    .then((r) => BigInt(r.balance.amount));
};
