module.exports.default = async ({ endHeight, address }, { fetch }) => {
  const { validators } = await fetch(
    // should use archive node & endHeight for easy verifiability
    `https://api-archive.sifchain.finance/cosmos/staking/v1beta1/delegators/${address}/validators?height=${endHeight}`
  ).then((r) => r.json());
  console.log({ validators });
  let totalStaked = 0n;
  for (let validator of validators) {
    const delegationInfo = await fetch(
      // should use archive node & endHeight for easy verifiability
      `https://api-archive.sifchain.finance/cosmos/staking/v1beta1/validators/${validator.operator_address}/delegations/${address}?height=${endHeight}`
    ).then((r) => r.json());
    totalStaked += BigInt(delegationInfo.delegation_response.balance.amount);
  }
  return totalStaked;
};
