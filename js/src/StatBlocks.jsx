import React from 'react';

const numFormatter = new Intl.NumberFormat();
const createStatBlock = ({
  title,
  subtitle,
  data = (data) => {
    return <div title={data}>{numFormatter.format(roundTo(data, 100))}</div>;
  },
  shouldDisplay = (data) => data !== 0,
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
  totalAccruedCommissionsAndClaimableRewards: createStatBlock({
    title: 'Earned',
    subtitle: 'Accrued Commissions & Rewards',
  }),
  get claimableReward() {
    return this.totalAccruedCommissionsAndClaimableRewards;
  },
  totalRewardAtMaturity: createStatBlock({
    title: 'Potential',
    subtitle: 'Projected Stake Rewards',
  }),
  maturityDateISO: createStatBlock({
    title: 'Maturity Date',
    subtitle: 'Max Rewards',
    data: (data) => <div>{new Date(data).toLocaleDateString()}</div>,
    prefix: null,
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
};
export const StatBlocks = {
  vs: {
    ...defaultStatBlocks,
    totalDepositedAmount: createStatBlock({
      title: 'Staked',
      subtitle: 'Deposited as Delegator',
    }),
    get totalTickets() {
      return this.totalDepositedAmount;
    },
    currentTotalCommissionsOnClaimableDelegatorRewards: createStatBlock({
      title: 'Commissions',
      subtitle: 'Awaiting Delegator Claims',
    }),
    totalClaimableCommissionsAndClaimableRewards: createStatBlock({
      title: 'Claimable',
      subtitle: 'Claimable Commissions & Rewards',
    }),

    // delegatorAddresses: createStatBlock({
    //   title: 'Delegators',
    //   subtitle: 'Addresses',
    //   prefix: null,
    //   data(data) {
    //     return (
    //       <div style={{ fontSize: '1rem' }}>
    //         <details>
    //           <summary>Click to Expand</summary>
    //           <p>
    //             {data.map((d) => {
    //               return (
    //                 <p key={d}>
    //                   <a target="_blank" href={`/#${d}&type=vs`}>
    //                     {d}
    //                   </a>
    //                 </p>
    //               );
    //             })}
    //           </p>
    //         </details>
    //       </div>
    //     );
    //   },
    // }),
  },
  lm: {
    ...defaultStatBlocks,
    totalDepositedAmount: createStatBlock({
      title: 'Pooled',
      subtitle: 'DEPOSIT',
    }),
    get totalTickets() {
      return this.totalDepositedAmount;
    },
  },
};