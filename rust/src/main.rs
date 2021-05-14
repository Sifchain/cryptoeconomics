use serde_json::Result;
use std::fs;
mod validator_staking;
// mod remap_vs_addresses;
fn main() {
    // process_vs_snapshot();
}

const EVENT_INTERVAL_MINUTES: i32 = 200;

fn remap_vs_addresses() {}

fn get_processed_vs_data(snapshot: validator_staking::types::Snapshot) {
    let v = crate::load_snapshot_json();
    let data = v.data.snapshots_validators[0].snapshot_data.iter();
    for (key, val) in data {
        println!("{:?}", &key)
    }
}

fn load_snapshot_json() -> validator_staking::types::Snapshot {
    let contents = fs::read_to_string("../js/snapshots/snapshot_vs_latest.json")
        .expect("Something went wrong reading the file");
    println!("Contents Length {}", contents.len());
    // Parse the string of data into serde_json::Value.
    serde_json::from_str::<validator_staking::types::Snapshot>(&contents.as_str()).unwrap()
}

#[cfg(test)]
mod tests {
    #[test]
    fn load_snapshot_json_test() {
        let v = crate::load_snapshot_json();
        let data = v.data.snapshots_validators[0].snapshot_data.iter();
        for (key, val) in data {
            println!("{:?}", &key)
        }
    }
}
