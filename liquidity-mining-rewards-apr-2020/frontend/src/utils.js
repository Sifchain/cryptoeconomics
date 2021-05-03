import moment from 'moment';
import { START_DATETIME } from './config'

export const timestampToDate = timestamp => {
  const start = moment.utc(START_DATETIME)
  const date = start.add(timestamp, 'm')
  return date.toDate()
}

export function getUserData(all, address) {
  return all.map((timestampData) => {
    const userData = timestampData.users[address] || { tickets: [], reservedReward: 0, claimableReward: 0 };
    const userClaimableReward = userData.claimableReward
    const userReservedReward = userData.reservedReward
    return {
      timestamp: timestampData.timestamp, userClaimableReward, userReservedReward
    }
  }).slice(1)
}
