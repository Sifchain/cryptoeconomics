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
Sifchain will run a liquidity mining. There is 30mill ROWAN being initially allocated to this current rewards program. The program started at Betanet launch and will last at least 4 months. All liquidity that is added to Sifchain during the period will be eligible for LM Rewards. The program may be extended with additional allocations.

The total rewards in the program are split between different liquidity providers and validators based on the proportion of total liquidity in the system that they have been providing over the duration of the program. Their total possible reward grows the longer they keep their liquidity in the system, up to a maximum of 4 months.

## Detail
### Global pools
There can be multiple global reward pools that each contain ROWAN to be rewarded across a 4-month time period. Initially, we will start with one pool, but we may periodically top up with additional pools as the program continues or is extended.

Reward ROWAN starts off in its global pool, and as the program progresses will be moved over to individual users as they earn their rewards.

Participants will generate rewards through their behavior. By the end of each pool's 4 month drain, its entire ROWAN reward will be drained into user reward.

### Liquidity-Deposit Tickets
Each time a user deposits liquidity to a pool during the program, they create an amount of liquidity-deposit tickets equal to the ROWAN value of the deposit made. Users will create new tickets each time they deposit liquidity.

#### Ticket Multiplier
Tickets are non-fungible. Each ticket has a multiplier that grows over time up from 25% to 100%.

#### Reward Generation
Each time period, each ticket generates rewards from the global pools based on its multiplier. The rewards are attached to the ticket.

#### Claiming rewards
Users can claim their rewards at any time by resetting their tickets. Whenever a ticket is reset, it will release its rewards to the user based on its current multiplier. Reset tickets then start empty with a 25% multiplier again.

#### Withdrawing Liquidity
Whenever a user withdraws their liquidity, they will automatically burn an equivalent amount of tickets to cover the withdrawal. The rewards in these tickets will be automatically claimed, as above, and the tickets will be burned. By default, their tickets will be burned in order from lowest multiplier to highest in order to preserve their best tickets with highest multipliers.

## Calculations

For each user, at any point in time, we want to calculate both of:
 -  Their expected total reward until the end of the program, assuming the amount of tickets across all users stays as is.
 - Their immediate current claimable reward if they were to burn shares to withdraw from the unlocked pool.

We need 2 functions to calculate this.

### Algorithm
Global state calculation:
```
for each timestep
  for each user
    for each currency
      - on +: create new tickets with 1x multiplier
      - on -: burn lowest tickets and their shares
      - on claim: reset lowest tickets and burn their shares
  for each ticket
    process share generation and ticket growth
  move rowan from locked pool to unlocked pool
  save new state as global state at timestep
```

Querying a user's immediate claimable reward:
 - Query all tickets for the user at current time
 - Calculate reward if all tickets are reset
 - (Could also do on a per-ticket/per-group-of-tickets basis)

Querying a user's projected final reward:
 - Run the global state calculation as above, but continue loop into future until end of program, assuming no events on any future timesteps
 - Sum up final share amounts for user at end
 - Calculate reward if all shares are burned at end

## Process for claiming rewards
Rewards will not be automatically distributed. Users need to burn their unlocked pool shares to claim their rewards.

Each week users can go into the UI and submit a claim transaction to claim their rewards. These transactions will be gathered at the end of each week and then at the end of the week, we will process those claims by calculating each user's share of the unlocked pool with these python scripts and the amount of ROWAN that entitles them to. Then this list of users and their outstanding reward amount will be sent again to the distribution module to trigger the start of the distribution process.
