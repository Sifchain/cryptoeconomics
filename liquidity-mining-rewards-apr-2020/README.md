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
There are 2 global reward pools - the locked pool and unlocked pool.

All reward ROWAN starts off locked, in the locked pool. Over time, each period, ROWAN moves from the locked pool to the unlocked pool.

Participants will generate shares in the unlocked pool through their behavior. At the end of the competition, the entire locked pool will be drained into the unlocked pool.

### Liquidity-Deposit Tickets
Each time a user deposits liquidity to a pool during the program, they create an amount of liquidity-deposit tickets equal to the ROWAN value of the deposit made. Users will create new tickets each time they deposit liquidity.

#### Ticket Multiplier
Tickets are non-fungible. Each ticket has a multiplier that grows over time up from 1x to 4x.

#### Ticket Share Generation
Each time period, each ticket generates shares in the unlocked pool based on its multiplier. These shares are attached to the ticket.

#### Claiming rewards
Users can reset their tickets at any time. Whenever tickets are reset, the shares attached will be burned and the user will receive a corresponding portion of the unlocked rewards pool. Reset tickets start with a 1x multiplier again.

#### Withdrawing Liquidity
Whenever a user withdraws their liquidity, they will automatically burn an equivalent amount of tickets to cover the withdrawal. The shares attached to those tickets will also be burned, with the corresponding portion of the unlocked rewards pool going to the user. By default, their tickets and shares will be burned in order from newest tickets to oldest tickets in order to preserve the tickets with the highest multiplier.

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
