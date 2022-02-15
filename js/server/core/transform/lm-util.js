const _ = require('lodash');
const configs = require('../../config');
const { getTimeIndex } = require('../../util/getTimeIndex');
const { DelegateEvent } = require('../types');
const moment = require('moment');
const fetch = require('cross-fetch').fetch;
const rewardProgramStartingStates = {
  harvest_expansion: require('../load/starting-states/lm-harvest_expansion-starting-state.json'),
  expansion_bonus: require('../load/starting-states/lm-expansion_bonus-starting-state.json'),
  bonus_v2_luna: require('../load/starting-states/lm-bonus_v2_luna-starting-state.json'),
  expansion_v2_bonus: require('../load/starting-states/lm-expansion_v2_bonus-starting-state.json'),
  expansion_v3_bonus: require('../load/starting-states/lm-expansion_v3_bonus-starting-state.json'),
  expansion_v4_bonus: require('../load/starting-states/lm-expansion_v4_bonus-starting-state.json'),
};

const getLMTimeseriesFinalIndex = (snapshotData) => {
  // Snapshot timeseries (generated by Vanir) overshoots by 1 extra interval. Account for this.
  const finalIndex = [
    ...Object.values(snapshotData).reduce((prev, curr) => {
      Object.values(curr).forEach((val) => {
        if (!val.length) return;
        prev.add(val[val.length - 1][0]);
      });
      return prev;
    }, new Set()),
  ]
    .sort((a, b) => a - b)
    .pop();
  return finalIndex;
};

let smallestTimestampUnix = Infinity;
// Restructure snapshot address liquidity event entries into per-time interval aggregated event form
// (see global-state.md for example)
// let deltaCoeff = 0.000004;
// (async () => {
//   while (true) {
//     console.log({ deltaCoeff });
//     console.log({ deltaCoeff });
//     await new Promise((r) => setTimeout(r, 20000));
//   }
// })();
function remapLMAddresses(addresses, deltaCoeff, rewardProgram) {
  const {
    EVENT_INTERVAL_MINUTES,
    SHOULD_SUBTRACT_WITHDRAWALS_FROM_INITIAL_BALANCE,
    SHOULD_INCLUDE_INITIAL_LIQUIDITY,
    START_DATETIME,
  } = configs[rewardProgram];
  // delete addresses['sif1zdh3jjrfp3jjs5ufccdsk0uml22dgl7gghu98g'];
  const mapped = _.map(addresses, (tokens, address) => {
    const addressTokenEvents = _.map(tokens, (timeIntervals, token) => {
      return timeIntervals
        .map((interval) => {
          smallestTimestampUnix =
            smallestTimestampUnix > interval.unix_timestamp
              ? interval.unix_timestamp
              : smallestTimestampUnix;
          return DelegateEvent.fromJSON({
            timestamp:
              (getTimeIndex(interval.unix_timestamp * 1000, rewardProgram) +
                1) *
              EVENT_INTERVAL_MINUTES,
            amount: interval.delta, //* deltaCoeff,
            delegateAddress: address,
            token: token,
            rawTimestamp: interval.unix_timestamp * 1000,
          });
        })
        .filter((e) => e.amount !== 0);
    }).filter((events) => events.length !== 0);
    return addressTokenEvents;
  });

  let rawEvents = _.flattenDeep(mapped);

  // this only runs when we want liquidity removals to be subtracted from previous liquidity, but not
  // for previous liquidity to be automatically included. i.e. users need to re-add liquidity.
  if (SHOULD_SUBTRACT_WITHDRAWALS_FROM_INITIAL_BALANCE) {
    console.log('subtracting withdrawals from initial balance');
    rawEvents = rawEvents
      .sort((a, b) => a.amount - b.amount)
      .sort((a, b) => a.rawTimestamp - b.rawTimestamp);
    let rawTimestampGroupedEvents = _.groupBy(rawEvents, 'rawTimestamp');
    _.mapValues(rawTimestampGroupedEvents, (timeIntervalEvents) => {
      return timeIntervalEvents.map((event) => {
        if (event.amount < 0) {
          const subtractMaxFromUserPool = (token) => {
            // initial token balances for all users
            const tokenBalances =
              rewardProgramStartingStates[rewardProgram][token];
            // initial token balance for current user
            const remainingInitialRemovableBalance = tokenBalances
              ? tokenBalances[event.delegateAddress] || 0
              : 0;
            // normalized initial token balance for user
            const convertedVal = +remainingInitialRemovableBalance / 10 ** 18;
            // subtract (add the negative) the withdrawal amount from the initial amount
            let amountRemainingAfterRemoval = convertedVal + event.amount;
            // if the result is negative, the withdrawal exceeded the initial amount
            if (amountRemainingAfterRemoval < 0) {
              // if the token existed at the starting time
              if (rewardProgramStartingStates[rewardProgram][token])
                // the initial amount has now been zero'ed out
                rewardProgramStartingStates[rewardProgram][token][
                  event.delegateAddress
                ] = 0;
              // the remaining withdrawal = the amount that it exceeded the initial amount
              event.amount = amountRemainingAfterRemoval;
            } else {
              // if the token existed at program genesis
              if (rewardProgramStartingStates[rewardProgram][token])
                // if there is a positive amount remaining, set to that positive amount.
                rewardProgramStartingStates[rewardProgram][token][
                  event.delegateAddress
                ] = BigInt(
                  Math.floor(amountRemainingAfterRemoval * 10 ** 18)
                ).toString();
              // the withdrawal is covered by the initial amount
              event.amount = 0;
            }
          };
          // if the event doesn't have a pool
          if (event.token === 'rowan') {
            // guess that the pool is the first non-rowan token that this user also removed
            const externalAssetEvents =
              timeIntervalEvents.length > 1
                ? timeIntervalEvents.filter(
                    (ev) =>
                      ev.token !== 'rowan' &&
                      ev.amount < 0 &&
                      ev.delegateAddress === event.delegateAddress
                  )
                : [];
            // if there is a non-rowan withdrawal
            if (externalAssetEvents.length) {
              // subtract this rowan amount from those
              while (event.amount < 0 && externalAssetEvents.length) {
                subtractMaxFromUserPool(externalAssetEvents.pop().token);
              }
            } else {
              for (let tokenKey in rewardProgramStartingStates[rewardProgram]) {
                if (
                  rewardProgramStartingStates[rewardProgram][tokenKey][
                    event.delegateAddress
                  ] > 0
                ) {
                  subtractMaxFromUserPool(tokenKey);
                }

                if (event.amount === 0) {
                  break;
                }
              }
            }
          } else {
            subtractMaxFromUserPool(event.token);
          }
        }
      });
    });
  }

  const startingState = rewardProgramStartingStates[rewardProgram];
  if (SHOULD_INCLUDE_INITIAL_LIQUIDITY && !!startingState) {
    console.log('including initial liquidity!!!!');
    const addressList = [
      ...new Set(
        Object.values(startingState).reduce((prev, curr) => {
          prev.push(...Object.keys(curr));
          return prev;
        }, [])
      ),
    ];
    for (let address of addressList) {
      let sum = 0n;

      for (let token in startingState) {
        const initialAmount = startingState[token][address];
        sum += BigInt(initialAmount || 0);
      }
      rawEvents.unshift(
        DelegateEvent.fromJSON({
          timestamp:
            (getTimeIndex(START_DATETIME, rewardProgram) + 1) *
            EVENT_INTERVAL_MINUTES,
          amount: +sum.toString() / 1e18, //* deltaCoeff,
          delegateAddress: address,
          token: 'rowan',
        })
      );
    }
  }
  let allTimeIntervalEvents = _.groupBy(rawEvents, 'timestamp');
  allTimeIntervalEvents = _.mapValues(
    allTimeIntervalEvents,
    (timeIntervalEvents) => {
      return timeIntervalEvents.map((event) => {
        event.clearTimestamp();
        return event;
      });
    }
  );

  let allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalEvents,
    (timeIntervalEvents) => {
      return _.groupBy(timeIntervalEvents, 'delegateAddress');
    }
  );

  allTimeIntervalAddressEvents = _.mapValues(
    allTimeIntervalAddressEvents,
    (timeIntervalAddressEvents, timeInterval) => {
      return _.mapValues(
        timeIntervalAddressEvents,
        (addressEvents, address) => {
          if (SHOULD_SUBTRACT_WITHDRAWALS_FROM_INITIAL_BALANCE) {
            addressEvents = addressEvents.sort((a, b) => {
              return a.rawTimestamp - b.rawTimestamp;
            });
          }
          return [
            DelegateEvent.fromJSON({
              timestamp: parseInt(timeInterval),
              delegateAddress: address,
              amount: addressEvents.reduce((accum, addressEvent) => {
                const nextVal = accum + parseFloat(addressEvent.amount);
                return nextVal;
              }, 0),
            }),
          ];
        }
      );
    }
  );

  return allTimeIntervalAddressEvents;
}

function createClaimEvents(addresses, rewardProgram) {
  const { EVENT_INTERVAL_MINUTES } = configs[rewardProgram];
  const claimEventsByUserByTimestamp = {};
  for (const addr in addresses) {
    const claimEventsTimeSeries = addresses[addr];
    for (let item of claimEventsTimeSeries) {
      const timelineIndex = getTimeIndex(item.unix * 1000, rewardProgram);
      const didClaim = true;
      const timestamp = (1 + timelineIndex) * EVENT_INTERVAL_MINUTES;
      claimEventsByUserByTimestamp[timestamp] =
        claimEventsByUserByTimestamp[timestamp] || {};
      if (didClaim) {
        claimEventsByUserByTimestamp[timestamp][addr] = true;
      }
    }
  }
  return claimEventsByUserByTimestamp;
}

function createDispensationEvents(addresses, rewardProgram) {
  const { EVENT_INTERVAL_MINUTES } = configs[rewardProgram];

  const dispensationEventsByUserByTimestamp = {};
  for (const addr in addresses) {
    const dispensationEventsTimeSeries = addresses[addr];
    for (let i = 0; i < dispensationEventsTimeSeries.length; i++) {
      const item = dispensationEventsTimeSeries[i];
      const amountToDistribute = item.amount;
      const timelineIndex = getTimeIndex(item.timestamp, rewardProgram);
      const timestamp = (timelineIndex + 1) * EVENT_INTERVAL_MINUTES;
      dispensationEventsByUserByTimestamp[timestamp] =
        dispensationEventsByUserByTimestamp[timestamp] || {};
      if (amountToDistribute) {
        dispensationEventsByUserByTimestamp[timestamp][addr] =
          amountToDistribute;
      }
    }
  }
  return dispensationEventsByUserByTimestamp;
}

module.exports = {
  remapLMAddresses,
  createClaimEvents,
  createDispensationEvents,
  getLMTimeseriesFinalIndex,
};
