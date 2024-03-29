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
Sifchain will run a liquidity mining program. There are 30 million ROWAN being initially allocated to this current rewards program. The eligibility window for the program started on Feb 19 and is set to end on May 14.  All liquidity that is added to Sifchain during the eligibility window will be eligible for LM Rewards. The program may be extended with additional allocations.

The total rewards in the program are split between different liquidity providers and validators based on the proportion of total liquidity in the system that they have been providing over the duration of the program. Their total possible reward grows the longer they keep their liquidity in the system, up to a maximum of 4 months.

## Detail
### Global bucket
There can be multiple global reward buckets that each contain ROWAN to be rewarded across a 4-month time period. Initially, we will start with one bucket, but we may periodically top up with additional buckets as the program continues or is extended.

Reward ROWAN starts off in its global bucket, and as the program progresses will be moved over to individual users as they earn their rewards.

Participants will generate rewards through their behavior. By the end of each bucket's 4 month drain, its entire ROWAN reward will be drained into user rewards.

### Liquidity-Deposit Tickets
Each time a user deposits liquidity to a liquidity pool during the program, they create an amount of liquidity-deposit tickets equal to the ROWAN value of the deposit made. Users will create new tickets each time they deposit liquidity.

#### Ticket Multiplier
Tickets are non-fungible. Each ticket has a multiplier that grows over time up from 25% to 100%.

#### Reward Generation
Each time period, each ticket generates rewards from each global bucket on the basis of 1 share per ticket. The rewards are attached to the ticket.

#### Claiming rewards
Users can claim their rewards at any time by resetting their tickets. Whenever a ticket is reset, it will release its rewards to the user based on its current multiplier. Reset tickets then start empty with a 25% multiplier again.

#### Withdrawing Liquidity
Whenever a user withdraws their liquidity, they will automatically burn an equivalent amount of tickets to cover the withdrawal. The rewards in these tickets will also be automatically claimed, as above. Tickets will be burned in order from lowest multiplier to highest in order to preserve a user's best tickets with highest multipliers.

## Calculations

For each user, at any point in time, we want to calculate both of:
 - Their projected total reward at maturity at the end of the program, assuming the amount of tickets across all users stays as is.
 - Their immediate current claimable reward if they were to reset or burn all their tickets.

### Algorithm
Global state calculation:
```
for each timestep
  for each user
    for each currency
      - on +: create new tickets with 25% multiplier
      - on -: burn worst tickets and release their rewards
      - on claim: reset all tickets and release their rewards
  for each ticket
    process reward accrual
  save new state as global state at timestep
```

Querying a user's immediate claimable reward:
 - Query all tickets for the user at current time
 - Calculate reward if all tickets are reset
 - (Could also do on a per-ticket/per-group-of-tickets basis)

Querying a user's projected final reward:
 - Run the global state calculation as above, but continue loop into future until 4 months past end of program, assuming no events on any future timesteps
 - Sum up final ticket reward amounts for user at end
 - Calculate reward if all tickets are reset at end after 4 months

## Process for claiming rewards
Rewards will not be automatically distributed. Users need to burn or reset their tickets to claim their rewards.

Each week users can go into the UI and submit a claim transaction to claim their rewards. These transactions will be gathered at the end of each week and then at the end of the week, we will process those claims by calculating each user's released rewards with these scripts and the amount of ROWAN that entitles them to. Then this list of users and their reward payouts will be sent again to the distribution module to trigger the start of the distribution process.

# Development
 - Before starting, copy .env.example to .env and update it
 - ```yarn``` - run to install dependencies
 - ```yarn refresh-lm-snapshot``` - to update with latest local lm snapshot (when `LOCAL_SNAPSHOT_DEV_MODE=enabled`)
 - ```yarn refresh-vs-snapshot``` - to update with latest local vs snapshot (when `LOCAL_SNAPSHOT_DEV_MODE=enabled`)
 - ```yarn server``` - to run server
 - ```yarn start``` - to run client

# Deployment

1. Set all environment variables defined in [js/.env.example](js/.env.example).
2. Go to:
[Sifchain/chainOps/actions/workflows/cryptoeconomics_build_and_deployment_pipeline.yml](https://github.com/Sifchain/chainOps/actions/workflows/cryptoeconomics_build_and_deployment_pipeline.yml)
3. Click on "Run workflow" and a dropdown with several options will appear.
4. Enter in the version for this release. Don't worry about any of the other options, these are all set as they should be.
5. Click on the green "Run workflow" button at the bottom of the dropdown and it'll run a deployment (build the image, push the image to docker hub, and deploy the image to k8s - which is available on https://api-cryptoeconomics.sifchain.finance).
6. It won't look like it's running until you refresh the page.
7. Deployed.
