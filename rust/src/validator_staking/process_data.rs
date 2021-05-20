use super::{
    remap_vs_addresses::remap_vs_addresses,
    types::{Snapshot, ValidatorStakingBucketEvent, ValidatorStakingRewardState},
};
use crate::{
    config::{self, Config},
    validator_staking::types::DelegationEvent,
};

use rayon::prelude::*;
use std::{collections::HashMap, vec};

pub fn process_data<'a>(snapshot: Snapshot) {
    let config = Config::new();

    let history = vec![config.VS_INITIAL_REWARD_STATE];
    let delegationEvents = &remap_vs_addresses(snapshot, config.EVENT_INTERVAL_MINUTES);
    for i in 0..(config.NUMBER_OF_INTERVALS_TO_RUN as i64) {
        let timestamp: i64 = i * config.EVENT_INTERVAL_MINUTES as i64;
        let mut userEvents = HashMap::<String, &Vec<&DelegationEvent>>::new();
        for (userAddress, userDelegationEvents) in delegationEvents.iter() {
            for de in userDelegationEvents.iter() {
                if de.timestamp != timestamp {
                    continue;
                }
                let addr = de.delegateAddress.clone();
                let deClone = de.clone();
                match userEvents.get(&de.delegateAddress) {
                    Some(userDelegationEvents) => userDelegationEvents.clone(),
                    None => &&vec![deClone],
                };
            }
        }
    }
}
