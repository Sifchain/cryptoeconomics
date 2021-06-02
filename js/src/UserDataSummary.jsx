import React from 'react';

const numFormatter = new Intl.NumberFormat();

const styleData = data => ({
  __styled: true,
  data
});
const say = (template, ...substitutions) => {
  // if (!substitutions.every((s) => !!s)) {
  //   return null;
  // }
  return template.map(str => {
    let item = substitutions.shift();
    const isStyled = item && item.__styled;
    item = isStyled ? item.data : item;
    const formattedData =
      typeof item === 'number'
        ? numFormatter.format(+item.toFixed(2))
        : item || '';
    const style =
      isStyled || typeof item === 'number'
        ? { color: 'var(--accent-blue)', fontWeight: 700 }
        : {};
    return (
      <span key={item}>
        {str}
        <span style={style}>{formattedData}</span>
      </span>
    );
  });
};
export const UserDataSummary = ({ user, type = 'vs' }) => {
  if (!user) return null;
  // if (
  //   // type !== 'vs' ||
  //   !(
  //     !process.env.REACT_APP_DEPLOYMENT_TAG ||
  //     process.env.REACT_APP_DEPLOYMENT_TAG === 'devnet'
  //   )
  // ) {
  //   return null;
  // }
  const validatorText =
    user.claimableCommissions +
      user.currentTotalCommissionsOnClaimableDelegatorRewards !==
    0 ? (
      <div>
        {say`As a validator, you have ${styleData(
          user.claimableCommissions
        )} rowan in commissions ready to claim. 
  ${say`And ${styleData(
    user.currentTotalCommissionsOnClaimableDelegatorRewards
  )} rowan in commissions will be claimable when they reach maturity or when their respective delegators claim their rewards.`}`}
      </div>
    ) : null;
  const stakerText = say`You are currently ${
    type === 'vs' ? 'staking' : 'pooling'
  } ${user.totalDepositedAmount} rowan and you can claim ${styleData(
    user.totalClaimableRewardsOnDepositedAssets +
      user.claimableRewardsOnWithdrawnAssets
  )} rowan in rewards today. `;
  const stakerText2 =
    user.reservedReward > user.totalClaimableRewardsOnDepositedAssets
      ? say`But if you wait until ${styleData(
          user.maturityDate
        )}, you could claim up to ${
          user.totalRewardsOnDepositedAssetsAtMaturity
        } rowan. ${say`(a projected APY of ${styleData(
          user.nextRewardProjectedAPYOnTickets * 100
        )}%)`}`
      : null;
  return (
    <div style={{ width: '100%', padding: '0% 0%' }}>
      <div className='user-data-summary-container'>
        <div style={{}}>
          {stakerText}
          {stakerText2}
        </div>
        {validatorText}
      </div>
    </div>
  );
};
