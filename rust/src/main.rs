use serde_json::Result;
use std::fs;
pub mod config;
mod validator_staking;
use std::time::Instant;

// mod remap_vs_addresses;
fn main() {
    let out = get_processed_vs_data();
    // println!("{}", out.len());

    // process_vs_snapshot();
}

fn get_processed_vs_data() {
    let now = Instant::now();
    let snapshot = crate::load_snapshot_json();
    println!("{}", now.elapsed().as_millis());
    validator_staking::process_data::process_data(snapshot)
    // for (key, val) in data.iter() {
    //     println!("{:?}", &key);
    // }
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
    fn process_vs_test() {
        let processed = crate::get_processed_vs_data();
        println!("{:?}", processed);
    }
}
