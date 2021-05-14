use std::collections::HashMap;

use super::types::{self, DelegationEvent};
use serde_json::map::Iter;

fn remap_vs_addresses<'a>(
    validator_addresses: types::SnapshotValidatorDataItemMap,
    timeInterval: i64,
) {
    let mapped = validator_addresses.iter().map(
        //   ({ commission: commissionEvents, ...valAddressData }, valStakeAddress) => {
        |(valStakeAddress, snapshotDelegate)| {
            let commissionTimeIntervals = process_commission_events(snapshotDelegate.commission);

            let valDelegateEventsIterator = snapshotDelegate
                .delegates
                .iter()
                .map(|(delegateAddress, delegate)| {
                    delegate
                        .rowan
                        .iter()
                        .enumerate()
                        .map(|(index, amount)| types::DelegationEvent::<'a> {
                            timestamp: (index + 1).into() * timeInterval,
                            commission: &commissionTimeIntervals[index],
                            amount,
                            delegateAddress,
                            validatorSifAddress: valStakeAddress,
                        })
                        .filter(|delegationEvent| delegationEvent.amount != 0.into())
                        .collect::<Vec<types::DelegationEvent>>()
                })
                .filter(|events| events.len() != 0);
            let valDelegateEvents = Iterator::flatten(valDelegateEventsIterator)
                .collect::<Vec<types::DelegationEvent>>();
            return valDelegateEvents;
        },
    );

    let rawEvents = mapped.flatten().collect::<Vec<DelegationEvent>>();
    let eventsByTimeStamp = HashMap::<i64, Vec<&DelegationEvent<'a>>>::new();
    for de in rawEvents.iter() {
        match eventsByTimeStamp.get(de.timestamp) {
            Some(val) => {
                val.push(de);
            }
            None => {}
        };
    }
    let eventsByDelegateByTimestamp = eventsByTimeStamp.iter().map(|(ts, events)| {});
    for (ts, events) in eventsByTimeStamp.iter() {
        let collected = HashMap::<&String, Vec<&&DelegationEvent>>::new();
        events.iter().for_each(|de| {
            match collected.get(de.delegateAddress) {
                Some(val) => {
                    val.push(de);
                }
                None => {
                    collected.insert(de.delegateAddress, vec![de]);
                }
            };
        });
        return (ts, collected);
    }
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

    return rawEvents;
}

fn process_commission_events(commission_events: types::SnapshotTimeSeriesVec) -> Vec<f64> {
    let commission = vec![commission_events[0]];
    commission_events
        .iter_mut()
        .enumerate()
        .for_each(|(index, event)| {
            if event.is_sign_negative() {
                println!("Commission Rate < 0. Needs handling.");
            }
            if event.clone() == 0.0f64 {
                let last_event = commission[index - 1];
                commission.push(last_event);
            } else {
                commission.push(event.clone());
            }
        });
    return commission;
}
