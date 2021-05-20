use std::{collections::HashMap, hash::Hash, ops::Add, thread::current, vec};

use super::types::{self, DelegationEvent, User, UserTicketsVec, ValidatorStakingRewardState};
use crate::{
    config,
    validator_staking::types::{UserTicket, ValidatorStakingBucketEvent},
};
use chrono::{DateTime, Duration};
use itertools::Itertools;
use rayon::{
    iter::{
        IndexedParallelIterator, IntoParallelIterator, IntoParallelRefIterator,
        IntoParallelRefMutIterator, ParallelIterator,
    },
    prelude,
    slice::ParallelSliceMut,
};
pub fn process_state<'a>(
    prevState: ValidatorStakingRewardState,
    timestamp: i64,
    events: HashMap<&'a String, Vec<DelegationEvent>>,
) -> &ValidatorStakingRewardState {
    let (rewardBuckets, globalRewardAccrued) = process_reward_buckets(&prevState);
    let users = process_user_tickets_into_new_users(&prevState, globalRewardAccrued);
    let mut nextState = ValidatorStakingRewardState {
        timestamp,
        rewardBuckets,
        users,
        bucketEvent: prevState.bucketEvent,
    };
    process_user_events(nextState, events)
}

pub fn process_user_events<'a>(
    nextState: types::ValidatorStakingRewardState,
    eventsByUser: HashMap<&'a String, Vec<DelegationEvent>>,
) -> &types::ValidatorStakingRewardState {
    let config = config::get();
    let nextState = &nextState;
    for (address, userEvents) in eventsByUser.iter() {
        for de in userEvents.iter() {
            let user = nextState.findUser(de.delegateAddress.clone()).unwrap();
            let prevTickets = user.tickets.to_owned();
            let mut validator = nextState.findOrCreateUser(de.validatorSifAddress);

            if de.amount > 0_f64 {
                let isRedelegation = userEvents.len() > 1
                    && userEvents
                        .par_iter()
                        .any(|otherEvent| otherEvent.amount == -de.amount);
                if !isRedelegation
                    && de.timestamp
                        > (config.DEPOSITS_ALLOWED_DURATION_MS / 1000_f64 / 60_f64) as i64
                {
                    continue;
                }
                let redelegatedTicket = if isRedelegation {
                    prevTickets.par_iter().find_first(|t| t.amount == de.amount)
                } else {
                    None
                };
                let newTicket = UserTicket {
                    mul: match redelegatedTicket {
                        Some(ticket) => ticket.mul,
                        None => 0.25,
                    },
                    reward: 0_f64,
                    commission: de.commission,
                    validatorSifAddress: de.validatorSifAddress.clone(),
                    amount: de.amount,
                    humanReadableTimestamp: config
                        .START_DATETIME
                        .add(Duration::minutes(de.timestamp))
                        .format("%B %_d %Y, %l:%M:%S %P")
                        .to_string(),
                };
                user.tickets.push(newTicket);
            } else if de.amount < 0_f64 {
                let mut currentValidatorTickets: Vec<UserTicket> = vec![];
                let mut foreignValidatorTickets: Vec<UserTicket> = vec![];
                for ticket in user.tickets.iter() {
                    if ticket.validatorSifAddress == de.validatorSifAddress {
                        currentValidatorTickets.push(ticket.to_owned());
                    } else {
                        foreignValidatorTickets.push(ticket.to_owned());
                    }
                }
                let (mut burnedTickets, mut remainingTickets) =
                    burn_tickets(-de.amount, &currentValidatorTickets);
                let (claimed, forfeited) = calculate_claim_reward(burnedTickets);
                user.claimed += claimed * (1_f64 - de.commission);
                validator.claimed += claimed * de.commission;
                validator.commissionClaimedAsValidator += claimed * de.commission;
                user.forfeited += forfeited;
                foreignValidatorTickets.append(&mut remainingTickets);
                let userTickets: Vec<UserTicket> = vec![];
                for item in foreignValidatorTickets.iter() {
                    let ticket = item.to_owned();
                    // let ticket = item.clo
                }
            }
        }
    }
    return nextState;
}

//       if (event.claim) {
//         const { claimed, forfeited } = calculateClaimReward(user.tickets);
//         user.claimed += claimed * (1 - event.commission);
//         validator.claimed += claimed * event.commission;
//         validator.commissionClaimed += claimed * event.commission;
//         user.forfeited += forfeited;
//         user.tickets = resetTickets(user.tickets);
//       }
//     });
//   });
//   return users;
// }

pub fn burn_tickets<'a>(
    amount: f64,
    tickets: &Vec<UserTicket>,
) -> (Vec<UserTicket>, Vec<UserTicket>) {
    let mut sortedTickets = tickets.clone();
    sortedTickets.sort_by_key(|t| (t.mul * 10000_f64) as i64);
    let mut amountLeft = amount.clone();
    let mut burnedTickets: Vec<UserTicket> = vec![];
    let mut remainingTickets: Vec<UserTicket> = vec![];
    for ticket in sortedTickets.iter() {
        if amountLeft == 0_f64 {
            remainingTickets.push(ticket.to_owned());
            continue;
        }
        let amountToRemove = if amountLeft < ticket.amount {
            amountLeft
        } else {
            ticket.amount
        };
        let proportionBurned = if ticket.amount == 0_f64 {
            0_f64
        } else {
            amountToRemove / ticket.amount
        };
        burnedTickets.push(UserTicket {
            mul: ticket.mul,
            reward: proportionBurned * ticket.reward,
            commission: ticket.commission,
            validatorSifAddress: ticket.validatorSifAddress.to_owned(),
            amount: amountToRemove,
            humanReadableTimestamp: ticket.humanReadableTimestamp.to_owned(),
        });
        amountLeft = amountLeft - amountToRemove;
        if amountLeft == 0_f64 {
            remainingTickets.push(UserTicket {
                mul: ticket.mul,
                reward: (1_f64 - proportionBurned) * ticket.reward,
                commission: ticket.commission,
                validatorSifAddress: ticket.validatorSifAddress.to_owned(),
                amount: ticket.amount - amountToRemove,
                humanReadableTimestamp: ticket.humanReadableTimestamp.to_owned(),
            });
        }
    }
    return (burnedTickets.clone(), remainingTickets.clone());
}

pub fn calculate_claim_reward(tickets: Vec<UserTicket>) -> (f64, f64) {
    let mut claimed = 0_f64;
    let forfeited = 0_f64;
    for ticket in tickets.iter() {
        let forfeitedMultiplier = 1_f64 - ticket.mul;
        let reward = ticket.reward;
        claimed = claimed + reward * ticket.mul;
        forfeited = forfeited + reward * forfeitedMultiplier;
    }
    return (claimed, forfeited);
}

// function resetTickets (tickets) {
//   return tickets.map(ticket => ({
//     ...ticket,
//     mul: 0,
//     reward: 0
//   }));
// }

pub fn process_user_tickets_into_new_users<'a>(
    prevState: &ValidatorStakingRewardState,
    globalRewardAccrued: f64,
) -> HashMap<String, User> {
    let config = crate::config::Config::new();
    // process reward accruals and multiplier updates
    let mut totalShares = 0_f64;
    let mut newUsers: HashMap<String, User> = HashMap::new();
    for (address, user) in prevState.users.iter() {
        totalShares += user.tickets.iter().map(|t| t.amount).sum::<f64>();
    }
    for (address, user) in prevState.users.iter() {
        let mut newUserTickets: Vec<UserTicket> = vec![];
        for (index, ticket) in user.tickets.iter().enumerate() {
            let denominator = if totalShares != 0_f64 {
                totalShares
            } else {
                1_f64
            };
            let additionalAmount = (ticket.amount / (denominator)) * globalRewardAccrued;
            let nextMul = ticket.mul + 0.75 / config.MULTIPLIER_MATURITY;
            newUserTickets.push(UserTicket {
                mul: if nextMul > 1_f64 { 1_f64 } else { nextMul },
                reward: ticket.reward + additionalAmount,
                commission: ticket.commission,
                validatorSifAddress: ticket.validatorSifAddress.clone(),
                amount: ticket.amount,
                humanReadableTimestamp: ticket.humanReadableTimestamp.clone(),
            });
        }
        newUsers.insert(
            address.clone(),
            User {
                tickets: newUserTickets,
                claimed: user.claimed,
                dispensed: user.dispensed,
                forfeited: user.forfeited,
                commissionClaimedAsValidator: user.commissionClaimedAsValidator,
                address: user.address.clone(),
            },
        );
    }
    return newUsers;
}

pub fn process_reward_buckets(
    prevState: &ValidatorStakingRewardState,
) -> (Vec<ValidatorStakingBucketEvent>, f64) {
    let mut globalRewardAccrued = 0_f64;
    let mut rewardBuckets: Vec<ValidatorStakingBucketEvent> = vec![];
    for bucket in prevState.rewardBuckets.iter() {
        let accrueAmount = bucket.initialRowan / (bucket.duration - 1_f64);
        globalRewardAccrued += accrueAmount;
        let nextRowan = bucket.rowan - accrueAmount;
        if (nextRowan > 0_f64) {
            rewardBuckets.push(ValidatorStakingBucketEvent {
                rowan: nextRowan,
                initialRowan: bucket.initialRowan,
                duration: bucket.duration,
            });
        }
    }
    match prevState.bucketEvent {
        Some(bucketEvent) => rewardBuckets.push(bucketEvent),
        None => {}
    };
    return (rewardBuckets, globalRewardAccrued);
}
