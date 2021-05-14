use serde;
use serde::Deserialize;
use std::collections::HashMap;

pub struct DelegationEvent<'a> {
    pub timestamp: &'a i64,
    pub commission: &'a f64,
    pub amount: &'a f64,
    pub delegateAddress: &'a String,
    pub validatorSifAddress: &'a String,
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
