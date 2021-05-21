import React from 'react';

const numFormatter = new Intl.NumberFormat();
const createStatBlock = ({
  title,
  subtitle,
  data = (data) => {
    return <div title={data}>{numFormatter.format(roundTo(data, 100))}</div>;
  },
  shouldDisplay = (data) => true,
  prefix = (
    <img
      style={{
        display: 'inline',
        height: '0.7em',
        opacity: 0.7,
        marginBottom: -6,
        marginRight: 5,
        filter: 'brightness(1000%)',
      }}
      src="sifchain-s.svg"
    />
  ),
  suffix = null,
}) => ({
  title,
  subtitle,
  prefix,
  suffix,
  data,
  shouldDisplay,
});
const roundTo = (num, oneWithZeros = 100) =>
  ~~(num * oneWithZeros) / oneWithZeros;

const defaultStatBlocks = {
  currentTotalClaimableReward: createStatBlock({
    title: 'Claimable',
    subtitle: 'ROWAN',
  }),
  totalRewardAtMaturity: createStatBlock({
    title: 'Potential',
    subtitle: 'ROWAN',
  }),
};
export const StatBlocks = {
  vs: {
    ...defaultStatBlocks,
    totalTicketsAmountSum: createStatBlock({
      title: 'Staked',
      subtitle: 'ROWAN',
    }),
  },
  lm: {
    ...defaultStatBlocks,
    totalTicketsAmountSum: createStatBlock({
      title: 'Pooled',
      subtitle: 'ROWAN',
    }),
    currentAPYOnTickets: createStatBlock({
      title: 'APY',
      subtitle: 'Annual Percentage Yield',
      data: (data) => {
        return (
          <div title={data}>
            {numFormatter.format(~~(roundTo(data, 100) * 100))}
          </div>
        );
      },
      prefix: null,
      shouldDisplay(data) {
        return data > 0;
      },
      suffix: (
        <span
          style={{
            color: 'white',
            fontWeight: 400,
            opacity: 0.7,
            fontSize: '1em',
          }}
        >
          %
        </span>
      ),
    }),
  },
};
