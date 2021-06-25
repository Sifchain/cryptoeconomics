const { loadLatestAirdrop } = require('../loaders/loadLatestAirdrop');
const { loadLatestWinners } = require('../loaders/loadLatestWinners');
const { validateSifAddress } = require('./validateSifAddress');

const GENERIC_DISPENSATION_JOB_TYPES = {
  AIRDROP: 'airdrop',
  TRADING_COMPETITION: 'trading-competition'
};
exports.GENERIC_DISPENSATION_JOB_TYPES = GENERIC_DISPENSATION_JOB_TYPES;
exports.createGenericDispensationJob = async jobType => {
  const EROWAN_PRECISION = 1e18;
  const {
    data: { users }
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
    const formattedAmount = BigInt(
      Math.floor(claimed * EROWAN_PRECISION)
    ).toString();
    if (formattedAmount === '0') {
      continue;
    }
    output.push({
      address: address,
      coins: [
        {
          denom: 'rowan',
          amount: formattedAmount
        }
      ]
    });
  }
  return {
    job: {
      Output: output
    }
  };
};
