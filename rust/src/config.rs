use std::{collections::HashMap, marker::PhantomData};

use chrono::{Date, DateTime, TimeZone, Utc};
use math;

use crate::validator_staking::types::{ValidatorStakingBucketEvent, ValidatorStakingRewardState};
/*
  - The network was started prior to the DEX launch. There is roughly ~week worth of blocks that had no meaningful transactions as the product was not launched.
    Because the snapshots start at the genesis block, they include that week of null activity epochs. This has an impact on the reward distribution. The changes we make to the snapshot will remove those null epochs and balance out the rewards distribution.
    Because we are extending the program to June 30th(initially ended ~May 14th) there was initially a 6 week accumulation period after the official end of the program. So users could accumulate rewards up until ~June 19th.
  - We decided to extend the program eligibility to June 30th, but did not extend the accumulation of reward period relative to the same rules that were implemented when we started the program.
    Extending to August 4th will maintain our initial program details that were communicated to the community
*/
pub struct Config {
    // Rewards begin accruing
    pub START_DATETIME: DateTime<Utc>,
    // Deposits are cut off earlier on
    pub DEPOSIT_CUTOFF_DATETIME: DateTime<Utc>,
    // But they can continue to accrue rewards until the final end date
    pub END_OF_REWARD_ACCRUAL_DATETIME: DateTime<Utc>,
    // Snapshot of all Validator events is split into 200 minute intervals (https://github.com/Sifchain/Vanir/issues/13)
    pub EVENT_INTERVAL_MINUTES: f64,
    // Amount of time that users can accrue rewards
    pub REWARD_ACCRUAL_DURATION_MS: f64,
    // Amount of time that users can deposit with opportunity to gain rewards
    pub DEPOSITS_ALLOWED_DURATION_MS: f64,
    // Amount of 200min intervals before users can no-longer gain rewards
    pub REWARD_ACCRUAL_DURATION_INTERVAL_COUNT: f64,
    // 4 months in in 200minute intervals,
    pub MULTIPLIER_MATURITY: f64,
    // duration of bucket drain + duration to latest possible multiplier maturity
    pub NUMBER_OF_INTERVALS_TO_RUN: f64,
    pub VS_INITIAL_REWARD_STATE: ValidatorStakingRewardState,
}

impl Config {
    pub fn new() -> Config {
        let START_DATETIME = Utc.ymd(2021, 2, 19).and_hms_milli(6, 48, 43, 0);
        let DEPOSIT_CUTOFF_DATETIME = Utc.ymd(2021, 6, 30).and_hms_milli(23, 59, 59, 0);
        let END_OF_REWARD_ACCRUAL_DATETIME = Utc.ymd(2021, 8, 4).and_hms_milli(23, 59, 59, 0);
        let EVENT_INTERVAL_MINUTES = 200_f64;
        let REWARD_ACCRUAL_DURATION_MS = (END_OF_REWARD_ACCRUAL_DATETIME.timestamp_millis()
            - START_DATETIME.timestamp_millis()) as f64;
        let DEPOSITS_ALLOWED_DURATION_MS =
            (DEPOSIT_CUTOFF_DATETIME.timestamp_millis() - START_DATETIME.timestamp_millis()) as f64;
        let REWARD_ACCRUAL_DURATION_INTERVAL_COUNT = math::round::floor(
            REWARD_ACCRUAL_DURATION_MS / 1000_f64 / 60_f64 / EVENT_INTERVAL_MINUTES,
            0,
        );
        let MULTIPLIER_MATURITY = 864_f64;
        let NUMBER_OF_INTERVALS_TO_RUN = REWARD_ACCRUAL_DURATION_INTERVAL_COUNT + 864_f64;
        let VS_INITIAL_REWARD_STATE = ValidatorStakingRewardState {
            timestamp: -1,
            rewardBuckets: vec![],
            bucketEvent: Some(ValidatorStakingBucketEvent {
                rowan: 45_000_000f64,
                initialRowan: 45_000_000f64,
                duration: REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
            }),
            users: HashMap::new(),
        };
        Config {
            START_DATETIME,
            DEPOSIT_CUTOFF_DATETIME,
            END_OF_REWARD_ACCRUAL_DATETIME,
            EVENT_INTERVAL_MINUTES,
            REWARD_ACCRUAL_DURATION_MS,
            DEPOSITS_ALLOWED_DURATION_MS,
            REWARD_ACCRUAL_DURATION_INTERVAL_COUNT,
            MULTIPLIER_MATURITY,
            NUMBER_OF_INTERVALS_TO_RUN,
            VS_INITIAL_REWARD_STATE,
        }
    }
}

pub fn get() -> Config {
    return Config::new();
}
