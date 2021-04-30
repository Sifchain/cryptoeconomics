```javascript
const ExampleGlobalState = [{
  timestamp: 200,
  state: {
    rewardBuckets: [
      { rowan: 30000000, rewardPerTimestamp: 34435.261708 } // 871.2 200min period or 121 days
    ],
    users: {
      'sif...': {
        tickets: [
          {
            size: 7,
            multiplier: 0.25,
            reward: 200
          }
        ],
        claimedReward: 1000
        dispensedReward: 100
      }
    }
  },
  events: [
    {
      address: 'sif...',
      amount: 23, // or -23
      claim: false // or true
    }],
}]
```
