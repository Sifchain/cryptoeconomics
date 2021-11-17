module.exports.default = async ({ startHeight, endHeight }, { fetch }) => {
  const ballotsByAddress = [];
  /* 
    Keep going through pagination until you reach the end
  */
  let totalCount = 0;
  const allTxs = [];
  let page = 1;
  do {
    const { result } = await fetch(
      // optimally, would implement startHeight greater than & endHeight less than
      `https://rpc.sifchain.finance/tx_search?query="transfer.recipient='sif1seftxu8l6v7d50ltm3v7hl55jlyxrps53rmjl8'"&per_page=100&page=${page}`
    ).then((r) => r.json());
    totalCount = +result.total_count;
    allTxs.push(...result.txs);
  } while (page++ * 100 < totalCount);

  await Promise.all(
    allTxs
      .sort((a, b) => +a.height - +b.height)
      .map(async ({ height, hash }) => {
        if (+height < startHeight || +height > endHeight) return;
        const json = await fetch(
          `https://api.sifchain.finance/cosmos/tx/v1beta1/txs/${hash}`
        ).then((r) => r.json());
        const userAddress = json.tx.body.messages[0].from_address;
        ballotsByAddress[userAddress] = (
          json.tx.body.memo.toUpperCase().trim() || '_empty_'
        )
          .split(/[^a-z0-9]/gim)
          .filter((v) => !!v)
          .slice(0, 4)
          .map((v) => v.trim().toUpperCase());
      })
  );
  return ballotsByAddress;
};
