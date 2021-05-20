use rayon::{iter::*, prelude};
use serde;
use serde::Deserialize;
use std::collections::HashMap;
use std::marker::PhantomData;
#[derive(Deserialize, Debug)]
pub struct ValidatorStakingBucketEvent {
    pub rowan: f64,
    pub initialRowan: f64,
    pub duration: f64,
}

#[derive(Deserialize, Debug, Clone)]
pub struct UserTicket {
    pub mul: f64,
    pub reward: f64,
    pub commission: f64,
    pub validatorSifAddress: String,
    pub amount: f64,
    pub humanReadableTimestamp: String,
}

pub type UserTicketsVec = Vec<UserTicket>;
#[derive(Deserialize, Debug)]
pub struct User {
    pub tickets: UserTicketsVec,
    pub claimed: f64,
    pub dispensed: f64,
    pub forfeited: f64,
    pub commissionClaimedAsValidator: f64,
    pub address: String,
}

impl User {
    /// Get a mutable reference to the user's tickets.
    pub fn tickets_mut(&mut self) -> &mut UserTicketsVec {
        &mut self.tickets
    }
}

#[derive(Deserialize, Debug)]
pub struct ValidatorStakingRewardState {
    pub timestamp: i64,
    pub rewardBuckets: Vec<ValidatorStakingBucketEvent>,
    pub users: HashMap<String, User>,
    pub bucketEvent: Option<ValidatorStakingBucketEvent>,
}

impl ValidatorStakingRewardState {
    pub fn findUser(mut self, addr: String) -> Option<&'static User> {
        self.users.get(&addr)
    }
    pub fn findOrCreateUser(mut self, addr: String) -> &'static User {
        match self.findUser(addr) {
            Some(u) => u,
            None => {
                let user = User {
                    tickets: vec![],
                    claimed: 0_f64,
                    dispensed: 0_f64,
                    forfeited: 0_f64,
                    commissionClaimedAsValidator: 0_f64,
                    address: addr,
                };
                self.users.insert(addr, user);
                &user
            }
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct DelegationEvent {
    pub timestamp: i64,
    pub commission: f64,
    pub amount: f64,
    pub delegateAddress: String,
    pub validatorSifAddress: String,
}

pub type SnapshotTimeSeriesVec = Vec<f64>;

#[derive(Deserialize, Debug)]
pub struct SnapshotDelegate {
    pub rowan: SnapshotTimeSeriesVec,
}
pub type SnapshotDateItemDelegateMap = HashMap<String, SnapshotDelegate>;
#[derive(Deserialize, Debug)]
pub struct SnapshotDataItem {
    pub commission: SnapshotTimeSeriesVec,
    #[serde(flatten)]
    pub delegates: SnapshotDateItemDelegateMap,
}

pub type SnapshotValidatorDataItemMap = HashMap<String, SnapshotDataItem>;
#[derive(Deserialize, Debug)]
pub struct SnapshotValidator {
    pub snapshot_data: SnapshotValidatorDataItemMap,
}
#[derive(Deserialize, Debug)]
pub struct SnapshotGraphQLData {
    pub snapshots_validators: Vec<SnapshotValidator>,
}
#[derive(Deserialize, Debug)]
pub struct Snapshot {
    pub data: SnapshotGraphQLData,
}
