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

We want to calculate both of:
 <!-- - The expected total reward for each user assuming they leave their liquidity as is until the end of the program
 - ?the claimable reward? The expected total reward of each user assuming they remove all their liquidity immediately. Is this even claimable? -->

## Formula for calculating all user rewards

 <!-- - based on % of total LPs user has been pooling
 - 4 months incentive (121days)
 - claimable reward is what you can claim immediately today
 - reserved reward is your expected total reward if you keep your same liq pooled for full period

For a specific user, their total reward should be calculated as follows:
 - Users accrue rewards -->

# Claims process
Rewards will not be automatically distributed. Users need to claim their rewards.

Each week users can go into the UI and submit a claim transaction to claim their rewards. These transactions will be gathered at the end of each week and then at the end of the week, we will process those claims by calculating each users unpaid reward with these python scripts and then the list of users and their outstanding reward amount will be sent again to the distribution module to trigger the start of the distribution process.

# Todo
<!-- clarify/double check below example and considerations:

on may 20 we set max for each user as their pooled amount and global max

if a user withdraws liq below their personal max, this drops the user's max and the global max

May 20 40M total LP
May 20 i had 2M liq. so now my max is 2M for the last month.
May 21 I withdraw 500k. now my multiplier is based on having only 1.5M
May 21 I add 100M liq
May 23 I remove 100M liq
May 30 60M total LP -->
