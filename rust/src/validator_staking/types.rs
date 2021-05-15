use serde;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize, Debug)]
pub struct ValidatorStakingBucketEvent {
    pub rowan: f64,
    pub initialRowan: f64,
    pub duration: f64,
}

#[derive(Deserialize, Debug)]
pub struct UserTicket {
    pub mul: f64,
    pub reward: f64,
    pub commission: f64,
    pub validatorSifAddress: String,
    pub amount: f64,
    pub humanReadableTimestamp: String,
}

#[derive(Deserialize, Debug)]
pub struct User {
    pub tickets: Vec<UserTicket>,
    pub claimed: f64,
    pub dispensed: f64,
    pub forfeited: f64,
    pub commissionClaimedAsValidator: f64,
}

#[derive(Deserialize, Debug)]
pub struct ValidatorStakingRewardState {
    pub timestamp: i64,
    pub rewardBuckets: Vec<ValidatorStakingBucketEvent>,
    pub users: HashMap<String, User>,
    // users: {
    //   /*
    //   [*]: {

    //   }
    //   */
    // },
    pub bucketEvent: Option<ValidatorStakingBucketEvent>,
}

#[derive(Deserialize, Debug)]
pub struct DelegationEvent {
    pub timestamp: i64,
    pub commission: f64,
    pub amount: f64,
    pub delegateAddress: String,
    pub validatorSifAddress: String,
}

pub type EventsByUser = HashMap<String, Vec<DelegationEvent>>;

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
