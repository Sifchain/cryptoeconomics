use std::collections::HashMap;

use rayon::iter::{IntoParallelRefIterator, ParallelIterator};

use super::types::{self, DelegationEvent};

pub fn remap_vs_addresses<'a>(
    snapshot: types::Snapshot,
    timeInterval: f64,
) -> HashMap<&'a String, Vec<DelegationEvent>> {
    let allDelegationEvents = HashMap::new();
    snapshot.data.snapshots_validators[0]
        .snapshot_data
        .par_iter()
        .for_each(move |(valStakeAddress, snapshotDataItem)| {
            let commissionTimeIntervals: Vec<f64> = process_commission_events(snapshotDataItem);

            let valDelegateEventsIterator = snapshotDataItem
                .delegates
                .iter()
                .map(move |(delegateAddress, delegate)| {
                    delegate
                        .rowan
                        .iter()
                        .enumerate()
                        .map(|(index, amount)| types::DelegationEvent {
                            timestamp: ((index + 1) as i64 * (timeInterval as i64)),
                            commission: commissionTimeIntervals[index].clone(),
                            amount: amount.clone(),
                            delegateAddress: delegateAddress.clone(),
                            validatorSifAddress: valStakeAddress.clone(),
                        })
                        .filter(|delegationEvent| delegationEvent.amount != 0f64)
                        .collect::<Vec<types::DelegationEvent>>()
                })
                .filter(|events| events.len() != 0);
            let valDelegateEvents = Iterator::flatten(valDelegateEventsIterator)
                .collect::<Vec<types::DelegationEvent>>();
            allDelegationEvents.insert(valStakeAddress, valDelegateEvents);
        });

    // .collect::<Vec<(f64, std::result::Iter<&types::DelegationEvent>)>>()
    // .map(|(ts, deVec)| {
    //     return (
    //         ts,
    //         itertools::Itertools::group_by(deVec.iter(), |de| de.delegateAddress),
    //     );
    // });

    // allTimeIntervalAddressEvents = _.mapValues(
    //   allTimeIntervalAddressEvents,
    //   (timeIntervalAddressEvents, timeInterval) => {
    //     return _.map(
    //       timeIntervalAddressEvents,
    //       (addressEvents, delegateAddress) => {
    //         return addressEvents.map(addressEvent => {
    //           return {
    //             ...addressEvent,
    //             timestamp: parseInt(timeInterval),
    //             delegateAddress
    //           };
    //         });
    //       }
    //     );
    //   }
    // );

    return allDelegationEvents;
}

fn process_commission_events(snapshotDataItem: &types::SnapshotDataItem) -> Vec<f64> {
    let mut commission = vec![snapshotDataItem.commission[0]];
    for (index, event) in snapshotDataItem.commission.iter().enumerate() {
        if event.is_sign_negative() {
            println!("Commission Rate < 0. Needs handling.");
        }
        if event.clone() == 0.0f64 {
            let last_event = commission.last().unwrap().clone();
            commission.push(last_event);
        } else {
            commission.push(event.clone());
        }
    }
    return commission;
}
