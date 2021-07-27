const fetch = require('cross-fetch').default;
const files = require('fs').readdirSync(
  require('path').join(__dirname, `./output/get-all-user-data-at-v1-end`)
);

const summary = [];

(async () => {
  const data = [
    ...(await fetch(
      `https://api-cryptoeconomics.sifchain.finance/api/vs?key=users&snapshot-source=mainnet`
    ).then(r => r.json())),
    ...(await fetch(
      `https://api-cryptoeconomics.sifchain.finance/api/lm?key=users&snapshot-source=mainnet`
    ).then(r => r.json()))
  ];
  console.group(`All Users (LM & VS):`);
  console.log(
    `${files.length} processed / ${data.length} total  ${
      data.length === files.length ? 'valid ✅' : 'invalid ❌'
    }\n\n\n`
  );
  console.groupEnd();
})();

/* 
  Just one large list with:
  All addresses receiving rewards
  Claimable rewards total at the end of August 4th
  Fully maturated rewards total at the end of August 4th
  Timestamp/Date of maturation
*/
let firstTimestamp;

const totals = {
  lm: {
    totalGivenOut: 0,
    totalForfeited: 0,
    totalToBeGivenOutInEOLProgram: 0,
    totalClaimedSinceLastDispensation: 0,
    claimCountSinceLastDispensation: 0
  },
  vs: {
    totalGivenOut: 0,
    totalForfeited: 0,
    totalToBeGivenOutInEOLProgram: 0,
    totalClaimedSinceLastDispensation: 0,
    claimCountSinceLastDispensation: 0
  }
};
for (let file of files) {
  const filePath = require('path').join(
    __dirname,
    `./output/get-all-user-data-at-v1-end/${file}`
  );
  const type = file.split('__')[0];
  const fileContent = require(filePath);
  if (!fileContent.user) console.log(`user does not exist for ${file}`);
  firstTimestamp = firstTimestamp || fileContent.timestamp;
  if (firstTimestamp !== fileContent.timestamp) {
    console.log(
      `Timestamps are not equal ${firstTimestamp}, ${fileContent.timestamp}`
    );
  }
  // if (
  //   !fileContent.user ||
  //   !fileContent.user.totalAccruedCommissionsAndClaimableRewards ||
  //   fileContent.user.totalAccruedCommissionsAndClaimableRewards < 1e-18 ||
  //   fileContent.user.totalCommissionsAndRewardsAtMaturity < 1e-18
  // ) {
  //   // console.log('bad nums', fileContent.user);
  //   // process.exit();
  // }
  const maturatedRewardsTotal =
    fileContent.user.totalCommissionsAndRewardsAtMaturity;
  const claimableRewardsTotal =
    fileContent.user.totalAccruedCommissionsAndClaimableRewards;
  const claimedRewardsSinceFinalDispensation =
    fileContent.user.claimedCommissionsAndRewardsAwaitingDispensation;
  // fileContent.user.totalRewardsOnDepositedAssetsAtMaturity +
  // fileContent.user.totalAccruedCommissionsAtMaturity;
  if (claimedRewardsSinceFinalDispensation > 1e-16) {
    totals[type].claimCountSinceLastDispensation += 1;
    // console.log(file);
  }
  totals[type].totalForfeited +=
    fileContent.user.forfeited + fileContent.user.forfeitedCommissions;
  totals[type].totalGivenOut += fileContent.user.dispensed;
  totals[
    type
  ].totalClaimedSinceLastDispensation += claimedRewardsSinceFinalDispensation;
  totals[type].totalToBeGivenOutInEOLProgram +=
    maturatedRewardsTotal + claimedRewardsSinceFinalDispensation;
  if (Number.isNaN(totals[type].totalToBeGivenOutInEOLProgram)) {
    totals[type].totalToBeGivenOutInEOLProgram = 0;
    console.log(fileContent.user.totalCommissionsAndRewardsAtMaturity);
    process.exit();
  }
  const address = file
    .split('__')
    .pop()
    .split('.json')[0];
  const obj = {
    type,
    address,
    maturatedRewardsTotal,
    claimableRewardsTotal,
    claimedRewardsSinceFinalDispensation,
    // 'What `wrdtotal` should be': maturatedRewardsTotal - claimableRewardsTotal,
    // 'What their initial payment should be':
    //   claimableRewardsTotal + claimedRewardsSinceFinalDispensation + <WeeklyPayout>,
    maturityDateISO: fileContent.user.maturityDateISO
  };
  if (Object.values(obj).some(v => +v < 0)) {
    console.log(obj);
  }
  if (fileContent.user.nextRewardProjectedFutureReward) {
    console.log(fileContent.user.nextRewardProjectedFutureReward);
  }
  if (
    maturatedRewardsTotal > 1e-18 ||
    claimableRewardsTotal > 1e-18 ||
    claimedRewardsSinceFinalDispensation > 1e-18
  ) {
    summary.push(obj);
  }
}
// process.exit();
// save results to file
const filePath = require('path').join(
  __dirname,
  `./output/get-all-v1-closure-data/rewards-v1-closure-data.json`
);
require('fs').writeFileSync(
  filePath,
  JSON.stringify(
    {
      targetDateTime: `2021-08-04T23:59:59`,
      rewardRemedyList: summary
    },
    null,
    2
  )
);

const fmtr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

console.log('\n\n');
function testProgram (programName) {
  const upperName = programName.toUpperCase();
  const programData = totals[programName];
  const grandTotal =
    programData.totalForfeited +
    programData.totalGivenOut +
    programData.totalToBeGivenOutInEOLProgram;
  console.group(`${upperName} Totals`);
  console.log(`Forfeited: ${fmtr.format(programData.totalForfeited)} ROWAN`);
  console.log(`Dispensed: ${fmtr.format(programData.totalGivenOut)} ROWAN`);
  // console.log(
  //   `Claim Count Since Final Dispensation: ${fmtr.format(
  //     programData.claimCountSinceLastDispensation
  //   )} Claims`
  // );
  console.log(
    `Claimed Since Last Dispensation: ${fmtr.format(
      programData.totalClaimedSinceLastDispensation
    )} ROWAN`
  );
  console.log(
    `Sunset Rewards: ${fmtr.format(
      programData.totalToBeGivenOutInEOLProgram
    )} ROWAN`
  );
  console.log(
    `Program Total: ${fmtr.format(Math.round(grandTotal))} ROWAN ${
      Math.round(grandTotal) === 4.5e7 ? 'valid ✅' : 'invalid 🚫'
    }`
  );
  console.groupEnd();
}

testProgram('lm');
testProgram('vs');
