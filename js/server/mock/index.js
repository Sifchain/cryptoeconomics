const moment = require('moment');
const {
  getDateFromSnapshotIndex,
} = require('../util/getDateFromSnapshotIndex');
const { getTimeIndex } = require('../util/getTimeIndex');
exports.mockMinerClaims = function mockMinerClaims(snapshot) {
  const addrLookup = snapshot.data.snapshots_new[0].snapshot_data;

  return {
    /* {
      ADDRESS_1: [0,0,1,0,0,0,0,0,0,0,0,0,1,0],
      ADDRESS_2: [0,0,0,0,0,1,0,0,0,0,1,0,0,0]
    } */
    claimsSnapshotData:
      // Mocks claims to occur 30 days after any withdrawal or deposit
      Object.fromEntries(
        Object.entries(addrLookup).map(([key, val]) => {
          const amountDeltas = Object.values(val).reduce((prev, curr) =>
            curr.map((currItem, index) => {
              const val = prev[index] || 0;
              return currItem + val;
            })
          );
          const claims = Array.from({ length: amountDeltas.length }, () => 0);
          // const dispensations = Array.from(
          //   { length: amountDeltas.length },
          //   () => 0
          // );
          // let lastDispensedAt = 0;
          amountDeltas.forEach((aD, index) => {
            if (aD === 0) return;
            const daysInMinutes = 24 * 60;
            const intervalCountUntilMockClaim = ~~((10 * daysInMinutes) / 200);
            const claimIndex = Math.min(
              index + intervalCountUntilMockClaim - 1,
              claims.length - 1
            );
            // const dispensationIndex = Math.max(
            //   index + intervalCountUntilMockClaim * 2,
            //   claims.length - 1
            // );

            claims[claimIndex] = 1;
            // dispensations[dispensationIndex] = ;
          });
          return [key, claims];
        })
      ),
  };
};

function nextDayOfWeek(
  momentInstance = moment(),
  dayINeed = 5 /* for Friday */
) {
  const today = momentInstance.isoWeekday();
  // if we haven't yet passed the day of the week that I need:
  if (today <= dayINeed) {
    // then just give me this week's instance of that day
    return momentInstance
      .clone()
      .isoWeekday(dayINeed)
      .hours(0)
      .minutes(1)
      .second(1);
  } else {
    // otherwise, give me *next week's* instance of that same day
    return momentInstance.clone().add(1, 'weeks').isoWeekday(dayINeed);
  }
}

exports.mockMinerDispensations = (minerClaimsSnapshotData) => {
  const dispensationsSnapshot = {};
  for (const addr in minerClaimsSnapshotData) {
    const claims = minerClaimsSnapshotData[addr];
    const dists = Array.from({ length: claims.length }, () => 0);
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      if (claim) {
        let date = getDateFromSnapshotIndex(i + 1);
        const distDate = nextDayOfWeek(moment.utc(date));
        const distIndex = getTimeIndex(distDate.valueOf());
        if (distIndex < dists.length) {
          // for mock purposes, just claim it all
          dists[distIndex] += 100000000000000;
        }
      }
    }
    dispensationsSnapshot[addr] = dists;
  }
  return { dispensationsSnapshotData: dispensationsSnapshot };
};
