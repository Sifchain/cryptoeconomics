module.exports.mockMinerClaims = function mockMinerClaims(snapshot) {
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
          const amountDeltas = Object.values(val).reduce((prev, curr) => {
            return curr.map((currItem, index) => {
              const val = prev[index] || 0;
              return currItem + val;
            });
          });
          const claims = Array.from({ length: amountDeltas.length }, () => 0);
          // const dispensations = Array.from(
          //   { length: amountDeltas.length },
          //   () => 0
          // );
          // let lastDispensedAt = 0;
          amountDeltas.forEach((aD, index) => {
            if (aD == 0) return;
            const daysInMinutes = 24 * 60;
            const intervalCountUntilMockClaim = ~~((30 * daysInMinutes) / 200);
            const claimIndex = Math.max(
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
    distributionsSnapshot: {
      data: {
        snapshots_lm_claims: [
          {
            addr: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
          },
        ],
      },
    },
  };
};
