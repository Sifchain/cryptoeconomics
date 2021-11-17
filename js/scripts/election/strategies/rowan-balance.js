module.exports.default = async ({ endHeight, address }, { fetch }) => {
  return await fetch(
    // should use archive node & endHeight for easy verifiability
    `https://api.sifchain.finance/cosmos/bank/v1beta1/balances/${address}/rowan`
  )
    .then((r) => r.json())
    .then((r) => BigInt(r.balance.amount));
};
