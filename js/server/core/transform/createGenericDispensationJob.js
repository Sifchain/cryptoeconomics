const { loadLatestAirdrop } = require('../load/loadLatestAirdrop');
const { loadLatestWinners } = require('../load/loadLatestWinners');
const { validateSifAddress } = require('../../util/validateSifAddress');

const GENERIC_DISPENSATION_JOB_TYPES = {
  AIRDROP: 'airdrop',
  TRADING_COMPETITION: 'trading-competition',
};
exports.GENERIC_DISPENSATION_JOB_TYPES = GENERIC_DISPENSATION_JOB_TYPES;
exports.createGenericDispensationJob = async (jobType) => {
  const EROWAN_PRECISION = 1e18;
  const {
    data: { users },
  } =
    jobType === GENERIC_DISPENSATION_JOB_TYPES.AIRDROP
      ? await loadLatestAirdrop()
      : await loadLatestWinners();
  const output = [];
  for (const user of users) {
    const address = user.address;
    const { isValid } = validateSifAddress(address);
    if (!isValid) {
      console.warn(
        `WARNING: ${address} is not valid. Commissions and/or rewards will not be dispensed.`
      );
      continue;
    }
    const claimed = user.amount;
    if (!claimed) continue;
    const bigIntAmount = BigInt(Math.floor(claimed * EROWAN_PRECISION));
    if (bigIntAmount === BigInt('0') || !bigIntAmount) {
      continue;
    }
    const formattedAmount = bigIntAmount.toString();
    output.push({
      address: address,
      coins: [
        {
          denom: 'rowan',
          amount: formattedAmount,
        },
      ],
    });
  }
  return {
    job: {
      Output: output,
    },
  };
};
