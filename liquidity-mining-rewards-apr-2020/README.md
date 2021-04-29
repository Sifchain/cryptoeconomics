# Overview
This code is responsible for taking a data-services snapshot from that team that contains:
 - All liquidity adds
 - All liquidity removes
for all users from history of chain

The snapshot has those separated into 200minute epochs.

All values for liquidity adds/removes are normalized into Rowan. This normalization has already been done for the snapshots by converting the liquidity currency into Rowan at time of liquidity add/remove.

We want to reward users for keeping liquidity in Sifchain. The calculations logic in these scripts is responsible for parsing the snapshot and calculating how much reward each user should be getting.

This code runs on a lambda function that can be queried to return the total reward amount for a specific user.

# Input Snapshot
An input snapshot example is in snapshots/snapshot_example.json
 - snapshots_new is the name of the table
 - snapshot_data is the actual snapshot data
   - It contains an object entry for each address.
     - Each object contains a mapping from token type to liquidity events
       - Liquidity events is an array of numbers, representing different liquidity add or remove events
         - Each number is a positive (for adds) or negative (for removes) value in amount of ROWAN added or removed during that epoch (during the 200minute period).

Notes to be aware of:
 - Related to snapshot creation:
   - Earlier on, the value of ROWAN vs Asset was very volatile, so there were a lot of crazy outliers in the data with really high or low changes. When creating the snapshot, sometimes an exchange rate from a previous block was used instead of for the exact time when the liquidity add/remove event occurred.

# Liquidity Mining Rewards
There are 30mill ROWAN allocated to this current rewards program. The program started at Betanet launch and will last until May 19th. All liquidity that is added to Sifchain before that date will be eligible for LM Rewards.

The total rewards are split between different liquidity providers based on the proportion of total liquidity in the system that they have been providing over the duration of the program. Additionally, their reward grows the longer they keep their liquidity in the system, up to a maximum of 4 months.

## Detail
### Global pools
All ROWAN starts off locked, in a locked pool. Over time, each period, ROWAN moves from the locked pool to the unlocked pool.

Participants will generate shares in the unlocked pool through their behavior. At the end of the competition, the entire locked pool will be drained into the unlocked pool.

### Liquidity-Deposit Tickets and Deposit Bundles
Each time a user deposits liquidity to a pool during the program, they create a nonfungible asset called a deposit bundle which contains an amount of liquidity-deposit tickets equal to the ROWAN value of the deposit made. Users will create multiple deposit bundles if they deposit liquidity multiple times.

Each bundle has a multiplier that grows over time up to 4x.

Each time period, each bundle generates shares in the unlocked pool for its owner based on its size and multiplier.

Whenever a user wants to withdraw their liquidity, they must burn an equivalent amount of tickets from their bundles to cover the withdrawal. By default, their tickets will be burned from bundles in order from newest bundles to oldest bundle in order to preserve the bundles with the highest multipliers.

### Unlocked Pool Shares
Users can burn their shares at any time to withdraw a corresponding portion of the unlocked pool.

## Calculations

For each user, at any point in time, we want to calculate both of:
 -  Their expected total reward until the end of the program, assuming the amount of tickets across all users stays as is.
 - Their immediate current claimable reward if they were to burn shares to withdraw from the unlocked pool.

We need 2 functions to calculate this.

### Formulas

 <!-- - based on % of total LPs user has been pooling
 - 4 months incentive (121days)
 - claimable reward is what you can claim immediately today
 - reserved reward is your expected total reward if you keep your same liq pooled for full period

For a specific user, their total reward should be calculated as follows:
 - Users accrue rewards -->

## Claiming rewards
Rewards will not be automatically distributed. Users need to burn their unlocked pool shares to claim their rewards.

Each week users can go into the UI and submit a claim transaction to claim their rewards. These transactions will be gathered at the end of each week and then at the end of the week, we will process those claims by calculating each user's share of the unlocked pool with these python scripts and the amount of ROWAN that entitles them to. Then this list of users and their outstanding reward amount will be sent again to the distribution module to trigger the start of the distribution process.
