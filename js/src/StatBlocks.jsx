import React from 'react';

const numFormatter = new Intl.NumberFormat();
const createStatBlock = ({
  title,
  subtitle,
  data = data => {
    return <div title={data}>{numFormatter.format(roundTo(data, 100))}</div>;
  },
  shouldDisplay = data => true, // data !== 0,
  order = 0,
  prefix = (
    <img
      style={{
        display: 'inline',
        height: '0.7em',
        opacity: 0.7,
        marginBottom: -6,
        marginRight: 5,
        filter: 'brightness(1000%)'
      }}
      src='sifchain-s.svg'
    />
  ),
  suffix = null
}) => ({
  title,
  subtitle,
  prefix,
  suffix,
  data,
  shouldDisplay,
  order
});
const roundTo = (num, oneWithZeros = 100) =>
  Math.floor(num * oneWithZeros) / oneWithZeros;

const defaultStatBlocks = {
  dispensed: createStatBlock({
    title: 'Received Earnings',
    subtitle: 'Dispensed Commissions + Rewards',
    order: 5
  }),
  claimedCommissionsAndRewardsAwaitingDispensation: createStatBlock({
    title: 'Claimed Earnings',
    subtitle: 'Dispensing on friday',
    order: 4
  }),
  totalAccruedCommissionsAndClaimableRewards: createStatBlock({
    title: 'Current Earnings',
    order: 2,
    subtitle: 'Commissions + Rewards',
    shouldDisplay: () => true
  }),
  get claimableReward () {
    return this.totalAccruedCommissionsAndClaimableRewards;
  },
  totalCommissionsAndRewardsAtMaturity: createStatBlock({
    title: 'Potential Earnings',
    order: 3,
    subtitle: 'Commissions + Rewards at Maturity'
  }),
  maturityDateISO: createStatBlock({
    title: 'Maturity Date',
    subtitle: 'Max Rewards',
    order: 6,
    data: data => <div>{new Date(data).toLocaleDateString()}</div>,
    prefix: null
  }),
  nextRewardProjectedAPYOnTickets: createStatBlock({
    title: 'Projected APY <small>*until program end<small>',
    subtitle: 'Annual Percentage Yield',
    order: 4,
    data: data => {
      return (
        <div title={data}>
          {numFormatter.format(Math.floor(roundTo(data, 100) * 100))}
        </div>
      );
    },
    prefix: null,
    shouldDisplay (data) {
      return data > 0;
    },
    suffix: (
      <span
        style={{
          color: 'white',
          fontWeight: 400,
          opacity: 0.7,
          fontSize: '1em'
        }}
      >
        %
      </span>
    )
  })
};
export const StatBlocks = {
  vs: {
    ...defaultStatBlocks,
    totalDepositedAmount: createStatBlock({
      order: 0,
      title: 'Staked',
      subtitle: 'Delegated Assets'
    }),
    get totalTickets () {
      return this.totalDepositedAmount;
    }
    // currentTotalCommissionsOnClaimableDelegatorRewards: createStatBlock({
    //   title: 'Commissions',
    //   subtitle: 'Awaiting Delegator Claims',
    // }),
    // totalClaimableCommissionsAndClaimableRewards: createStatBlock({
    //   title: 'Claimable',
    //   subtitle: 'Claimable Commissions & Rewards',
    // }),

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
      order: 0,
      subtitle: 'Deposited Assets'
    }),
    get totalTickets () {
      return this.totalDepositedAmount;
    }
  }
};
